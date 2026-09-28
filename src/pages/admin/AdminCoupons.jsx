import { useEffect, useState } from "react";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "../../lib/coupons";

const empty = { code: "", type: "percentage", value: "", minOrder: "0", maxDiscount: "", active: true };

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    listCoupons().then(setItems);
  }

  useEffect(() => refresh(), []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!form.code.trim() || !form.value) return setError("Code and value are required.");
    setBusy(true);
    try {
      await createCoupon({ ...form, value: Number(form.value), minOrder: Number(form.minOrder || 0), maxDiscount: Number(form.maxDiscount || 0) });
      setForm(empty);
      refresh();
    } catch (err) {
      setError(err.message || "Could not create coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(coupon) {
    await updateCoupon(coupon.id, { active: !coupon.active });
    refresh();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this coupon?")) return;
    await deleteCoupon(id);
    refresh();
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Coupons</h1>

      <form onSubmit={handleAdd} className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="field"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="field"><label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
          <div className="field"><label>Value</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>Min Order</label><input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} /></div>
          <div className="field"><label>Max Discount</label><input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} /></div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 16 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
        </label>

        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-accent" disabled={busy}>{busy ? "Saving…" : "Create Coupon"}</button>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0 && <div className="empty-state">No coupons yet.</div>}
        {items.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{c.code}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{c.type === "fixed" ? "Fixed" : "Percent"} · {c.value}{c.type === "percentage" ? "%" : " Rs"} · Min {Number(c.minOrder || 0).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>{c.active ? "Disable" : "Enable"}</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
