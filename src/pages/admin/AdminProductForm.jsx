import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProduct, createProduct, updateProduct } from "../../lib/products";
import { listCategories } from "../../lib/categories";
import { useAuth } from "../../context/AuthContext";

const PAYMENT_METHODS = [
  { id: "cod", name: "Cash on Delivery Only" },
  { id: "bank", name: "Bank Transfer" },
  { id: "jazzcash", name: "JazzCash" },
  { id: "easypaisa", name: "EasyPaisa" },
];

const empty = {
  name: "", slug: "", sku: "", barcode: "", brand: "", categoryId: "", categoryName: "",
  description: "", specifications: "", price: "", salePrice: "", discountPercent: "", stock: "", lowStockThreshold: "5",
  featured: false, status: "active", images: [""], sellerPhone: "",
  // NEW — customer ko checkout par yehi delivery/payment method aur
  // bank details dikhengi jo yahan admin/seller ne set ki hain.
  sellerPaymentMethod: "cod", sellerAccountTitle: "", sellerAccountNumber: "", sellerBankName: "",
};

export default function AdminProductForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const isEdit = !!id;
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listCategories().then(setCategories);
    if (isEdit) {
      getProduct(id).then((p) => {
        if (p) setForm({ ...empty, ...p, images: p.images?.length ? p.images : [""] });
      });
    }
  }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateImage(idx, value) {
    setForm((f) => {
      const images = [...f.images];
      images[idx] = value;
      return { ...f, images };
    });
  }

  function addImageField() {
    setForm((f) => ({ ...f, images: [...f.images, ""] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.price || !form.categoryId) {
      return setError("Name, price, and category are required.");
    }
    if (form.sellerPaymentMethod !== "cod" && !form.sellerAccountNumber.trim()) {
      return setError("Account number is required for non-COD payment methods.");
    }
    setBusy(true);
    try {
      const categoryName = categories.find((c) => c.id === form.categoryId)?.name || "";
      const price = Number(form.price) || 0;
      const discountPercent = Math.min(99, Math.max(0, Number(form.discountPercent) || 0));
      const salePrice = discountPercent > 0 ? Math.round(price * (1 - discountPercent / 100)) : (Number(form.salePrice) || "");
      const payload = { ...form, categoryName, images: form.images.filter(Boolean), price, salePrice, discountPercent };
      if (isEdit) {
        await updateProduct(id, payload);
      } else {
        // ownerEmail must be set to the creating admin's email — Firestore
        // rules require request.resource.data.ownerEmail === auth email.
        await createProduct({ ...payload, ownerEmail: user?.email || "" });
      }
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>{isEdit ? "Edit Product" : "Add Product"}</h1>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
        <div className="field"><label>Product Name *</label><input required value={form.name} onChange={(e) => update("name", e.target.value)} /></div>

        <div className="admin-grid-2c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>SKU</label><input value={form.sku} onChange={(e) => update("sku", e.target.value)} /></div>
          <div className="field"><label>Barcode</label><input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} /></div>
        </div>

        <div className="admin-grid-2c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>Brand</label><input value={form.brand} onChange={(e) => update("brand", e.target.value)} /></div>
          <div className="field">
            <label>Category *</label>
            <select required value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
        <div className="field"><label>Specifications</label><textarea rows={2} value={form.specifications} onChange={(e) => update("specifications", e.target.value)} /></div>

        <div className="admin-grid-3c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="field"><label>Price (Rs) *</label><input required type="number" min="0" value={form.price} onChange={(e) => update("price", e.target.value)} /></div>
          <div className="field"><label>Discount (%)</label><input type="number" min="0" max="99" value={form.discountPercent} onChange={(e) => update("discountPercent", e.target.value)} placeholder="e.g., 20" /></div>
          <div className="field"><label>Stock Qty *</label><input required type="number" min="0" value={form.stock} onChange={(e) => update("stock", e.target.value)} /></div>
        </div>

        <div className="field"><label>Low Stock Threshold</label><input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => update("lowStockThreshold", e.target.value)} /></div>

        <div className="field">
          <label>Seller WhatsApp Number</label>
          <input value={form.sellerPhone} onChange={(e) => update("sellerPhone", e.target.value)} placeholder="e.g., 03001234567" />
        </div>

        <div style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", color: "var(--ink-soft)" }}>💳 Payment / Delivery Details</h3>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: -2, marginBottom: 10 }}>
            Customer ko checkout par sirf yehi method aur (agar diye hain) bank details dikhengi.
          </p>
          <div className="field">
            <label>Payment Method Accepted *</label>
            <select value={form.sellerPaymentMethod} onChange={(e) => update("sellerPaymentMethod", e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {form.sellerPaymentMethod !== "cod" && (
            <>
              <div className="admin-grid-2c" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field"><label>Account Title *</label><input value={form.sellerAccountTitle} onChange={(e) => update("sellerAccountTitle", e.target.value)} placeholder="e.g., Ali Khan" /></div>
                <div className="field"><label>Account Number *</label><input value={form.sellerAccountNumber} onChange={(e) => update("sellerAccountNumber", e.target.value)} placeholder="e.g., 03001234567" /></div>
              </div>
              {form.sellerPaymentMethod === "bank" && (
                <div className="field"><label>Bank Name *</label><input value={form.sellerBankName} onChange={(e) => update("sellerBankName", e.target.value)} placeholder="e.g., Meezan Bank" /></div>
              )}
            </>
          )}
        </div>

        <div className="field">
          <label>Image URLs</label>
          {form.images.map((img, i) => (
            <input key={i} value={img} onChange={(e) => updateImage(i, e.target.value)} placeholder="https://…" style={{ marginBottom: 8 }} />
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addImageField}>+ Add another image</button>
        </div>

        <div className="admin-row-wrap" style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} /> Featured product
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={form.status === "active"} onChange={(e) => update("status", e.target.checked ? "active" : "inactive")} /> Active
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="admin-row-wrap" style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/products")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}