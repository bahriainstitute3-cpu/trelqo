import { useEffect, useState } from "react";
import { listAllOrders, updateOrderStatus, updatePaymentStatus, ORDER_STATUSES } from "../../lib/orders";
import { migrateOldOrdersSellerInfo } from "../../lib/migrateSellerInfo";
import { getAppConfig, updateAppConfig } from "../../lib/appConfig";
import {
  getOrderDate, buildWhatsAppText, getUniqueSellers,
  downloadReceiptPdf, openWhatsApp,
} from "../../lib/receipt";
import OrderReceipt from "../../components/OrderReceipt";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [viewOrder, setViewOrder] = useState(null);
  const [customerViewOrder, setCustomerViewOrder] = useState(null);
  const [sellerViewOrder, setSellerViewOrder] = useState(null);
  const [adminViewOrder, setAdminViewOrder] = useState(null);
  const [migrating, setMigrating] = useState(false);

  // Site links shown as QR codes / "visit now" links at the bottom of every
  // receipt. Stored on the shared appSettings/main doc (same doc Settings
  // page already reads/writes) so it's real, admin-editable, and synced
  // across every device — not hardcoded.
  const [siteLinks, setSiteLinks] = useState([]);
  const [showLinksManager, setShowLinksManager] = useState(false);
  const [linksDraft, setLinksDraft] = useState([]);
  const [savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    getAppConfig().then((cfg) => {
      const links = Array.isArray(cfg.receiptLinks) ? cfg.receiptLinks : [];
      setSiteLinks(links);
    });
  }, []);

  function openLinksManager() {
    setLinksDraft(siteLinks.length > 0 ? siteLinks : [{ label: "Trelqo", url: "" }]);
    setShowLinksManager(true);
  }

  function updateDraftLink(idx, field, value) {
    setLinksDraft((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addDraftLink() {
    setLinksDraft((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeDraftLink(idx) {
    setLinksDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveLinks() {
    const cleaned = linksDraft
      .map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() }))
      .filter((l) => l.url);
    setSavingLinks(true);
    try {
      await updateAppConfig({ receiptLinks: cleaned });
      setSiteLinks(cleaned);
      setShowLinksManager(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not save site links.");
    } finally {
      setSavingLinks(false);
    }
  }

  // One-time helper for fixing OLD orders that were placed before the
  // seller-info fix. Safe to click more than once — it only touches items
  // that are still missing seller info.
  async function handleRunMigration() {
    if (migrating) return;
    setMigrating(true);
    try {
      const result = await migrateOldOrdersSellerInfo();
      alert(`Migration done.\nOrders checked: ${result.ordersChecked}\nOrders updated: ${result.ordersUpdated}\nItems fixed: ${result.itemsFixed}`);
      refresh();
    } catch (err) {
      console.error(err);
      alert("Migration failed — check the browser console for details.");
    } finally {
      setMigrating(false);
    }
  }

  // --- EXISTING CODE (NOTIFICATIONS & POLLING) ---
  const seenOrderIdsKey = "trelqo _admin_seen_order_ids";

  function showNewOrderNotification(order) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const show = () => {
      try {
        const notification = new Notification("Trelqo — New Order", {
          body: `Order #${order.orderNumber || order.id} received${order.total != null ? ` · Rs ${Number(order.total).toLocaleString()}` : ""}`,
          tag: `trelqo -order-${order.id}`,
          icon: "/icons/icon-192.PNG",
          badge: "/icons/icon-192.PNG",
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
          setViewOrder(order);
        };
      } catch {}
    };
    if (Notification.permission === "granted") show();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") show();
      }).catch(() => {});
    }
  }

  function refresh({ notify = false } = {}) {
    listAllOrders().then((nextOrders) => {
      if (!Array.isArray(nextOrders)) { setOrders([]); return; }
      if (notify) {
        let seenIds = [];
        try {
          seenIds = JSON.parse(localStorage.getItem(seenOrderIdsKey) || "[]");
          if (!Array.isArray(seenIds)) seenIds = [];
        } catch { seenIds = []; }
        const seenSet = new Set(seenIds);
        const newOrders = nextOrders.filter((order) => order?.id && !seenSet.has(order.id));
        const nextSeenIds = Array.from(new Set([...seenIds, ...nextOrders.map((order) => order?.id).filter(Boolean)])).slice(-500);
        try { localStorage.setItem(seenOrderIdsKey, JSON.stringify(nextSeenIds)); } catch {}
        newOrders.forEach(showNewOrderNotification);
      }
      setOrders(nextOrders);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    listAllOrders().then((initialOrders) => {
      const safeOrders = Array.isArray(initialOrders) ? initialOrders : [];
      setOrders(safeOrders);
      try {
        const existingIds = safeOrders.map((order) => order?.id).filter(Boolean);
        localStorage.setItem(seenOrderIdsKey, JSON.stringify(existingIds.slice(-500)));
      } catch {}
    }).finally(() => setLoading(false));
    const interval = setInterval(() => refresh({ notify: true }), 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleStatusChange(id, status) {
    await updateOrderStatus(id, status);
    refresh();
  }

  async function handlePaymentChange(id, status) {
    await updatePaymentStatus(id, status);
    refresh();
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  // --- END EXISTING CODE ---

  // ---------------- Receipt actions (Print / Download / WhatsApp) ----------------

  // WhatsApp: Customer receipt -> customer's number, Seller receipt -> that seller's
  // number (only if there is exactly one seller with a phone). Otherwise WhatsApp
  // opens with the text ready so you can pick the contact yourself.
  // Must stay synchronous (no await before window.open) or mobile blocks the popup.
  function shareOnWhatsApp(type, order) {
    const text = buildWhatsAppText(type, order);
    let phone = "";
    if (type === "Customer") {
      phone = order.address?.phone || order.customer?.phone || "";
    } else if (type === "Seller") {
      const phones = getUniqueSellers(order).map((s) => s.seller?.phone).filter(Boolean);
      if (phones.length === 1) phone = phones[0];
    }
    openWhatsApp(phone, text);
  }

  // Download: real PDF file (works on desktop and mobile). Does NOT touch the page DOM.
  async function downloadReceipt(type, order) {
    try {
      await downloadReceiptPdf(
        `receipt-${type}-${order.id}`,
        `Trelqo-${type}-Order-${order.orderNumber || order.id}`
      );
    } catch (err) {
      console.error(err);
      alert("PDF could not be created: " + (err?.message || err));
    }
  }

  // Print: prints a copy of the slip inside a hidden iframe.
  // (The old version replaced document.body.innerHTML, which destroyed React's
  // DOM — that is why every button stopped working after the first click.)
  function printReceipt(type, order) {
    const el = document.getElementById(`receipt-${type}-${order.id}`);
    if (!el) return;

    const clone = el.cloneNode(true);
    // canvases (QR codes) are empty when cloned -> convert them to images
    const srcCanvases = el.querySelectorAll("canvas");
    clone.querySelectorAll("canvas").forEach((c, i) => {
      try {
        const img = document.createElement("img");
        img.src = srcCanvases[i].toDataURL("image/png");
        img.style.cssText = c.style.cssText;
        c.replaceWith(img);
      } catch { /* ignore */ }
    });

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win.document;
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join("\n");

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      headStyles +
      `<style>@page{margin:8mm} html,body{margin:0;background:#fff}</style>` +
      `</head><body>${clone.outerHTML}</body></html>`
    );
    doc.close();
    doc.title = `Trelqo-${type}-Order-${order.orderNumber || order.id}`;

    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    win.onafterprint = cleanup;
    setTimeout(cleanup, 120000); // safety cleanup

    const imgsReady = Promise.all(
      Array.from(doc.images).map((im) =>
        im.complete ? null : new Promise((res) => { im.onload = im.onerror = res; })
      )
    );
    Promise.race([imgsReady, new Promise((res) => setTimeout(res, 4000))]).then(() => {
      setTimeout(() => {
        try { win.focus(); win.print(); } catch (e) { console.error(e); cleanup(); }
      }, 300);
    });
  }

  return (
    <div>
      <div className="admin-page-header admin-row-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24 }}>Orders</h1>
        <div className="admin-row-wrap" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={openLinksManager}
            title="Add or edit the site link(s) shown as QR codes on every receipt"
            style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: "pointer" }}
          >
            🔗 Site Links ({siteLinks.length || 1})
          </button>
          <button
            onClick={handleRunMigration}
            disabled={migrating}
            title="Backfills seller info into old orders placed before the fix"
            style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: migrating ? "not-allowed" : "pointer" }}
          >
            {migrating ? "🔄 Fixing…" : "🔄 Fix Old Orders"}
          </button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }}>
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && filtered.length === 0 && <div className="empty-state">No orders found.</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        {filtered.map((o) => (
          <div key={o.id} style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <div className="admin-row-stack" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>#{o.orderNumber}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {o.address?.fullName || o.customer?.name} · {o.address?.phone || o.customer?.phone} · {o.items?.length || 0} item(s)
                  {getOrderDate(o) && <> · {getOrderDate(o)}</>}
                </div>
              </div>
              <div className="admin-row-wrap" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>Rs {o.total?.toLocaleString()}</div>
                <button onClick={() => setViewOrder(o)} style={orderBtnStyle}>View</button>
                <button onClick={() => setCustomerViewOrder(o)} style={orderBtnStyle}>View as Customer</button>
                <button onClick={() => setSellerViewOrder(o)} style={orderBtnStyle}>View as Seller</button>
                <button onClick={() => setAdminViewOrder(o)} style={orderBtnStyle}>View as Admin</button>
              </div>
            </div>
            <div className="admin-row-wrap" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>ORDER STATUS</label>
                <select value={o.status} onChange={(e) => handleStatusChange(o.id, e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--line)" }}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>PAYMENT</label>
                {String(o.paymentMethod || "").toLowerCase() === "cod" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", minHeight: 32, padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--line)", color: "var(--ink-soft)", fontSize: 13 }}>
                    Cash on delivery
                  </span>
                ) : (
                  <select value={o.paymentStatus || "pending"} onChange={(e) => handlePaymentChange(o.id, e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--line)" }}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- SITE LINKS MANAGER --- */}
      {showLinksManager && (
        <div onClick={() => setShowLinksManager(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} className="admin-modal-box card" style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 20, background: "#fff", borderRadius: 12 }}>
            <h3 style={{ fontSize: 17, marginBottom: 6 }}>Site Links for Receipts</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
              These show as QR codes + "visit now" links at the bottom of every Customer / Seller / Admin receipt. Add one link, or several.
            </p>
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {linksDraft.map((l, idx) => (
                <div key={idx} className="admin-row-wrap" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    placeholder="Label (e.g. ShopHub)"
                    value={l.label}
                    onChange={(e) => updateDraftLink(idx, "label", e.target.value)}
                    style={{ flex: "1 1 120px", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--line)", minWidth: 0 }}
                  />
                  <input
                    placeholder="https://your-site.com/"
                    value={l.url}
                    onChange={(e) => updateDraftLink(idx, "url", e.target.value)}
                    style={{ flex: "2 1 200px", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--line)", minWidth: 0 }}
                  />
                  <button onClick={() => removeDraftLink(idx)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: "pointer", color: "var(--danger)" }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={addDraftLink} style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1.5px dashed var(--line)", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              + Add another link
            </button>
            <div className="admin-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowLinksManager(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveLinks} disabled={savingLinks} className="btn btn-primary" style={{ padding: "8px 14px" }}>
                {savingLinks ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RAW VIEW MODAL --- */}
      {viewOrder && (
        <div onClick={() => setViewOrder(null)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} className="admin-modal-box card" style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 20, background: "#fff", borderRadius: 12, position: "relative" }}>
            <button onClick={() => setViewOrder(null)} style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>Order #{viewOrder.orderNumber}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(viewOrder).map(([key, value]) => (
                <div key={key} style={{ fontSize: 13.5, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 11, textTransform: "uppercase", marginBottom: 2 }}>
                    {key.replace(/([A-Z])/g, " $1")}
                  </div>
                  <div style={{ overflowWrap: "anywhere" }}>{typeof value === "object" ? JSON.stringify(value) : String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOMER / SELLER / ADMIN RECEIPT MODALS --- */}
      <ReceiptModal type="Customer" order={customerViewOrder} onClose={() => setCustomerViewOrder(null)} siteLinks={siteLinks} onPrint={printReceipt} onDownload={downloadReceipt} onWhatsApp={shareOnWhatsApp} />
      <ReceiptModal type="Seller" order={sellerViewOrder} onClose={() => setSellerViewOrder(null)} siteLinks={siteLinks} onPrint={printReceipt} onDownload={downloadReceipt} onWhatsApp={shareOnWhatsApp} />
      <ReceiptModal type="Admin" order={adminViewOrder} onClose={() => setAdminViewOrder(null)} siteLinks={siteLinks} onPrint={printReceipt} onDownload={downloadReceipt} onWhatsApp={shareOnWhatsApp} />
    </div>
  );
}

function ReceiptModal({ type, order, onClose, siteLinks, onPrint, onDownload, onWhatsApp }) {
  const [downloading, setDownloading] = useState(false);
  if (!order) return null;

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload(type, order);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} className="admin-modal-box" style={{ maxWidth: 820, width: "100%", background: "transparent", borderRadius: 12, position: "relative" }}>
        <div className="admin-modal-actions" style={{ textAlign: "right", marginBottom: 14, display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <button onClick={onClose} style={modalActionBtnStyle}>✕ Close</button>
          <button onClick={() => onPrint(type, order)} style={modalActionBtnStyle}>🖨️ Print</button>
          <button onClick={handleDownload} disabled={downloading} style={{ ...modalActionBtnStyle, opacity: downloading ? 0.7 : 1, cursor: downloading ? "wait" : "pointer" }}>
            {downloading ? "⏳ Preparing…" : "⬇️ Download"}
          </button>
          <button onClick={() => onWhatsApp(type, order)} style={{ ...modalActionBtnStyle, border: "1.5px solid #25D366", background: "#25D366", color: "#fff" }}>📱 WhatsApp</button>
        </div>
        <OrderReceipt type={type} order={order} siteLinks={siteLinks} />
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
  alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto",
};

const orderBtnStyle = { padding: "6px 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: "pointer" };

const modalActionBtnStyle = { padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "#fff", cursor: "pointer" };