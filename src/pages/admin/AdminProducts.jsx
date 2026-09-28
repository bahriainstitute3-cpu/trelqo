import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAllProductsForAdmin, deleteProduct, updateProduct } from "../../lib/products";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    listAllProductsForAdmin().then(setProducts).finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteProduct(id);
    refresh();
  }

  async function toggleStatus(p) {
    await updateProduct(p.id, { status: p.status === "active" ? "inactive" : "active" });
    refresh();
  }

  return (
    <div>
      <div className="admin-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>Products</h1>
        <Link to="/admin/products/new" className="btn btn-accent">+ Add Product</Link>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && products.length === 0 && <div className="empty-state">No products yet. Add your first one.</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        {products.map((p) => (
          <div key={p.id} className="admin-row-stack" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ width: 46, height: 46, borderRadius: 8, overflow: "hidden", background: "#f0efe8", flexShrink: 0 }}>
              {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>SKU: {p.sku || "—"} · Stock: {p.stock}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Rs {(p.salePrice || p.price).toLocaleString()}</div>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
              background: p.status === "active" ? "#e4f3e8" : "#f2e4e4",
              color: p.status === "active" ? "var(--success)" : "var(--danger)",
            }}>{p.status}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(p)}>{p.status === "active" ? "Deactivate" : "Activate"}</button>
            <Link to={`/admin/products/${p.id}`} className="btn btn-outline btn-sm">Edit</Link>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
