import { useEffect, useMemo, useState } from "react";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db, loadAuth } from "../lib/firebase";

// Sirf yehi login "Add review" button dekh sakta hai.
const REVIEW_ADMIN_EMAIL = "bahriainstitute3@gmail.com";

// Photo ko chota (max 640px, jpeg) kerke base64 mai Firestore doc ke andar save karte hain.
function compressImage(file, maxSide = 640, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const Stars = ({ n = 5 }) => (
  <span style={{ color: "#c9a227", letterSpacing: 2 }}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>
);

/**
 * <Reviews />                       -> saare reviews (Home)
 * <Reviews productId={product.id} /> -> sirf us product ke reviews
 */
export default function Reviews({ productId = "" }) {
  const [reviews, setReviews] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  // Login email check (auth lazy-loaded hai project mai)
  useEffect(() => {
    let unsub = () => {};
    let alive = true;
    (async () => {
      try {
        const mod = await loadAuth();
        const auth = mod?.auth || mod;
        const { onAuthStateChanged } = await import("firebase/auth");
        if (!alive) return;
        unsub = onAuthStateChanged(auth, (u) => {
          setIsAdmin(!!u && (u.email || "").toLowerCase() === REVIEW_ADMIN_EMAIL);
        });
      } catch {
        setIsAdmin(false);
      }
    })();
    return () => { alive = false; unsub(); };
  }, []);

  // Firebase se live reviews
  useEffect(() => {
    const base = collection(db, "reviews");
    const q = productId ? query(base, where("productId", "==", productId)) : base;
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReviews(list);
    }, () => {});
    return unsub;
  }, [productId]);

  const scrolling = reviews.length >= 3;
  const loopReviews = useMemo(() => {
    if (!scrolling) return reviews;
    // kam reviews hon to bhi track lamba ho jaye
    const reps = Math.max(1, Math.ceil(8 / reviews.length));
    return Array.from({ length: reps }).flatMap(() => reviews);
  }, [reviews, scrolling]);

  if (reviews.length === 0 && !isAdmin) return null;

  return (
    <section style={{ background: "#fff", padding: "34px 0 24px" }}>
      <style>{`
        @keyframes shRevLeft{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .shrev-marq{overflow:hidden;width:100%}
        .shrev-track{display:flex;width:max-content}
        .shrev-track.on{animation:shRevLeft var(--dur,40s) linear infinite}
        .shrev-marq:hover .shrev-track{animation-play-state:paused}
        .shrev-set{display:flex;gap:16px;padding-right:16px;flex-shrink:0}
        .shrev-card{width:250px;flex-shrink:0;border:1px solid #111;border-radius:16px;overflow:hidden;background:#fff}
        .shrev-card img{width:100%;height:220px;object-fit:cover;display:block;background:#eee}
        @media (prefers-reduced-motion:reduce){.shrev-track.on{animation:none}}
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 16, padding: "0 16px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: 28, margin: 0 }}>Customer Reviews</h2>
        <div style={{ color: "#c9a227", fontSize: 18 }}>★★★★★</div>
        {isAdmin && (
          <button type="button" onClick={() => setOpen(true)}
            style={{ marginTop: 10, padding: "10px 20px", borderRadius: 999, border: "none", background: "#000", color: "#f5d36b", fontWeight: 800, cursor: "pointer" }}>
            + Add review
          </button>
        )}
      </div>

      <div className="shrev-marq" style={{ "--dur": `${Math.max(30, reviews.length * 8)}s` }}>
        <div className={`shrev-track ${scrolling ? "on" : ""}`} style={!scrolling ? { justifyContent: "center", width: "100%" } : undefined}>
          {[0, 1].slice(0, scrolling ? 2 : 1).map((k) => (
            <div className="shrev-set" key={k} aria-hidden={k === 1}>
              {loopReviews.map((r, i) => (
                <div className="shrev-card" key={`${r.id}-${k}-${i}`}>
                  {r.images?.[0] && <img src={r.images[0]} alt={`${r.name || "Customer"} review`} loading="lazy" />}
                  <div style={{ padding: "10px 14px 14px" }}>
                    <Stars n={r.rating || 5} />
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{r.name || "Customer"}</div>
                    {r.text && <div style={{ fontSize: 14, color: "#333", marginTop: 4, overflowWrap: "anywhere" }}>{r.text}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#777", marginTop: 10 }}>Trusted by customers who choose Trelqo Pakistan.</p>

      {open && <AddReviewModal productId={productId} onClose={() => setOpen(false)} />}
    </section>
  );
}

function AddReviewModal({ productId, onClose }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(e) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    try {
      setImages(await Promise.all(files.map((f) => compressImage(f))));
    } catch {
      setErr("Image load nahi hui, dobara try karein.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setErr("Customer ka naam likhein.");
    if (!text.trim() && images.length === 0) return setErr("Review likhein ya picture add karein.");
    setBusy(true);
    setErr("");
    try {
      await addDoc(collection(db, "reviews"), {
        name: name.trim(),
        text: text.trim(),
        rating,
        images,
        productId: productId || "",
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (e2) {
      setErr(e2.message || "Save nahi hua (Firestore rules check karein).");
      setBusy(false);
    }
  }

  const inp = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 10, font: "inherit", boxSizing: "border-box", marginBottom: 10 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(420px,100%)", maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ margin: "0 0 12px" }}>Add customer review</h3>
        <input style={inp} placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}
              style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: n <= rating ? "#c9a227" : "#ccc" }}>★</button>
          ))}
        </div>
        <textarea style={{ ...inp, minHeight: 90 }} placeholder="Review likhein…" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="file" accept="image/*" multiple onChange={pick} style={{ marginBottom: 10 }} />
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {images.map((src, i) => <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />)}
          </div>
        )}
        {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#000", color: "#f5d36b", fontWeight: 800, cursor: "pointer" }}>
            {busy ? "Saving…" : "Add review"}
          </button>
        </div>
      </form>
    </div>
  );
}