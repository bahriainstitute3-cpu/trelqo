import { useEffect, useMemo, useState } from "react";
import {
  SELLER_STATUSES,
  SELLER_VERIFICATION_STATUSES,
  createSeller,
  deleteSeller,
  listSellers,
  setSellerStatus,
  setSellerVerification,
  updateSeller,
} from "../../lib/sellers";

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  cnic: "",
  email: "",
  age: "",
  gender: "",
  address: "",
  postalCode: "",
  city: "",
  area: "",
  registrationDate: new Date().toISOString().slice(0, 10),
  status: "active",
  verificationStatus: "pending",
  notes: "",
};

const VERIFICATION_LABELS = {
  pending: "Pending",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
};

const VERIFICATION_COLORS = {
  pending: { bg: "#fff4dd", fg: "#a9720b" },
  under_review: { bg: "#e6f0ff", fg: "#1a56b0" },
  verified: { bg: "#e6f9f7", fg: "var(--teal)" },
  rejected: { bg: "#ffe6e6", fg: "var(--danger)" },
};

const STATUS_LABELS = { active: "Active", inactive: "Inactive", suspended: "Suspended" };

function Field({ label, children }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label style={{ fontSize: 12 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)", width: "100%" };

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding new
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [viewSeller, setViewSeller] = useState(null);

  function refresh() {
    setLoading(true);
    listSellers()
      .then(setSellers)
      .catch((err) => setError(err.message || "Could not load sellers."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellers.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (verificationFilter !== "all" && s.verificationStatus !== verificationFilter) return false;
      if (!q) return true;
      return (
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.city || "").toLowerCase().includes(q)
      );
    });
  }, [sellers, search, statusFilter, verificationFilter]);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(seller) {
    setEditingId(seller.id);
    setForm({
      fullName: seller.fullName || "",
      phone: seller.phone || "",
      cnic: seller.cnic || "",
      email: seller.email || "",
      age: seller.age ?? "",
      gender: seller.gender || "",
      address: seller.address || "",
      postalCode: seller.postalCode || "",
      city: seller.city || "",
      area: seller.area || "",
      registrationDate: seller.registrationDate || new Date().toISOString().slice(0, 10),
      status: seller.status || "active",
      verificationStatus: seller.verificationStatus || "pending",
      notes: seller.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.fullName.trim()) return setFormError("Full name is required.");
    if (!form.email.trim()) return setFormError("Email address is required.");
    if (!form.phone.trim()) return setFormError("Phone number is required.");

    setBusy(true);
    try {
      if (editingId) {
        await updateSeller(editingId, form);
        flashSuccess("✓ Seller updated");
      } else {
        await createSeller(form);
        flashSuccess("✓ Seller added");
      }
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err.message || "Could not save seller.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(seller) {
    if (!confirm(`Delete seller "${seller.fullName}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteSeller(seller.id);
      flashSuccess("✓ Seller deleted");
      refresh();
    } catch (err) {
      setError(err.message || "Could not delete seller.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerificationChange(seller, verificationStatus) {
    setBusy(true);
    try {
      await setSellerVerification(seller.id, verificationStatus);
      flashSuccess(`✓ Marked ${VERIFICATION_LABELS[verificationStatus]}`);
      refresh();
    } catch (err) {
      setError(err.message || "Could not update verification status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(seller, status) {
    setBusy(true);
    try {
      await setSellerStatus(seller.id, status);
      flashSuccess("✓ Status updated");
      refresh();
    } catch (err) {
      setError(err.message || "Could not update seller status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="admin-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24 }}>🧑‍💼 Sellers</h1>
        <button className="btn btn-accent" onClick={openAddForm}>➕ Add Seller</button>
      </div>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20, fontSize: 13.5 }}>
        Add, verify, and manage every registered seller. All changes save to Firebase immediately.
      </p>

      {error && <div style={{ background: "#ffe6e6", color: "var(--danger)", padding: 12, borderRadius: 10, marginBottom: 16 }}>❌ {error}</div>}
      {success && <div style={{ background: "#e6f9f7", color: "var(--teal)", padding: 12, borderRadius: 10, marginBottom: 16 }}>{success}</div>}

      {/* SEARCH + FILTERS */}
      <div className="card admin-row-wrap" style={{ padding: 16, marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by name, email, phone, or city…"
          style={{ ...inputStyle, flex: 2, minWidth: 200 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 140 }}>
          <option value="all">All statuses</option>
          {SELLER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
          <option value="all">All verification statuses</option>
          {SELLER_VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{VERIFICATION_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>⏳ Loading sellers…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
            {sellers.length === 0 ? "No sellers yet — click \"Add Seller\" to register one." : "No sellers match your search/filters."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
              <thead>
                <tr style={{ background: "var(--bg)", textAlign: "left" }}>
                  {["Seller", "Phone", "Email", "City", "Status", "Verification", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const vColor = VERIFICATION_COLORS[s.verificationStatus] || VERIFICATION_COLORS.pending;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                        {s.fullName}
                        {s.verificationStatus === "verified" && (
                          <span title="Verified Seller" style={{ marginLeft: 6, color: "var(--teal)" }}>✓</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>{s.phone}</td>
                      <td style={{ padding: "12px 14px" }}>{s.email}</td>
                      <td style={{ padding: "12px 14px" }}>{s.city || "—"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <select
                          value={s.status}
                          onChange={(e) => handleStatusChange(s, e.target.value)}
                          disabled={busy}
                          style={{ padding: "5px 8px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 12.5 }}
                        >
                          {SELLER_STATUSES.map((st) => (
                            <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <select
                          value={s.verificationStatus}
                          onChange={(e) => handleVerificationChange(s, e.target.value)}
                          disabled={busy}
                          style={{ padding: "5px 8px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12.5, background: vColor.bg, color: vColor.fg }}
                        >
                          {SELLER_VERIFICATION_STATUSES.map((v) => (
                            <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setViewSeller(s)}>👁️ View</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(s)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {formOpen && (
        <div
          onClick={closeForm}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="card admin-modal-box"
            style={{ maxWidth: 560, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 22, background: "#fff", borderRadius: 12, position: "relative" }}
          >
            <button type="button" onClick={closeForm} style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>{editingId ? "Edit Seller" : "Add Seller"}</h3>

            <div className="admin-grid-2c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Field label="Full Name"><input style={inputStyle} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <Field label="Phone Number"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email Address">
                <input type="email" style={inputStyle} value={form.email} disabled={!!editingId} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="CNIC"><input style={inputStyle} value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="xxxxx-xxxxxxx-x" /></Field>
              <Field label="Age"><input type="number" min="0" style={inputStyle} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></Field>
              <Field label="Gender">
                <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="City"><input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Area"><input style={inputStyle} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
              <Field label="Postal Code"><input style={inputStyle} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
              <Field label="Registration Date"><input type="date" style={inputStyle} value={form.registrationDate} onChange={(e) => setForm({ ...form, registrationDate: e.target.value })} /></Field>
              <Field label="Seller Status">
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {SELLER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </Field>
              <Field label="Verification Status">
                <select style={inputStyle} value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}>
                  {SELLER_VERIFICATION_STATUSES.map((v) => <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>)}
                </select>
              </Field>
            </div>

            <div className="field" style={{ marginBottom: 4 }}>
              <label>Complete Address</label>
              <textarea rows={2} style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Notes (optional)</label>
              <textarea rows={2} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any other relevant seller information…" />
            </div>

            {formError && <p className="error-text">{formError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="btn btn-accent" disabled={busy}>{busy ? "Saving…" : editingId ? "Save Changes" : "Add Seller"}</button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewSeller && (
        <div
          onClick={() => setViewSeller(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card admin-modal-box"
            style={{ maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 20, background: "#fff", borderRadius: 12, position: "relative" }}
          >
            <button onClick={() => setViewSeller(null)} style={{ position: "absolute", top: 10, right: 10, border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>✕</button>
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>{viewSeller.fullName}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Phone", viewSeller.phone],
                ["Email", viewSeller.email],
                ["CNIC", viewSeller.cnic],
                ["Age", viewSeller.age],
                ["Gender", viewSeller.gender],
                ["City", viewSeller.city],
                ["Area", viewSeller.area],
                ["Postal Code", viewSeller.postalCode],
                ["Complete Address", viewSeller.address],
                ["Registration Date", viewSeller.registrationDate],
                ["Status", STATUS_LABELS[viewSeller.status] || viewSeller.status],
                ["Verification", VERIFICATION_LABELS[viewSeller.verificationStatus] || viewSeller.verificationStatus],
                ["Notes", viewSeller.notes],
              ].map(([label, value]) => (
                <div key={label} style={{ fontSize: 13.5, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 11, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div>{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}