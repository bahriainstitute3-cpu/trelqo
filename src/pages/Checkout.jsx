import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { placeOrder } from "../lib/orders";
import { getProduct } from "../lib/products";
import {
  addAddress,
  listAddresses,
  removeAddress,
  setDefaultAddress,
  updateAddress,
} from "../lib/addresses";
import {
  DEFAULT_ZONE_CITY,
  listDeliveryZones,
  resolveDeliveryCharge,
} from "../lib/deliveryZones";

const PAYMENT_METHOD_LABELS = {
  bank: "Bank Transfer",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  wallet: "Wallet Payment",
  cod: "Cash on Delivery",
};

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  city: "",
  area: "",
  state: "",
  email: "",
  address: "",
  landmark: "",
  postalCode: "",
};

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  // City-based delivery charges.
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [cityMode, setCityMode] = useState("select");

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [sellerPaymentInfo, setSellerPaymentInfo] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);

  // Prevent saved-address loading from overwriting data
  // that the customer has already started typing.
  const userEditedAddressRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;

    listAddresses(user.uid)
      .then((items) => {
        setSavedAddresses(items);

        if (userEditedAddressRef.current) return;

        const defaultAddr =
          items.find((item) => item.default) || items[0];

        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          applyAddressWithCityMode(defaultAddr);
        }
      })
      .catch((err) => {
        console.error("Could not load saved addresses:", err);
      });
  }, [user]);

  // Load admin-configured delivery zones.
  useEffect(() => {
    function loadZones() {
      listDeliveryZones()
        .then((list) => setDeliveryZones(list || []))
        .catch((err) =>
          console.error("Could not load delivery charges:", err)
        );
    }

    loadZones();

    window.addEventListener("deliveryzoneschange", loadZones);

    return () => {
      window.removeEventListener("deliveryzoneschange", loadZones);
    };
  }, []);

  // Check whether current city matches an admin-configured city.
  useEffect(() => {
    if (deliveryZones.length === 0 || !address.city) return;

    const options = deliveryZones.filter(
      (z) => z.city !== DEFAULT_ZONE_CITY
    );

    const matches = options.some(
      (z) =>
        z.city?.trim().toLowerCase() ===
        address.city.trim().toLowerCase()
    );

    if (matches) {
      setCityMode("select");
    }
  }, [deliveryZones, address.city]);

  // Fetch seller payment information for cart products.
  useEffect(() => {
    if (items.length === 0) {
      setSellerPaymentInfo([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      items.map(async (item) => {
        try {
          const product = await getProduct(item.productId);

          return {
            productId: item.productId,
            productName: item.name,
            ownerEmail: product?.ownerEmail || "",
            sellerPaymentMethod:
              product?.sellerPaymentMethod || "cod",
            sellerAccountTitle:
              product?.sellerAccountTitle || "",
            sellerAccountNumber:
              product?.sellerAccountNumber || "",
            sellerBankName:
              product?.sellerBankName || "",
          };
        } catch (err) {
          console.error(
            `Could not load product ${item.productId}:`,
            err
          );

          return {
            productId: item.productId,
            productName: item.name,
            ownerEmail: "",
            sellerPaymentMethod: "cod",
            sellerAccountTitle: "",
            sellerAccountNumber: "",
            sellerBankName: "",
          };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setSellerPaymentInfo(
          results.filter(
            (r) => r.sellerPaymentMethod !== "cod"
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  const cityOptions = deliveryZones.filter(
    (z) => z.city !== DEFAULT_ZONE_CITY
  );

  const deliveryCharge = resolveDeliveryCharge(
    deliveryZones,
    address.city
  );

  const total = subtotal + deliveryCharge;

  function applyAddressWithCityMode(addr) {
    const normalizedAddress = {
      ...EMPTY_ADDRESS,
      ...(addr || {}),
    };

    setAddress(normalizedAddress);

    const options = deliveryZones.filter(
      (z) => z.city !== DEFAULT_ZONE_CITY
    );

    const city = (normalizedAddress.city || "").trim();

    if (!city) {
      setCityMode("select");
      return;
    }

    const matches = options.some(
      (z) =>
        z.city?.trim().toLowerCase() ===
        city.toLowerCase()
    );

    setCityMode(matches ? "select" : "other");
  }

  function handleCitySelect(value) {
    userEditedAddressRef.current = true;

    if (value === "__other__") {
      setCityMode("other");

      setAddress((current) => ({
        ...current,
        city: "",
      }));
    } else {
      setCityMode("select");

      setAddress((current) => ({
        ...current,
        city: value,
      }));
    }
  }

  function update(field, val) {
    userEditedAddressRef.current = true;

    setAddress((current) => ({
      ...current,
      [field]: val,
    }));

    // If customer manually changes a selected saved address,
    // it is now treated as an edited form.
    if (selectedAddressId) {
      setSelectedAddressId("");
    }
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();

    setError("");

    if (!user?.uid) {
      setError("Please login before placing an order.");
      return;
    }

    // Required checkout fields.
    if (
      !address.fullName?.trim() ||
      !address.phone?.trim() ||
      !address.city?.trim() ||
      !address.address?.trim()
    ) {
      setError(
        "Please fill in all required address fields."
      );
      return;
    }

    setBusy(true);

    try {
      const finalAddress = {
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        city: address.city.trim(),
        area: address.area?.trim() || "",
        state: address.state?.trim() || "",
        email:
          address.email?.trim() ||
          user.email?.trim() ||
          "",
        address: address.address.trim(),
        landmark: address.landmark?.trim() || "",
        postalCode: address.postalCode?.trim() || "",
      };

      const orderItems = items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: Number(i.price) || 0,
        qty: Number(i.qty) || 1,
        image: i.image || "",
      }));

      const customerEmail =
        finalAddress.email || user.email || "";

      const { orderNumber, id } = await placeOrder({
        userId: user.uid,

        customerName: finalAddress.fullName,

        // Form email first, logged-in account email as fallback.
        customerEmail,

        items: orderItems,

        // Complete form/address data is saved.
        address: finalAddress,

        paymentMethod,

        subtotal,
        deliveryCharge,
        discount: 0,
        total,
      });

      clearCart();

      navigate(`/orders/${id}`, {
        state: {
          justPlaced: true,
          orderNumber,
        },
      });
    } catch (err) {
      console.error("Place order error:", err);

      setError(
        err?.message ||
          "Could not place order. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAddress() {
    if (!user?.uid) {
      setError("Please login before saving an address.");
      return;
    }

    if (
      !address.fullName?.trim() ||
      !address.phone?.trim() ||
      !address.city?.trim() ||
      !address.address?.trim()
    ) {
      setError(
        "Please complete the delivery address fields before saving."
      );
      return;
    }

    setAddressBusy(true);
    setError("");

    try {
      const addressToSave = {
        ...address,
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        city: address.city.trim(),
        area: address.area?.trim() || "",
        state: address.state?.trim() || "",
        email: address.email?.trim() || "",
        address: address.address.trim(),
        landmark: address.landmark?.trim() || "",
        postalCode: address.postalCode?.trim() || "",
      };

      if (selectedAddressId) {
        await updateAddress(
          user.uid,
          selectedAddressId,
          addressToSave
        );
      } else {
        const id = await addAddress(user.uid, {
          ...addressToSave,
          default: savedAddresses.length === 0,
        });

        setSelectedAddressId(id);
      }

      const next = await listAddresses(user.uid);

      setSavedAddresses(next);

      const defaultAddr =
        next.find((item) => item.default) || next[0];

      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        applyAddressWithCityMode(defaultAddr);
      }
    } catch (err) {
      console.error("Save address error:", err);

      setError(
        err?.message || "Could not save address."
      );
    } finally {
      setAddressBusy(false);
    }
  }

  function handlePickSavedAddress(addr) {
    setSelectedAddressId(addr.id);
    userEditedAddressRef.current = false;
    applyAddressWithCityMode(addr);
  }

  async function handleDeleteSavedAddress(addrId) {
    if (!user?.uid) return;

    try {
      await removeAddress(user.uid, addrId);

      const next = await listAddresses(user.uid);

      setSavedAddresses(next);

      if (selectedAddressId === addrId) {
        const defaultAddr =
          next.find((item) => item.default) || next[0];

        setSelectedAddressId(
          defaultAddr?.id || ""
        );

        if (defaultAddr) {
          applyAddressWithCityMode(defaultAddr);
        } else {
          setAddress({
            ...EMPTY_ADDRESS,
          });

          setCityMode("select");
          userEditedAddressRef.current = false;
        }
      }
    } catch (err) {
      setError(
        err?.message || "Could not delete address."
      );
    }
  }

  async function handleSetDefault(addrId) {
    if (!user?.uid) return;

    try {
      await setDefaultAddress(user.uid, addrId);

      const next = await listAddresses(user.uid);

      setSavedAddresses(next);

      const selected = next.find(
        (item) => item.id === addrId
      );

      if (selected) {
        setSelectedAddressId(selected.id);
        applyAddressWithCityMode(selected);
      }
    } catch (err) {
      setError(
        err?.message || "Could not set default address."
      );
    }
  }

  if (items.length === 0) {
    return (
      <div
        className="container empty-state"
        style={{ padding: 60 }}
      >
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="container checkout-page">
      <style>{`
        .checkout-page {
          padding: 32px 20px;
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 30px;
          align-items: start;
        }

        .checkout-form-col {
          order: 1;
        }

        .checkout-summary-col {
          order: 2;
          position: sticky;
          top: 20px;
        }

        .checkout-address-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .checkout-address-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .checkout-address-actions .btn-group {
          display: flex;
          gap: 6px;
        }

        @media (max-width: 1024px) {
          .checkout-page {
            grid-template-columns: 1fr 260px;
            gap: 20px;
            padding: 24px 16px;
          }
        }

        @media (max-width: 720px) {
          .checkout-page {
            grid-template-columns: 1fr;
            gap: 16px;
            padding: 16px 12px;
          }

          .checkout-form-col {
            order: 2;
          }

          .checkout-summary-col {
            order: 1;
            position: static;
          }

          .checkout-address-row {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .checkout-address-actions {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .checkout-address-actions .btn-group {
            width: 100%;
          }

          .checkout-address-actions .btn-group .btn {
            flex: 1;
          }

          .btn-block {
            font-size: 15px;
            padding: 14px;
          }
        }
      `}</style>

      {/* ORDER SUMMARY */}
      <div className="checkout-summary-col">
        <div
          className="card"
          style={{
            padding: 20,
            height: "fit-content",
          }}
        >
          <h3
            style={{
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            Order Summary
          </h3>

          {items.map((i) => (
            <div
              key={i.productId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13.5,
                marginBottom: 8,
                gap: 10,
              }}
            >
              <span>
                {i.name} × {i.qty}
              </span>

              <span>
                Rs{" "}
                {(i.price * i.qty).toLocaleString()}
              </span>
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid var(--line)",
              margin: "12px 0",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              <span>Product Subtotal</span>

              <span>
                Rs {subtotal.toLocaleString()}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              <span>Delivery Charges</span>

              <span>
                {address.city.trim()
                  ? `Rs ${deliveryCharge.toLocaleString()}`
                  : "Select a city"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: 16,
                marginTop: 10,
              }}
            >
              <span>Grand Total</span>

              <span>
                Rs {Math.max(0, total).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKOUT FORM */}
      <div className="checkout-form-col">
        <form onSubmit={handlePlaceOrder}>
          <h1
            style={{
              fontSize: 24,
              marginBottom: 20,
            }}
          >
            Checkout
          </h1>

          {/* DELIVERY ADDRESS */}
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                marginBottom: 14,
              }}
            >
              Delivery Address
            </h3>

            {/* SAVED ADDRESSES */}
            {savedAddresses.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Saved addresses
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      style={{
                        border:
                          selectedAddressId === addr.id
                            ? "1.5px solid var(--teal)"
                            : "1.5px solid var(--line)",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div className="checkout-address-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handlePickSavedAddress(addr)
                          }
                          style={{
                            textAlign: "left",
                            fontWeight: 700,
                            background: "none",
                            border: 0,
                            padding: 0,
                            color: "var(--ink)",
                          }}
                        >
                          {addr.fullName} · {addr.city}

                          {addr.default && (
                            <span
                              style={{
                                marginLeft: 8,
                                color: "var(--success)",
                                fontSize: 11,
                              }}
                            >
                              Default
                            </span>
                          )}
                        </button>

                        <div className="btn-group">
                          {!addr.default && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                handleSetDefault(addr.id)
                              }
                            >
                              Set default
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              handleDeleteSavedAddress(
                                addr.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-soft)",
                          marginTop: 4,
                        }}
                      >
                        {addr.address}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FULL NAME */}
            <div className="field">
              <label>Full Name</label>

              <input
                required
                value={address.fullName}
                onChange={(e) =>
                  update(
                    "fullName",
                    e.target.value
                  )
                }
              />
            </div>

            {/* PHONE */}
            <div className="field">
              <label>Phone Number</label>

              <input
                required
                value={address.phone}
                onChange={(e) =>
                  update(
                    "phone",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="checkout-address-row">
              {/* CITY */}
              <div className="field">
                <label>City</label>

                <select
                  required
                  value={
                    cityMode === "other"
                      ? "__other__"
                      : address.city || ""
                  }
                  onChange={(e) =>
                    handleCitySelect(
                      e.target.value
                    )
                  }
                >
                  <option
                    value=""
                    disabled
                  >
                    Select city
                  </option>

                  {cityOptions.map((z) => (
                    <option
                      key={z.id}
                      value={z.city}
                    >
                      {z.city}
                    </option>
                  ))}

                  <option value="__other__">
                    Other city
                  </option>
                </select>

                {cityMode === "other" && (
                  <input
                    required
                    value={address.city}
                    onChange={(e) =>
                      update(
                        "city",
                        e.target.value
                      )
                    }
                    placeholder="Type your city name"
                    style={{
                      marginTop: 8,
                    }}
                  />
                )}

                {address.city.trim() && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 6,
                    }}
                  >
                    Delivery charge for{" "}
                    {address.city}:{" "}
                    <strong>
                      Rs{" "}
                      {deliveryCharge.toLocaleString()}
                    </strong>
                  </div>
                )}
              </div>

              {/* AREA */}
              <div className="field">
                <label>Area</label>

                <input
                  value={address.area}
                  onChange={(e) =>
                    update(
                      "area",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* STATE */}
              <div className="field">
                <label>State</label>

                <input
                  value={address.state}
                  onChange={(e) =>
                    update(
                      "state",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* EMAIL */}
              <div className="field">
                <label>Email</label>

                <input
                  type="email"
                  value={address.email}
                  onChange={(e) =>
                    update(
                      "email",
                      e.target.value
                    )
                  }
                  placeholder="e.g., you@example.com"
                />
              </div>
            </div>

            {/* COMPLETE ADDRESS */}
            <div className="field">
              <label>Complete Address</label>

              <textarea
                required
                rows={2}
                value={address.address}
                onChange={(e) =>
                  update(
                    "address",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="checkout-address-row">
              {/* LANDMARK */}
              <div className="field">
                <label>
                  Landmark (optional)
                </label>

                <input
                  value={address.landmark}
                  onChange={(e) =>
                    update(
                      "landmark",
                      e.target.value
                    )
                  }
                />
              </div>

              {/* POSTAL CODE */}
              <div className="field">
                <label>Postal Code</label>

                <input
                  value={address.postalCode}
                  onChange={(e) =>
                    update(
                      "postalCode",
                      e.target.value
                    )
                  }
                  placeholder="e.g., 75500"
                />
              </div>
            </div>

            {/* SAVE ADDRESS */}
            <button
              type="button"
              className="btn btn-outline"
              disabled={addressBusy}
              onClick={handleSaveAddress}
            >
              {addressBusy
                ? "Saving…"
                : selectedAddressId
                ? "Save changes to address"
                : "Save this address"}
            </button>
          </div>

          {/* PAYMENT */}
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                marginBottom: 14,
              }}
            >
              Payment Method
            </h3>

            {[
              {
                id: "cod",
                label: "Cash on Delivery",
              },
              {
                id: "bank_transfer",
                label: "Bank Transfer",
              },
              {
                id: "wallet",
                label:
                  "Wallet Payment (JazzCash / EasyPaisa)",
              },
            ].map((m) => (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  opacity: m.disabled
                    ? 0.5
                    : 1,
                }}
              >
                <input
                  type="radio"
                  name="pm"
                  disabled={m.disabled}
                  checked={
                    paymentMethod === m.id
                  }
                  onChange={() =>
                    setPaymentMethod(m.id)
                  }
                />

                {m.label}
              </label>
            ))}

            {/* SELLER PAYMENT DETAILS */}
            {paymentMethod !== "cod" &&
              sellerPaymentInfo.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.04em",
                    }}
                  >
                    Send payment to
                  </div>

                  {sellerPaymentInfo.map((s) => (
                    <div
                      key={s.productId}
                      style={{
                        border:
                          "1.5px solid var(--line)",
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13.5,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        {s.productName}
                      </div>

                      <div
                        style={{
                          color:
                            "var(--ink-soft)",
                        }}
                      >
                        {PAYMENT_METHOD_LABELS[
                          s.sellerPaymentMethod
                        ] ||
                          s.sellerPaymentMethod}
                      </div>

                      {s.sellerBankName && (
                        <div>
                          Bank:{" "}
                          {s.sellerBankName}
                        </div>
                      )}

                      {s.sellerAccountTitle && (
                        <div>
                          Account Title:{" "}
                          {
                            s.sellerAccountTitle
                          }
                        </div>
                      )}

                      {s.sellerAccountNumber && (
                        <div>
                          Account Number:{" "}
                          <strong>
                            {
                              s.sellerAccountNumber
                            }
                          </strong>
                        </div>
                      )}
                    </div>
                  ))}

                  <p
                    style={{
                      fontSize: 12,
                      color:
                        "var(--ink-soft)",
                    }}
                  >
                    Please send payment to
                    the seller directly, then
                    place your order below.
                  </p>
                </div>
              )}
          </div>

          {/* ERROR */}
          {error && (
            <p className="error-text">
              {error}
            </p>
          )}

          {/* PLACE ORDER */}
          <button
            type="submit"
            className="btn btn-accent btn-block"
            disabled={busy}
          >
            {busy
              ? "Placing order…"
              : `Place Order — Rs ${total.toLocaleString()}`}
          </button>
        </form>
      </div>
    </div>
  );
}