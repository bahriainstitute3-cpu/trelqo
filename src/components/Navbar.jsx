import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getCachedConfig, getAppConfig, normalizeLogoUrl } from "../lib/appConfig";
import { buildWhatsappLink } from "../lib/whatsapp";
import { listCategories, peekCategories } from "../lib/categories";
import { listProducts, peekProducts } from "../lib/products";
import NotificationBell from "./NotificationBell";

const HELP_WHATSAPP_NUMBER = "03040024727";
const helpPurchasingLink = buildWhatsappLink(HELP_WHATSAPP_NUMBER, "Hi! I need help with purchasing a product.");
const helpSellingLink = buildWhatsappLink(HELP_WHATSAPP_NUMBER, "Hi! I need help with selling a product.");

const LANGUAGES = [
  ["en", "English"], ["ur", "اردو"], ["ar", "العربية"], ["hi", "हिन्दी"],
  ["bn", "বাংলা"], ["pa", "ਪੰਜਾਬੀ"], ["fa", "فارسی"], ["tr", "Türkçe"],
  ["id", "Bahasa Indonesia"], ["ms", "Bahasa Melayu"], ["zh", "中文"],
  ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"], ["fr", "Français"],
  ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"], ["ru", "Русский"],
  ["sw", "Kiswahili"], ["th", "ไทย"], ["vi", "Tiếng Việt"], ["ta", "தமிழ்"],
  ["te", "తెలుగు"], ["ne", "नेपाली"], ["ps", "پښتو"], ["ku", "Kurdî"],
];

const UI_LABELS = {
  en: { wishlist: "Wishlist", add: "Add Product", settings: "Settings", admin: "Admin Panel", buying: "Help (Buying)", logout: "Logout", language: "Language" },
  ur: { wishlist: "پسندیدہ", add: "پروڈکٹ شامل کریں", settings: "ترتیبات", admin: "ایڈمن پینل", buying: "خریداری مدد", selling: "فروخت مدد", logout: "لاگ آؤٹ", language: "زبان" },
  ar: { wishlist: "المفضلة", add: "إضافة منتج", settings: "الإعدادات", admin: "لوحة الإدارة", buying: "مساعدة الشراء", selling: "مساعدة البيع", logout: "تسجيل الخروج", language: "اللغة" },
  hi: { wishlist: "पसंदीदा", add: "उत्पाद जोड़ें", settings: "सेटिंग्स", admin: "एडमिन पैनल", buying: "खरीदारी सहायता", selling: "बिक्री सहायता", logout: "लॉग आउट", language: "भाषा" },
};

// Naheed-style brand bar color for the main navbar row
const BRAND_BG = "var(--teal, #0f766e)";

// bold the part of `name` that matches `term` (case-insensitive), Naheed-style
function Highlighted({ name, term }) {
  const i = name.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1 || !term) return <>{name}</>;
  return (
    <>
      {name.slice(0, i)}
      <strong style={{ color: "#1d4ed8" }}>{name.slice(i, i + term.length)}</strong>
      {name.slice(i + term.length)}
    </>
  );
}

function getName(p) {
  return p?.name || p?.title || p?.productName || "";
}

export default function Navbar() {
  const { user, profile, isAdmin, canAddProduct, canAccessSettings, logout } = useAuth();
  const { itemCount } = useCart();
  const [term, setTerm] = useState("");
  const [appConfig, setAppConfig] = useState(getCachedConfig());
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [language, setLanguage] = useState(() => localStorage.getItem("shophub_language") || "en");

  // NEW — refs so the mobile menu can be closed by tapping outside it
  const menuButtonRef = useRef(null);
  const menuPanelRef = useRef(null);

  // Categories dropdown (Naheed-style "Categories ▾" button)
  const [categories, setCategories] = useState(() => {
    const cached = peekCategories();
    return cached ? cached.filter((c) => c.active) : [];
  });
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesRef = useRef(null);

  // NEW — live "as you type" suggestions under the search bar (Naheed-style):
  // matching categories first, then matching product names, real substring
  // matches against the real catalog (no AI, no fuzzy guessing).
  const [allProducts, setAllProducts] = useState(() => peekProducts({ max: 5000 }) || null);
  const allPromiseRef = useRef(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [catMatches, setCatMatches] = useState([]);
  const [productMatches, setProductMatches] = useState([]);
  const searchWrapRef = useRef(null);

  const navigate = useNavigate();
  const logoSrc = normalizeLogoUrl(appConfig.appLogo);
  const labels = UI_LABELS[language] || UI_LABELS.en;
  const selectedLanguage = LANGUAGES.find(([code]) => code === language)?.[1] || "English";
  const filteredLanguages = LANGUAGES.filter(([, name]) => name.toLowerCase().includes(languageSearch.toLowerCase()));

  function selectLanguage(code) {
    setLanguage(code);
    localStorage.setItem("shophub_language", code);
    document.documentElement.lang = code;
    document.documentElement.dir = ["ur", "ar", "fa", "ps", "ku"].includes(code) ? "rtl" : "ltr";
    setLanguageOpen(false);
    setLanguageSearch("");
    window.dispatchEvent(new CustomEvent("languagechange", { detail: code }));
  }

  useEffect(() => {
    getAppConfig().then(setAppConfig).catch(() => {});
    const refreshConfig = (event) => setAppConfig(event.detail || getCachedConfig());
    window.addEventListener("appconfigchange", refreshConfig);
    return () => window.removeEventListener("appconfigchange", refreshConfig);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = ["ur", "ar", "fa", "ps", "ku"].includes(language) ? "rtl" : "ltr";
  }, [language]);

  // Load categories for the dropdown
  useEffect(() => {
    listCategories()
      .then((cats) => setCategories(cats.filter((c) => c.active)))
      .catch(() => {});
  }, []);

  // Close categories dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target)) setCategoriesOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // NEW — close the mobile hamburger menu when tapping outside it (the
  // toggle button itself is excluded so its own onClick can still toggle
  // normally instead of fighting with this handler).
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (menuButtonRef.current && menuButtonRef.current.contains(e.target)) return;
      if (menuPanelRef.current && menuPanelRef.current.contains(e.target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  // NEW — close the mobile hamburger menu with the Escape key
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Same cached-catalog pattern used elsewhere in the app — loads once,
  // reused for every keystroke instead of re-fetching from Firestore.
  function loadAllProducts() {
    if (allProducts) return Promise.resolve(allProducts);
    if (!allPromiseRef.current) {
      allPromiseRef.current = listProducts({ max: 5000 })
        .then((list) => {
          const safe = Array.isArray(list) ? list : [];
          setAllProducts(safe);
          return safe;
        })
        .catch((e) => {
          allPromiseRef.current = null;
          throw e;
        });
    }
    return allPromiseRef.current;
  }

  // Live suggestions: real substring match against real category names and
  // real product names — nothing invented, nothing fuzzy.
  useEffect(() => {
    const q = term.trim().toLowerCase();
    if (!q) {
      setCatMatches([]);
      setProductMatches([]);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const cats = categories.filter((c) => (c.name || "").toLowerCase().includes(q)).slice(0, 4);
      if (!cancelled) setCatMatches(cats);
      try {
        const list = await loadAllProducts();
        if (cancelled) return;
        const matches = list.filter((p) => getName(p).toLowerCase().includes(q)).slice(0, 8);
        setProductMatches(matches);
        setSuggestOpen(true);
      } catch {
        if (!cancelled) { setProductMatches([]); setSuggestOpen(true); }
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, categories]);

  // Plain search — same "/search?q=..." pattern your existing Search page
  // reads. No AI, no extra layers — just types, presses enter/click, goes.
  function onSearch(e) {
    e.preventDefault();
    if (term.trim()) {
      setSuggestOpen(false);
      navigate(`/search?q=${encodeURIComponent(term.trim())}`);
    }
  }

  function pickProduct(p) {
    setSuggestOpen(false);
    setTerm(getName(p));
    navigate(`/search?q=${encodeURIComponent(getName(p))}`);
  }

  function pickCategory(c) {
    setSuggestOpen(false);
    navigate(`/category/${c.id}`);
  }

  // NEW — bottom-nav "Contact" tab: scrolls straight to the real Footer
  // (id="footer") at the bottom of the page instead of opening a new
  // section. If the footer isn't on the current page (e.g. Footer is
  // only rendered on certain routes), it goes Home first, then scrolls.
  function scrollToFooterContact() {
    const footerEl = document.getElementById("footer");
    if (footerEl) {
      footerEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/");
    setTimeout(() => {
      document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  const showSuggest = suggestOpen && term.trim() && (catMatches.length > 0 || productMatches.length > 0);

  return (
    <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 40 }}>
      {/* ==================================================================
          Scoped responsive tweaks for this navbar only:
          1) Wishlist / Account / Logout icons in the top-right row are
             hidden on mobile+tablet (they're already reachable inside the
             hamburger menu below, and via the bottom Profile tab).
          2) The mobile hamburger menu gets a tap-outside backdrop, an
             Escape-key close, and an explicit "Close" button so it's easy
             to dismiss.
          Desktop layout/behaviour is completely unchanged.
      ================================================================== */}
      <style>{`
        @media (max-width: 1023px) {
          .sh-topbar-hide-mobile { display: none !important; }
        }
        .sh-menu-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 55;
        }
        .sh-menu-close-btn {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--line);
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          color: inherit;
        }
      `}</style>

      {/* Top thin bar */}
      <div className="shop-topbar">
        <div className="container shop-topbar-inner" style={{ flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
            Welcome To {appConfig.appName || "ShopHub"}! &nbsp;
            <a href={`tel:${HELP_WHATSAPP_NUMBER}`} style={{ color: "inherit", textDecoration: "underline" }}>
              📞 {HELP_WHATSAPP_NUMBER}
            </a>
          </span>
          <span className="bismillah" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</span>
          <span className="shop-topbar-note">Shop smart · Buy with confidence</span>
          <div className="language-picker">
            <button type="button" className="language-picker-button" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen}>
              🌐 {labels.language}: {selectedLanguage} <span aria-hidden="true">⌄</span>
            </button>
            {languageOpen && (
              <div className="language-picker-menu">
                <input autoFocus value={languageSearch} onChange={(event) => setLanguageSearch(event.target.value)} placeholder="Search language..." aria-label="Search language" />
                <div className="language-options">
                  {filteredLanguages.map(([code, name]) => (
                    <button type="button" key={code} className={code === language ? "selected" : ""} onClick={() => selectLanguage(code)}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main bar — logo, categories, search + live suggestions, account/wishlist/cart */}
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          rowGap: 12,
          padding: "12px 20px",
          background: BRAND_BG,
        }}
      >
        {/* Logo + name */}
        <Link to="/" className="display navbar-brand" style={{ fontSize: 22, color: "#fff", whiteSpace: "nowrap", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="navbar-logo"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <span>{appConfig.appName || "ShopHub"}</span>
        </Link>

        {/* CATEGORIES dropdown */}
        <div ref={categoriesRef} style={{ position: "relative", flex: "0 0 auto" }}>
          <button
            type="button"
            onClick={() => setCategoriesOpen((o) => !o)}
            aria-expanded={categoriesOpen}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.15)", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 14px", fontWeight: 800, fontSize: 14,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            ☰ Categories <span aria-hidden="true">⌄</span>
          </button>
          {categoriesOpen && (
            <div
              className="card"
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                minWidth: 220, maxHeight: "60vh", overflowY: "auto", background: "#fff",
                borderRadius: 12, padding: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
              }}
            >
              {categories.length === 0 && (
                <div style={{ padding: 10, fontSize: 13, color: "var(--ink-soft)" }}>No categories yet</div>
              )}
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/category/${c.id}`}
                  onClick={() => setCategoriesOpen(false)}
                  style={{ display: "block", padding: "10px 10px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Search bar with live "as you type" suggestions */}
        <div ref={searchWrapRef} style={{ position: "relative", flex: "1 1 260px", minWidth: 220, maxWidth: 640 }}>
          <form onSubmit={onSearch} style={{ display: "flex" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#fff", borderRadius: "10px 0 0 10px", padding: "0 14px", minHeight: 44 }}>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onFocus={() => { if (term.trim()) setSuggestOpen(true); }}
                placeholder="Search products, brands, categories…"
                aria-label="Search products"
                autoComplete="off"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, padding: "10px 0" }}
              />
            </div>
            <button
              type="submit"
              aria-label="Search"
              style={{
                background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "0 10px 10px 0",
                padding: "0 18px", fontWeight: 800, cursor: "pointer", minHeight: 44,
              }}
            >
              🔍
            </button>
          </form>

          {showSuggest && (
            <div
              className="card"
              style={{
                position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 60,
                background: "#fff", borderRadius: 12, padding: 6, maxHeight: "60vh", overflowY: "auto",
                boxShadow: "0 12px 32px rgba(0,0,0,0.18)", color: "var(--ink, #111)",
              }}
            >
              {catMatches.map((c) => (
                <button
                  key={`cat-${c.id}`}
                  type="button"
                  onClick={() => pickCategory(c)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, fontSize: 14 }}
                >
                  <span aria-hidden="true">▦</span>
                  <span style={{ color: "var(--ink-soft)" }}>Category:</span>
                  <Highlighted name={c.name} term={term} />
                </button>
              ))}
              {productMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProduct(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 8, fontSize: 14 }}
                >
                  <span aria-hidden="true">🔍</span>
                  <Highlighted name={getName(p)} term={term} />
                </button>
              ))}
              <button
                type="button"
                onClick={onSearch}
                style={{ display: "block", width: "100%", textAlign: "center", padding: "10px 8px", border: "none", borderTop: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1d4ed8", marginTop: 4 }}
              >
                View all results →
              </button>
            </div>
          )}
        </div>

        {/* Notification bell — kept mounted on every screen size */}
        <NotificationBell />

        {/* RIGHT: Wishlist, Cart, Account/Login.
            NEW — Wishlist / Account / Logout are hidden on mobile+tablet via
            .sh-topbar-hide-mobile: they're already reachable in the
            hamburger menu below, so this stops the top corner being
            cramped. Cart, Login and the hamburger button itself stay
            visible on every screen size. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginLeft: "auto" }}>
          <Link to="/wishlist" className="sh-topbar-hide-mobile" style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
            <span style={{ fontSize: 20 }}>♡</span>
            {labels.wishlist}
          </Link>

          <Link
  to="/cart"
  aria-label="Cart"
  className="sh-topbar-hide-mobile"
  style={{display: "flex", flexDirection: "column", alignItems: "center", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none", position: "relative" }}>
            <span style={{ fontSize: 20, position: "relative" }}>
              🛒
              {itemCount > 0 && (
                <span style={{
                  position: "absolute", top: -8, right: -10, background: "var(--berry)", color: "#fff",
                  fontSize: 11, borderRadius: 999, padding: "1px 6px", fontWeight: 800,
                }}>{itemCount}</span>
              )}
            </span>
            Cart
          </Link>

          {user ? (
            <>
              <Link to="/profile" aria-label="Profile" className="sh-topbar-hide-mobile" style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                <span style={{ fontSize: 20 }}>👤</span>
                Account
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="sh-topbar-hide-mobile"
                style={{
                  background: "#dc2626", color: "#fff", border: "none", borderRadius: 8,
                  padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {labels.logout}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
          )}

          <button
            ref={menuButtonRef}
            className="mobile-menu-button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span style={{ color: "#fff" }}>{menuOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Secondary links row — Become a Seller / Add Product / Settings / Admin / Help */}
      <div className="container desktop-nav" style={{ display: "flex", alignItems: "center", gap: 18, padding: "8px 20px", flexWrap: "wrap" }}>
        <Link to="/become-a-seller" style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: "var(--accent, #f97316)" }}>Become a Seller</Link>
        {canAddProduct && <Link to="/sell" style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: "var(--ink)" }}>{labels.add}</Link>}
        {canAccessSettings && <Link to="/settings" style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: "var(--ink)" }}>{labels.settings}</Link>}
        {isAdmin && <Link to="/admin" style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: "var(--ink)" }}>{labels.admin}</Link>}
        <a href={helpPurchasingLink} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: "var(--ink)" }}>{labels.buying}</a>
        <a href={helpSellingLink} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: "var(--ink)" }}>{labels.selling}</a>
      </div>

      {/* NEW — semi-transparent backdrop so tapping anywhere outside the
          mobile menu closes it (in addition to the toggle button, the
          Close row below, and the Escape key). */}
      {menuOpen && <div className="sh-menu-backdrop" onClick={() => setMenuOpen(false)} />}

      {menuOpen && (
        <div className="mobile-menu" ref={menuPanelRef}>
          <button type="button" className="sh-menu-close-btn" onClick={() => setMenuOpen(false)}>
            ✕ Close
          </button>
          <Link to="/become-a-seller" onClick={() => setMenuOpen(false)}>Become a Seller</Link>
          {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin panel</Link>}
          {canAddProduct && <Link to="/sell" onClick={() => setMenuOpen(false)}>Add product</Link>}
          {user && <Link to="/orders" onClick={() => setMenuOpen(false)}>My orders</Link>}
          <Link to="/wishlist" onClick={() => setMenuOpen(false)}>Wishlist</Link>
          {canAccessSettings && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}
          <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
          <Link to="/cart" onClick={() => setMenuOpen(false)}>Cart {itemCount > 0 && `(${itemCount})`}</Link>
          <a href={helpPurchasingLink} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>🛍️ Help with Purchasing</a>
          <a href={helpSellingLink} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>🏷️ Help with Selling</a>
          {user ? <button onClick={() => { setMenuOpen(false); logout(); }}>Logout</button> : <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>}
        </div>
      )}
      <style>{`
        /* Mobile bottom navigation: evenly spaced and safe-area friendly */
        .mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 1023px) {
          .mobile-bottom-nav {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 45;
            display: flex;
            align-items: center;
            justify-content: space-around;
            gap: 4px;
            padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
            background: var(--surface, #fff);
            border-top: 1px solid var(--line, #e5e7eb);
            box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.08);
          }
          .mobile-bottom-nav > a {
            flex: 1 1 0;
            min-width: 0;
            min-height: 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            color: var(--ink, #1f2937);
            text-decoration: none;
            font-size: 21px;
            line-height: 1.1;
            border-radius: 10px;
            -webkit-tap-highlight-color: transparent;
          }
          .mobile-bottom-nav > a small {
            font-size: 10px;
            font-weight: 700;
            line-height: 1.2;
          }
          .mobile-bottom-nav > a:active {
            background: rgba(15, 118, 110, 0.10);
          }
          body {
            padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        <Link to="/">
          <span>⌂</span>
          <small>Home</small>
        </Link>
        <Link to="/notifications">
          <span>🔔</span>
          <small>Notification</small>
        </Link>
        <Link to="/cart" aria-label={`Cart${itemCount > 0 ? ` (${itemCount})` : ""}`}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            🛒
            {itemCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -7,
                  right: -11,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--berry, #e11d48)",
                  color: "#fff",
                  fontSize: 10,
                  lineHeight: "16px",
                  fontWeight: 800,
                  textAlign: "center",
                }}
              >
                {itemCount}
              </span>
            )}
          </span>
          <small>Cart</small>
        </Link>
        <Link to="/profile">
          <span>👤</span>
          <small>Profile</small>
        </Link>
        
        
      </nav>
    </header>
  );
}