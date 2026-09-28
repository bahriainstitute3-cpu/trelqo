import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { cdnImage } from "../lib/imageUrl";
import {
  getOrderDate, getOrderDay, getOrderTime, formatPrice,
  getItemSellerSummary, getUniqueSellers, getBankDetails,
} from "../lib/receipt";
import "./OrderReceipt.css";

const FALLBACK_LINKS = [{ label: "Trelqo", url: "https://trelqo 1-pk.netlify.app/" }];

function Wordmark() {
  return (
    <div className="order-slip-wordmark">
      Trelqo
      <svg className="order-slip-wordmark-arrow" viewBox="0 0 160 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6C42 26 118 26 154 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M143 3L156 7L148 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function ProductRow({ item, idx, showOwner }) {
  // 0 = optimized (cdn) url, 1 = original url, 2 = emoji fallback
  const [imgStage, setImgStage] = useState(0);
  const owner = showOwner ? getItemSellerSummary(item) : null;
  const qty = item.quantity || item.qty || 1;
  const unitPrice = item.price ?? item.unitPrice;
  const total = item.subtotal ?? (unitPrice * qty);
  const variant = [item.variant, item.color, item.size].filter(Boolean).join(" / ");

  return (
    <div className="order-slip-row" data-idx={idx + 1}>
      <div className="order-slip-cell order-slip-cell-num">{idx + 1}</div>
      <div className="order-slip-cell order-slip-cell-product">
        <div className="order-slip-product-thumb">
          {item.image && imgStage < 2 ? (
            <img
              src={imgStage === 0 ? cdnImage(item.image, 80) : item.image}
              alt=""
              onError={() => setImgStage((s) => s + 1)}
            />
          ) : (
            <span>🛍️</span>
          )}
        </div>
        <div>
          <div className="order-slip-product-name">{item.productName || item.name || "—"}</div>
          {variant && <div className="order-slip-product-variant">{variant}</div>}
          {owner?.name && (
            <div className="order-slip-product-owner">Owner: {owner.name}{owner.phone ? ` · ${owner.phone}` : ""}</div>
          )}
        </div>
      </div>
      <div className="order-slip-cell order-slip-cell-qty" data-label="Qty">{qty}</div>
      <div className="order-slip-cell order-slip-cell-price" data-label="Unit price">{formatPrice(unitPrice)}</div>
      <div className="order-slip-cell order-slip-cell-total" data-label="Total">{formatPrice(total)}</div>
    </div>
  );
}

function ProductTable({ items, showOwner }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="order-slip-empty">No items found.</div>;
  }
  return (
    <div className="order-slip-table">
      <div className="order-slip-row order-slip-row-head">
        <div className="order-slip-cell order-slip-cell-num">#</div>
        <div className="order-slip-cell order-slip-cell-product">Product</div>
        <div className="order-slip-cell order-slip-cell-qty">Quantity</div>
        <div className="order-slip-cell order-slip-cell-price">Unit Price</div>
        <div className="order-slip-cell order-slip-cell-total">Total</div>
      </div>
      {items.map((item, idx) => <ProductRow key={idx} item={item} idx={idx} showOwner={showOwner} />)}
    </div>
  );
}

function SellerCard({ seller, items }) {
  const bank = getBankDetails(null, seller);
  return (
    <div className="order-slip-seller-card">
      <div className="order-slip-seller-head">
        <div className="order-slip-seller-name">{seller?.name || "Unknown Seller"}</div>
        <div className="order-slip-seller-contact">
          {seller?.phone && <span>{seller.phone}</span>}
          {seller?.email && <span>{seller.email}</span>}
        </div>
      </div>
      {bank && (
        <div className="order-slip-seller-bank">
          {seller?.paymentMethod && <div><strong>Method:</strong> {seller.paymentMethod}</div>}
          <div><strong>Account:</strong> {bank.accountNumber}</div>
          <div><strong>Title:</strong> {bank.accountTitle}</div>
          <div><strong>Bank:</strong> {bank.bankName}</div>
        </div>
      )}
      <ProductTable items={items} showOwner={false} />
    </div>
  );
}

export default function OrderReceipt({ type, order, siteLinks }) {
  const links = Array.isArray(siteLinks) && siteLinks.length > 0 ? siteLinks : FALLBACK_LINKS;
  const isCOD = String(order.paymentMethod || "COD").toUpperCase() === "COD";
  const uniqueSellers = getUniqueSellers(order);
  const address = [
    order.address?.address, order.address?.city, order.address?.area,
    order.address?.province, order.address?.postalCode,
  ].filter(Boolean).join(", ") || "—";

  return (
    <div className="order-slip" id={`receipt-${type}-${order.id}`}>
      <div className="order-slip-head">
        <div className="order-slip-brand"><Wordmark /></div>
        <div className="order-slip-head-divider" />
        <div className="order-slip-title">
          <h2>ORDER SLIP</h2>
          <p>{type === "Seller" ? "SELLER RECEIPT" : type === "Admin" ? "ADMIN RECORD" : "THANK YOU FOR SHOPPING WITH US"}</p>
        </div>
        <div className="order-slip-head-divider" />
        <div className="order-slip-meta">
          <span className="order-slip-meta-icon">🛒</span>
          <div>
            <div className="order-slip-meta-label">ORDER NO.</div>
            <div className="order-slip-meta-value">{order.orderNumber || order.id}</div>
            <div className="order-slip-meta-label">DATE</div>
            <div className="order-slip-meta-value">{getOrderDate(order) || "—"}</div>
          </div>
        </div>
      </div>

      <div className="order-slip-info-row">
        <div className="order-slip-info-col">
          <div className="order-slip-info-heading">♙ {type === "Seller" ? "CUSTOMER SHIPPING INFO" : "CUSTOMER DETAILS"}</div>
          <div>{order.address?.fullName || order.customer?.name || "—"}</div>
          <div>{order.address?.phone || order.customer?.phone || "—"}</div>
          {type !== "Seller" && <div>{order.address?.email || order.customer?.email || "—"}</div>}
        </div>
        <div className="order-slip-info-col">
          <div className="order-slip-info-heading">💳 PAYMENT METHOD</div>
          <div>{isCOD ? "Cash on Delivery (COD)" : (order.paymentMethod || "Online Payment")}</div>
        </div>
        <div className="order-slip-info-col">
          <div className="order-slip-info-heading">🚚 DELIVERY ADDRESS</div>
          <div>{address}</div>
        </div>
      </div>

      {type === "Seller" || type === "Admin" ? (
        <>
          <div className="order-slip-section-label">{type === "Admin" ? "ALL PRODUCTS" : "PRODUCTS & PAYOUT"}</div>
          {type === "Admin" && <ProductTable items={order.items} showOwner={true} />}
          <div className="order-slip-section-label">{type === "Admin" ? "ALL SELLERS (SUMMARY + BANK DETAILS)" : "SELLER / PRODUCT OWNER DETAILS"}</div>
          {uniqueSellers.map((s, idx) => <SellerCard key={idx} seller={s.seller} items={s.items} />)}
        </>
      ) : (
        <>
          <div className="order-slip-section-label">ITEMS</div>
          <ProductTable items={order.items} showOwner={false} />
        </>
      )}

      <div className="order-slip-bottom-row">
        <div className="order-slip-thanks">
          <span className="order-slip-thanks-icon">📦</span>
          <div>
            <strong>THANK YOU!</strong>
            <p>For {type === "Seller" ? "partnering with" : "shopping with"} Trelqo. Your trust means a lot to us.</p>
          </div>
        </div>
        <div className="order-slip-summary">
          <div className="order-slip-summary-row">
            <span>Sub Total</span><span>{formatPrice(order.subtotal || order.total)}</span>
          </div>
          <div className="order-slip-summary-row">
            <span>Delivery Charges</span><span>{formatPrice(order.shipping || 0)}</span>
          </div>
          {order.discount > 0 && (
            <div className="order-slip-summary-row">
              <span>Discount</span><span>- {formatPrice(order.discount)}</span>
            </div>
          )}
          {order.tax > 0 && (
            <div className="order-slip-summary-row">
              <span>Tax</span><span>{formatPrice(order.tax)}</span>
            </div>
          )}
          <div className="order-slip-summary-row order-slip-summary-grand">
            <span>Grand Total</span><span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {type === "Customer" && !isCOD && (
        <div className="order-slip-payto">
          <div className="order-slip-section-label">PAY TO</div>
          {uniqueSellers.map(({ seller, items }, idx) => {
            const bank = getBankDetails(order, seller);
            return (
              <div key={idx} className="order-slip-payto-card">
                <div className="order-slip-payto-head">
                  {seller?.name || "Seller"}
                  {items.length > 0 && <span> ({items.map((i) => i.productName || i.name).join(", ")})</span>}
                </div>
                {bank ? (
                  <>
                    <div><strong>Account Number:</strong> {bank.accountNumber}</div>
                    <div><strong>Account Title:</strong> {bank.accountTitle}</div>
                    <div><strong>Bank Name:</strong> {bank.bankName}</div>
                  </>
                ) : (
                  <div className="order-slip-muted">Contact seller for payment details.</div>
                )}
              </div>
            );
          })}
          <div className="order-slip-payto-total"><strong>Amount to Pay:</strong> {formatPrice(order.total)}</div>
        </div>
      )}

      <div className="order-slip-badges">
        <span>🛡️ 100% Original Products</span>
        <span>🎧 Dedicated Support</span>
        <span>📦 Easy Returns</span>
      </div>

      <div className="order-slip-links">
        <div className="order-slip-links-title">SCAN TO VISIT</div>
        <div className="order-slip-links-grid">
          {links.map((l, idx) => (
            <div key={idx} className="order-slip-link-item">
              <QRCodeCanvas value={l.url} size={104} includeMargin />
              {l.label && <div className="order-slip-link-label">{l.label}</div>}
              <div className="order-slip-link-url">{l.url}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}