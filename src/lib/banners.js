
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import { cached, peekCache, invalidateCache } from "./cache";

const bannersCol = collection(db, "banners");

export function peekBanners() {
  return peekCache("banners");
}

export async function listBanners() {
  return cached("banners", async () => {
    const q = query(bannersCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

// NEW: Real-time listener for all devices
export function subscribeBanners(onChange, onError) {
  const q = query(bannersCol, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const banners = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Refresh local cache so future reads don't use stale data.
      invalidateCache("banners");

      // Send the latest banners to the Home page.
      onChange(banners);
    },
    (error) => {
      console.error("Real-time banner listener failed:", error);
      if (onError) onError(error);
    }
  );
}

export async function createBanner(data) {
  const result = await addDoc(bannersCol, {
    ...data,
    active: data.active !== false,
    mediaType: data.mediaType === "video" ? "video" : "image",
    imageUrl: data.imageUrl || "",
    videoUrl: data.videoUrl || "",
    title: data.title || "",
    link: data.link || "/",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  invalidateCache("banners");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bannerschange"));
  }

  return result;
}

export async function updateBanner(id, data) {
  const result = await updateDoc(doc(db, "banners", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });

  invalidateCache("banners");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bannerschange"));
  }

  return result;
}

export async function deleteBanner(id) {
  const result = await deleteDoc(doc(db, "banners", id));

  invalidateCache("banners");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bannerschange"));
  }

  return result;
}