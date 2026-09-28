import { useEffect, useState } from "react";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../../lib/categories";
import CategoryIcon, { CATEGORY_ICON_OPTIONS, guessCategoryIcon, resolveCategoryIcon } from "../../components/CategoryIcon";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Edit-in-place ke liye
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  function refresh() {
    listCategories().then(setCategories);
  }
  useEffect(refresh, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const finalIcon = icon === "auto" ? guessCategoryIcon(name) : icon;
      await createCategory({ name: name.trim(), icon: finalIcon, order: categories.length });
      setName("");
      setIcon("auto");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon || "auto");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(c) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      const finalIcon = editIcon === "auto" ? guessCategoryIcon(editName) : editIcon;
      await updateCategory(c.id, { name: editName.trim(), icon: finalIcon });
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c) {
    await updateCategory(c.id, { active: !c.active });
    refresh();
  }

  async function handleDelete(c) {
    if (!confirm(`Delete category "${c.name}"? Products in this category will remain but won't show under it.`)) return;
    await deleteCategory(c.id);
    refresh();
  }

  const previewIcon = icon === "auto" ? guessCategoryIcon(name || "?") : icon;

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Categories</h1>

      <form onSubmit={handleAdd} className="card" style={{ padding: 18, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)" }} />
        <select value={icon} onChange={(e) => setIcon(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)" }}>
          {CATEGORY_ICON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div title="Icon preview" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 10, background: "var(--bg)", color: "var(--teal)" }}>
          <CategoryIcon icon={previewIcon} />
        </div>
        <button className="btn btn-accent" disabled={busy}>Add</button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflow: "hidden" }}>
        {categories.length === 0 && <div className="empty-state">No categories yet.</div>}
        {categories.map((c) => (
          <div key={c.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            {editingId === c.id ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ flex: 1, minWidth: 140, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }} />
                <select value={editIcon} onChange={(e) => setEditIcon(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }}>
                  {CATEGORY_ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(c)}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
              </div>
            ) : (
              <div className="admin-row-stack" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "var(--bg)", color: "var(--teal)", flexShrink: 0 }}>
                    <CategoryIcon icon={resolveCategoryIcon(c)} size={20} />
                  </div>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>{c.active ? "Deactivate" : "Activate"}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}