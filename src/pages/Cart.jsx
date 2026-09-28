import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { cdnImage } from "../lib/imageUrl";

export default function Cart() {
  const { items, removeItem, setQty, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container empty-state" style={{ padding: "60px 20px" }}>
        <h2 style={{ marginBottom: 10 }}>Your cart is empty</h2>
        <p style={{ marginBottom: 20 }}>Browse products and add something you like.</p>
        <Link to="/" className="btn btn-primary">Continue Shopping</Link>
      </div>
    );
  }

  function goToCheckout() {
    if (!user) return navigate("/login", { state: { from: { pathname: "/checkout" } } });
    navigate("/checkout");
  }

  return (
    <div className="container cart-page">
      <div className="cart-items">
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>Your Cart</h1>
        {items.map((item) => (
          <div key={item.productId} className="card cart-item">
            <div className="cart-item-thumb">
              {item.image && <img src={cdnImage(item.image, 120)} alt="" loading="lazy" decoding="async" />}
            </div>
            <div className="cart-item-body">
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-price">Rs {item.price.toLocaleString()}</div>
              <div className="cart-item-controls">
                <div className="cart-item-qty">
                  <button className="btn btn-ghost btn-sm" onClick={() => setQty(item.productId, item.qty - 1)}>-</button>
                  <span>{item.qty}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeItem(item.productId)}>Remove</button>
              </div>
            </div>
            <div className="cart-item-total">Rs {(item.price * item.qty).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="card cart-summary">
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Order Summary</h3>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
          <span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13, color: "var(--ink-soft)" }}>
          <span>Delivery & tax calculated at checkout</span>
        </div>
        <button className="btn btn-accent btn-block" onClick={goToCheckout}>Proceed to Checkout</button>
      </div>
    </div>
  );
}
