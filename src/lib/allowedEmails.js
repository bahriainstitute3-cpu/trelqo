export const PRIVILEGED_EMAILS = [
  "anusch2026@gmail.com",
  "bahriainstitute3@gmail.com",
];

export const SETTINGS_ADMIN_EMAILS = ["bahriainstitute3@gmail.com"];

export const SELLER_EMAILS = [
  "anusch2026@gmail.com",
  "bahriainstitute3@gmail.com",
];

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function isEmailAllowed(email) {
  return true; // Allow any email to sign up
}

export function isSellerEmail(email) {
  return SELLER_EMAILS.includes(normalizeEmail(email));
}

export function isPrivilegedEmail(email) {
  return PRIVILEGED_EMAILS.includes(normalizeEmail(email));
}

export function canAccessSettings(email) {
  return SETTINGS_ADMIN_EMAILS.includes(normalizeEmail(email));
}
