import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listOrdersForUser, getOrder, ORDER_STATUSES } from "../lib/orders";

const STATUS_LABELS = {
  pending: "Pending", confirmed: "Confirmed", processing: "Processing", packed: "Packed",
  shipped: "Shipped", out_for_delivery: "Out for Delivery", delivered: "Delivered",
  cancelled: "Cancelled", returned: "Returned",
};

const TIMELINE = ["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"];

function formatOrderDate(order) {
  // Firestore timestamps come back either as a Timestamp object (with
  // .toDate()) or already as a plain Date/ISO string depending on how the
  // order was saved — handle all three so a bad date never crashes the list.
  const raw = order.createdAt || order.placedAt || order.date;
  if (!raw) return "";
  try {
    const d = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function OrdersList() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Every order ever placed by this user is fetched here — nothing is
    // ever removed from this list, so the full history always stays visible.
    listOrdersForUser(user.uid).then(setOrders).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="container" style={{ padding: 40 }}>Loading…</div>;
  if (orders.length === 0) return <div className="container empty-state" style={{ padding: 60 }}>You haven't placed any orders yet.</div>;

  return (
    <div className="container" style={{ padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>My Orders</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 20 }}>
        Your complete order history — {orders.length} order{orders.length !== 1 ? "s" : ""} placed so far.
      </p>

      {orders.map((o) => {
        const date = formatOrderDate(o);
        return (
          <Link to={`/orders/${o.id}`} key={o.id} className="card" style={{ display: "block", padding: 18, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>#{o.orderNumber}</div>
                {date && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>Placed on {date}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="tag-label" style={{ background: "var(--teal)" }}>{STATUS_LABELS[o.status] || o.status}</span>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Rs {o.total.toLocaleString()}</div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 6 }}>
              {o.items.map((i, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-soft)" }}>
                  <span>{i.name} × {i.qty}</span>
                  <span>Rs {(i.price * i.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)" }}>
              <span>💳 {o.paymentMethod?.toUpperCase()}</span>
              {o.address && (
                <span>📍 {o.address.city}{o.address.area ? `, ${o.address.area}` : ""}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrder(id).then(setOrder).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container" style={{ padding: 40 }}>Loading…</div>;
  if (!order) return <div className="container empty-state">Order not found.</div>;

  const currentIdx = TIMELINE.indexOf(order.status);
  const isCashOnDelivery = String(order.paymentMethod || "").toLowerCase() === "cod";
  const paymentLabel = isCashOnDelivery
    ? "Cash on delivery"
    : `${order.paymentMethod?.toUpperCase() || "PAYMENT"} · ${order.paymentStatus || "pending"}`;

  return (
    <div className="container" style={{ padding: "32px 20px", maxWidth: 720 }}>
      {location.state?.justPlaced && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: "#eef7ef", borderColor: "var(--success)" }}>
          ✓ Order placed successfully! We'll notify you as your order progresses.
        </div>
      )}
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Order #{order.orderNumber}</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>Payment: {paymentLabel}</p>

      {order.status !== "cancelled" && order.status !== "returned" && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {TIMELINE.map((s, i) => (
              <div key={s} style={{ textAlign: "center", flex: 1 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", margin: "0 auto 6px",
                  background: i <= currentIdx ? "var(--teal)" : "var(--line)",
                }} />
                <div style={{ fontSize: 10.5, color: i <= currentIdx ? "var(--ink)" : "var(--ink-soft)", fontWeight: i === currentIdx ? 800 : 500 }}>
                  {STATUS_LABELS[s]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Items</h3>
        {order.items.map((i, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
            <span>{i.name} × {i.qty}</span><span>Rs {(i.price * i.qty).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
          <span>Total</span><span>Rs {order.total.toLocaleString()}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Delivery Address</h3>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {order.address.fullName} · {order.address.phone}<br />
          {order.address.address}, {order.address.area}, {order.address.city}
        </p>
      </div>
    </div>
  );
}