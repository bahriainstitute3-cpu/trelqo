import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listProducts, peekProducts } from "../lib/products";
import { listCategories, peekCategories } from "../lib/categories";
import { peekBanners, subscribeBanners } from "../lib/banners";
import ProductCard from "../components/ProductCard";
import CategoryIcon, { resolveCategoryIcon } from "../components/CategoryIcon";
import { cdnBanner, cdnImage } from "../lib/imageUrl";
import SmartSearch from "../components/SmartSearch";
import PriceRangePanel from "../components/PriceRangePanel";
import ProductResults from "../components/ProductResults";
import { getTs } from "../lib/smartSearch";

const PAGE_SIZE = 24;

const DAY = 24 * 60 * 60 * 1000;

// WhatsApp number used by the floating contact button
const WHATSAPP_NUMBER = "923040024727";

// Real links reused from Footer.jsx
const CONTACT_PHONE = "03040024727";
const CONTACT_EMAIL = "anusch2026@gmail.com";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/anus_20_26/",
    bg: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/groups/2174879403074280",
    bg: "#1877F2",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@shophub.pk",
    bg: "#000000",
  },
  {
    name: "WhatsApp Channel",
    href: "https://whatsapp.com/channel/0029VbCLNAl9hXFC2Gr26u3a",
    bg: "#25D366",
  },
];

// New Arrivals / Price Range buttons
const quickBtnStyle = (on) => ({
  padding: "10px 18px",
  minHeight: 44,
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  border: on ? "1.5px solid var(--teal)" : "1.5px solid var(--line)",
  background: on ? "var(--teal)" : "#fff",
  color: on ? "#fff" : "inherit",
});

// Product grid
const bigProductGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
  width: "100%",
};

// Info strip
const infoStripItems = [
  { icon: "🚚", title: "Fast Shipping", sub: "Shipped In 1-3 Days" },
  { icon: "💵", title: "Payment On Delivery", sub: "Cash On Delivery Option" },
  { icon: "🎧", title: "Customer Support", sub: "Phone and Email" },
];

// Banner arrows
const bannerArrowStyle = (side) => ({
  position: "absolute",
  top: "50%",
  [side]: 12,
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  fontSize: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 5,
});

const DESKTOP_QUERY = "(min-width: 1024px)";

export default function Home() {
  // Cached data
  const cachedFeatured = peekProducts({ featured: true, max: 24 });
  const cachedLatest = peekProducts({ max: 120 });
  const cachedCats = peekCategories();
  const cachedBanners = peekBanners();

  const [categories, setCategories] = useState(() =>
    cachedCats ? cachedCats.filter((c) => c.active) : []
  );
  const [featured, setFeatured] = useState(cachedFeatured || []);
  const [newArrivals, setNewArrivals] = useState(cachedLatest || []);
  const [banners, setBanners] = useState(() =>
    cachedBanners ? cachedBanners.filter((b) => b.active) : []
  );
  const [bannerIndex, setBannerIndex] = useState(0);
  const [loading, setLoading] = useState(!cachedLatest);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // home | new | price | search
  const [view, setView] = useState("home");

  // Full catalog
  const [allProducts, setAllProducts] = useState(
    () => peekProducts({ max: 5000 }) || null
  );
  const allPromiseRef = useRef(null);
  const [searchResult, setSearchResult] = useState(null);
  const [newWindow, setNewWindow] = useState(null);
  const toolbarRef = useRef(null);

  // Mobile contact
  const contactSectionRef = useRef(null);

  // Banner is desktop only -> don't load / animate it on mobile at all
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // -------------------------------------------------------
  // BANNER AUTO SLIDER (desktop only)
  // -------------------------------------------------------

  useEffect(() => {
    if (!isDesktop || banners.length <= 1) return;

    const timer = setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [banners.length, isDesktop]);

  // -------------------------------------------------------
  // LOAD MORE PRODUCTS
  // -------------------------------------------------------

  useEffect(() => {
    const node = sentinelRef.current;

    if (!node) return;
    if (visibleCount >= newArrivals.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: "600px 0px" }
    );

    io.observe(node);

    return () => io.disconnect();
  }, [visibleCount, newArrivals.length, view]);

  // -------------------------------------------------------
  // LOAD HOME DATA (all in parallel, each renders as soon as ready)
  // -------------------------------------------------------

  function loadHomeData() {
    const tasks = [
      listProducts({ featured: true, max: 24 }).then(setFeatured),
      listProducts({ max: 120 })
        .then(setNewArrivals)
        .finally(() => setLoading(false)),
      listCategories().then((cats) =>
        setCategories(cats.filter((c) => c.active))
      ),
    ];

    tasks.forEach((t) => t.catch((e) => setError(e.message)));
  }

  // -------------------------------------------------------
  // REAL-TIME BANNERS
  // -------------------------------------------------------

  useEffect(() => {
    loadHomeData();

    const unsubscribe = subscribeBanners(
      (latestBanners) => {
        const activeBanners = latestBanners.filter((b) => b.active);

        setBanners(activeBanners);

        setBannerIndex((current) =>
          activeBanners.length > 0 ? current % activeBanners.length : 0
        );
      },
      (err) => {
        setError(err.message || "Could not load live banners");
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------
  // LOAD ALL PRODUCTS
  // -------------------------------------------------------

  function loadAllProducts() {
    if (allProducts) {
      return Promise.resolve(allProducts);
    }

    if (!allPromiseRef.current) {
      allPromiseRef.current = listProducts({ max: 5000 })
        .then((list) => {
          const safe = Array.isArray(list) ? list : [];

          setAllProducts(safe);

          return safe;
        })
        .catch((e) => {
          allPromiseRef.current = null;

          setError(e.message);

          throw e;
        });
    }

    return allPromiseRef.current;
  }

  // -------------------------------------------------------
  // LOAD CATALOG WHEN FILTER OPENS
  // -------------------------------------------------------

  useEffect(() => {
    if ((view === "new" || view === "price") && !allProducts) {
      loadAllProducts().catch(() => {});
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // -------------------------------------------------------
  // SCROLL RESULTS INTO VIEW
  // -------------------------------------------------------

  useEffect(() => {
    if (view !== "home" && toolbarRef.current) {
      toolbarRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [view]);

  // -------------------------------------------------------
  // HOME / VIEW FUNCTIONS
  // -------------------------------------------------------

  function goHome() {
    setView("home");
    setSearchResult(null);
  }

  function toggleView(next) {
    setSearchResult(null);

    setView((v) => (v === next ? "home" : next));
  }

  function handleSearchResults(payload) {
    setSearchResult(payload);
    setView("search");
  }

  // -------------------------------------------------------
  // BANNER CONTROLS
  // -------------------------------------------------------

  function prevBanner() {
    if (banners.length <= 1) return;

    setBannerIndex((i) => (i - 1 + banners.length) % banners.length);
  }

  function nextBanner() {
    if (banners.length <= 1) return;

    setBannerIndex((i) => (i + 1) % banners.length);
  }

  // -------------------------------------------------------
  // BANNER LINK
  // -------------------------------------------------------

  function openBannerLink(banner) {
    if (!banner) return;

    const link = banner.linkUrl || banner.link || banner.targetUrl || "";

    if (!link || !String(link).trim()) {
      return;
    }

    const cleanLink = String(link).trim();

    // External URL
    if (cleanLink.startsWith("http://") || cleanLink.startsWith("https://")) {
      window.location.href = cleanLink;

      return;
    }

    // Internal React route
    if (cleanLink.startsWith("/")) {
      window.location.href = cleanLink;

      return;
    }

    // If admin accidentally saves: product/abc123
    window.location.href = `/${cleanLink}`;
  }

  // -------------------------------------------------------
  // CONTACT
  // -------------------------------------------------------

  function scrollToContact() {
    const globalFooter = document.getElementById("footer");

    const target = globalFooter || contactSectionRef.current;

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  // -------------------------------------------------------
  // NEW ARRIVALS
  // -------------------------------------------------------

  const newestSorted = useMemo(
    () =>
      allProducts ? [...allProducts].sort((a, b) => getTs(b) - getTs(a)) : [],
    [allProducts]
  );

  const hasTimestamps = useMemo(
    () => newestSorted.some((p) => getTs(p) > 0),
    [newestSorted]
  );

  const newLists = useMemo(() => {
    const now = Date.now();

    return {
      "7d": newestSorted.filter((p) => getTs(p) >= now - 7 * DAY),
      "30d": newestSorted.filter((p) => getTs(p) >= now - 30 * DAY),
      latest: newestSorted.slice(0, 60),
    };
  }, [newestSorted]);

  const effectiveWindow = !hasTimestamps
    ? "latest"
    : newWindow ||
      (newLists["7d"].length > 0
        ? "7d"
        : newLists["30d"].length > 0
        ? "30d"
        : "latest");

  const newList = newLists[effectiveWindow] || [];

  // -------------------------------------------------------
  // ACTIVE BANNER
  // -------------------------------------------------------

  const activeBanner =
    banners.length > 0 ? banners[bannerIndex % banners.length] : null;

  const visibleArrivals = newArrivals.slice(0, visibleCount);

  const isHomeRoute = location.pathname === "/";

  // -------------------------------------------------------
  // MEMOIZED LISTS
  // Banner timer / state changes no longer re-render every card
  // -------------------------------------------------------

  const categoryTiles = useMemo(
    () =>
      categories.map((c) => (
        <Link
          key={c.id}
          to={`/category/${c.id}`}
          className="card category-tile"
          style={{
            padding: "18px 10px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--bg)",
              color: "var(--teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CategoryIcon icon={resolveCategoryIcon(c)} size={24} />
          </div>

          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</div>
        </Link>
      )),
    [categories]
  );

  const featuredCards = useMemo(
    () =>
      featured.map((p, index) => (
        <ProductCard key={p.id} product={p} priority={index < 4} />
      )),
    [featured]
  );

  const arrivalCards = useMemo(
    () =>
      visibleArrivals.map((p, index) => (
        <ProductCard key={p.id} product={p} priority={index < 4} />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newArrivals, visibleCount]
  );

  return (
    <div className="sh-page-wrap">
      {/* ====================================================
          RESPONSIVE CSS
      ==================================================== */}

      <style>{`

        /* MOBILE PRODUCT GRID */
        @media (max-width: 767px) {
          .sh-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
        }

        /* BANNER: DESKTOP ONLY */
        @media (max-width: 1023px) {
          .sh-banner-wrap {
            display: none !important;
          }

          .sh-contact-fab {
            display: none !important;
          }
        }

        /* SEARCH (always visible) */
        .sh-search-row {
          width: 100%;
        }

        .sh-search-shell {
          width: 100%;
        }

        @media (max-width: 767px) {

          .sh-main {
            padding: 14px 12px 28px !important;
          }

          .sh-search-shell {
            background: #fff;
            border: 1.5px solid var(--line);
            border-radius: 18px;
            padding: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
          }

          .sh-search-shell input {
            font-size: 16px; /* stops iOS zoom on focus */
          }

          .sh-quick-row {
            margin-top: 10px !important;
          }

          /* CATEGORIES: swipeable strip */
          .category-strip {
            display: flex !important;
            overflow-x: auto;
            gap: 10px !important;
            padding: 4px 2px 8px;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .category-strip::-webkit-scrollbar {
            display: none;
          }

          .category-strip .category-tile {
            flex: 0 0 88px;
            scroll-snap-align: start;
            padding: 12px 6px !important;
          }

          .category-strip .skeleton {
            flex: 0 0 88px;
          }
        }

        /* MOBILE CONTACT */
        .sh-mobile-contact {
          display: none;
        }

        @media (max-width: 767px) {
          .sh-mobile-contact {
            display: block;
          }
        }

        /* BANNER IMAGE */
        .sh-banner-media {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          display: block;
        }

      `}</style>

      {/* ====================================================
          BANNER (desktop only, exact 5:1, no cropping)
      ==================================================== */}

      {isDesktop && activeBanner && (
        <div
          className="sh-banner-wrap"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "5 / 1",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            role={activeBanner.linkUrl ? "link" : undefined}
            tabIndex={activeBanner.linkUrl ? 0 : undefined}
            onClick={() => openBannerLink(activeBanner)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && activeBanner.linkUrl) {
                e.preventDefault();

                openBannerLink(activeBanner);
              }
            }}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              cursor: activeBanner.linkUrl ? "pointer" : "default",
            }}
          >
            {activeBanner.mediaType === "video" && activeBanner.videoUrl ? (
              <video
                key={activeBanner.id}
                src={activeBanner.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="sh-banner-media"
              />
            ) : (
              <img
                key={activeBanner.id}
                src={cdnBanner(activeBanner.imageUrl, 1600)}
                alt={activeBanner.title || "Special offer"}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="sh-banner-media"
              />
            )}

            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous banner"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevBanner();
                  }}
                  style={bannerArrowStyle("left")}
                >
                  ‹
                </button>

                <button
                  type="button"
                  aria-label="Next banner"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextBanner();
                  }}
                  style={bannerArrowStyle("right")}
                >
                  ›
                </button>
              </>
            )}
          </div>

          {banners.length > 1 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 10,
                display: "flex",
                justifyContent: "center",
                gap: 6,
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Go to banner ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBannerIndex(i);
                  }}
                  style={{
                    width: i === bannerIndex % banners.length ? 20 : 8,
                    height: 8,
                    borderRadius: 999,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background:
                      i === bannerIndex % banners.length
                        ? "var(--teal)"
                        : "#fff",
                    boxShadow: "0 1px 5px rgba(0,0,0,.35)",
                    transition: "width 0.2s ease",
                    pointerEvents: "auto",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      <div
        className="container sh-main"
        style={{
          padding: "40px 20px",
        }}
      >
        {error && <p className="error-text">{error}</p>}

        {/* ==================================================
            SEARCH + FILTERS
        ================================================== */}

        <div
          ref={toolbarRef}
          style={{
            marginBottom: 28,
            scrollMarginTop: 80,
          }}
        >
          <div className="sh-search-row">
            <div className="sh-search-shell">
              <SmartSearch
                loadProducts={loadAllProducts}
                categories={categories}
                active={view === "search"}
                onResults={handleSearchResults}
                onClear={goHome}
              />
            </div>
          </div>

          <div
            className="sh-quick-row"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              onClick={() => toggleView("price")}
              aria-pressed={view === "price"}
              style={quickBtnStyle(view === "price")}
            >
              💰 Price Range
            </button>
          </div>
        </div>

        {/* ==================================================
            SEARCH RESULTS
        ================================================== */}

        {view === "search" && searchResult && (
          <section style={{ marginBottom: 44 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span className="section-eyebrow">
                  {searchResult.mode === "ai"
                    ? "AI search results"
                    : "Search results"}
                </span>

                <h2 style={{ fontSize: 22, overflowWrap: "anywhere" }}>
                  “{searchResult.query}”
                </h2>

                <p
                  style={{
                    fontSize: 14,
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  {searchResult.products.length} product
                  {searchResult.products.length === 1 ? "" : "s"} found
                </p>
              </div>

              <button
                type="button"
                onClick={goHome}
                style={{
                  padding: "8px 14px",
                  minHeight: 40,
                  borderRadius: 10,
                  border: "1.5px solid var(--line)",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ← Back to Home
              </button>
            </div>

            {searchResult.error && (
              <p className="error-text">{searchResult.error}</p>
            )}

            {searchResult.aiUsed && searchResult.summary && (
              <p
                style={{
                  fontSize: 14,
                  marginBottom: 10,
                  color: "#7c3aed",
                  fontWeight: 700,
                }}
              >
                ✨ {searchResult.summary}
              </p>
            )}

            {searchResult.aiFallback && (
              <p
                style={{
                  fontSize: 13,
                  marginBottom: 10,
                  color: "var(--ink-soft)",
                }}
              >
                AI is not available right now, so smart search was used
                instead.
              </p>
            )}

            {searchResult.chips.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                {searchResult.chips.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: 700,
                      background:
                        c.kind === "price"
                          ? "#ecfdf5"
                          : c.kind === "sort"
                          ? "#eff6ff"
                          : "var(--bg)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {c.kind === "price" ? "💰 " : c.kind === "sort" ? "↕ " : ""}
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            {searchResult.note && searchResult.products.length > 0 && (
              <p
                style={{
                  fontSize: 13,
                  marginBottom: 12,
                  color: "var(--ink-soft)",
                }}
              >
                {searchResult.note}
              </p>
            )}

            <ProductResults
              products={searchResult.products}
              emptyText="No products matched. Try different words, a wider price, or Search with AI."
            />
          </section>
        )}

        {/* ==================================================
            NEW ARRIVALS VIEW
        ================================================== */}

        {view === "new" && (
          <section style={{ marginBottom: 44 }}>
            <span className="section-eyebrow">Recently added</span>

            <h2 style={{ fontSize: 22, marginBottom: 12 }}>New arrivals</h2>

            {!allProducts ? (
              <div className="sh-grid" style={bigProductGridStyle}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{ aspectRatio: "5/1" }}
                  />
                ))}
              </div>
            ) : (
              <>
                {hasTimestamps && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
                    {[
                      ["7d", "Last 7 days"],
                      ["30d", "Last 30 days"],
                      ["latest", "Latest 60"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewWindow(key)}
                        style={{
                          padding: "8px 14px",
                          minHeight: 38,
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          border:
                            effectiveWindow === key
                              ? "1.5px solid var(--teal)"
                              : "1.5px solid var(--line)",
                          background:
                            effectiveWindow === key ? "var(--teal)" : "#fff",
                          color: effectiveWindow === key ? "#fff" : "inherit",
                        }}
                      >
                        {label} ({newLists[key].length})
                      </button>
                    ))}
                  </div>
                )}

                <ProductResults
                  products={newList}
                  emptyText="No new products in this period."
                />
              </>
            )}
          </section>
        )}

        {/* ==================================================
            PRICE RANGE
        ================================================== */}

        {view === "price" && (
          <div style={{ marginBottom: 44 }}>
            <PriceRangePanel products={allProducts} />
          </div>
        )}

        {/* ==================================================
            NORMAL HOME
        ================================================== */}

        {view === "home" && (
          <>
            {/* CATEGORIES */}

            <section style={{ marginBottom: 44 }}>
              <span className="section-eyebrow">Shop by category</span>

              <div className="category-strip">
                {categories.length === 0 &&
                  loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{
                        height: 96,
                        borderRadius: "var(--radius)",
                      }}
                    />
                  ))}

                {!loading && categories.length === 0 && (
                  <p style={{ color: "var(--ink-soft)" }}>
                    No categories yet — add some from the admin panel.
                  </p>
                )}

                {categoryTiles}
              </div>
            </section>

            {/* FEATURED PRODUCTS */}

            {featured.length > 0 && (
              <section style={{ marginBottom: 44 }}>
                <span className="section-eyebrow">Featured products</span>

                <h2 style={{ fontSize: 22, marginBottom: 16 }}>
                  Handpicked for you
                </h2>

                <div className="sh-grid" style={bigProductGridStyle}>
                  {featuredCards}
                </div>
              </section>
            )}

            {/* NEW ARRIVALS */}

            <section>
              <span className="section-eyebrow">Just landed</span>

              <h2 style={{ fontSize: 22, marginBottom: 16 }}>New arrivals</h2>

              {loading && newArrivals.length === 0 && (
                <div className="sh-grid" style={bigProductGridStyle}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{ aspectRatio: "5/1" }}
                    />
                  ))}
                </div>
              )}

              {!loading && newArrivals.length === 0 && (
                <div className="empty-state">
                  No products yet. Add your first product from the admin panel.
                </div>
              )}

              <div className="sh-grid" style={bigProductGridStyle}>
                {arrivalCards}
              </div>

              {visibleCount < newArrivals.length && (
                <div
                  ref={sentinelRef}
                  style={{ height: 1 }}
                  aria-hidden="true"
                />
              )}
            </section>
          </>
        )}

        {/* ==================================================
            MOBILE CONTACT
        ================================================== */}

        <div
          ref={contactSectionRef}
          id="sh-mobile-contact"
          className="sh-mobile-contact"
          style={{
            marginTop: 44,
            scrollMarginTop: 80,
          }}
        >
          <div className="card" style={{ padding: "20px 18px" }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
              Contact Us
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              <a
                href={`tel:${CONTACT_PHONE}`}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span aria-hidden="true">📞</span>
                {CONTACT_PHONE}
              </a>

              <a
                href={`mailto:${CONTACT_EMAIL}`}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span aria-hidden="true">✉️</span>
                {CONTACT_EMAIL}
              </a>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  title={s.name}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: s.bg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: "none",
                  }}
                >
                  {s.name[0]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================
          INFO STRIP
      ==================================================== */}

      <div className="container" style={{ padding: "18px 20px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 10,
          }}
        >
          {infoStripItems.map((item) => (
            <div
              key={item.title}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>

              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                  {item.title}
                </div>

                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  {item.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ====================================================
          WHATSAPP FLOATING BUTTON
      ==================================================== */}

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
          "Hi Trelqo Pakistan! I need help with an order."
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact with us on WhatsApp"
        className="sh-contact-fab"
        style={{
          position: "fixed",
          right: 20,
          bottom: 24,
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#25D366",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: 999,
          textDecoration: "none",
          fontWeight: 800,
          fontSize: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width="22"
          height="22"
          fill="#fff"
          aria-hidden="true"
        >
          <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.34.687 4.518 1.869 6.35L4 29l7.82-1.828A11.94 11.94 0 0 0 16.001 27C22.628 27 28 21.627 28 15S22.628 3 16.001 3zm0 21.75c-1.94 0-3.75-.55-5.29-1.503l-.38-.226-4.64 1.085 1.108-4.52-.248-.393A9.71 9.71 0 0 1 5.25 15c0-5.93 4.822-10.75 10.751-10.75S26.751 9.07 26.751 15 21.93 24.75 16.001 24.75zm5.888-8.06c-.322-.161-1.905-.94-2.2-1.047-.295-.108-.51-.161-.725.161-.215.322-.833 1.047-1.022 1.262-.188.215-.376.242-.698.081-.322-.161-1.36-.501-2.591-1.598-.958-.854-1.605-1.909-1.793-2.231-.188-.322-.02-.496.141-.657.145-.144.322-.376.483-.564.161-.188.215-.322.322-.537.108-.215.054-.403-.027-.564-.081-.161-.725-1.747-.994-2.393-.262-.63-.528-.545-.725-.555l-.617-.011c-.215 0-.564.081-.859.403-.295.322-1.128 1.102-1.128 2.688 0 1.586 1.155 3.118 1.316 3.333.161.215 2.273 3.47 5.508 4.867.77.332 1.37.531 1.838.68.772.246 1.475.211 2.031.128.62-.092 1.905-.779 2.174-1.531.269-.752.269-1.396.188-1.531-.081-.135-.295-.215-.617-.376z" />
        </svg>
        Contact with us!
      </a>
    </div>
  );
}