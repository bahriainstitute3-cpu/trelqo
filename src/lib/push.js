// src/lib/push.js
// Background (closed-app) push notifications via Firebase Cloud Messaging.
//
// Flow:
//  1. registerPushToken(user)  - gets this device's FCM token and saves it in
//     Firestore (/pushTokens/{token}) so the server knows where to send.
//  2. requestPushForNotification(id) - after a notification doc is created,
//     asks the Netlify function to deliver it as a real push to the
//     recipient's devices (works with the app closed / phone locked).
//  3. unregisterPushToken() - on logout, so the next person using the same
//     phone doesn't receive the previous user's notifications.
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { app, db, loadAuth } from "./firebase";

// Public Web Push (VAPID) key - safe to ship in the browser.
const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  "BL6_zCGX_5_QEMyEXv8P8ARCoxq-fx_yNvLMBmUubv2lxxJEp4mb7E5BHN5agrWUvJLDjizgh1du0gY-WkwS9mA";

const TOKEN_STORAGE_KEY = "trelqo-fcm-token";

export function isPushPossible() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Saves this device's push token for the signed-in user.
 * Safe to call on every login / app start - it does nothing unless the user
 * already granted notification permission.
 */
export async function registerPushToken(user) {
  try {
    if (!user?.uid || !user?.email || !isPushPossible()) return null;
    if (Notification.permission !== "granted") return null;

    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return null;

    // Reuse the app's existing service worker (it imports push-sw.js).
    const registration = await withTimeout(navigator.serviceWorker.ready, 10000);
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await setDoc(
      doc(db, "pushTokens", token),
      {
        token,
        uid: user.uid,
        email: user.email.toLowerCase().trim(),
        userAgent: (navigator.userAgent || "").slice(0, 200),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
    return token;
  } catch (err) {
    console.error("Push registration failed:", err);
    return null;
  }
}

/** Removes this device's token (call before signing out). */
export async function unregisterPushToken() {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    await deleteDoc(doc(db, "pushTokens", token));
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error("Push unregister failed:", err);
  }
}

/**
 * Asks the server to deliver an existing notification doc as a push.
 * Fire-and-forget: the in-app notification already exists either way.
 */
export async function requestPushForNotification(notificationId) {
  try {
    if (!notificationId) return;
    const { auth } = await loadAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/.netlify/functions/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ notificationId }),
      keepalive: true,
    });
  } catch (err) {
    console.error("Push delivery request failed:", err);
  }
}
