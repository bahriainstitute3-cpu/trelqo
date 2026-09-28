// City-based delivery charges. Admin adds/edits/deletes a charge per city
// from the "Delivery Charges" admin page; the checkout page reads this same
// collection to price the order the moment a customer picks their city.
//
// Everything is stored in the existing "deliveryZones" Firestore collection
// (already admin-only-write in firestore.rules), so rates persist across
// refreshes/devices exactly like categories/banners/coupons do.
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
} from "firebase/firestore";
import { db } from "./firebase";

const zonesCol = collection(db, "deliveryZones");

// Sentinel "city" name used to store the fallback/default rate for any city
// that doesn't have its own entry ("Other cities" in the admin UI). Kept in
// the same collection instead of a separate config doc so the admin only
// ever has one screen to manage delivery pricing on.
export const DEFAULT_ZONE_CITY = "__default__";

function normalizeCityKey(city) {
  return (city || "").trim().toLowerCase();
}

export async function listDeliveryZones() {
  const q = query(zonesCol, orderBy("city", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("deliveryzoneschange"));
  }
}

function assertValidCharge(charge) {
  const chargeNum = Number(charge);
  if (Number.isNaN(chargeNum) || chargeNum < 0) {
    throw new Error("Delivery charge must be a valid, non-negative number.");
  }
  return chargeNum;
}

// Creates a new per-city delivery rate. Pass city = DEFAULT_ZONE_CITY to
// create the "Other cities" fallback rate instead of a named city.
export async function createDeliveryZone({ city, charge }) {
  const cityTrimmed = (city || "").trim();
  if (!cityTrimmed) throw new Error("City name is required.");
  const chargeNum = assertValidCharge(charge);

  if (cityTrimmed !== DEFAULT_ZONE_CITY) {
    const existing = await listDeliveryZones();
    const duplicate = existing.find((z) => normalizeCityKey(z.city) === normalizeCityKey(cityTrimmed));
    if (duplicate) {
      throw new Error(`"${cityTrimmed}" already has a delivery rate — edit it instead of adding a duplicate.`);
    }
  }

  const result = await addDoc(zonesCol, {
    city: cityTrimmed,
    charge: chargeNum,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  notify();
  return result;
}

export async function updateDeliveryZone(id, { city, charge }) {
  const updates = { updatedAt: serverTimestamp() };
  if (city !== undefined) updates.city = (city || "").trim();
  if (charge !== undefined) updates.charge = assertValidCharge(charge);

  const result = await updateDoc(doc(db, "deliveryZones", id), updates);
  notify();
  return result;
}

export async function deleteDeliveryZone(id) {
  const result = await deleteDoc(doc(db, "deliveryZones", id));
  notify();
  return result;
}

// Given the full list of zones (from listDeliveryZones) and a city name
// typed/selected by a customer, returns the delivery charge to use:
//   1. An exact (case-insensitive, trimmed) match on that city.
//   2. Otherwise Rs 0 — a city with no configured rate is free delivery.
export function resolveDeliveryCharge(zones, city) {
  const key = normalizeCityKey(city);
  if (!key) return 0;
  const list = zones || [];
  const match = list.find((z) => normalizeCityKey(z.city) === key);
  return match ? Number(match.charge) || 0 : 0;
}