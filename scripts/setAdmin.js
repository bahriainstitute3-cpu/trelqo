// One-time script to promote a user to Super Admin.
// Usage:
//   1. Download a service account key from Firebase Console →
//      Project Settings → Service Accounts → Generate new private key.
//      Save it as scripts/serviceAccountKey.json (already gitignored).
//   2. Run: node scripts/setAdmin.js someone@example.com
//
// This writes role: "super_admin" directly via the Admin SDK, which bypasses
// Firestore security rules — this is intentional and is the only supported
// way to create the first admin (no one can grant themselves admin through
// the app itself).
import admin from "firebase-admin";
import { readFileSync } from "fs";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/setAdmin.js someone@example.com");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(new URL("./serviceAccountKey.json", import.meta.url)));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const user = await auth.getUserByEmail(email);
await db.collection("users").doc(user.uid).set({ role: "super_admin" }, { merge: true });
console.log(`✓ ${email} is now a super_admin.`);
process.exit(0);
