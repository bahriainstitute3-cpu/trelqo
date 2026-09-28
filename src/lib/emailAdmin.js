import emailjs from "@emailjs/browser";

// ⚠️ EmailJS dashboard se apni values yahan daalo
const EMAILJS_SERVICE_ID = "service_sancsp2",
      
const EMAILJS_TEMPLATE_ID = "template_auro9hn";
const EMAILJS_PUBLIC_KEY = "h6nfXgyUdVaD2QtL-";

function formatPrice(val) {
  const num = Number(val);
  return isNaN(num) ? "0" : num.toLocaleString();
}

// Har order item ka ek <tr> row banata hai — order ki tamam items ke saath
function buildItemsTable(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length === 0) {
    return `<tr><td colspan="5" style="padding: 8px; text-align:center; color:#666;">No items found</td></tr>`;
  }

  return items
    .map((item) => {
      const name = item.productName || item.name || "—";
      const qty = item.quantity || item.qty || 1;
      const price = item.price || item.unitPrice || 0;
      const subtotal = item.subtotal || price * qty;
      const sellerName = item.ownerName || item.sellerName || "—";

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">Rs ${formatPrice(price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight:bold;">Rs ${formatPrice(subtotal)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${sellerName}</td>
        </tr>`;
    })
    .join("");
}

export async function sendAdminOrderEmail(order) {
  const templateParams = {
    order_number: order.orderNumber || order.id,
    order_date: new Date().toLocaleString(),
    order_subtotal: formatPrice(order.subtotal || order.total),
    order_delivery: formatPrice(order.shipping || 0),
    order_total: formatPrice(order.total),
    payment_method: order.paymentMethod || "COD",
    customer_name: order.address?.fullName || order.customer?.name || "—",
    customer_phone: order.address?.phone || order.customer?.phone || "—",
    customer_address: [
      order.address?.address,
      order.address?.city,
      order.address?.area,
      order.address?.province,
    ]
      .filter(Boolean)
      .join(", ") || "—",
    items_table: buildItemsTable(order),
    admin_panel_link: "https://trelqo 1-pk.netlify.app/admin/orders",
  };

  try {
    await emailjs.send(
      "service_sancsp2",
      "template_auro9hn",
      "templateParams",
      "h6nfXgyUdVaD2QtL-"
    );
    console.log("✅ Admin order email sent");
  } catch (err) {
    console.error("❌ Admin email failed:", err);
  }
}