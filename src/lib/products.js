import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit as qLimit, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { getProductPermission } from "./permissions";
import { createNotification } from "./notifications";
import { notifyAdmins } from "./notifications";
import { peekCache, invalidateCache } from "./cache";

const productsCol = collection(db, "products");

// Home, Search and CategoryPage used to each fire their OWN full-collection
// download (900 + 100 + 500 + 200 docs). They all ask for a prefix of the
// same "newest first" list, so we download a compact first-page list exactly
// once, cache it, and slice locally. This keeps the first storefront load
// fast; detail pages still fetch their product directly by id.
const CATALOG_KEY = "products_catalog";
const CATALOG_MAX = 120;

async function fetchCatalog() {
  const q = query(productsCol, orderBy("createdAt", "desc"), qLimit(CATALOG_MAX));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function applyFilters(list, { category, featured }) {
  return list.filter((product) => {
    if (product.status && product.status !== "active") return false;
    if (category && product.categoryId !== category) return false;
    if (featured && !product.featured) return false;
    return true;
  });
}

/**
 * Synchronous cache peek — lets a page paint its previous results on the
 * very first render (no spinner) while the fresh data loads behind it.
 */
export function peekProducts({ category = null, featured = null, max = 60 } = {}) {
  const raw = peekCache(CATALOG_KEY);
  if (!raw) return null;
  return applyFilters(raw.slice(0, max), { category, featured });
}

export async function listProducts({ category = null, featured = null, max = 60 } = {}) {
  // Product status can change when an admin approves a seller product. Read
  // the catalog fresh so every visitor sees activation without waiting for
  // another user's local cache to expire.
  const raw = await fetchCatalog();
  return applyFilters(raw.slice(0, max), { category, featured });
}

export async function listAllProductsForAdmin() {
  const q = query(productsCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProduct(id) {
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createProduct(data) {
  const ownerEmail = String(data.ownerEmail || "").trim().toLowerCase();
  const sellerId = data.sellerId || "";
  const sellerSnap = sellerId ? await getDoc(doc(db, "sellers", sellerId)) : null;
  const approvedSeller = sellerSnap?.exists() &&
    sellerSnap.data().sellerStatus === "APPROVED" &&
    sellerSnap.data().email === ownerEmail;
  const allowed = approvedSeller || await getProductPermission(ownerEmail);
  if (!allowed) throw new Error("You do not have permission to add products.");

  const payload = {
    ...data,
    sellerId,
    ownerEmail,
    status: data.status || "active",
    featured: !!data.featured,
    stock: Number(data.stock) || 0,
    lowStockThreshold: Number(data.lowStockThreshold) || 5,
    price: Number(data.price) || 0,
    salePrice: data.salePrice ? Number(data.salePrice) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(productsCol, payload);

  invalidateCache("products_");

  // Best-effort: notify everyone about the new product (name + description).
  // Never block product creation if this fails.
  if ((data.status || "active") === "active") {
    const shortDescription = (data.description || "").trim().slice(0, 140);
    createNotification({
      recipientEmail: "all",
      type: "new_product",
      title: `New product: ${data.name}`,
      message: shortDescription || "Check it out now!",
      link: `/product/${ref.id}`,
    }).catch((err) => console.error("New product notification failed:", err));
  }
  if (payload.status === "under_review") {
    notifyAdmins({
      type: "product_review",
      title: "Product awaiting review",
      message: `${payload.name} was submitted by ${payload.ownerName || payload.ownerEmail}.`,
      link: "/admin/products",
    }).catch((err) => console.error("Product admin notification failed:", err));
  }

  return ref;
}

export async function updateProduct(id, data) {
  const ref = doc(db, "products", id);
  const previousSnap = await getDoc(ref);
  const previous = previousSnap.exists() ? previousSnap.data() : null;
  const result = await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  invalidateCache("products_");
  if (previous && previous.status !== "active" && data.status === "active" && previous.ownerEmail) {
    createNotification({
      recipientEmail: previous.ownerEmail,
      type: "product_approved",
      title: "Your product is active now",
      message: `${previous.name || "Your product"} has been approved and is now visible in the Trelqo catalog.`,
      link: `/product/${id}`,
    }).catch((err) => console.error("Product approval notification failed:", err));
  }
  return result;
}

export async function deleteProduct(id) {
  const result = await deleteDoc(doc(db, "products", id));
  invalidateCache("products_");
  return result;
}

export async function adjustStock(id, delta) {
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Product not found");
  const current = snap.data().stock || 0;
  const next = Math.max(0, current + delta);
  await updateDoc(ref, { stock: next, updatedAt: serverTimestamp() });
  invalidateCache("products_");
  return next;
}

export async function searchProducts(term) {
  // Firestore has no native full-text search; fetch active products and
  // filter client-side. Fine for small-to-mid catalogs — swap in Algolia /
  // Typesense later for large catalogs.
  const all = await listProducts({ max: 500 });
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return all.filter(
    (p) =>
      p.name?.toLowerCase().includes(t) ||
      p.brand?.toLowerCase().includes(t) ||
      p.categoryName?.toLowerCase().includes(t)
  );
}
