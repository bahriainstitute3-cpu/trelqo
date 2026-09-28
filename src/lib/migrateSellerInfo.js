// src/lib/migrateSellerInfo.js
//
// ONE-TIME MIGRATION SCRIPT
// Backfills seller info (ownerName, ownerEmail, sellerPhone, payment details)
// into OLD orders whose items were saved before the orders.js fix.
//
// HOW TO RUN:
// 1. Temporarily import this in AdminOrders.jsx:
//      import { migrateOldOrdersSellerInfo } from "../../lib/migrateSellerInfo";
// 2. Add a temporary button somewhere in the admin page:
//      <button onClick={() => migrateOldOrdersSellerInfo()}>Run Migration (once)</button>
// 3. Click it ONCE while logged in as admin. Watch the browser console for progress/results.
// 4. After it finishes and you confirm orders are fixed, REMOVE the button and this import.
//    (Keep this file around in case you ever need to re-run it.)
//
// SAFE TO RE-RUN: it only touches items that are missing seller info —
// orders that are already fixed (new orders) are skipped automatically.

import { collection, getDocs, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export async function migrateOldOrdersSellerInfo() {
  console.log("🔄 Starting seller-info migration for old orders...");

  const ordersSnap = await getDocs(collection(db, "orders"));
  console.log(`Found ${ordersSnap.size} total orders.`);

  const productCache = new Map(); // avoid re-fetching same product repeatedly

  async function getProductCached(productId) {
    if (!productId) return null;
    if (productCache.has(productId)) return productCache.get(productId);
    try {
      const snap = await getDoc(doc(db, "products", productId));
      const data = snap.exists() ? snap.data() : null;
      productCache.set(productId, data);
      return data;
    } catch (err) {
      console.error(`  ⚠️ Could not fetch product ${productId}:`, err.message);
      productCache.set(productId, null);
      return null;
    }
  }

  let ordersChecked = 0;
  let ordersUpdated = 0;
  let itemsFixed = 0;
  let itemsSkippedNoProduct = 0;

  for (const orderDoc of ordersSnap.docs) {
    ordersChecked++;
    const order = orderDoc.data();
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) continue;

    let orderNeedsUpdate = false;

    const newItems = await Promise.all(
      items.map(async (item) => {
        // Already has seller info? Skip — this order is already fine.
        const hasSellerInfo =
          item.ownerEmail || item.ownerName || item.sellerPhone;
        if (hasSellerInfo) return item;

        const product = await getProductCached(item.productId);
        if (!product) {
          itemsSkippedNoProduct++;
          return item; // product deleted or missing — leave item as-is
        }

        orderNeedsUpdate = true;
        itemsFixed++;

        return {
          ...item,
          ownerEmail: product.ownerEmail || "",
          ownerName: product.ownerName || product.sellerName || "",
          sellerPhone: product.sellerPhone || "",
          sellerPaymentMethod: product.sellerPaymentMethod || "",
          sellerAccountTitle: product.sellerAccountTitle || "",
          sellerAccountNumber: product.sellerAccountNumber || "",
          sellerBankName: product.sellerBankName || "",
        };
      })
    );

    if (orderNeedsUpdate) {
      await updateDoc(doc(db, "orders", orderDoc.id), { items: newItems });
      ordersUpdated++;
      console.log(`✅ Updated order ${order.orderNumber || orderDoc.id}`);
    }
  }

  console.log("🎉 Migration complete.");
  console.log(`   Orders checked: ${ordersChecked}`);
  console.log(`   Orders updated: ${ordersUpdated}`);
  console.log(`   Items fixed:    ${itemsFixed}`);
  if (itemsSkippedNoProduct > 0) {
    console.log(`   ⚠️ Items skipped (product no longer exists): ${itemsSkippedNoProduct}`);
  }

  return { ordersChecked, ordersUpdated, itemsFixed, itemsSkippedNoProduct };
}