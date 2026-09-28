import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// PERFORMANCE FIX
// Previously every single ProductCard called isWishlisted(), and each of
// those calls did its own getDoc() on /wishlists/{uid}. On a page showing
// hundreds of products that meant hundreds of identical Firestore reads
// firing at once — the single biggest cause of the slow load (and of a big
// Firestore bill). Now the wishlist document is fetched ONCE per user and
// shared from memory; cards read it synchronously and subscribe to changes.

let cacheUserId = null;
let cacheItems = null;        // array | null (null = not loaded yet)
let cachePromise = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn(cacheItems || []);
    } catch {
      // a broken subscriber must never break the others
    }
  });
}

function resetFor(userId) {
  if (cacheUserId !== userId) {
    cacheUserId = userId;
    cacheItems = null;
    cachePromise = null;
  }
}

/** Synchronous read of the already-loaded wishlist (null if not loaded). */
export function peekWishlist(userId) {
  if (!userId || cacheUserId !== userId) return null;
  return cacheItems;
}

/**
 * Subscribe to wishlist changes. Returns an unsubscribe function.
 * Triggers the one-and-only load if it hasn't happened yet.
 */
export function subscribeWishlist(userId, callback) {
  if (!userId) return () => {};
  resetFor(userId);
  subscribers.add(callback);
  getWishlist(userId).then(callback).catch(() => callback([]));
  return () => subscribers.delete(callback);
}

export async function getWishlist(userId) {
  if (!userId) return [];
  resetFor(userId);

  if (cacheItems) return cacheItems;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    try {
      const ref = doc(db, "wishlists", userId);
      const snap = await getDoc(ref);
      cacheItems = snap.exists() ? (snap.data().items || []) : [];
    } catch {
      cacheItems = [];
    } finally {
      cachePromise = null;
    }
    notify();
    return cacheItems;
  })();

  return cachePromise;
}

export async function isWishlisted(userId, productId) {
  if (!userId || !productId) return false;
  const items = await getWishlist(userId);
  return items.some((item) => item.productId === productId);
}

export async function toggleWishlistItem(userId, product) {
  if (!userId) throw new Error("Please log in to save items.");

  const current = await getWishlist(userId);
  const exists = current.some((item) => item.productId === product.id);

  const next = exists
    ? current.filter((item) => item.productId !== product.id)
    : [
        {
          productId: product.id,
          name: product.name,
          image: product.images?.[0] || "",
          price: Number(product.salePrice || product.price || 0),
          ownerEmail: product.ownerEmail || "",
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];

  // Optimistic: UI flips instantly, write happens behind it.
  cacheItems = next;
  notify();

  try {
    const ref = doc(db, "wishlists", userId);
    await setDoc(ref, { items: next, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    cacheItems = current; // roll back on failure
    notify();
    throw err;
  }

  return !exists;
}

/** Called on logout so the next user doesn't see stale data. */
export function clearWishlistCache() {
  cacheUserId = null;
  cacheItems = null;
  cachePromise = null;
  notify();
}
