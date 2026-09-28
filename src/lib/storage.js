// Cloudinary config — aapke account ki values
const CLOUDINARY_CLOUD_NAME = "byozo8xx";
const CLOUDINARY_UPLOAD_PRESET = "hrvonxcb";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function getDefaultProductImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#f5efe5"/>
      <rect x="120" y="180" width="560" height="420" rx="48" fill="#e7dfd2"/>
      <rect x="250" y="110" width="300" height="120" rx="36" fill="#1d5c4f"/>
      <path d="M260 310h280l-28 250H288z" fill="#d8b466"/>
      <path d="M315 350h170v30H315zm0 70h170v30H315zm0 70h110v30H315z" fill="#16463f" opacity="0.8"/>
      <circle cx="310" cy="620" r="30" fill="#1d5c4f"/>
      <circle cx="490" cy="620" r="30" fill="#1d5c4f"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Resizes/compresses an image before upload so it goes out faster.
// If anything goes wrong (unsupported format, decode failure, etc.),
// falls back to uploading the original file untouched instead of
// killing the whole upload.
async function prepareImage(file) {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 900;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.7
      );
    });
  } catch (err) {
    console.warn("prepareImage: falling back to original file:", err.message);
    return file;
  }
}

// Uploads a single file to Cloudinary using the unsigned preset.
// Returns the public secure_url. Retries once (fast, 15s) before giving up.
async function uploadToCloudinary(data, folder, timeoutMs = 15000) {
  const formData = new FormData();
  formData.append("file", data);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Cloudinary upload failed (${res.status})`);
    }

    const json = await res.json();
    return json.secure_url;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Image upload timed out. Check your internet connection.");
    }
    throw err;
  }
}

// Uploads one file under a folder and returns its public URL.
// Retries once with the raw original file before giving up.
export async function uploadProductImage(file, folder = "new") {
  try {
    const prepared = await prepareImage(file);
    return await uploadToCloudinary(prepared, `products/${folder}`);
  } catch (firstErr) {
    console.warn(`Upload failed for ${file.name}, retrying once:`, firstErr.message);
    try {
      return await uploadToCloudinary(file, `products/${folder}`, 15000);
    } catch (secondErr) {
      console.error(`Upload failed permanently for ${file.name}:`, secondErr.message);
      throw secondErr;
    }
  }
}

// Uploads all files independently — one failing image no longer wipes out
// the rest. Returns real URLs for whatever succeeded; only falls back to
// the placeholder if literally every image failed.
export async function uploadProductImages(files, folder = "new") {
  const results = await Promise.allSettled(
    Array.from(files).map((f) => uploadProductImage(f, folder))
  );

  const urls = [];
  let failedCount = 0;

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      urls.push(r.value);
    } else {
      failedCount++;
      console.error(`Image ${i + 1} (${files[i]?.name}) failed:`, r.reason?.message || r.reason);
    }
  });

  if (urls.length === 0) {
    console.error("All product images failed to upload — using placeholder.");
    return [getDefaultProductImage()];
  }

  if (failedCount > 0) {
    console.warn(`${failedCount} of ${files.length} images failed to upload; continuing with the rest.`);
  }

  return urls;
}

export async function uploadAppLogo(file) {
  const prepared = await prepareImage(file);
  return uploadToCloudinary(prepared, "appAssets");
}

export async function uploadBannerImage(file) {
  const prepared = await prepareImage(file);
  return uploadToCloudinary(prepared, "banners");
}

// ================= VIDEO UPLOAD (NEW — baqi file untouched) =================

// Videos ke liye Cloudinary ka alag "video" resource endpoint use hota hai
// (image endpoint se video upload nahi hoti).
const CLOUDINARY_VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

// Uploads a video file to Cloudinary. Videos are bigger, so timeout is longer (60s).
async function uploadVideoToCloudinary(file, folder, timeoutMs = 60000) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(CLOUDINARY_VIDEO_UPLOAD_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Cloudinary video upload failed (${res.status})`);
    }

    const json = await res.json();
    return json.secure_url;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Video upload timed out. Check your internet connection.");
    }
    throw err;
  }
}

// Uploads one product video and returns its public URL.
// Retries once before giving up (same pattern as uploadProductImage).
export async function uploadProductVideo(file, folder = "new") {
  try {
    return await uploadVideoToCloudinary(file, `products/${folder}`);
  } catch (firstErr) {
    console.warn(`Video upload failed for ${file.name}, retrying once:`, firstErr.message);
    return await uploadVideoToCloudinary(file, `products/${folder}`, 60000);
  }
}

// ================= HOMEPAGE VIDEO BANNER (NEW — baqi file untouched) =================

// Uploads a homepage banner video and returns its public URL. Same retry
// pattern as uploadProductVideo, just a separate Cloudinary folder so
// banner videos stay organized apart from product videos.
export async function uploadBannerVideo(file) {
  try {
    return await uploadVideoToCloudinary(file, "banners");
  } catch (firstErr) {
    console.warn(`Banner video upload failed for ${file.name}, retrying once:`, firstErr.message);
    return await uploadVideoToCloudinary(file, "banners", 60000);
  }
}