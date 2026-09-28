import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAllOrders } from "../../lib/orders";
import { listAllProductsForAdmin } from "../../lib/products";

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listAllOrders(), listAllProductsForAdmin()])
      .then(([o, p]) => { setOrders(o); setProducts(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard…</div>;

  const totalSales = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
  const outOfStock = products.filter((p) => p.stock <= 0);

  const stats = [
    ["Total Sales", `Rs ${totalSales.toLocaleString()}`],
    ["Total Orders", orders.length],
    ["Pending Orders", pending],
    ["Delivered Orders", delivered],
    ["Cancelled Orders", cancelled],
    ["Total Products", products.length],
    ["Low Stock", lowStock.length],
    ["Out of Stock", outOfStock.length],
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Dashboard</h1>
      <div className="admin-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {stats.map(([label, value]) => (
          <div key={label} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="admin-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>Recent Orders</h3>
          {orders.slice(0, 6).map((o) => (
            <Link to="/admin/orders" key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13.5, borderBottom: "1px solid var(--line)" }}>
              <span>#{o.orderNumber}</span><span style={{ fontWeight: 700 }}>Rs {o.total.toLocaleString()}</span>
            </Link>
          ))}
          {orders.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No orders yet.</p>}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>Low Stock Alerts</h3>
          {lowStock.slice(0, 6).map((p) => (
            <Link to="/admin/products" key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13.5, borderBottom: "1px solid var(--line)" }}>
              <span>{p.name}</span><span style={{ color: "var(--danger)", fontWeight: 700 }}>{p.stock} left</span>
            </Link>
          ))}
          {lowStock.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>All products well stocked.</p>}
        </div>
      </div>
    </div>
  );
}
