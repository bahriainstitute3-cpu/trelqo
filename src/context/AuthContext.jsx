import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { db, loadAuth } from "../lib/firebase";
import { canAccessSettings, isPrivilegedEmail, isSellerEmail, normalizeEmail } from "../lib/allowedEmails";
import { getProductPermission } from "../lib/permissions";
import { clearWishlistCache } from "../lib/wishlist";
import { getSellerProfileByUserId } from "../lib/sellers";
import { unregisterPushToken } from "../lib/push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // Firestore /users/{uid} doc
  const [sellerProfile, setSellerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const authRef = useRef(null); // { auth, sdk } once firebase/auth has loaded

  async function getAuthSdk() {
    if (!authRef.current) authRef.current = await loadAuth();
    return authRef.current;
  }

  async function refreshProfile(fbUser) {
    if (!fbUser) {
      const { auth } = await getAuthSdk();
      fbUser = auth.currentUser;
    }

    if (!fbUser) {
      setUser(null);
      setProfile(null);
      setSellerProfile(null);
      return null;
    }

    const ref = doc(db, "users", fbUser.uid);
    let existing = {};
    let profileExists = false;
    try {
      const snap = await getDoc(ref);
      profileExists = snap.exists();
      existing = profileExists ? snap.data() : {};
    } catch (err) {
      console.error("Could not read user profile:", err);
    }

    let canAddProduct = isSellerEmail(fbUser.email);
    if (!canAddProduct) {
      try {
        canAddProduct = await getProductPermission(fbUser.email);
      } catch (err) {
        console.error("Permission check failed:", err);
      }
    }

    const seller = await getSellerProfileByUserId(fbUser.uid);
    if (seller?.sellerStatus === "APPROVED") {
      canAddProduct = true;
    }

    const nextProfile = {
      ...existing,
      name: existing.name || fbUser.displayName || "",
      email: normalizeEmail(fbUser.email) || existing.email || "",
      photoURL: fbUser.photoURL || existing.photoURL || "",
      canAddProduct,
      role: isPrivilegedEmail(fbUser.email) ? "admin" : (existing.role || "customer"),
    };

    try {
      if (profileExists) {
        await setDoc(ref, {
          name: nextProfile.name,
          email: nextProfile.email,
          photoURL: nextProfile.photoURL,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await setDoc(ref, { ...nextProfile, blocked: false, createdAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("Could not sync user profile:", err);
    }

    const currentSeller = await getSellerProfileByUserId(fbUser.uid);
    setUser(fbUser);
    setProfile(nextProfile);
    setSellerProfile(currentSeller || null);
    return nextProfile;
  }

  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    (async () => {
      const { auth, sdk } = await getAuthSdk();
      if (cancelled) return;

      unsub = sdk.onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setProfile(null);
          setSellerProfile(null);
          clearWishlistCache();
          setLoading(false);
          return;
        }

        try {
          await refreshProfile(fbUser);
        } catch (err) {
          console.error("Authentication initialization failed:", err);
          setProfile({
            name: fbUser.displayName || "",
            email: normalizeEmail(fbUser.email),
            photoURL: fbUser.photoURL || "",
            canAddProduct: isSellerEmail(fbUser.email),
            role: isPrivilegedEmail(fbUser.email) ? "admin" : "customer",
          });
          setSellerProfile(null);
        } finally {
          setLoading(false);
        }
      });
    })().catch((err) => {
      console.error("Could not load auth:", err);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  // Remote-logout listener: watches THIS device's own /users/{uid} doc. If
  // an admin sets forceLogoutAt (via Settings > Sellers & Admins > Logout)
  // and it's newer than when this device signed in, this device signs
  // itself out immediately. Without this listener there's no way for a
  // remote logout to ever take effect — a client can't reach into another
  // device's session directly.
  useEffect(() => {
    if (!user) return;
    const signInMs = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : Date.now();
    const unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      const data = snap.data();
      const forceLogoutAt = data?.forceLogoutAt;
      const forceMs = forceLogoutAt?.toMillis ? forceLogoutAt.toMillis() : 0;
      if (forceMs > signInMs) {
        const { auth, sdk } = await getAuthSdk();
        sdk.signOut(auth);
      }
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const sellerQuery = query(collection(db, "sellers"), where("userId", "==", user.uid));
    return onSnapshot(
      sellerQuery,
      (snapshot) => {
        const seller = snapshot.docs[0];
        setSellerProfile(seller ? { id: seller.id, ...seller.data() } : null);
      },
      (err) => console.error("Could not listen for seller status updates:", err)
    );
  }, [user?.uid]);

  async function signup({ name, email, phone, password }) {
    const { auth, sdk } = await getAuthSdk();
    // Allow any email to sign up
    const normalEmail = normalizeEmail(email);
    if (!normalEmail) throw new Error("Email is required.");
    const cred = await sdk.createUserWithEmailAndPassword(auth, email, password);
    await sdk.updateProfile(cred.user, { displayName: name });
    const userDoc = {
      name, email: normalizeEmail(email),
      phone: phone || "",
      role: isPrivilegedEmail(email) ? "admin" : "customer",
      canAddProduct: isSellerEmail(email),
      blocked: false,
      photoURL: "",
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), userDoc);
    setProfile(userDoc);
    return cred.user;
  }

  async function login(email, password) {
    const { auth, sdk } = await getAuthSdk();
    const cred = await sdk.signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists() && snap.data().blocked) {
      await sdk.signOut(auth);
      throw new Error("This account has been blocked. Contact support.");
    }
    return cred.user;
  }

  // "Continue with Google" — open to any Google account (unlike email/password
  // signup, which is restricted to ALLOWED_EMAILS). Only the SELLER_EMAIL
  // account gets canAddProduct: true, checked fresh on every login so
  // changing SELLER_EMAIL later takes effect immediately.
  async function loginWithGoogle() {
    const { auth, sdk } = await getAuthSdk();
    const googleProvider = new sdk.GoogleAuthProvider();
    const cred = await sdk.signInWithPopup(auth, googleProvider);
    const googleEmail = normalizeEmail(cred.user.email);
    let canAddProduct = isSellerEmail(googleEmail);

    // Try to get permission from Firestore, but don't fail if it throws
    try {
      const perm = await getProductPermission(googleEmail);
      if (perm) canAddProduct = true;
    } catch (err) {
      console.error("Could not fetch permissions:", err);
    }

    const ref = doc(db, "users", cred.user.uid);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().blocked) {
      await sdk.signOut(auth);
      throw new Error("This account has been blocked. Contact support.");
    }

    const userDoc = {
      name: cred.user.displayName || "",
      email: googleEmail,
      phone: cred.user.phoneNumber || "",
      role: isPrivilegedEmail(googleEmail) ? "admin" : (snap.exists() ? (snap.data().role || "customer") : "customer"),
      canAddProduct,
      photoURL: cred.user.photoURL || "",
      blocked: false,
      updatedAt: serverTimestamp(),
      createdAt: snap.exists() ? snap.data().createdAt || serverTimestamp() : serverTimestamp(),
    };

    await setDoc(ref, userDoc, { merge: true });
    setProfile(userDoc);
    return cred.user;
  }

  async function logout() {
    await unregisterPushToken(); // stop pushes for this user on this device
    setProfile(null);
    setUser(null);
    clearWishlistCache();
    const { auth, sdk } = await getAuthSdk();
    return sdk.signOut(auth);
  }

  async function resetPassword(email) {
    const { auth, sdk } = await getAuthSdk();
    return sdk.sendPasswordResetEmail(auth, email);
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const canAddProduct = !!profile?.canAddProduct || sellerProfile?.sellerStatus === "APPROVED";
  const canAccessSettingsState = !!user && canAccessSettings(user.email);

  return (
    <AuthContext.Provider value={{ user, profile, sellerProfile, loading, isAdmin, canAddProduct, canAccessSettings: canAccessSettingsState, signup, login, loginWithGoogle, logout, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
