import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeEmail, PRIVILEGED_EMAILS } from "./allowedEmails";

const permsCol = collection(db, "productPermissions");

export async function getProductPermission(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (PRIVILEGED_EMAILS.includes(normalized)) return true;

  const snap = await getDoc(doc(permsCol, normalized));
  return snap.exists() && !!snap.data().granted;
}

export async function listProductPermissions() {
  const snap = await getDocs(permsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setProductPermission(email, granted) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Email is required.");

  const ref = doc(db, "productPermissions", normalized);
  await setDoc(ref, {
    email: normalized,
    granted: !!granted,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return { email: normalized, granted: !!granted };
}

export async function getSellerPermissionState(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { granted: false, isPrivileged: false };
  const privileged = PRIVILEGED_EMAILS.includes(normalized);
  if (privileged) return { granted: true, isPrivileged: true };
  const granted = await getProductPermission(normalized);
  return { granted, isPrivileged: false };
}
