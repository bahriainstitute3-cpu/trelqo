// Turns a raw phone number (any common format) into digits-only, with the
// Pakistani country code applied when a local "0..." number is given.
export function normalizePhoneForWhatsapp(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) {
    digits = "92" + digits.slice(1);
  } else if (digits.startsWith("3") && digits.length === 10) {
    // e.g. "3001234567" typed without the leading 0
    digits = "92" + digits;
  }
  return digits;
}

// Builds a wa.me link that opens a WhatsApp chat pre-filled with a message.
// Falls back to null if there's no usable phone number.
export function buildWhatsappLink(phone, message = "") {
  const digits = normalizePhoneForWhatsapp(phone);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
