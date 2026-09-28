import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="empty-state">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="empty-state">Loading…</div>;
  if (!user || !isAdmin) return <Navigate to="/login" replace />;
  return children;
}

export function SellerRoute({ children }) {
  const { user, loading, sellerProfile } = useAuth();
  const location = useLocation();

  if (loading) return <div className="empty-state">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!sellerProfile || String(sellerProfile.sellerStatus || "").toUpperCase() !== "APPROVED") {
    return <Navigate to="/become-a-seller" replace />;
  }
  return children;
}
