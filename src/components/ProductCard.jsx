import { memo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { peekWishlist, subscribeWishlist, toggleWishlistItem } from "../lib/wishlist";
import { buildWhatsappLink } from "../lib/whatsapp";
import { cdnImage } from "../lib/imageUrl";

function CardStars({ value }) {
  return (
    <span style={{ color: "var(--marigold)", fontSize: 12 }}>
      {"★".repeat(Math.round(value))}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

function ProductCard({ product, priority = false }) {
  const storedDiscount = Number(product.discountPercent ?? product.discount ?? 0);
  const hasSale = product.salePrice && product.salePrice < product.price;
  const originalPrice = hasSale ? product.price : (Number(product.oldPrice) > Number(product.price) ? Number(product.oldPrice) : product.price);
  const hasDiscount = hasSale || originalPrice > product.price || storedDiscount > 0;
  const pct = hasSale ? Math.round(100 - (product.salePrice / product.price) * 100) : Math.max(0, Math.round(storedDiscount || (1 - product.price / originalPrice) * 100));
  const stock = product.stock || 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= (product.lowStockThreshold || 5); // NEW — lowStockThreshold field ab use ho raha hai
  const soldCount = product.soldCount || 0; // NEW — kitne bik chuke hain
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(
    () => !!peekWishlist(user?.uid)?.some((i) => i.productId === product?.id)
  );
  const [justAdded, setJustAdded] = useState(false);
  const [isHovering, setIsHovering] = useState(false); // NEW — video-on-hover ke liye

  // PERFORMANCE FIX: this used to run one Firestore getDoc() PER CARD. On a
  // page with hundreds of products that was hundreds of parallel reads. Now
  // every card reads from one shared, already-loaded wishlist snapshot.
  useEffect(() => {
    if (!user?.uid || !product?.id) return setSaved(false);
    return subscribeWishlist(user.uid, (items) =>
      setSaved(items.some((i) => i.productId === product.id))
    );
  }, [user?.uid, product?.id]);

  function handleAddToCart(e) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }

  async function handleWishlistToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate("/login", { state: { from: { pathname: `/product/${product.id}` } } });
    const added = await toggleWishlistItem(user.uid, product);
    setSaved(added);
  }

  function handleMessage(e) {
    e.preventDefault();
    e.stopPropagation();
    const link = buildWhatsappLink(product.sellerPhone, `Hi! I'm interested in "${product.name}".`);
    if (link) window.open(link, "_blank");
  }

  return (
    <Link
      to={`/product/${product.id}`}
      className="card"
      style={{ overflow: "hidden", display: "block", position: "relative" }}
      onMouseEnter={() => setIsHovering(true)} // NEW
      onMouseLeave={() => setIsHovering(false)} // NEW
    >
      <div style={{ position: "relative", aspectRatio: "1/1", background: "#f0efe8" }}>
        {product.images?.[0] ? (
          <img src={cdnImage(product.images[0], 340)} alt={product.name} loading={priority ? "eager" : "lazy"} decoding="async" width="340" height="340" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>No image</div>
        )}

        {/* NEW — hover par video image ke upar overlay ho kar play hoti hai */}
        {product.videoUrl && isHovering && (
          <video
            src={product.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* NEW — badge jo batata hai product ki video available hai */}
        {product.videoUrl && (
          <span style={{
            position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.6)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, display: "flex",
            alignItems: "center", gap: 4,
          }}>
            🎥 Video
          </span>
        )}

        {hasDiscount && pct > 0 && (
          <span className="tag-label" style={{ position: "absolute", top: 12, left: 0 }}>-{pct}%</span>
        )}
        {outOfStock && (
          <span style={{
            position: "absolute", inset: 0, background: "rgba(255,255,255,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13, color: "var(--danger)", letterSpacing: "0.04em",
          }}>OUT OF STOCK</span>
        )}
        {product.sellerPhone && (
          <button onClick={handleMessage} title="Message seller" style={{
            position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%",
            background: "#fff", border: "1px solid var(--line)", display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "var(--shadow)", padding: 0,
          }}>
            💬
          </button>
        )}
        <button onClick={handleWishlistToggle} title={saved ? "Remove from wishlist" : "Add to wishlist"} style={{
          position: "absolute", top: 52, right: 10, width: 30, height: 30, borderRadius: "50%",
          background: saved ? "var(--marigold)" : "#fff", border: "1px solid var(--line)", display: "flex",
          alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)", padding: 0,
          color: saved ? "#23180a" : "var(--ink)", fontSize: 15,
        }}>
          {saved ? "♥" : "♡"}
        </button>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {product.brand && <div style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{product.brand}</div>}
        <div style={{ fontWeight: 600, fontSize: 14.5, margin: "3px 0 6px", lineHeight: 1.3 }}>{product.name}</div>
        {product.ratingCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <CardStars value={product.ratingAvg || 0} />
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              {(product.ratingAvg || 0).toFixed(1)} ({product.ratingCount})
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Rs {(product.salePrice || product.price).toLocaleString()}</span>
          {hasDiscount && <span style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "line-through" }}>Rs {Number(originalPrice).toLocaleString()}</span>}
        </div>

        {/* NEW — is product ke neeche kitne bik chuke hain wo dikhta hai */}
        {(soldCount > 0 || lowStock) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 11.5 }}>
            {soldCount > 0 && <span style={{ color: "var(--ink-soft)" }}>🔥 {soldCount} products buye</span>}
            {lowStock && <span style={{ color: "var(--danger)", fontWeight: 700 }}>Only {stock} left</span>}
          </div>
        )}

        <button onClick={handleAddToCart} disabled={outOfStock} className="btn btn-outline btn-sm btn-block" style={justAdded ? { background: "var(--success)", color: "#fff", borderColor: "var(--success)" } : undefined}>
          {outOfStock ? "Out of stock" : justAdded ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}

// Memoised: re-rendering the whole grid (e.g. when the cart count changes)
// no longer re-renders every card unless its own product object changed.
export default memo(ProductCard, (a, b) => a.product === b.product);
