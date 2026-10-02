// src/lib/notifications.js
import { db, loadAuth } from "./firebase";
import { requestPushForNotification } from "./push";

import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { PRIVILEGED_EMAILS } from "./allowedEmails";

const NOTIF_COLLECTION = "notifications";

/**
 * Create a notification.
 * @param {Object} data
 * @param {string} data.recipientEmail - specific user's email, ya "all" agar sab ko dikhani ho
 * @param {"new_product"|"new_message"|"order"} data.type
 * @param {string} data.title
 * @param {string} data.message
 * @param {string} [data.link] - click karne par kahan navigate karna hai (e.g. "/product/123")
 */
export async function createNotification({ recipientEmail, type, title, message, link = "/" }) {
  if (!recipientEmail) return;
  let createdBy = "";
  try {
    const { auth } = await loadAuth();
    createdBy = auth.currentUser?.uid || "";
  } catch {}
  const ref = await addDoc(collection(db, NOTIF_COLLECTION), {
    recipientEmail: recipientEmail.toLowerCase().trim(),
    type,
    title,
    message,
    link,
    read: false,
    createdBy,
    createdAt: serverTimestamp(),
  });
  // Also deliver as a real push (works when the app is closed). Never blocks.
  requestPushForNotification(ref.id);
}

export async function notifyAdmins({ type, title, message, link = "/admin" }) {
  await Promise.all(
    PRIVILEGED_EMAILS.map((recipientEmail) =>
      createNotification({ recipientEmail, type, title, message, link })
    )
  );
}

/**
 * Real-time listener. Calls callback(notifications[]) har baar jab data change ho.
 * Returns unsubscribe function — component unmount par usay call karein.
 */
export function listenToNotifications(userEmail, callback) {
  if (!userEmail) return () => {};
  const email = userEmail.toLowerCase().trim();

  const q = query(
    collection(db, NOTIF_COLLECTION),
    where("recipientEmail", "in", [email, "all"])
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 30);
    callback(items);
  }, (error) => {
    console.error("Could not load notifications:", error);
  });
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, NOTIF_COLLECTION, notificationId), { read: true });
}

export async function markAllNotificationsRead(notifications) {
  await Promise.all(
    notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id))
  );
}
