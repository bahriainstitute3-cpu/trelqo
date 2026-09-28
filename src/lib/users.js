import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function listUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

// Real remote logout: there is no backend/Cloud Function in this project,
// so a client can't directly kill another device's Firebase session. What
// we CAN do purely client-side: write a timestamp onto that user's own
// /users/{uid} doc. Every signed-in device listens (onSnapshot) to its own
// doc — see AuthContext.jsx — and if it sees a forceLogoutAt newer than its
// own sign-in time, it calls signOut() on itself immediately. That's what
// actually logs the other device out (as long as it's online); previously
// this button did nothing at all beyond a fake success message.
export async function forceLogoutUser(userId) {
  await setDoc(doc(db, "users", userId), { forceLogoutAt: serverTimestamp() }, { merge: true });
}