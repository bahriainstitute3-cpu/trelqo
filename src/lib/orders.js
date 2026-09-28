import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { createNotification } from "./notifications";
import { sendSellerOrderEmail, sendAdminOrderEmail } from "./email";
import { PRIVILEGED_EMAILS } from "./allowedEmails";

const ordersCol = collection(db, "orders");

const ADMIN_EMAIL = "anusch2026@gmail.com";

export const ORDER_STATUSES = [
  "pending", "confirmed", "processing", "packed",
  "shipped", "out_for_delivery", "delivered", "cancelled", "returned",
];

export async function placeOrder({ userId, customerName, customerEmail, items, address, paymentMethod, subtotal, deliveryCharge, discount, total }) {
  const result = await runTransaction(db, async (tx) => {
    const itemsWithSellerInfo = [];

    const productRefs = items.map((item) => doc(db, "products", item.productId));
    const productSnaps = await Promise.all(productRefs.map((pRef) => tx.get(pRef)));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pSnap = productSnaps[i];
      if (!pSnap.exists()) throw new Error(`Product ${item.name} no longer exists`);
      const stock = pSnap.data().stock || 0;
      if (stock < item.qty) throw new Error(`Not enough stock for ${item.name}`);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pRef = productRefs[i];
      const pData = productSnaps[i].data();
      // NEW — soldCount track hota hai taake home page par "X products buye" dikh sake
      tx.update(pRef, { stock: pData.stock - item.qty, soldCount: (pData.soldCount || 0) + item.qty });
      itemsWithSellerInfo.push({
        ...item,
        ownerEmail: pData.ownerEmail || "",
        ownerName: pData.ownerName || pData.sellerName || "",
        sellerPhone: pData.sellerPhone || "",
        sellerPaymentMethod: pData.sellerPaymentMethod || "",
        sellerAccountTitle: pData.sellerAccountTitle || "",
        sellerAccountNumber: pData.sellerAccountNumber || "",
        sellerBankName: pData.sellerBankName || "",
      });
    }

    const orderRef = doc(ordersCol);
    const orderNumber = "SH" + Date.now().toString().slice(-8);
    tx.set(orderRef, {
      orderNumber,
      userId,
      customerName: customerName || "",
      customerEmail: customerEmail || "",
      items: itemsWithSellerInfo,
      address,
      paymentMethod,
      paymentStatus: "pending",
      subtotal,
      deliveryCharge,
      discount,
      total,
      status: "pending",
      statusHistory: [{ status: "pending", at: new Date().toISOString() }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: orderRef.id, orderNumber, itemsWithSellerInfo };
  });

  notifyOrderParties({
    id: result.id,
    orderNumber: result.orderNumber,
    customerName,
    customerEmail,
    items: result.itemsWithSellerInfo,
    address,
    total,
    paymentMethod,
  }).catch((err) => console.error("Order notifications/emails failed:", err));

  return { id: result.id, orderNumber: result.orderNumber };
}

async function notifyOrderParties({ id, orderNumber, customerName, customerEmail, items, address, total, paymentMethod }) {
  const fullProductList = items.map((i) => `${i.name} x${i.qty}`).join(", ");

  const notificationJobs = [
    ...(customerEmail ? [createNotification({
      recipientEmail: customerEmail,
      type: "order",
      title: "Order Placed!",
      message: `Your order ${orderNumber} (Rs ${total.toLocaleString()}) has been placed.`,
      link: `/orders/${id}`,
    })] : []),
    ...PRIVILEGED_EMAILS.map((adminEmail) => createNotification({
      recipientEmail: adminEmail,
      type: "order",
      title: "New Order Placed!",
      message: `${customerName || "A customer"} placed order ${orderNumber} (Rs ${total.toLocaleString()}) — ${fullProductList}`,
      link: `/orders/${id}`,
    })),
  ];

  const notificationResults = await Promise.allSettled(notificationJobs);
  notificationResults
    .filter((result) => result.status === "rejected")
    .forEach((result) => console.error("Order notification failed:", result.reason));

  const productListWithSellers = items
    .map((i) => `${i.name} x${i.qty} (Rs ${(i.price * i.qty).toLocaleString()}) — Seller: ${i.ownerName || i.ownerEmail || "Unknown"}`)
    .join("\n");

  await sendAdminOrderEmail({
    to_email: ADMIN_EMAIL,
    order_number: orderNumber,
    product_list:
      `ORDER #${orderNumber}\n\n` +
      `PRODUCTS:\n${productListWithSellers}\n\n` +
      `TOTAL: Rs ${total.toLocaleString()}\n` +
      `PAYMENT METHOD: ${paymentMethod}\n\n` +
      `CUSTOMER DETAILS:\n` +
      `Name: ${customerName || "—"}\n` +
      `Phone: ${address.phone || "—"}\n` +
      `Email: ${customerEmail || address.email || "—"}\n` +
      `Address: ${address.address || "—"}, ${address.city || "—"}${address.area ? ", " + address.area : ""}${address.postalCode ? ", " + address.postalCode : ""}`,
    customer_name: customerName || "Customer",
    customer_phone: address.phone || "",
    total: `Rs ${total.toLocaleString()}`,
    delivery_address: `${address.address || ""}, ${address.city || ""}`,
    payment_method: paymentMethod,
  });

  const sellerEmails = [...new Set(items.map((i) => i.ownerEmail).filter(Boolean))];
  for (const sellerEmail of sellerEmails) {
    const sellerItems = items.filter((i) => i.ownerEmail === sellerEmail);
    const sellerProductList = sellerItems.map((i) => `${i.name} x${i.qty}`).join(", ");
    const sellerTotal = sellerItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    await createNotification({
      recipientEmail: sellerEmail,
      type: "order",
      title: "New Order Received!",
      message: `${customerName || "A customer"} ordered: ${sellerProductList}`,
      link: `/orders/${id}`,
    });
    await sendSellerOrderEmail({
      to_email: sellerEmail,
      customer_name: customerName || "Customer",
      customer_phone: address.phone || "",
      order_number: orderNumber,
      product_list: sellerProductList,
      total: `Rs ${sellerTotal.toLocaleString()}`,
      delivery_address: `${address.address}, ${address.city}`,
      payment_method: paymentMethod,
    });
  }
}

export async function listOrdersForUser(userId) {
  const q = query(ordersCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listAllOrders() {
  const q = query(ordersCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOrder(id) {
  const snap = await getDoc(doc(db, "orders", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateOrderStatus(id, status) {
  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  const history = snap.exists() ? snap.data().statusHistory || [] : [];
  return updateDoc(ref, {
    status,
    statusHistory: [...history, { status, at: new Date().toISOString() }],
    updatedAt: serverTimestamp(),
  });
}

export async function updatePaymentStatus(id, paymentStatus) {
  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  const order = snap.exists() ? snap.data() : null;
  if (String(order?.paymentMethod || "").toLowerCase() === "cod") {
    throw new Error("Cash on delivery orders do not use online payment statuses.");
  }
  return updateDoc(ref, { paymentStatus, updatedAt: serverTimestamp() });
}