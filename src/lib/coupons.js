import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const couponsCol = collection(db, "coupons");

export async function listCoupons() {
  const q = query(couponsCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCouponByCode(code) {
  const q = query(couponsCol, where("code", "==", String(code || "").trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createCoupon(data) {
  const code = String(data.code || "").trim().toUpperCase();
  if (!code) throw new Error("postal code is required.");
  return addDoc(couponsCol, {
    ...data,
    code,
    active: data.active !== false,
    type: data.type === "fixed" ? "fixed" : "percentage",
    value: Number(data.value) || 0,
    minOrder: Number(data.minOrder) || 0,
    maxDiscount: Number(data.maxDiscount) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCoupon(id, data) {
  const next = { ...data, updatedAt: serverTimestamp() };
  if (next.code) next.code = String(next.code).trim().toUpperCase();
  return updateDoc(doc(db, "coupons", id), next);
}

export async function deleteCoupon(id) {
  return deleteDoc(doc(db, "coupons", id));
}

export function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon || !coupon.active) return 0;
  if (Number(subtotal || 0) < Number(coupon.minOrder || 0)) return 0;

  const value = Number(coupon.value || 0);
  if (coupon.type === "fixed") {
    const discount = Math.min(value, Number(coupon.maxDiscount || value));
    return Math.max(0, discount);
  }

  const percent = Math.min(value, 100);
  const discount = (Number(subtotal || 0) * percent) / 100;
  if (coupon.maxDiscount && coupon.maxDiscount > 0) {
    return Math.min(discount, Number(coupon.maxDiscount));
  }
  return discount;
}
