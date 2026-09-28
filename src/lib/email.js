import emailjs from "@emailjs/browser";

// ⚠️ EmailJS setup complete karne ke baad ye 4 values yahan daal dein
const EMAILJS_SERVICE_ID = "service_cj46krf";
const EMAILJS_CUSTOMER_TEMPLATE_ID = "template_afpfmry";
const EMAILJS_SELLER_TEMPLATE_ID = "template_lavctg4";
const EMAILJS_PUBLIC_KEY = "h6nfXgyUdVaD2QtL-";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  initialized = true;
}

// Sends the "your order is placed" email to the customer.
export async function sendCustomerOrderEmail(params) {
  if (!params.to_email) return;
  try {
    ensureInit();
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CUSTOMER_TEMPLATE_ID, params);
  } catch (err) {
    console.error("Customer order email failed:", err);
  }
}

// Sends the "you got a new order" email to the seller.
export async function sendSellerOrderEmail(params) {
  if (!params.to_email) return;
  try {
    ensureInit();
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SELLER_TEMPLATE_ID, params);
  } catch (err) {
    console.error("Seller order email failed:", err);
  }
}

// Sends the "new order came in" email to the ShopHub admin (anusch2026@gmail.com).
// Reuses the seller template's variable shape (to_email, customer_name, order_number,
// product_list, total, delivery_address, payment_method) since it already carries
// everything needed. If you'd like a dedicated admin template with different wording,
// create one in EmailJS and swap EMAILJS_SELLER_TEMPLATE_ID below for its ID.
export async function sendAdminOrderEmail(params) {
  if (!params.to_email) return;
  try {
    ensureInit();
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SELLER_TEMPLATE_ID, params);
  } catch (err) {
    console.error("Admin order email failed:", err);
  }
}