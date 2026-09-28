// Firebase initialization.
//
// PERFORMANCE: only Firestore is loaded up front, because that's the only
// thing the home page actually needs in order to show products. The Auth SDK
// (~126 KB) and Storage SDK used to be pulled into the very first download
// even for a logged-out visitor just browsing the catalogue. They're now
// loaded on demand, so the first screen paints sooner.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVvab3WLNqWHgiObxOKR5PO_9v5_LnFhM",
  authDomain: "shop-hub-cc92a.firebaseapp.com",
  projectId: "shop-hub-cc92a",
  storageBucket: "shop-hub-cc92a.firebasestorage.app",
  messagingSenderId: "884097759528",
  appId: "1:884097759528:web:c93b74e4e826945a49781d"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ---- Lazily loaded SDKs -------------------------------------------------

let authPromise = null;

/**
 * Loads firebase/auth on demand.
 * @returns {Promise<{ auth: import("firebase/auth").Auth, sdk: any }>}
 */
export function loadAuth() {
  if (!authPromise) {
    authPromise = import("firebase/auth").then((sdk) => ({
      sdk,
      auth: sdk.getAuth(app),
    }));
  }
  return authPromise;
}

let storagePromise = null;

export function loadStorage() {
  if (!storagePromise) {
    storagePromise = import("firebase/storage").then((sdk) => ({
      sdk,
      storage: sdk.getStorage(app),
    }));
  }
  return storagePromise;
}
