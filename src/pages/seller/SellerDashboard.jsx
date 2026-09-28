import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getSellerDashboardStats } from "../../lib/sellers";

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user, sellerProfile, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!sellerProfile?.id) return;
      const data = await getSellerDashboardStats(sellerProfile.id);
      setStats(data);
      setLoading(false);
    }
    load();
  }, [sellerProfile?.id]);

  if (!user) return <div className="container empty-state" style={{ padding: 60 }}>Login required.</div>;
  if (!sellerProfile) return <div className="container empty-state" style={{ padding: 60 }}>Seller profile not found.</div>;
  if (sellerProfile.sellerStatus !== "APPROVED") {
    return (
      <div className="container empty-state" style={{ padding: 60 }}>
        <h2>Seller account not approved</h2>
        <p>{sellerProfile.sellerStatus || "Pending"}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "20px 20px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "var(--ink-soft)" }}>Trelqo</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Seller Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/become-a-seller" className="btn btn-ghost btn-sm">My Store</Link>
          <button className="btn btn-danger btn-sm" onClick={() => logout()}>Logout</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {[
          ["Total Sales", stats?.totalSales ?? 0],
          ["Total Orders", stats?.totalOrders ?? 0],
          ["Pending Orders", stats?.pendingOrders ?? 0],
          ["Completed Orders", stats?.completedOrders ?? 0],
          ["Total Products", stats?.totalProducts ?? 0],
          ["Active Products", stats?.activeProducts ?? 0],
          ["Out of Stock", stats?.outOfStock ?? 0],
          ["Available Balance", `Rs ${Number(stats?.availableBalance || 0).toLocaleString()}`],
          ["Pending Balance", `Rs ${Number(stats?.pendingBalance || 0).toLocaleString()}`],
          ["Total Commission", `Rs ${Number(stats?.totalCommission || 0).toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 28, padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Seller Info</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div><strong>Seller Name:</strong> {sellerProfile.fullName}</div>
          <div><strong>Email:</strong> {sellerProfile.email}</div>
          <div><strong>Phone:</strong> {sellerProfile.phone}</div>
          <div><strong>City:</strong> {sellerProfile.city}</div>
          <div><strong>Status:</strong> {sellerProfile.sellerStatus}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 28, padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>My Products</h3>
        {!stats?.products?.length ? (
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>No products added yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {stats.products.map((product) => (
              <div key={product.id} style={{ overflow: "hidden", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name || "Product"} style={{ width: "100%", aspectRatio: "1.5 / 1", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ aspectRatio: "1.5 / 1", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--ink-soft)" }}>No image</div>
                )}
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{product.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Rs {Number(product.salePrice || product.price || 0).toLocaleString()}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: product.status === "active" ? "var(--success)" : "var(--ink-soft)" }}>
                      {product.status === "under_review" ? "Under review" : product.status}
                    </span>
                    {product.status === "active" && <Link to={`/product/${product.id}`} className="btn btn-ghost btn-sm">View product</Link>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" to="/sell">Add Product</Link>
        <Link className="btn btn-ghost" to="/">Shop Home</Link>
      </div>
    </div>
  );
}
