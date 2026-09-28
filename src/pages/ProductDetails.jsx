import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useNavigate,
} from "react-router-dom";
import { getProduct } from "../lib/products";
import {
  listReviews,
  addReview,
  deleteReview,
  averageRating,
} from "../lib/reviews";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import {
  isWishlisted,
  toggleWishlistItem,
} from "../lib/wishlist";
import { buildWhatsappLink } from "../lib/whatsapp";
import { cdnImage } from "../lib/imageUrl";

export default function ProductDetails() {
  const { id } = useParams();

  const [product, setProduct] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [activeImg, setActiveImg] =
    useState(0);

  const [selectedColor, setSelectedColor] =
    useState("");

  const [qty, setQty] = useState(1);
  const [added, setAdded] =
    useState(false);

  const [reviews, setReviews] =
    useState([]);

  const [myRating, setMyRating] =
    useState(5);

  const [myComment, setMyComment] =
    useState("");

  const [reviewBusy, setReviewBusy] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [confirmingId, setConfirmingId] =
    useState(null);

  const [saved, setSaved] =
    useState(false);

  const { addItem } = useCart();

  const { user, profile } =
    useAuth();

  const navigate = useNavigate();

  // =========================
  // Load product
  // =========================
  useEffect(() => {
    let mounted = true;

    setLoading(true);

    Promise.all([
      getProduct(id),
      listReviews(id),
    ])
      .then(
        ([
          productData,
          reviewData,
        ]) => {
          if (!mounted) return;

          setProduct(productData);
          setReviews(
            reviewData || []
          );

          // =========================
          // First color + image
          // =========================
          if (
            Array.isArray(
              productData?.colors
            ) &&
            productData.colors.length >
              0
          ) {
            const firstColor =
              productData.colors[0];

            setSelectedColor(
              firstColor
            );

            const colorMap =
              productData
                ?.colorImageMap ||
              {};

            let firstImage =
              colorMap[firstColor];

            // Case-insensitive fallback
            if (
              firstImage ===
              undefined
            ) {
              const matchingKey =
                Object.keys(
                  colorMap
                ).find(
                  (key) =>
                    String(key)
                      .trim()
                      .toLowerCase() ===
                    String(
                      firstColor
                    )
                      .trim()
                      .toLowerCase()
                );

              if (matchingKey) {
                firstImage =
                  colorMap[
                    matchingKey
                  ];
              }
            }

            const firstImageIndex =
              Number(firstImage);

            const imageCount =
              Array.isArray(
                productData.images
              )
                ? productData.images
                    .length
                : 0;

            if (
              Number.isInteger(
                firstImageIndex
              ) &&
              firstImageIndex >= 0 &&
              firstImageIndex <
                imageCount
            ) {
              setActiveImg(
                firstImageIndex
              );
            } else {
              // fallback to same color index
              const colorIndex =
                productData.colors.findIndex(
                  (item) =>
                    String(item)
                      .trim()
                      .toLowerCase() ===
                    String(
                      firstColor
                    )
                      .trim()
                      .toLowerCase()
                );

              if (
                colorIndex >=
                  0 &&
                colorIndex <
                  imageCount
              ) {
                setActiveImg(
                  colorIndex
                );
              }
            }
          }
        }
      )
      .catch((err) => {
        console.error(
          "Could not load product:",
          err
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // =========================
  // Wishlist
  // =========================
  useEffect(() => {
    if (!user || !id) {
      setSaved(false);
      return;
    }

    isWishlisted(
      user.uid,
      id
    )
      .then(setSaved)
      .catch(() =>
        setSaved(false)
      );
  }, [user, id]);

  // =========================
  // Media
  // =========================
  const mediaItems = useMemo(() => {
    if (!product) return [];

    return [
      ...(Array.isArray(
        product.images
      )
        ? product.images.map(
            (url) => ({
              url,
              type: "image",
            })
          )
        : []),

      ...(product.videoUrl
        ? [
            {
              url: product.videoUrl,
              type: "video",
            },
          ]
        : []),
    ];
  }, [product]);

  const activeMedia =
    mediaItems[activeImg];

  // =========================
  // Product calculations
  // =========================
  const hasSale =
    Number(
      product?.oldPrice || 0
    ) >
    Number(
      product?.price || 0
    );

  const displayPrice =
    product?.salePrice &&
    Number(
      product.salePrice
    ) <
      Number(
        product.price
      )
      ? Number(
          product.salePrice
        )
      : Number(
          product?.price || 0
        );

  const originalPrice = hasSale
    ? Number(
        product.oldPrice
      )
    : Number(
        product?.price || 0
      );

  const outOfStock =
    Number(
      product?.stock || 0
    ) <= 0;

  const avg =
    reviews.length > 0
      ? averageRating(reviews)
      : 0;

  const productColors =
    Array.isArray(
      product?.colors
    )
      ? product.colors
      : [];

  // ==================================================
  // COLOR SELECT
  // ==================================================
  function handleColorSelect(
    color
  ) {
    setSelectedColor(color);

    if (!product) return;

    const colorMap =
      product.colorImageMap ||
      {};

    /*
     * First try exact key.
     */
    let mappedImage =
      colorMap[color];

    /*
     * Then case-insensitive key.
     *
     * This means:
     * Red
     * red
     * RED
     *
     * will all work.
     */
    if (
      mappedImage ===
      undefined
    ) {
      const matchingKey =
        Object.keys(
          colorMap
        ).find(
          (key) =>
            String(key)
              .trim()
              .toLowerCase() ===
            String(color)
              .trim()
              .toLowerCase()
        );

      if (matchingKey) {
        mappedImage =
          colorMap[
            matchingKey
          ];
      }
    }

    /*
     * IMPORTANT:
     * Only product.images are used for
     * color mapping.
     *
     * Video is NOT counted as an image.
     */
    const imageCount =
      Array.isArray(
        product.images
      )
        ? product.images.length
        : 0;

    const imageIndex =
      Number(mappedImage);

    /*
     * Actual saved mapping.
     *
     * Example:
     *
     * Red → 2
     *
     * means:
     *
     * product.images[2]
     */
    if (
      Number.isInteger(
        imageIndex
      ) &&
      imageIndex >= 0 &&
      imageIndex < imageCount
    ) {
      setActiveImg(
        imageIndex
      );
      return;
    }

    /*
     * Fallback:
     *
     * Color 1 → Image 1
     * Color 2 → Image 2
     * Color 3 → Image 3
     */
    const colorIndex =
      productColors.findIndex(
        (item) =>
          String(item)
            .trim()
            .toLowerCase() ===
          String(color)
            .trim()
            .toLowerCase()
      );

    if (
      colorIndex >= 0 &&
      colorIndex < imageCount
    ) {
      setActiveImg(
        colorIndex
      );
    }
  }

  // =========================
  // Cart
  // =========================
  function handleAdd() {
    addItem(
      product,
      qty
    );

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1500);
  }

  function handleBuyNow() {
    addItem(
      product,
      qty
    );

    navigate(
      "/checkout"
    );
  }

  // =========================
  // WhatsApp
  // =========================
  function handleMessage() {
    const link =
      buildWhatsappLink(
        product.sellerPhone,
        `Hi! I'm interested in "${product.name}".`
      );

    if (link) {
      window.open(
        link,
        "_blank"
      );
    }
  }

  // =========================
  // Wishlist
  // =========================
  async function handleWishlistToggle() {
    if (!user) {
      navigate(
        "/login",
        {
          state: {
            from: {
              pathname: `/product/${product.id}`,
            },
          },
        }
      );

      return;
    }

    const added =
      await toggleWishlistItem(
        user.uid,
        product
      );

    setSaved(added);
  }

  // =========================
  // Review
  // =========================
  async function handleSubmitReview(
    e
  ) {
    e.preventDefault();

    if (!user) {
      navigate(
        "/login"
      );
      return;
    }

    setReviewBusy(true);

    try {
      await addReview({
        productId: id,
        userId: user.uid,
        userName:
          profile?.name ||
          user.displayName ||
          "Customer",
        rating: myRating,
        comment: myComment,
      });

      setMyComment("");
      setMyRating(5);

      const fresh =
        await listReviews(
          id
        );

      setReviews(
        fresh || []
      );
    } catch (err) {
      alert(
        err?.message ||
          "Could not submit review."
      );
    } finally {
      setReviewBusy(false);
    }
  }

  // =========================
  // Delete review
  // =========================
  async function handleDeleteReview(
    reviewId
  ) {
    setDeletingId(
      reviewId
    );

    try {
      await deleteReview(
        reviewId,
        id
      );

      setReviews(
        (prev) =>
          prev.filter(
            (r) =>
              r.id !==
              reviewId
          )
      );
    } catch (err) {
      alert(
        err?.message ||
          "Could not delete review."
      );
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  // =========================
  // Loading
  // =========================
  if (loading) {
    return (
      <div
        className="container"
        style={{
          padding: 40,
        }}
      >
        Loading…
      </div>
    );
  }

  // =========================
  // Not found
  // =========================
  if (!product) {
    return (
      <div
        className="container empty-state"
        style={{
          padding: 40,
        }}
      >
        Product not found.
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .pd-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.05fr)
            minmax(0, 0.95fr);
          gap: 40px;
          align-items: start;
        }

        .pd-buybox {
          position: sticky;
          top: 20px;
        }

        .pd-image-box {
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
        }

        .pd-color-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .pd-color-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1.5px solid var(--line);
          background: var(--surface);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          transition: 0.2s ease;
        }

        .pd-color-button:hover {
          transform: translateY(-1px);
        }

        .pd-color-button.active {
          border-color: var(--marigold);
          box-shadow:
            0 0 0 2px
            rgba(245, 166, 35, 0.12);
        }

        .pd-color-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.18);
          display: inline-block;
          flex-shrink: 0;
        }

        .pd-info-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .pd-info-item {
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--surface);
        }

        .pd-info-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
          margin-bottom: 4px;
          font-weight: 700;
        }

        .pd-info-value {
          font-size: 14px;
          font-weight: 600;
          word-break: break-word;
          white-space: pre-wrap;
        }

        @media (max-width: 768px) {
          .pd-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .pd-buybox {
            position: static;
          }

          .pd-info-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .pd-main-title {
            font-size: 23px !important;
          }

          .pd-action-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }

          .pd-action-row button:last-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>

      {/* =========================
          TOP PRODUCT AREA
      ========================== */}
      <div
        className="container pd-grid"
        style={{
          padding: "32px 20px",
        }}
      >
        {/* IMAGE GALLERY */}
        <div>
          <div
            className="card pd-image-box"
            style={{
              marginBottom: 10,
            }}
          >
            {activeMedia ? (
              activeMedia.type ===
              "video" ? (
                <video
                  key={
                    activeMedia.url
                  }
                  src={
                    activeMedia.url
                  }
                  controls
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      "cover",
                    background:
                      "#000",
                  }}
                />
              ) : (
                <img
                  src={cdnImage(
                    activeMedia.url,
                    1000
                  )}
                  alt={
                    product.name
                  }
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      "cover",
                  }}
                />
              )
            ) : (
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  height: "100%",
                  color:
                    "var(--ink-soft)",
                }}
              >
                No image
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {mediaItems.length >
            1 && (
            <div
              style={{
                display:
                  "flex",
                gap: 8,
                flexWrap:
                  "wrap",
              }}
            >
              {mediaItems.map(
                (
                  item,
                  i
                ) => (
                  <button
                    type="button"
                    key={`${item.url}-${i}`}
                    onClick={() =>
                      setActiveImg(
                        i
                      )
                    }
                    style={{
                      position:
                        "relative",
                      width: 60,
                      height: 60,
                      borderRadius:
                        8,
                      overflow:
                        "hidden",
                      border:
                        i ===
                        activeImg
                          ? "2px solid var(--marigold)"
                          : "1.5px solid var(--line)",
                      padding: 0,
                      background:
                        "#000",
                      cursor:
                        "pointer",
                    }}
                  >
                    {item.type ===
                    "video" ? (
                      <>
                        <video
                          src={
                            item.url
                          }
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "cover",
                          }}
                        />

                        <span
                          style={{
                            position:
                              "absolute",
                            inset: 0,
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color:
                              "#fff",
                            fontSize:
                              18,
                            textShadow:
                              "0 1px 3px rgba(0,0,0,0.7)",
                            pointerEvents:
                              "none",
                          }}
                        >
                          ▶
                        </span>
                      </>
                    ) : (
                      <img
                        src={cdnImage(
                          item.url,
                          180
                        )}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "cover",
                        }}
                      />
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* PRODUCT BUY BOX */}
        <div className="pd-buybox">
          {product.brand && (
            <div className="section-eyebrow">
              {product.brand}
            </div>
          )}

          <h1
            className="pd-main-title"
            style={{
              fontSize: 26,
              marginBottom: 6,
            }}
          >
            {product.name}
          </h1>

          {/* Rating */}
          {reviews.length >
            0 && (
            <div
              style={{
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                }}
              >
                <Stars
                  value={avg}
                />

                <span
                  style={{
                    fontSize: 13,
                    color:
                      "var(--ink-soft)",
                  }}
                >
                  {avg.toFixed(
                    1
                  )}{" "}
                  (
                  {
                    reviews.length
                  }{" "}
                  review
                  {reviews.length >
                  1
                    ? "s"
                    : ""}
                  )
                </span>
              </div>
            </div>
          )}

          {/* Price */}
          <div
            style={{
              display:
                "flex",
              alignItems:
                "baseline",
              gap: 10,
              marginBottom: 14,
              flexWrap:
                "wrap",
            }}
          >
            <span
              style={{
                fontWeight:
                  800,
                fontSize: 26,
              }}
            >
              Rs{" "}
              {displayPrice.toLocaleString()}
            </span>

            {hasSale && (
              <>
                <span
                  style={{
                    fontSize: 16,
                    color:
                      "var(--ink-soft)",
                    textDecoration:
                      "line-through",
                  }}
                >
                  Rs{" "}
                  {originalPrice.toLocaleString()}
                </span>

                {product.discount >
                  0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight:
                        800,
                      color:
                        "var(--danger)",
                    }}
                  >
                    {
                      product.discount
                    }
                    % OFF
                  </span>
                )}
              </>
            )}
          </div>

          {/* Stock */}
          <div
            style={{
              marginBottom: 20,
              fontSize: 14,
              fontWeight: 700,
              color:
                outOfStock
                  ? "var(--danger)"
                  : "var(--success)",
            }}
          >
            {outOfStock
              ? "Out of stock"
              : `${product.stock} available`}
          </div>

          {/* COLORS */}
          {productColors.length >
            0 && (
            <div
              style={{
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                Color
                {selectedColor
                  ? `: ${selectedColor}`
                  : ""}
              </div>

              <div className="pd-color-list">
                {productColors.map(
                  (
                    color
                  ) => (
                    <button
                      type="button"
                      key={color}
                      className={`pd-color-button ${
                        selectedColor ===
                        color
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        handleColorSelect(
                          color
                        )
                      }
                      title={`Select ${color}`}
                    >
                      <span
                        className="pd-color-dot"
                        style={{
                          background:
                            color,
                        }}
                      />

                      <span>
                        {color}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Quantity */}
          {!outOfStock && (
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 14,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  border:
                    "1.5px solid var(--line)",
                  borderRadius:
                    999,
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setQty(
                      (q) =>
                        Math.max(
                          1,
                          q - 1
                        )
                    )
                  }
                >
                  -
                </button>

                <span
                  style={{
                    minWidth: 24,
                    textAlign:
                      "center",
                    fontWeight:
                      700,
                  }}
                >
                  {qty}
                </span>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setQty(
                      (q) =>
                        Math.min(
                          Number(
                            product.stock
                          ),
                          q + 1
                        )
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            className="pd-action-row"
            style={{
              display:
                "flex",
              gap: 12,
              marginBottom: 14,
              flexWrap:
                "wrap",
            }}
          >
            <button
              className="btn btn-outline"
              disabled={
                outOfStock
              }
              onClick={
                handleAdd
              }
            >
              {added
                ? "Added ✓"
                : "Add to Cart"}
            </button>

            <button
              className="btn btn-accent"
              disabled={
                outOfStock
              }
              onClick={
                handleBuyNow
              }
            >
              Buy Now
            </button>

            <button
              className="btn btn-ghost"
              onClick={
                handleWishlistToggle
              }
            >
              {saved
                ? "♥ Saved"
                : "♡ Save"}
            </button>
          </div>

          {/* Seller contact */}
          {product.sellerPhone && (
            <button
              onClick={
                handleMessage
              }
              className="btn btn-ghost btn-sm"
              style={{
                padding:
                  "8px 0",
              }}
            >
              💬 Message seller on
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* =========================
          ALL PRODUCT DETAILS
      ========================== */}
      <div
        className="container"
        style={{
          padding:
            "0 20px 30px",
          maxWidth: 1000,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          Product Details
        </h2>

        {/* Description */}
        {product.description && (
          <div
            className="card"
            style={{
              padding: 18,
              marginBottom: 14,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                marginBottom: 8,
              }}
            >
              Description
            </h3>

            <p
              style={{
                color:
                  "var(--ink-soft)",
                lineHeight:
                  1.7,
                whiteSpace:
                  "pre-wrap",
                margin: 0,
              }}
            >
              {
                product.description
              }
            </p>
          </div>
        )}

        {/* Main information */}
        <div className="pd-info-grid">
          {product.categoryName && (
            <InfoItem
              label="Category"
              value={
                product.categoryName
              }
            />
          )}

          {product.subcategory && (
            <InfoItem
              label="Subcategory"
              value={
                product.subcategory
              }
            />
          )}

          {product.brand && (
            <InfoItem
              label="Brand"
              value={
                product.brand
              }
            />
          )}

          {product.condition && (
            <InfoItem
              label="Condition"
              value={formatValue(
                product.condition
              )}
            />
          )}

          {product.sku && (
            <InfoItem
              label="SKU / Barcode"
              value={
                product.sku
              }
            />
          )}

          {product.weight && (
            <InfoItem
              label="Weight"
              value={`${product.weight} kg`}
            />
          )}

          {product.dimensions && (
            <InfoItem
              label="Dimensions"
              value={
                product.dimensions
              }
            />
          )}

          {product.location && (
            <InfoItem
              label="Location"
              value={
                product.location
              }
            />
          )}

          {product.stock !==
            undefined &&
            product.stock !==
              null && (
              <InfoItem
                label="Stock"
                value={`${product.stock} available`}
              />
            )}

          {product.tags && (
            <InfoItem
              label="Tags"
              value={
                product.tags
              }
            />
          )}

          {product.variants && (
            <InfoItem
              label="Variants"
              value={
                product.variants
              }
            />
          )}

          {product.deliveryType && (
            <InfoItem
              label="Delivery"
              value={
                product.deliveryType ===
                "paid"
                  ? `Paid Delivery${
                      product.deliveryCharges
                        ? ` — Rs ${Number(
                            product.deliveryCharges
                          ).toLocaleString()}`
                        : ""
                    }`
                  : "Free Delivery"
              }
            />
          )}

          {product.sellerName && (
            <InfoItem
              label="Seller"
              value={
                product.sellerName
              }
            />
          )}
        </div>

        {/* Colors */}
        {productColors.length >
          0 && (
          <div
            className="card"
            style={{
              padding: 18,
              marginTop: 14,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                marginBottom: 10,
              }}
            >
              Available Colors
            </h3>

            <div className="pd-color-list">
              {productColors.map(
                (
                  color
                ) => (
                  <button
                    type="button"
                    key={color}
                    className={`pd-color-button ${
                      selectedColor ===
                      color
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleColorSelect(
                        color
                      )
                    }
                  >
                    <span
                      className="pd-color-dot"
                      style={{
                        background:
                          color,
                      }}
                    />

                    {color}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Specifications */}
        {product.specifications && (
          <div
            className="card"
            style={{
              padding: 18,
              marginTop: 14,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                marginBottom: 8,
              }}
            >
              Specifications
            </h3>

            <p
              style={{
                fontSize: 14,
                color:
                  "var(--ink-soft)",
                whiteSpace:
                  "pre-wrap",
                lineHeight:
                  1.6,
                margin: 0,
              }}
            >
              {
                product.specifications
              }
            </p>
          </div>
        )}

        {/* Payment */}
        {(product.sellerPaymentMethod ||
          product.sellerAccountTitle ||
          product.sellerBankName) && (
          <div
            className="card"
            style={{
              padding: 18,
              marginTop: 14,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                marginBottom: 12,
              }}
            >
              Payment Information
            </h3>

            <div className="pd-info-grid">
              {product.sellerPaymentMethod && (
                <InfoItem
                  label="Payment Method"
                  value={formatPaymentMethod(
                    product.sellerPaymentMethod
                  )}
                />
              )}

              {product.sellerAccountTitle && (
                <InfoItem
                  label="Account Title"
                  value={
                    product.sellerAccountTitle
                  }
                />
              )}

              {product.sellerBankName && (
                <InfoItem
                  label="Bank"
                  value={
                    product.sellerBankName
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Video */}
        {product.videoUrl && (
          <div
            className="card"
            style={{
              padding: 18,
              marginTop: 14,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                marginBottom: 12,
              }}
            >
              Product Video
            </h3>

            <video
              src={
                product.videoUrl
              }
              controls
              playsInline
              style={{
                width: "100%",
                maxHeight: 600,
                borderRadius: 12,
                background:
                  "#000",
              }}
            />
          </div>
        )}
      </div>

      {/* =========================
          REVIEWS
      ========================== */}
      <div
        className="container"
        style={{
          padding:
            "0 20px 50px",
          maxWidth: 1000,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          Ratings & Feedback
        </h2>

        {user && (
          <form
            onSubmit={
              handleSubmitReview
            }
            className="card"
            style={{
              padding: 18,
              marginBottom: 20,
            }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  "var(--ink-soft)",
                display:
                  "block",
                marginBottom: 8,
              }}
            >
              YOUR RATING
            </label>

            <div
              style={{
                display:
                  "flex",
                gap: 4,
                marginBottom: 12,
              }}
            >
              {[1, 2, 3, 4, 5].map(
                (n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() =>
                      setMyRating(
                        n
                      )
                    }
                    style={{
                      fontSize: 22,
                      background:
                        "none",
                      border:
                        "none",
                      cursor:
                        "pointer",
                      color:
                        n <=
                        myRating
                          ? "var(--marigold)"
                          : "var(--line)",
                    }}
                  >
                    ★
                  </button>
                )
              )}
            </div>

            <textarea
              placeholder="Share your feedback about this product…"
              rows={2}
              value={
                myComment
              }
              onChange={(e) =>
                setMyComment(
                  e.target
                    .value
                )
              }
              style={{
                width:
                  "100%",
                padding:
                  "10px 14px",
                borderRadius:
                  10,
                border:
                  "1.5px solid var(--line)",
                marginBottom:
                  12,
              }}
            />

            <button
              className="btn btn-primary btn-sm"
              disabled={
                reviewBusy
              }
            >
              {reviewBusy
                ? "Posting…"
                : "Submit Review"}
            </button>
          </form>
        )}

        {reviews.length ===
          0 && (
          <p
            style={{
              color:
                "var(--ink-soft)",
            }}
          >
            No reviews yet. Be the first
            to leave feedback.
          </p>
        )}

        {reviews.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{
              padding: 16,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                marginBottom: 6,
                gap: 10,
              }}
            >
              <strong
                style={{
                  fontSize: 14,
                }}
              >
                {r.userName}
              </strong>

              <Stars
                value={
                  r.rating
                }
              />
            </div>

            {r.comment && (
              <p
                style={{
                  fontSize: 14,
                  color:
                    "var(--ink-soft)",
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {r.comment}
              </p>
            )}

            {user &&
              r.userId ===
                user.uid &&
              (confirmingId ===
              r.id ? (
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 10,
                    marginTop: 8,
                    flexWrap:
                      "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color:
                        "var(--ink-soft)",
                    }}
                  >
                    Delete this
                    review?
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteReview(
                        r.id
                      )
                    }
                    disabled={
                      deletingId ===
                      r.id
                    }
                    className="btn btn-sm"
                    style={{
                      padding:
                        "4px 10px",
                      background:
                        "var(--danger)",
                      color:
                        "#fff",
                      border:
                        "none",
                      borderRadius:
                        6,
                    }}
                  >
                    {deletingId ===
                    r.id
                      ? "Deleting…"
                      : "Yes, delete"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmingId(
                        null
                      )
                    }
                    disabled={
                      deletingId ===
                      r.id
                    }
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding:
                        "4px 10px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmingId(
                      r.id
                    )
                  }
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding:
                      "4px 0",
                    marginTop: 8,
                    color:
                      "var(--danger)",
                  }}
                >
                  🗑️ Delete my review
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================
// Info Item
// =========================
function InfoItem({
  label,
  value,
}) {
  if (
    value ===
      undefined ||
    value === null ||
    String(value).trim() ===
      ""
  ) {
    return null;
  }

  return (
    <div className="pd-info-item">
      <div className="pd-info-label">
        {label}
      </div>

      <div className="pd-info-value">
        {String(value)}
      </div>
    </div>
  );
}

// =========================
// Format condition
// =========================
function formatValue(value) {
  return String(value)
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

// =========================
// Format payment
// =========================
function formatPaymentMethod(
  value
) {
  const map = {
    cod: "Cash on Delivery",
    bank: "Bank Transfer",
    jazzcash: "JazzCash",
    easypaisa: "EasyPaisa",
  };

  return (
    map[value] ||
    formatValue(value)
  );
}

// =========================
// Stars
// =========================
function Stars({
  value,
}) {
  const rounded =
    Math.max(
      0,
      Math.min(
        5,
        Math.round(
          Number(value) || 0
        )
      )
    );

  return (
    <span
      style={{
        color:
          "var(--marigold)",
        fontSize: 14,
      }}
    >
      {"★".repeat(
        rounded
      )}

      <span
        style={{
          color:
            "var(--line)",
        }}
      >
        {"★".repeat(
          5 - rounded
        )}
      </span>
    </span>
  );
}