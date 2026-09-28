import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeEmail } from "./allowedEmails";
import { notifyAdmins } from "./notifications";

const sellersCol = collection(db, "sellers");

export const SELLER_VERIFICATION_STATUSES = ["pending", "under_review", "verified", "rejected"];
export const SELLER_STATUSES = ["active", "inactive", "suspended"];
export const SELLER_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

function createSellerId() {
  return `seller_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSellers() {
  const q = query(sellersCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listSellerApplications(statusFilter = "all") {
  const q = query(sellersCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (statusFilter === "all") return items;
  return items.filter((seller) => (seller.sellerStatus || seller.status || "PENDING") === statusFilter);
}

export async function getSeller(email) {
  const id = normalizeEmail(email);
  if (!id) return null;
  const snap = await getDoc(doc(db, "sellers", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getSellerById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "sellers", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getSellerProfileByUserId(userId) {
  if (!userId) return null;
  const q = query(sellersCol, where("userId", "==", userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const seller = snap.docs[0];
  return { id: seller.id, ...seller.data() };
}

export async function isSellerVerified(email) {
  const seller = await getSeller(email);
  return !!seller && (seller.sellerStatus === "APPROVED" || seller.verificationStatus === "verified");
}

export async function createSeller(data) {
  const id = normalizeEmail(data.email);
  if (!id) throw new Error("Seller email is required.");
  if (!data.fullName?.trim()) throw new Error("Seller full name is required.");

  const existing = await getDoc(doc(db, "sellers", id));
  if (existing.exists()) throw new Error("A seller with this email already exists.");

  await setDoc(doc(db, "sellers", id), {
    fullName: (data.fullName || "").trim(),
    phone: (data.phone || "").trim(),
    cnic: (data.cnic || "").trim(),
    email: id,
    age: data.age ? Number(data.age) : null,
    gender: data.gender || "",
    address: (data.address || "").trim(),
    postalCode: (data.postalCode || "").trim(),
    city: (data.city || "").trim(),
    area: (data.area || "").trim(),
    registrationDate: data.registrationDate || new Date().toISOString().slice(0, 10),
    status: SELLER_STATUSES.includes(data.status) ? data.status : "active",
    verificationStatus: SELLER_VERIFICATION_STATUSES.includes(data.verificationStatus) ? data.verificationStatus : "pending",
    notes: (data.notes || "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function createSellerApplication({
  userId,
  userEmail,
  fullName,
  phone,
  whatsapp,
  email,
  cnic,
  age,
  gender,
  city,
  area,
  address,
  registrationDate,
  payoutMethod,
  payoutAccountName,
  payoutAccountNumber,
  agreementAccepted,
}) {
  const normalizedEmail = normalizeEmail(userEmail || email);
  if (!normalizedEmail) throw new Error("Please enter your email.");
  if (!fullName?.trim()) throw new Error("Please enter your full name.");
  if (!phone?.trim()) throw new Error("Please enter your phone number.");
  if (!cnic?.trim()) throw new Error("Please enter your CNIC number.");
  if (!age || Number(age) < 18) throw new Error("Seller age must be 18 or above.");
  if (!gender?.trim()) throw new Error("Please select your gender.");
  if (!city?.trim()) throw new Error("Please enter your city.");
  if (!address?.trim()) throw new Error("Please enter your complete address.");
  if (!agreementAccepted) throw new Error("Please accept the seller agreement.");
  if (!/^\+?[0-9\s()-]{7,20}$/.test(phone.trim())) throw new Error("Please enter a valid phone number.");
  if (whatsapp && !/^\+?[0-9\s()-]{7,20}$/.test(whatsapp.trim())) throw new Error("Please enter a valid WhatsApp number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Please enter a valid email.");

  const existingByUser = userId ? await getSellerProfileByUserId(userId) : null;
  if (existingByUser && existingByUser.sellerStatus !== "REJECTED") {
    throw new Error("This seller application already exists.");
  }

  const sellerId = createSellerId();
  const now = new Date().toISOString();
  const sellerData = {
    id: sellerId,
    userId: userId || "",
    sellerStatus: "PENDING",
    fullName: fullName.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    whatsapp: whatsapp?.trim() || "",
    cnic: cnic.trim(),
    age: Number(age),
    gender: gender.trim(),
    city: city.trim(),
    area: area?.trim() || "",
    address: address.trim(),
    registrationDate: registrationDate || new Date().toISOString().slice(0, 10),
    status: "inactive",
    verificationStatus: "pending",
    payoutMethod: payoutMethod || "bank",
    payoutAccountName: payoutAccountName?.trim() || "",
    payoutAccountNumber: payoutAccountNumber?.trim() || "",
    payoutStatus: "PENDING",
    approvedAt: null,
    rejectedAt: null,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "sellers", sellerId), sellerData);
  notifyAdmins({
    type: "seller_application",
    title: "New seller application",
    message: `${sellerData.fullName} submitted a seller application for review.`,
    link: "/admin/sellers",
  }).catch((err) => console.error("Seller admin notification failed:", err));

  return sellerData;
}

export async function updateSellerStatus(id, sellerStatus, reason = "") {
  if (!SELLER_STATUS_VALUES.includes(sellerStatus)) {
    throw new Error("Invalid seller status.");
  }
  const sellerRef = doc(db, "sellers", id);
  const sellerSnap = await getDoc(sellerRef);
  if (!sellerSnap.exists()) throw new Error("Seller not found.");
  const prev = sellerSnap.data();
  const patch = {
    sellerStatus,
    status: sellerStatus === "APPROVED" ? "active" : sellerStatus === "PENDING" ? "inactive" : sellerStatus === "REJECTED" ? "inactive" : "suspended",
    updatedAt: new Date().toISOString(),
  };
  if (sellerStatus === "APPROVED") patch.approvedAt = new Date().toISOString();
  if (sellerStatus === "REJECTED") patch.rejectedAt = new Date().toISOString();
  if (sellerStatus === "SUSPENDED") patch.suspendedAt = new Date().toISOString();
  if (reason) patch.rejectionReason = reason;
  await updateDoc(sellerRef, patch);
  return { previous: prev.sellerStatus || prev.status || "PENDING", current: sellerStatus };
}

export async function updateSeller(id, data) {
  const patch = { ...data, updatedAt: serverTimestamp() };
  delete patch.email;
  delete patch.id;
  if (patch.age !== undefined) patch.age = patch.age ? Number(patch.age) : null;
  await updateDoc(doc(db, "sellers", id), patch);
}

export async function deleteSeller(id) {
  await deleteDoc(doc(db, "sellers", id));
}

export async function setSellerVerification(id, verificationStatus) {
  if (!SELLER_VERIFICATION_STATUSES.includes(verificationStatus)) {
    throw new Error("Invalid verification status.");
  }
  const patch = { verificationStatus, updatedAt: serverTimestamp() };
  if (verificationStatus === "verified") {
    patch.sellerStatus = "APPROVED";
    patch.status = "active";
    patch.approvedAt = new Date().toISOString();
  } else if (verificationStatus === "rejected") {
    patch.sellerStatus = "REJECTED";
    patch.status = "inactive";
    patch.rejectedAt = new Date().toISOString();
  } else {
    patch.sellerStatus = "PENDING";
    patch.status = "inactive";
  }
  await updateDoc(doc(db, "sellers", id), patch);
}

export async function setSellerStatus(id, status) {
  if (!SELLER_STATUSES.includes(status)) {
    throw new Error("Invalid seller status.");
  }
  await updateDoc(doc(db, "sellers", id), { status, updatedAt: serverTimestamp() });
}

export async function getSellerDashboardStats(sellerId) {
  const seller = await getSellerById(sellerId);
  if (!seller) return null;

  const productsSnap = await getDocs(collection(db, "products"));
  const sellerEmail = normalizeEmail(seller.email);
  const products = productsSnap.docs
    .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
    .filter((product) => product.sellerId === sellerId || normalizeEmail(product.ownerEmail) === sellerEmail);

  let orders = [];
  try {
    const ordersSnap = await getDocs(collection(db, "orders"));
    orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Seller order permissions can be narrower than admin permissions. Keep
    // the product dashboard usable even when order analytics are unavailable.
    console.warn("Seller order analytics unavailable:", err);
  }
  const sellerOrders = orders.filter((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    return items.some((item) => item.sellerId === sellerId || item.ownerEmail === seller.email);
  });

  const totalSales = sellerOrders.reduce((sum, order) => {
    const sellerItems = (order.items || []).filter((item) => item.sellerId === sellerId || item.ownerEmail === seller.email);
    return sum + sellerItems.reduce((itemTotal, item) => itemTotal + Number(item.price || 0) * Number(item.qty || 0), 0);
  }, 0);

  return {
    seller,
    products,
    totalProducts: products.length,
    activeProducts: products.filter((p) => String(p.status || "").toLowerCase() === "active").length,
    outOfStock: products.filter((p) => Number(p.stock || 0) <= 0).length,
    totalOrders: sellerOrders.length,
    pendingOrders: sellerOrders.filter((o) => ["pending", "confirmed", "processing"].includes(String(o.status || "").toLowerCase())).length,
    completedOrders: sellerOrders.filter((o) => String(o.status || "").toLowerCase() === "delivered").length,
    totalSales,
    availableBalance: totalSales * 0.85,
    pendingBalance: totalSales * 0.15,
    totalCommission: totalSales * 0.15,
  };
}
