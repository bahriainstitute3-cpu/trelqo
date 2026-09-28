import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { cached, peekCache, invalidateCache } from "./cache";

const categoriesCol = collection(db, "categories");

export function peekCategories() {
  return peekCache("categories");
}

export async function listCategories() {
  return cached("categories", async () => {
    const q = query(categoriesCol, orderBy("order", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function createCategory(data) {
  invalidateCache("categories");
  return addDoc(categoriesCol, {
    ...data,
    active: data.active !== false,
    order: Number(data.order) || 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateCategory(id, data) {
  invalidateCache("categories");
  return updateDoc(doc(db, "categories", id), data);
}

export async function deleteCategory(id) {
  invalidateCache("categories");
  return deleteDoc(doc(db, "categories", id));
}
