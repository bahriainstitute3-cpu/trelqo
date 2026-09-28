import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getWishlist } from "../lib/wishlist";
import { cdnImage } from "../lib/imageUrl";

export default function Wishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return setLoading(false);
    getWishlist(user.uid).then(setItems).finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return <div className="container empty-state" style={{ padding: 60 }}>Please log in to see your wishlist.</div>;
  }

  return (
    <div className="container" style={{ padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Wishlist</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Saved products for later.</p>

      {loading && <div className="empty-state">Loading wishlist…</div>}
      {!loading && items.length === 0 && <div className="empty-state">No saved products yet.</div>}

      <div className="grid-products">
        {items.map((item) => (
          <Link key={item.productId} to={`/product/${item.productId}`} className="card" style={{ overflow: "hidden", display: "block" }}>
            <div style={{ aspectRatio: "1/1", background: "#f0efe8" }}>
              {item.image ? <img src={cdnImage(item.image, 120)} alt={item.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)" }}>No image</div>}
            </div>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.4 }}>{item.name}</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>Rs {Number(item.price || 0).toLocaleString()}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
