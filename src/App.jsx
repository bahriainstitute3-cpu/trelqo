import React, { Suspense, lazy } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { ProtectedRoute, AdminRoute, SellerRoute } from "./components/RouteGuards";
import Navbar from "./components/Navbar";
import AnnouncementTicker from "./components/AnnouncementTicker";
import Footer from "./components/Footer"; // <-- NEW

// Pages that (almost) every visitor hits on first load: keep these as normal
// (non-lazy) imports so the very first paint isn't blocked by extra chunks.
import Home from "./pages/Home";
import CategoryPage from "./pages/CategoryPage";
import Search from "./pages/Search";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";

// Everything else is code-split (React.lazy): the browser only downloads
// this JS when the person actually navigates there. This is what makes the
// first load fast, especially on slower mobile connections.
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrdersList = lazy(() => import("./pages/Orders").then((m) => ({ default: m.OrdersList })));
const OrderDetail = lazy(() => import("./pages/Orders").then((m) => ({ default: m.OrderDetail })));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SellProduct = lazy(() => import("./pages/SellProduct"));
const BecomeSeller = lazy(() => import("./pages/BecomeSeller"));
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));

const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminProductForm = lazy(() => import("./pages/admin/AdminProductForm"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminDeliveryCharges = lazy(() => import("./pages/admin/AdminDeliveryCharges"));
const AdminSellers = lazy(() => import("./pages/admin/AdminSellers"));

function PageLoading() {
  return <div className="container empty-state" style={{ padding: 60 }}>Loading…</div>;
}

// Customer Layout — a single responsive Navbar handles both desktop (top
// nav + search bar) and mobile (hamburger drawer + bottom tab bar) via CSS
// breakpoints, so the site no longer looks like a phone app on a laptop.
function CustomerLayout() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)" }}>
      <AnnouncementTicker />
      <Navbar />
      <main className="container" style={{ paddingTop: 16, paddingBottom: 90 }}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer /> {/* NEW — shows on every customer-facing page */}
    </div>
  );
}

// App Entry Point
export default function App() {
  return (
    <Routes>
      {/* Admin Section */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <Suspense fallback={<PageLoading />}>
              <AdminLayout />
            </Suspense>
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id" element={<AdminProductForm />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="delivery-charges" element={<AdminDeliveryCharges />} />
        <Route path="sellers" element={<AdminSellers />} />
      </Route>

      {/* Customer App Layout */}
      <Route path="/" element={<CustomerLayout />}>
        <Route index element={<Home />} />
        <Route path="category/:id" element={<CategoryPage />} />
        <Route path="search" element={<Search />} />
        <Route path="product/:id" element={<ProductDetails />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute><OrdersList /></ProtectedRoute>} />
        <Route path="orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
        <Route path="sell" element={<ProtectedRoute><SellProduct /></ProtectedRoute>} />
        <Route path="become-a-seller" element={<BecomeSeller />} />
        <Route path="seller/dashboard" element={<SellerRoute><SellerDashboard /></SellerRoute>} />
      </Route>
    </Routes>
  );
}