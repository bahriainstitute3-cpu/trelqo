import { NavLink, Outlet } from "react-router-dom";
import "./admin-responsive.css";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/banners", label: "Banners" },
  { to: "/admin/delivery-charges", label: "Delivery Charges" },
  { to: "/admin/sellers", label: "Sellers" },
];

export default function AdminLayout() {
  return (
    <div className="admin-shell" style={{ display: "flex", minHeight: "calc(100vh - 68px)" }}>
      <aside className="admin-sidebar" style={{ width: 220, background: "var(--teal)", color: "#fff", padding: "24px 0", flexShrink: 0 }}>
        <div className="admin-sidebar-label" style={{ padding: "0 20px 20px", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", opacity: 0.7, textTransform: "uppercase" }}>
          Super Admin
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className="admin-sidebar-link"
            style={({ isActive }) => ({
              display: "block",
              padding: "12px 20px",
              fontWeight: 600,
              fontSize: 14.5,
              background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
              borderLeft: isActive ? "3px solid var(--marigold)" : "3px solid transparent",
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="admin-main" style={{ flex: 1, padding: "28px 32px", background: "var(--bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}