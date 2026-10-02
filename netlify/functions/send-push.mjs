// netlify/functions/send-push.mjs
// Delivers an existing /notifications/{id} document as a real web-push
// message (works when the site is closed / phone is locked).
//
// The browser calls this right after creating the notification, sending its
// Firebase ID token. The server:
//   1. verifies the token,
//   2. loads the notification from Firestore (so the text can't be spoofed),
//   3. checks the caller is the one who created it, and that it wasn't pushed yet,
//   4. sends it to every saved device token of the recipient.
//
// Needs ONE environment variable in Netlify:
//   FIREBASE_SERVICE_ACCOUNT  - the full service-account JSON
//   (Firebase Console > Project settings > Service accounts > Generate new private key)
//   Pasting it as base64 also works.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function init() {
  if (getApps().length) return;
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  raw = raw.trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  const account = JSON.parse(raw);
  if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(account) });
}

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const clip = (value, max) => String(value || "").slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    init();
  } catch (e) {
    console.error(e);
    return json({ error: "Push is not configured on the server" }, 503);
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not signed in" }, 401);

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(bearer);
  } catch {
    return json({ error: "Invalid session" }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const notificationId = clip(body?.notificationId, 100);
  if (!notificationId || notificationId.includes("/")) return json({ error: "Missing notificationId" }, 400);

  const db = getFirestore();
  const ref = db.collection("notifications").doc(notificationId);

  // Claim the notification exactly once (also stops anyone replaying the call).
  let n;
  try {
    n = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { error: "Not found", status: 404 };
      const data = snap.data();
      if (data.createdBy !== decoded.uid) return { error: "Not allowed", status: 403 };
      if (data.pushed) return { error: "Already sent", status: 200, already: true };
      const createdMs = data.createdAt?.toMillis?.() || 0;
      if (createdMs && Date.now() - createdMs > 10 * 60 * 1000) return { error: "Too old", status: 410 };
      tx.update(ref, { pushed: true, pushedAt: FieldValue.serverTimestamp() });
      return { data };
    });
  } catch (e) {
    console.error("Claim failed:", e);
    return json({ error: "Could not process notification" }, 500);
  }
  if (!n.data) return json({ error: n.error, sent: 0 }, n.status);

  const notification = n.data;
  const recipient = String(notification.recipientEmail || "").toLowerCase().trim();
  if (!recipient) return json({ sent: 0 });

  // Find the recipient's devices.
  let tokenDocs;
  if (recipient === "all") {
    const snap = await db.collection("pushTokens").limit(5000).get();
    // Don't buzz the person who just published the thing.
    tokenDocs = snap.docs.filter((d) => d.data().uid !== notification.createdBy);
  } else {
    const snap = await db.collection("pushTokens").where("email", "==", recipient).limit(50).get();
    tokenDocs = snap.docs;
  }
  const tokens = [...new Set(tokenDocs.map((d) => d.data().token || d.id).filter(Boolean))];
  if (!tokens.length) return json({ sent: 0 });

  const message = {
    data: {
      title: clip(notification.title, 80) || "Trelqo",
      body: clip(notification.message, 180),
      link: clip(notification.link, 300) || "/",
      type: clip(notification.type, 40),
      notificationId,
    },
    webpush: {
      // "high" urgency + a day of TTL = delivered quickly even to a sleeping
      // phone, and still delivered if the phone was switched off for a while.
      headers: { Urgency: "high", TTL: "86400" },
    },
  };

  let sent = 0;
  let failed = 0;
  const dead = [];

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const res = await getMessaging().sendEachForMulticast({ ...message, tokens: chunk });
      sent += res.successCount;
      failed += res.failureCount;
      res.responses.forEach((r, idx) => {
        if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(chunk[idx]);
      });
    } catch (e) {
      console.error("FCM send failed:", e);
      failed += chunk.length;
    }
  }

  // Clean out expired tokens so the list stays healthy.
  await Promise.allSettled(dead.map((t) => db.collection("pushTokens").doc(t).delete()));

  return json({ sent, failed });
};
