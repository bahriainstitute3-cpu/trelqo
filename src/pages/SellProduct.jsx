import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createProduct } from "../lib/products";
import { listCategories } from "../lib/categories";
import {
  uploadProductImages,
  uploadProductVideo,
} from "../lib/storage";

const PAYMENT_METHODS = [
  { id: "cod", name: "Cash on Delivery Only" },
  { id: "bank", name: "Bank Transfer" },
  { id: "jazzcash", name: "JazzCash" },
  { id: "easypaisa", name: "EasyPaisa" },
];

export default function SellProduct() {
  const {
    user,
    sellerProfile,
    isAdmin,
    canAddProduct,
    loading,
  } = useAuth();

  const navigate = useNavigate();

  // =========================
  // Categories
  // =========================
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // =========================
  // Basic Info
  // =========================
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");

  // =========================
  // Pricing & Stock
  // =========================
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [stock, setStock] = useState("");
  const [condition, setCondition] = useState("new");

  // =========================
  // Product Details
  // =========================
  const [sku, setSku] = useState("");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [variants, setVariants] = useState("");

  // =========================
  // Colors
  // =========================
  const [colorsInput, setColorsInput] = useState("");
  const [colorImageMap, setColorImageMap] = useState({});

  // =========================
  // Delivery
  // =========================
  const [deliveryType, setDeliveryType] = useState("free");
  const [deliveryCharges, setDeliveryCharges] = useState("");

  // =========================
  // Seller Contact
  // =========================
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerName, setSellerName] = useState("");

  // =========================
  // Seller Payment Details
  // =========================
  const [sellerPaymentMethod, setSellerPaymentMethod] =
    useState("cod");
  const [sellerAccountTitle, setSellerAccountTitle] =
    useState("");
  const [sellerAccountNumber, setSellerAccountNumber] =
    useState("");
  const [sellerBankName, setSellerBankName] =
    useState("");

  // =========================
  // Images
  // =========================
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // =========================
  // Video
  // =========================
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  // =========================
  // Status
  // =========================
  const [status, setStatus] = useState(
    isAdmin ? "active" : "under_review"
  );

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // =========================
  // Load ONLY admin categories
  // =========================
  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      setCategoriesLoading(true);

      try {
        const result = await listCategories();

        if (!mounted) return;

        const activeCategories = Array.isArray(result)
          ? result.filter(
              (cat) => cat && cat.active !== false
            )
          : [];

        activeCategories.sort((a, b) => {
          const orderA =
            typeof a.order === "number"
              ? a.order
              : 999999;

          const orderB =
            typeof b.order === "number"
              ? b.order
              : 999999;

          if (orderA !== orderB) {
            return orderA - orderB;
          }

          return String(a.name || "").localeCompare(
            String(b.name || "")
          );
        });

        setCategories(activeCategories);
      } catch (err) {
        console.error(
          "Failed to load categories:",
          err
        );

        if (mounted) {
          setCategories([]);
          setError(
            "Could not load categories. Please refresh the page."
          );
        }
      } finally {
        if (mounted) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================
  // Selected category
  // =========================
  const selectedCategory = useMemo(() => {
    return (
      categories.find(
        (cat) => cat.id === category
      ) || null
    );
  }, [categories, category]);

  // =========================
  // Colors
  // =========================
  const colors = useMemo(() => {
    return colorsInput
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean)
      .filter(
        (color, index, arr) =>
          arr.findIndex(
            (item) =>
              item.toLowerCase() ===
              color.toLowerCase()
          ) === index
      );
  }, [colorsInput]);

  // ==================================================
  // DEFAULT COLOR → IMAGE MAPPING
  // ==================================================
  //
  // Example:
  //
  // Colors:
  // Black, White, Red
  //
  // Images:
  // Image 1 = Black
  // Image 2 = White
  // Image 3 = Red
  //
  // Seller can manually change this mapping below.
  //
  useEffect(() => {
    if (files.length === 0) {
      setColorImageMap({});
      return;
    }

    setColorImageMap((previous) => {
      const next = {};

      colors.forEach((color, index) => {
        const previousIndex = Number(
          previous[color]
        );

        /*
         * If this color already has a valid mapping,
         * preserve it.
         */
        if (
          Number.isInteger(previousIndex) &&
          previousIndex >= 0 &&
          previousIndex < files.length
        ) {
          next[color] = previousIndex;
          return;
        }

        /*
         * Otherwise automatically map:
         *
         * Color 1 → Image 1
         * Color 2 → Image 2
         * Color 3 → Image 3
         */
        next[color] = Math.min(
          index,
          files.length - 1
        );
      });

      return next;
    });
  }, [colors, files.length]);

  // =========================
  // Auth guards
  // =========================
  if (loading) {
    return (
      <div
        className="container empty-state"
        style={{ padding: 60 }}
      >
        ⏳ Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="container empty-state"
        style={{ padding: 60 }}
      >
        <div
          style={{
            fontSize: 28,
            marginBottom: 10,
          }}
        >
          🔑
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Login Required
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          Please log in to add products.
        </div>
      </div>
    );
  }

  if (!canAddProduct) {
    return (
      <div
        className="container empty-state"
        style={{ padding: 60 }}
      >
        <div
          style={{
            fontSize: 28,
            marginBottom: 10,
          }}
        >
          🔒
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Permission Denied
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          You don't have permission to add products.
          Contact support.
        </div>
      </div>
    );
  }

  // =========================
  // Image handlers
  // =========================
  function handleFiles(e) {
    const selected = Array.from(
      e.target.files || []
    );

    if (!selected.length) return;

    const newPreviews = selected.map((file) =>
      URL.createObjectURL(file)
    );

    setFiles((prev) => [
      ...prev,
      ...selected,
    ]);

    setPreviews((prev) => [
      ...prev,
      ...newPreviews,
    ]);

    e.target.value = "";
  }

  function removeImage(idx) {
    setFiles((prev) =>
      prev.filter((_, i) => i !== idx)
    );

    setPreviews((prev) => {
      const removedUrl = prev[idx];

      if (removedUrl) {
        URL.revokeObjectURL(removedUrl);
      }

      return prev.filter(
        (_, i) => i !== idx
      );
    });

    setColorImageMap((previous) => {
      const next = {};

      Object.entries(previous).forEach(
        ([color, imageIndex]) => {
          const currentIndex =
            Number(imageIndex);

          if (currentIndex === idx) {
            next[color] =
              idx > 0
                ? idx - 1
                : 0;
          } else if (
            currentIndex > idx
          ) {
            next[color] =
              currentIndex - 1;
          } else {
            next[color] =
              currentIndex;
          }
        }
      );

      return next;
    });
  }

  // =========================
  // Video handlers
  // =========================
  function handleVideoFile(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (videoPreview) {
      URL.revokeObjectURL(
        videoPreview
      );
    }

    setVideoFile(file);

    setVideoPreview(
      URL.createObjectURL(file)
    );

    e.target.value = "";
  }

  function removeVideo() {
    if (videoPreview) {
      URL.revokeObjectURL(
        videoPreview
      );
    }

    setVideoFile(null);
    setVideoPreview(null);
  }

  // =========================
  // Submit
  // =========================
  async function handleSubmit(
    e,
    action = "publish"
  ) {
    e.preventDefault();

    setError("");

    // =========================
    // Validation
    // =========================
    if (!name.trim()) {
      return setError(
        "❌ Product name is required."
      );
    }

    if (!price) {
      return setError(
        "❌ Price is required."
      );
    }

    if (!stock && stock !== 0) {
      return setError(
        "❌ Stock quantity is required."
      );
    }

    if (!category) {
      return setError(
        "❌ Category is required."
      );
    }

    if (!selectedCategory) {
      return setError(
        "❌ Selected category is no longer available. Please select an active admin category."
      );
    }

    if (!location.trim()) {
      return setError(
        "❌ Location/City is required."
      );
    }

    if (!sellerPhone.trim()) {
      return setError(
        "❌ Your phone number is required so buyers can contact you."
      );
    }

    if (!sellerName.trim()) {
      return setError(
        "❌ Seller name is required."
      );
    }

    if (previews.length === 0) {
      return setError(
        "❌ Add at least one product image."
      );
    }

    if (
      sellerPaymentMethod !== "cod" &&
      !sellerAccountNumber.trim()
    ) {
      return setError(
        "❌ Please add your account number for the selected payment method."
      );
    }

    if (
      sellerPaymentMethod !== "cod" &&
      !sellerAccountTitle.trim()
    ) {
      return setError(
        "❌ Account title is required for the selected payment method."
      );
    }

    if (
      sellerPaymentMethod === "bank" &&
      !sellerBankName.trim()
    ) {
      return setError(
        "❌ Bank name is required."
      );
    }

    const priceNum = Number(price);

    if (
      !Number.isFinite(priceNum) ||
      priceNum <= 0
    ) {
      return setError(
        "❌ Price must be greater than 0."
      );
    }

    const stockNum = Number(stock);

    if (
      !Number.isFinite(stockNum) ||
      stockNum < 0
    ) {
      return setError(
        "❌ Stock cannot be negative."
      );
    }

    const requestedDiscount = Math.min(
      99,
      Math.max(
        0,
        Number(discountPercent) || 0
      )
    );

    const enteredOldPrice =
      Number(oldPrice) || 0;

    let oldPriceNum;

    if (enteredOldPrice > priceNum) {
      oldPriceNum = enteredOldPrice;
    } else if (
      requestedDiscount > 0
    ) {
      oldPriceNum = Math.round(
        priceNum /
          (1 -
            requestedDiscount / 100)
      );
    } else {
      oldPriceNum = priceNum;
    }

    const calculatedDiscount =
      oldPriceNum > priceNum
        ? Math.round(
            ((oldPriceNum -
              priceNum) /
              oldPriceNum) *
              100
          )
        : 0;

    setBusy(true);

    try {
      // =========================
      // Upload images
      // =========================
      setProgress(
        "📤 Uploading images…"
      );

      let imageUrls = [];

      try {
        imageUrls =
          await uploadProductImages(
            files
          );
      } catch (imgErr) {
        throw new Error(
          `Image upload failed: ${imgErr.message}`
        );
      }

      if (
        !imageUrls ||
        imageUrls.length === 0
      ) {
        throw new Error(
          "No images were uploaded. Please try again."
        );
      }

      // =========================
      // Upload video
      // =========================
      let videoUrl = "";

      if (videoFile) {
        setProgress(
          "📤 Uploading video…"
        );

        try {
          videoUrl =
            await uploadProductVideo(
              videoFile
            );
        } catch (vidErr) {
          throw new Error(
            `Video upload failed: ${vidErr.message}`
          );
        }
      }

      // ==================================================
      // FINAL COLOR → IMAGE MAPPING
      // ==================================================
      //
      // Convert local image indexes into Firestore-safe
      // integer values.
      //
      const savedColorImageMap = {};

      colors.forEach(
        (color, colorIndex) => {
          let imageIndex = Number(
            colorImageMap[color]
          );

          if (
            !Number.isInteger(
              imageIndex
            )
          ) {
            imageIndex = Math.min(
              colorIndex,
              imageUrls.length - 1
            );
          }

          imageIndex = Math.max(
            0,
            Math.min(
              imageUrls.length - 1,
              imageIndex
            )
          );

          savedColorImageMap[
            color
          ] = imageIndex;
        }
      );

      console.log(
        "Saved Color → Image Map:",
        savedColorImageMap
      );

      // =========================
      // Final product data
      // =========================
      const productData = {
        name: name.trim(),
        description:
          description.trim(),

        categoryId:
          selectedCategory.id,

        categoryName:
          selectedCategory.name,

        subcategory:
          subcategory.trim(),

        brand:
          brand.trim(),

        price: priceNum,

        oldPrice:
          oldPriceNum,

        salePrice: null,

        discount:
          calculatedDiscount,

        discountPercent:
          calculatedDiscount,

        stock: stockNum,

        condition,

        sku: sku.trim(),

        weight:
          weight.trim(),

        dimensions:
          dimensions.trim(),

        location:
          location.trim(),

        tags:
          tags.trim(),

        variants:
          variants.trim(),

        // =========================
        // COLORS
        // =========================
        colors,

        // IMPORTANT
        colorImageMap:
          savedColorImageMap,

        // =========================
        // MEDIA
        // =========================
        images:
          imageUrls,

        videoUrl:
          videoUrl || "",

        // =========================
        // SELLER
        // =========================
        ownerEmail:
          user.email,

        ownerName:
          sellerName.trim() ||
          user.displayName ||
          "Seller",

        sellerName:
          sellerName.trim(),

        sellerId:
          sellerProfile?.id || "",

        sellerPhone:
          sellerPhone.trim(),

        // =========================
        // DELIVERY
        // =========================
        deliveryType,

        deliveryCharges:
          deliveryType === "paid"
            ? Number(
                deliveryCharges
              ) || 0
            : 0,

        // =========================
        // PAYMENT
        // =========================
        sellerPaymentMethod,

        sellerAccountTitle:
          sellerAccountTitle.trim(),

        sellerAccountNumber:
          sellerAccountNumber.trim(),

        sellerBankName:
          sellerBankName.trim(),

        // =========================
        // STATUS
        // =========================
        status:
          action === "draft"
            ? "draft"
            : isAdmin
            ? status
            : "under_review",
      };

      setProgress(
        "💾 Saving product…"
      );

      await createProduct(
        productData
      );

      setProgress(
        "✅ Product created successfully!"
      );

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error(
        "Error adding product:",
        err
      );

      setError(
        err?.message ||
          "❌ Could not add product. Please check your internet and try again."
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="container sell-product-page">
      <style>{`
        .sell-product-page {
          padding: 32px 20px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .sell-product-form {
          padding: 28px;
          display: grid;
          gap: 28px;
        }

        .sell-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .sell-form-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .sell-form-actions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .color-assignment {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px;
          gap: 12px;
          align-items: center;
        }

        .image-mini-preview {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid var(--line);
          flex-shrink: 0;
        }

        @media (max-width: 800px) {
          .sell-form-grid-3 {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .sell-product-page {
            padding: 20px 12px;
          }

          .sell-product-form {
            padding: 16px;
            gap: 22px;
          }

          .sell-form-grid-2,
          .sell-form-grid-3,
          .sell-form-actions {
            grid-template-columns: 1fr;
          }

          .color-assignment {
            grid-template-columns: 1fr;
          }

          .sell-product-page h1 {
            font-size: 24px !important;
          }
        }
      `}</style>

      <h1
        style={{
          fontSize: 28,
          marginBottom: 6,
          fontWeight: 800,
        }}
      >
        🛍️ Add Product
      </h1>

      <p
        style={{
          color: "var(--ink-soft)",
          marginBottom: 28,
        }}
      >
        Fill in all details to list your product on
        ShopHub
      </p>

      <form
        onSubmit={(e) =>
          handleSubmit(e, "publish")
        }
        className="card sell-product-form"
      >
        {/* =========================
            IMAGES
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            📸 Product Images
          </h3>

          <div className="field">
            <label>
              Upload Photos (minimum 1) *
            </label>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
            />

            <p
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                marginTop: 6,
              }}
            >
              Upload clear product photos. You can
              upload multiple images and assign them
              to colors below.
            </p>
          </div>

          {previews.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              {previews.map(
                (src, i) => (
                  <div
                    key={`${src}-${i}`}
                    style={{
                      position: "relative",
                    }}
                  >
                    <img
                      src={src}
                      alt={`Product ${i + 1}`}
                      className="image-mini-preview"
                      style={{
                        width: 80,
                        height: 80,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeImage(i)
                      }
                      style={{
                        position:
                          "absolute",
                        top: -8,
                        right: -8,
                        background:
                          "var(--danger)",
                        color: "#fff",
                        border: "none",
                        borderRadius:
                          "50%",
                        width: 24,
                        height: 24,
                        fontSize: 14,
                        cursor:
                          "pointer",
                        fontWeight: 800,
                      }}
                    >
                      ×
                    </button>

                    <div
                      style={{
                        fontSize: 11,
                        textAlign:
                          "center",
                        color:
                          "var(--ink-soft)",
                        marginTop: 4,
                      }}
                    >
                      Image {i + 1}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {previews.length > 0 && (
            <p
              style={{
                fontSize: 12,
                color: "var(--teal)",
                marginTop: 8,
              }}
            >
              ✓ {previews.length} image(s)
              selected
            </p>
          )}

          {/* VIDEO */}
          <div
            className="field"
            style={{ marginTop: 20 }}
          >
            <label>
              Upload Product Video (optional)
            </label>

            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFile}
            />

            <p
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                marginTop: 6,
              }}
            >
              Short video showing your product.
            </p>
          </div>

          {videoPreview && (
            <div
              style={{
                position:
                  "relative",
                marginTop: 12,
                width: 260,
                maxWidth: "100%",
              }}
            >
              <video
                src={videoPreview}
                controls
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border:
                    "2px solid var(--line)",
                }}
              />

              <button
                type="button"
                onClick={
                  removeVideo
                }
                style={{
                  position:
                    "absolute",
                  top: -8,
                  right: -8,
                  background:
                    "var(--danger)",
                  color: "#fff",
                  border: "none",
                  borderRadius:
                    "50%",
                  width: 24,
                  height: 24,
                  fontSize: 14,
                  cursor:
                    "pointer",
                  fontWeight: 800,
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* =========================
            BASIC INFO
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            📝 Basic Information
          </h3>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div className="field">
              <label>
                Product Name *
              </label>

              <input
                required
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                placeholder="e.g., iPhone 15 Pro 256GB Space Black"
              />
            </div>

            <div className="sell-form-grid-2">
              <div className="field">
                <label>
                  Category *
                </label>

                <select
                  required
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  disabled={
                    categoriesLoading
                  }
                >
                  <option value="">
                    {categoriesLoading
                      ? "Loading categories..."
                      : categories.length ===
                        0
                      ? "No categories available"
                      : "Select Category"}
                  </option>

                  {categories.map(
                    (cat) => (
                      <option
                        key={cat.id}
                        value={cat.id}
                      >
                        {cat.name}
                      </option>
                    )
                  )}
                </select>

                {!categoriesLoading &&
                  categories.length ===
                    0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color:
                          "var(--danger)",
                        marginTop: 6,
                      }}
                    >
                      Add a category from
                      Admin → Categories first.
                    </p>
                  )}
              </div>

              <div className="field">
                <label>
                  Subcategory
                </label>

                <input
                  value={subcategory}
                  onChange={(e) =>
                    setSubcategory(
                      e.target.value
                    )
                  }
                  placeholder="e.g., Smartphones"
                />
              </div>
            </div>

            <div className="sell-form-grid-2">
              <div className="field">
                <label>
                  Brand
                </label>

                <input
                  value={brand}
                  onChange={(e) =>
                    setBrand(
                      e.target.value
                    )
                  }
                  placeholder="e.g., Apple"
                />
              </div>

              <div className="field">
                <label>
                  Condition *
                </label>

                <select
                  value={condition}
                  onChange={(e) =>
                    setCondition(
                      e.target.value
                    )
                  }
                >
                  <option value="new">
                    New
                  </option>
                  <option value="used">
                    Used
                  </option>
                  <option value="refurbished">
                    Refurbished
                  </option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>
                Description
              </label>

              <textarea
                rows={4}
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                placeholder="Detailed description of your product..."
              />
            </div>
          </div>
        </div>

        {/* =========================
            PRICING
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            💰 Pricing & Stock
          </h3>

          <div className="sell-form-grid-3">
            <div className="field">
              <label>
                Selling Price (Rs) *
              </label>

              <input
                required
                type="number"
                min="0"
                value={price}
                onChange={(e) =>
                  setPrice(
                    e.target.value
                  )
                }
                placeholder="0"
              />
            </div>

            <div className="field">
              <label>
                Old Price (Rs)
              </label>

              <input
                type="number"
                min="0"
                value={oldPrice}
                onChange={(e) =>
                  setOldPrice(
                    e.target.value
                  )
                }
                placeholder="e.g., 100000"
              />
            </div>

            <div className="field">
              <label>
                Discount (%)
              </label>

              <input
                type="number"
                min="0"
                max="99"
                value={
                  discountPercent
                }
                onChange={(e) =>
                  setDiscountPercent(
                    e.target.value
                  )
                }
                placeholder="e.g., 20"
              />
            </div>

            <div className="field">
              <label>
                Stock Quantity *
              </label>

              <input
                required
                type="number"
                min="0"
                value={stock}
                onChange={(e) =>
                  setStock(
                    e.target.value
                  )
                }
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* =========================
            PRODUCT DETAILS
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            🏷️ Product Details
          </h3>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div className="sell-form-grid-2">
              <div className="field">
                <label>
                  SKU / Barcode
                </label>

                <input
                  value={sku}
                  onChange={(e) =>
                    setSku(
                      e.target.value
                    )
                  }
                  placeholder="e.g., SKU-12345"
                />
              </div>

              <div className="field">
                <label>
                  Weight (kg)
                </label>

                <input
                  value={weight}
                  onChange={(e) =>
                    setWeight(
                      e.target.value
                    )
                  }
                  placeholder="e.g., 0.5"
                />
              </div>
            </div>

            <div className="field">
              <label>
                Dimensions (L×W×H cm)
              </label>

              <input
                value={dimensions}
                onChange={(e) =>
                  setDimensions(
                    e.target.value
                  )
                }
                placeholder="e.g., 15×10×5"
              />
            </div>

            <div className="field">
              <label>
                Variants
              </label>

              <input
                value={variants}
                onChange={(e) =>
                  setVariants(
                    e.target.value
                  )
                }
                placeholder="e.g., Size: S, M, L"
              />
            </div>

            {/* COLORS */}
            <div className="field">
              <label>
                Colors
              </label>

              <input
                value={colorsInput}
                onChange={(e) =>
                  setColorsInput(
                    e.target.value
                  )
                }
                placeholder="e.g., Black, White, Red, Blue"
              />

              <p
                style={{
                  fontSize: 12,
                  color:
                    "var(--ink-soft)",
                  marginTop: 6,
                }}
              >
                Enter multiple colors
                separated by commas.
              </p>
            </div>

            {/* COLOR → IMAGE */}
            {colors.length > 0 &&
              previews.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: 14,
                    background:
                      "var(--surface-alt)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      marginBottom: 6,
                    }}
                  >
                    🎨 Color → Product Image
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color:
                        "var(--ink-soft)",
                      marginBottom: 14,
                    }}
                  >
                    Select the exact uploaded
                    image for every color.
                    When a buyer clicks a color,
                    its selected image will open.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {colors.map(
                      (color) => {
                        const selectedImageIndex =
                          Number.isInteger(
                            Number(
                              colorImageMap[
                                color
                              ]
                            )
                          )
                            ? Number(
                                colorImageMap[
                                  color
                                ]
                              )
                            : 0;

                        return (
                          <div
                            key={color}
                            className="color-assignment"
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 10,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius:
                                    "50%",
                                  border:
                                    "1px solid var(--line)",
                                  background:
                                    color,
                                  display:
                                    "inline-block",
                                  flexShrink: 0,
                                }}
                              />

                              <strong
                                style={{
                                  fontSize: 14,
                                }}
                              >
                                {color}
                              </strong>

                              {previews[
                                selectedImageIndex
                              ] && (
                                <img
                                  src={
                                    previews[
                                      selectedImageIndex
                                    ]
                                  }
                                  alt={color}
                                  className="image-mini-preview"
                                />
                              )}
                            </div>

                            <select
                              value={
                                selectedImageIndex
                              }
                              onChange={(e) =>
                                setColorImageMap(
                                  (prev) => ({
                                    ...prev,
                                    [color]:
                                      Number(
                                        e.target
                                          .value
                                      ),
                                  })
                                )
                              }
                            >
                              {previews.map(
                                (
                                  src,
                                  imageIndex
                                ) => (
                                  <option
                                    key={
                                      imageIndex
                                    }
                                    value={
                                      imageIndex
                                    }
                                  >
                                    Image{" "}
                                    {imageIndex +
                                      1}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

            <div className="field">
              <label>
                Tags / Keywords
              </label>

              <input
                value={tags}
                onChange={(e) =>
                  setTags(
                    e.target.value
                  )
                }
                placeholder="e.g., quality, imported, bestseller"
              />
            </div>
          </div>
        </div>

        {/* =========================
            DELIVERY
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            🚚 Delivery & Location
          </h3>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div className="field">
              <label>
                City / Location *
              </label>

              <input
                required
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
                placeholder="e.g., Karachi, Lahore"
              />
            </div>

            <div className="sell-form-grid-2">
              <div className="field">
                <label>
                  Delivery Type
                </label>

                <select
                  value={deliveryType}
                  onChange={(e) =>
                    setDeliveryType(
                      e.target.value
                    )
                  }
                >
                  <option value="free">
                    Free Delivery
                  </option>

                  <option value="paid">
                    Paid Delivery
                  </option>
                </select>
              </div>

              {deliveryType ===
                "paid" && (
                <div className="field">
                  <label>
                    Delivery Charges (Rs)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      deliveryCharges
                    }
                    onChange={(e) =>
                      setDeliveryCharges(
                        e.target.value
                      )
                    }
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================
            PAYMENT
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            💳 Your Payment Details
          </h3>

          <p
            style={{
              fontSize: 12,
              color: "var(--ink-soft)",
              marginTop: -6,
              marginBottom: 12,
            }}
          >
            Buyers will see this when applicable.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div className="field">
              <label>
                Payment Method You Accept *
              </label>

              <select
                value={
                  sellerPaymentMethod
                }
                onChange={(e) =>
                  setSellerPaymentMethod(
                    e.target.value
                  )
                }
              >
                {PAYMENT_METHODS.map(
                  (method) => (
                    <option
                      key={method.id}
                      value={method.id}
                    >
                      {method.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {sellerPaymentMethod !==
              "cod" && (
              <>
                <div className="sell-form-grid-2">
                  <div className="field">
                    <label>
                      Account Title *
                    </label>

                    <input
                      value={
                        sellerAccountTitle
                      }
                      onChange={(e) =>
                        setSellerAccountTitle(
                          e.target.value
                        )
                      }
                      placeholder="e.g., Ali Khan"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Account Number *
                    </label>

                    <input
                      value={
                        sellerAccountNumber
                      }
                      onChange={(e) =>
                        setSellerAccountNumber(
                          e.target.value
                        )
                      }
                      placeholder="e.g., 03001234567"
                    />
                  </div>
                </div>

                {sellerPaymentMethod ===
                  "bank" && (
                  <div className="field">
                    <label>
                      Bank Name *
                    </label>

                    <input
                      value={
                        sellerBankName
                      }
                      onChange={(e) =>
                        setSellerBankName(
                          e.target.value
                        )
                      }
                      placeholder="e.g., Meezan Bank"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* =========================
            SELLER
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            🏪 Seller Information
          </h3>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div className="field">
              <label>
                Seller Email (Auto-filled)
              </label>

              <input
                value={user.email || ""}
                disabled
                style={{
                  background:
                    "var(--surface-alt)",
                  cursor:
                    "not-allowed",
                }}
              />
            </div>

            <div className="field">
              <label>
                Phone *
              </label>

              <input
                required
                value={sellerPhone}
                onChange={(e) =>
                  setSellerPhone(
                    e.target.value
                  )
                }
                placeholder="e.g., 03001234567"
              />
            </div>

            <div className="field">
              <label>
                Seller Name *
              </label>

              <input
                required
                value={sellerName}
                onChange={(e) =>
                  setSellerName(
                    e.target.value
                  )
                }
                placeholder="e.g., Muhammad Anus"
              />
            </div>
          </div>
        </div>

        {/* =========================
            STATUS
        ========================== */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            📊 Product Status
          </h3>

          <div className="field">
            <label>
              Status
            </label>

            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
            >
              {isAdmin && (
                <option value="active">
                  Active
                </option>
              )}

              {!isAdmin && (
                <option value="under_review">
                  Under Review
                </option>
              )}

              <option value="draft">
                Draft
              </option>

              <option value="outofstock">
                Out of Stock
              </option>
            </select>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#ffe6e6",
              color: "var(--danger)",
              padding: 14,
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* PROGRESS */}
        {progress && (
          <div
            style={{
              background: "#e6f3ff",
              color: "var(--teal)",
              padding: 14,
              borderRadius: 10,
              fontSize: 14,
            }}
          >
            ⏳ {progress}
          </div>
        )}

        {/* ACTIONS */}
        <div className="sell-form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              navigate(-1)
            }
            disabled={busy}
          >
            ← Cancel
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={(e) =>
              handleSubmit(
                e,
                "draft"
              )
            }
            disabled={busy}
          >
            💾 Save as Draft
          </button>

          <button
            type="submit"
            className="btn btn-accent"
            disabled={
              busy ||
              categoriesLoading ||
              categories.length === 0
            }
          >
            {busy
              ? progress ||
                "Publishing…"
              : "✅ Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}