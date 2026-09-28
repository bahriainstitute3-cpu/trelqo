import { useEffect, useState } from "react";
import { createBanner, deleteBanner, listBanners, updateBanner } from "../../lib/banners";
import { cdnBanner } from "../../lib/imageUrl";

const empty = { title: "", imageUrl: "", link: "/", active: true };

export default function AdminBanners() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    listBanners().then(setItems);
  }

  useEffect(() => refresh(), []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.imageUrl.trim()) return setError("Title and image URL are required.");
    setBusy(true);
    try {
      await createBanner(form);
      setForm(empty);
      refresh();
    } catch (err) {
      setError(err.message || "Could not create banner.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(banner) {
    await updateBanner(banner.id, { active: !banner.active });
    refresh();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this banner?")) return;
    await deleteBanner(id);
    refresh();
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Banners</h1>

      <form onSubmit={handleAdd} className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Image URL</label><input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
        <div className="field"><label>Link</label><input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 16 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
        </label>

        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-accent" disabled={busy}>{busy ? "Saving…" : "Create Banner"}</button>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0 && <div className="empty-state">No banners yet.</div>}
        {items.map((b) => (
          <div key={b.id} className="admin-row-stack" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <img src={cdnBanner(b.imageUrl, 240)} alt={b.title} style={{ width: 96, aspectRatio: "2.35 / 1", objectFit: "contain", borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{b.link}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(b)}>{b.active ? "Disable" : "Enable"}</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
