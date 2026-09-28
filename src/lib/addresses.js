import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export async function listAddresses(userId) {
  if (!userId) return [];
  const q = query(collection(db, "users", userId, "addresses"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addAddress(userId, data) {
  const payload = {
    ...data,
    fullName: (data.fullName || "").trim(),
    phone: (data.phone || "").trim(),
    city: (data.city || "").trim(),
    area: (data.area || "").trim(),
    address: (data.address || "").trim(),
    landmark: (data.landmark || "").trim(),
    default: !!data.default,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const addressesCol = collection(db, "users", userId, "addresses");
  const ref = await addDoc(addressesCol, payload);
  if (payload.default) {
    const existing = await listAddresses(userId);
    await Promise.all(
      existing
        .filter((item) => item.id !== ref.id && item.default)
        .map((item) => updateDoc(doc(db, "users", userId, "addresses", item.id), { default: false, updatedAt: serverTimestamp() }))
    );
  }
  return ref.id;
}

export async function updateAddress(userId, addressId, data) {
  const ref = doc(db, "users", userId, "addresses", addressId);
  const next = {
    ...data,
    fullName: (data.fullName || "").trim(),
    phone: (data.phone || "").trim(),
    city: (data.city || "").trim(),
    area: (data.area || "").trim(),
    address: (data.address || "").trim(),
    landmark: (data.landmark || "").trim(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, next);
  if (next.default) {
    const existing = await listAddresses(userId);
    await Promise.all(
      existing
        .filter((item) => item.id !== addressId && item.default)
        .map((item) => updateDoc(doc(db, "users", userId, "addresses", item.id), { default: false, updatedAt: serverTimestamp() }))
    );
  }
  return addressId;
}

export async function removeAddress(userId, addressId) {
  await deleteDoc(doc(db, "users", userId, "addresses", addressId));
}

export async function setDefaultAddress(userId, addressId) {
  const addresses = await listAddresses(userId);
  await Promise.all(
    addresses.map((item) =>
      updateDoc(doc(db, "users", userId, "addresses", item.id), {
        default: item.id === addressId,
        updatedAt: serverTimestamp(),
      })
    )
  );
}
