// Shared helpers for rendering order receipts (Customer / Seller / Admin
// views in AdminOrders, and anywhere else a receipt needs to be built).
//
// PERFORMANCE: html2canvas + jsPDF (~650KB combined) are only needed when an
// admin actually downloads/shares a PDF receipt. They used to be imported
// statically at the top of this file, which pulled all ~650KB into the same
// bundle as every other page that (even indirectly) touches this file. They
// are now loaded on demand, right before use, so a normal shopper never
// downloads this code at all.
let _pdfLibsPromise = null;
function loadPdfLibs() {
  if (!_pdfLibsPromise) {
    _pdfLibsPromise = Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]).then(([html2canvasMod, jspdfMod]) => ({
      html2canvas: html2canvasMod.default,
      jsPDF: jspdfMod.jsPDF,
    }));
  }
  return _pdfLibsPromise;
}

export function getOrderDate(o) {
  const raw = o.createdAt || o.date || o.orderDate || o.timestamp || o.created_at;
  if (!raw) return null;
  try {
    const d = raw.toDate ? raw.toDate() : new Date(raw);
    return isNaN(d.getTime()) ? String(raw) : d.toLocaleString();
  } catch { return String(raw); }
}

export function getOrderDay(o) {
  const raw = o.createdAt || o.date || o.orderDate || o.timestamp || o.created_at;
  if (!raw) return null;
  try {
    const d = raw.toDate ? raw.toDate() : new Date(raw);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "long" });
  } catch { return ""; }
}

export function getOrderTime(o) {
  const raw = o.createdAt || o.date || o.orderDate || o.timestamp || o.created_at;
  if (!raw) return null;
  try {
    const d = raw.toDate ? raw.toDate() : new Date(raw);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString();
  } catch { return ""; }
}

export function formatPrice(val) {
  const num = Number(val);
  return isNaN(num) ? "—" : `Rs ${num.toLocaleString()}`;
}

// Normalizes seller info for one order item into a single object:
// { name, phone, email, paymentMethod, accountTitle, accountNumber, bankName }.
//
// Priority:
//  1. A nested seller/store/vendor OBJECT on the item (older/alternate data shapes).
//  2. Flat fields on the item — this is what src/lib/orders.js saves today
//     (ownerName, ownerEmail, sellerPhone, sellerPaymentMethod, sellerAccountTitle,
//     sellerAccountNumber, sellerBankName), so this is the common case for new orders.
//  3. null if nothing usable is found (receipt shows "Unknown Seller").
export function getItemSeller(item) {
  if (!item) return null;

  const nested = item.seller || item.store || item.vendor || item.productOwner || item.owner ||
    item.sellerInfo || item.storeInfo || item.vendorInfo || item.productOwnerInfo || item.ownerInfo;

  if (nested && typeof nested === "object") {
    const name = nested.name || nested.storeName || nested.sellerName || nested.ownerName || nested.shopName || null;
    const phone = nested.phone || nested.sellerPhone || nested.ownerPhone || nested.contact || nested.mobile || nested.phoneNumber || null;
    const email = nested.email || nested.sellerEmail || nested.ownerEmail || nested.emailAddress || nested.emailId || null;
    const pay = nested.paymentInfo || nested.bankDetails || nested.payment || {};
    const paymentMethod = nested.sellerPaymentMethod || nested.paymentMethod || null;
    const accountTitle = pay.accountTitle || pay.title || nested.sellerAccountTitle || nested.accountTitle || null;
    const accountNumber = pay.accountNumber || pay.account || nested.sellerAccountNumber || nested.accountNumber || null;
    const bankName = pay.bankName || pay.bank || nested.sellerBankName || nested.bankName || null;
    if (!name && !phone && !email) return null;
    return { name, phone, email, paymentMethod, accountTitle, accountNumber, bankName };
  }

  // Flat fields — matches what lib/orders.js saves on each order item today.
  const name = item.ownerName || item.sellerName || item.vendorName || item.storeName || item.shopName || null;
  const email = item.ownerEmail || item.sellerEmail || item.vendorEmail || null;
  const phone = item.sellerPhone || item.ownerPhone || item.vendorPhone || null;
  const paymentMethod = item.sellerPaymentMethod || null;
  const accountTitle = item.sellerAccountTitle || null;
  const accountNumber = item.sellerAccountNumber || null;
  const bankName = item.sellerBankName || null;

  if (!name && !email && !phone) return null;
  return { name, phone, email, paymentMethod, accountTitle, accountNumber, bankName };
}

// Per-product-item summary used inline in the Admin receipt (name/phone/email only).
export function getItemSellerSummary(item) {
  const seller = getItemSeller(item);
  return {
    name: seller?.name || null,
    phone: seller?.phone || null,
    email: seller?.email || null,
  };
}

// Groups order items by seller (keyed by email, falling back to name) so the
// Seller/Admin receipts can show one card per seller with all their products
// and their bank/payment details together.
export function getUniqueSellers(order) {
  if (!order?.items || !Array.isArray(order.items)) return [];

  const sellersMap = new Map();

  order.items.forEach((item) => {
    const seller = getItemSeller(item);
    const key = seller ? (seller.email || seller.name || JSON.stringify(seller)) : "unknown";
    if (!sellersMap.has(key)) {
      sellersMap.set(key, { seller: seller || { name: "Unknown Seller", phone: null, email: null }, items: [] });
    }
    sellersMap.get(key).items.push(item);
  });

  return Array.from(sellersMap.values());
}

// Extract payment/bank details for a normalized seller object (from getItemSeller).
export function getBankDetails(order, seller) {
  if (!seller) return null;
  if (!seller.accountNumber && !seller.bankName && !seller.accountTitle) return null;
  return {
    accountNumber: seller.accountNumber || "—",
    accountTitle: seller.accountTitle || "—",
    bankName: seller.bankName || "—",
    iban: "—",
    branchCode: "—",
    otherDetails: "",
  };
}

// Builds a plain-text summary of a receipt for sharing via WhatsApp.
export function buildWhatsAppText(type, order) {
  const lines = [];
  lines.push(`*Trelqo — ${type} Receipt*`);
  lines.push(`Order #: ${order.orderNumber || order.id}`);
  if (getOrderDate(order)) lines.push(`Date: ${getOrderDate(order)}`);
  lines.push("");
  lines.push("*Items:*");
  (order.items || []).forEach((item) => {
    const qty = item.quantity || item.qty || 1;
    lines.push(`- ${item.productName || item.name || "—"} x${qty} — ${formatPrice(item.price)}`);
    if (type !== "Customer") {
      const s = getItemSellerSummary(item);
      if (s.name) lines.push(`  Seller: ${s.name}${s.phone ? " · " + s.phone : ""}`);
    }
  });
  lines.push("");
  lines.push(`*Total: ${formatPrice(order.total)}*`);
  if (type !== "Seller") {
    lines.push("");
    lines.push("*Customer:*");
    lines.push(order.address?.fullName || order.customer?.name || "—");
    lines.push(order.address?.phone || order.customer?.phone || "—");
  }
  return lines.join("\n");
}

// ====================== PDF download / share ======================
// npm i html2canvas jspdf

// Slip is always captured at desktop width so the PDF looks the same
// on phone and desktop (mobile layout stacks the table, which looks bad in PDF).
const CAPTURE_WIDTH = 900;

async function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  imgs.forEach((img) => { img.loading = "eager"; });
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = img.onerror = () => resolve();
          setTimeout(resolve, 4000); // never hang forever
        })
    )
  );
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }
}

export async function buildReceiptPdf(elementId) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Receipt not found on page (#${elementId})`);

  const { html2canvas, jsPDF } = await loadPdfLibs();

  await waitForImages(el);

  const isMobile = window.innerWidth < 768;
  const canvas = await html2canvas(el, {
    scale: isMobile ? 1.5 : 2, // lower scale on phones = no canvas memory crash
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: CAPTURE_WIDTH,
    onclone: (doc) => {
      const clone = doc.getElementById(elementId);
      if (!clone) return;
      clone.style.width = `${CAPTURE_WIDTH}px`;
      clone.style.maxWidth = "none";
      clone.style.margin = "0";
      // if the slip sits inside a scrollable modal, un-clip it in the clone
      let p = clone.parentElement;
      while (p && p !== doc.body) {
        p.style.overflow = "visible";
        p.style.maxHeight = "none";
        p.style.height = "auto";
        p = p.parentElement;
      }
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  let w = pageW;
  let h = (canvas.height * w) / canvas.width;

  if (h <= pageH) {
    pdf.addImage(imgData, "JPEG", 0, 0, w, h);
  } else if (h <= pageH * 1.25) {
    // slightly taller than one page -> shrink to fit one page
    const scale = pageH / h;
    w = w * scale;
    h = pageH;
    pdf.addImage(imgData, "JPEG", (pageW - w) / 2, 0, w, h);
  } else {
    // long slip -> multiple pages
    let left = h;
    let pos = 0;
    pdf.addImage(imgData, "JPEG", 0, pos, w, h);
    left -= pageH;
    while (left > 0) {
      pos = left - h;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, pos, w, h);
      left -= pageH;
    }
  }
  return pdf;
}

const safeName = (name) =>
  String(name || "order-slip").replace(/[^\w\-\.]+/g, "_").replace(/\.pdf$/i, "") + ".pdf";

export async function downloadReceiptPdf(elementId, fileName) {
  const pdf = await buildReceiptPdf(elementId);
  pdf.save(safeName(fileName));
}

// Mobile: opens the native share sheet with the PDF (WhatsApp shows there).
// Falls back to normal download if the browser can't share files.
export async function sharePdfFile(elementId, fileName, text = "") {
  const pdf = await buildReceiptPdf(elementId);
  const name = safeName(fileName);
  const blob = pdf.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  pdf.save(name);
  return "downloaded";
}

// ====================== WhatsApp ======================

// 0300-1234567 / +92 300 1234567 / 3001234567  ->  923001234567
export function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d;
}

// IMPORTANT: call this directly inside the click handler (no await before it),
// otherwise mobile browsers block the popup.
export function openWhatsApp(phone, text) {
  const num = normalizePhone(phone);
  const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  // NOTE: no "noopener" here - it makes window.open return null, which would
  // wrongly trigger the fallback and navigate the current tab away too.
  const win = window.open(url, "_blank");
  if (win) win.opener = null;
  else window.location.href = url; // popup blocked -> open in same tab
}