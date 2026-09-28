import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Profile() {
  const { profile, user, logout, canAccessSettings } = useAuth();

  return (
    <div className="container" style={{ padding: "32px 20px", maxWidth: 480 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>My Profile</h1>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>{profile?.name || "User"}</div>
        <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>{user?.email || profile?.email}</div>
        <div style={{ color: "var(--teal)", fontSize: 12, fontWeight: 700, marginTop: 8 }}>
          Role: {profile?.role === "admin" || profile?.role === "super_admin" ? "Admin" : profile?.canAddProduct ? "Seller" : "Customer"}
        </div>
        {profile?.phone && <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>{profile.phone}</div>}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {[
          ["My Orders", "/orders"],
          ["Wishlist", "/wishlist"],
          [profile?.role === "admin" || profile?.role === "super_admin" ? "Admin Dashboard" : "Become a Seller", profile?.role === "admin" || profile?.role === "super_admin" ? "/admin" : "/become-a-seller"],
          ...(canAccessSettings ? [["Settings", "/settings"]] : []),
        ].map(([label, to]) => (
          <Link key={to} to={to} style={{ display: "block", padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 600 }}>{label}</Link>
        ))}
        <button onClick={() => logout()} className="btn btn-ghost" style={{ width: "100%", textAlign: "left", padding: "16px 20px", color: "var(--danger)", fontWeight: 700, borderRadius: 0 }}>Logout</button>
      </div>
    </div>
  );
}
