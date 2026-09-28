import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const CONFIG_DOC = "appSettings/main";
let unsubscribeListener = null;

export function getDefaultBrandLogo() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1e7365"/>
          <stop offset="100%" stop-color="#123b36"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="64" height="64" rx="18" fill="#f8f1e6"/>
      <rect x="9" y="9" width="54" height="54" rx="16" fill="url(#g)"/>
      <path d="M22 25.5h28v6H22zm0 10h28v6H22zm0 10h18v6H22z" fill="#f6d48d"/>
      <circle cx="47" cy="39.5" r="8" fill="#f6d48d"/>
      <path d="M41.5 18.5h11.5l-1.8 4.5H42.8z" fill="#f8f1e6" opacity="0.9"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function normalizeLogoUrl(value) {
  if (!value || typeof value !== "string") return getDefaultBrandLogo();

  let next = value.trim();
  if (!next) return getDefaultBrandLogo();

  if (next.startsWith("http://")) {
    next = "https://" + next.slice(7);
  }

  const driveId = next.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/);
  if (driveId?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveId[1]}`;
  }

  return /^https?:\/\//.test(next) ? next : getDefaultBrandLogo();
}

export async function getAppConfig() {
  try {
    const snap = await getDoc(doc(db, CONFIG_DOC));
    if (snap.exists()) {
      const persisted = snap.data();
      const config = {
        ...getDefaultConfig(),
        ...persisted,
        appLogo: normalizeLogoUrl(persisted.appLogo) || "",
      };
      sessionStorage.setItem("appConfig", JSON.stringify(config));
      return config;
    }
    return getDefaultConfig();
  } catch (err) {
    console.error("Error fetching app config:", err);
    return getDefaultConfig();
  }
}

export function getDefaultConfig() {
  return {
    appName: "Trelqo",
    appLogo: getDefaultBrandLogo(),
    appTagline: "Shop smarter, live better",
    contactEmail: "support@trelqo .com",
    contactPhone: "+92-3040024727",
    whatsappNumber: "923040024727",
    // Scrolling announcement ticker shown at the very top of the app.
    tickerEnabled: false,
    tickerText: "",
    tickerBgColor: "#123b36",
    tickerTextColor: "#ffffff",
    // Site link(s) shown as QR codes at the bottom of order receipts
    // (Admin > Orders > Site Links). Empty by default; AdminOrders falls
    // back to a hardcoded ShopHub link if this stays empty.
    receiptLinks: [],
  };
}

export async function updateAppConfig(updates) {
  try {
    const normalized = {
      ...updates,
      ...(updates.appLogo ? { appLogo: normalizeLogoUrl(updates.appLogo) } : {}),
    };

    await setDoc(
      doc(db, CONFIG_DOC),
      {
        ...normalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const nextConfig = { ...getCachedConfig(), ...normalized };
    sessionStorage.setItem("appConfig", JSON.stringify(nextConfig));
    window.dispatchEvent(new CustomEvent("appconfigchange", { detail: nextConfig }));
    return true;
  } catch (err) {
    console.error("Error updating app config:", err);
    const isInternalAssertion = /INTERNAL ASSERTION FAILED/i.test(err?.message || "");
    throw new Error(
      err.code === "permission-denied"
        ? "Firebase permission denied. Sign in again and deploy firestore.rules."
        : isInternalAssertion
        ? "Firestore ran into a temporary internal glitch. Please refresh the page (F5) and try Save again — your other changes were not lost."
        : `Could not update app settings: ${err.message || "unknown error"}`
    );
  }
}

export async function cacheAppConfig() {
  try {
    const config = await getAppConfig();
    sessionStorage.setItem("appConfig", JSON.stringify(config));
    return config;
  } catch (err) {
    console.error("Error caching config:", err);
    return getDefaultConfig();
  }
}

export function getCachedConfig() {
  try {
    const cached = sessionStorage.getItem("appConfig");
    return cached ? JSON.parse(cached) : getDefaultConfig();
  } catch (err) {
    return getDefaultConfig();
  }
}

// Start real-time listener for app config changes across all devices
export function startConfigListener() {
  if (unsubscribeListener) return; // Already listening

  unsubscribeListener = onSnapshot(
    doc(db, CONFIG_DOC),
    (snapshot) => {
      if (snapshot.exists()) {
        const persisted = snapshot.data();
        const config = {
          ...getDefaultConfig(),
          ...persisted,
          appLogo: normalizeLogoUrl(persisted.appLogo) || "",
        };
        sessionStorage.setItem("appConfig", JSON.stringify(config));
        // Emit event to update UI across the app
        window.dispatchEvent(new CustomEvent("appconfigchange", { detail: config }));
      }
    },
    (error) => {
      console.error("Error listening to app config changes:", error);
    }
  );
}

// Stop the real-time listener
export function stopConfigListener() {
  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }
}