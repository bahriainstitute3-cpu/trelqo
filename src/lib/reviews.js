import {
  collection, addDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const reviewsCol = collection(db, "reviews");

export async function listReviews(productId) {
  // NOTE: previously this query combined where("productId", "==", ...) with
  // orderBy("createdAt", "desc"). Firestore requires a composite index for
  // that combination, and this project never had one deployed — so the
  // query was failing silently (no .catch upstream) and reviews never
  // showed up. Fetching by `where` alone needs no extra index, and we sort
  // newest-first here in JS instead.
  const q = query(reviewsCol, where("productId", "==", productId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  reviews.sort((a, b) => {
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
  return reviews;
}

// Recomputes the average rating + review count for a product and saves
// them ON the product document (ratingAvg / ratingCount). Product listing
// cards read these two fields directly, instead of every card on a page
// having to fetch that product's whole reviews collection just to show
// stars — that would be one extra query per card.
async function refreshProductRating(productId) {
  const reviews = await listReviews(productId);
  const ratingCount = reviews.length;
  const ratingAvg = ratingCount ? reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount : 0;
  try {
    await updateDoc(doc(db, "products", productId), { ratingAvg, ratingCount });
  } catch (err) {
    // Non-fatal: the review itself already saved/deleted successfully.
    console.error("Could not update product rating summary:", err);
  }
}

export async function addReview({ productId, userId, userName, rating, comment }) {
  const ref = await addDoc(reviewsCol, {
    productId, userId, userName: userName || "Anonymous",
    rating: Number(rating), comment: comment || "",
    createdAt: serverTimestamp(),
  });
  await refreshProductRating(productId);
  return ref;
}

export async function deleteReview(reviewId, productId) {
  await deleteDoc(doc(db, "reviews", reviewId));
  if (productId) await refreshProductRating(productId);
}

export function averageRating(reviews) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}