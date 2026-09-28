// Cloudinary delivery helper.
//
// Product images are uploaded at ~900px as JPEG q0.7, which is roughly
// 100-150 KB each. A grid of 24 cards was therefore pulling ~3 MB of images
// even though each card only ever displays a ~300px thumbnail.
//
// Cloudinary can resize and re-encode on the fly straight from the URL, so
// the same image can be served as a ~15 KB WebP/AVIF. Nothing needs to be
// re-uploaded — we just insert the transformation into the delivery URL.
//
// Anything that isn't a Cloudinary URL (data: URIs, Firebase Storage, Google
// Drive, plain http links) is returned completely untouched.

const CLOUDINARY_IMAGE_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/;

/**
 * @param {string} url    original image URL
 * @param {number} width  the widest the image will ever be displayed, in CSS px
 * @returns {string}      an optimised URL (or the original, unchanged)
 */
export function cdnImage(url, width = 400) {
  if (!url || typeof url !== "string") return url;

  const match = url.match(CLOUDINARY_IMAGE_RE);
  if (!match) return url;

  const [, base, rest] = match;

  // Already transformed by us (or by hand) — don't stack transformations.
  if (/(^|\/)(f_auto|q_auto|w_\d+)/.test(rest)) return url;

  // Account for high-DPI screens, but cap it so we never ask for something
  // absurd on a 3x phone.
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const target = Math.min(1600, Math.round(width * dpr));

  // f_auto  -> AVIF/WebP where the browser supports it, JPEG otherwise
  // q_auto  -> Cloudinary picks the lowest quality that still looks clean
  // c_limit -> only ever shrinks, never upscales a small original
  return `${base}/f_auto,q_auto,w_${target},c_limit/${rest}`;
}

/** Tiny blurred placeholder for progressive loading (same rules as above). */
export function cdnPreview(url) {
  if (!url || typeof url !== "string") return url;
  const match = url.match(CLOUDINARY_IMAGE_RE);
  if (!match) return url;
  const [, base, rest] = match;
  if (/(^|\/)(f_auto|q_auto|w_\d+|e_blur)/.test(rest)) return url;
  return `${base}/f_auto,q_auto:low,w_24,e_blur:200,c_limit/${rest}`;
}

// Banner delivery keeps the complete artwork visible. The storefront frame
// handles the responsive size while Cloudinary only compresses and limits
// width, so important text is never cropped out of an uploaded banner.
export function cdnBanner(url, width = 1600) {
  if (!url || typeof url !== "string") return url;
  const match = url.match(CLOUDINARY_IMAGE_RE);
  if (!match) return url;
  const [, base, rest] = match;
  if (/(^|\/)(f_auto|q_auto|w_\d+)/.test(rest)) return url;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : width;
  const responsiveWidth = viewportWidth < 768 ? Math.min(width, 720) : width;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const target = Math.min(viewportWidth < 768 ? 900 : 2400, Math.round(responsiveWidth * dpr));
  return `${base}/f_auto,q_auto,w_${target},c_limit/${rest}`;
}
