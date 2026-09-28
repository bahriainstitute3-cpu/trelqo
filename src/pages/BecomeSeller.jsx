import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSellerApplication, getSellerProfileByUserId } from "../lib/sellers";

const cityOptions = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Hyderabad"];

export default function BecomeSeller() {
  const navigate = useNavigate();
  const { user, profile, sellerProfile, loading } = useAuth();
  const [form, setForm] = useState({
    fullName: profile?.name || "",
    email: profile?.email || user?.email || "",
    phone: profile?.phone || "",
    whatsapp: "",
    cnic: "",
    age: "",
    gender: "",
    city: "",
    area: "",
    address: "",
    registrationDate: new Date().toISOString().slice(0, 10),
    payoutMethod: "bank",
    payoutAccountName: "",
    payoutAccountNumber: "",
    agreementAccepted: false,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusView, setStatusView] = useState(null);

  useEffect(() => {
    if (!user || !profile) return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || profile.name || "",
      email: current.email || profile.email || user.email || "",
      phone: current.phone || profile.phone || "",
    }));
  }, [user, profile]);

  useEffect(() => {
    async function fetchStatus() {
      if (!user?.uid) return;
      const seller = await getSellerProfileByUserId(user.uid);
      if (seller) setStatusView(seller);
    }
    fetchStatus();
  }, [user?.uid]);

  if (loading) return <div className="container empty-state" style={{ padding: 60 }}>Loading…</div>;

  if (!user) {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 30, marginBottom: 10 }}>Become a Seller</h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>Create your Trelqo seller account to start listing products.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/signup" className="btn btn-ghost">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (sellerProfile && sellerProfile.sellerStatus === "APPROVED") {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 30, marginBottom: 10 }}>Seller Dashboard</h1>
          <p style={{ color: "var(--ink-soft)", marginBottom: 16 }}>Your seller account is active and ready to use.</p>
          <Link to="/seller/dashboard" className="btn btn-primary">Open Dashboard</Link>
        </div>
      </div>
    );
  }

  if (sellerProfile && sellerProfile.sellerStatus === "PENDING") {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>⏳</div>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Your seller application is currently under review.</h1>
          <p style={{ color: "var(--ink-soft)" }}>We will notify you once an administrator reviews your application.</p>
        </div>
      </div>
    );
  }

  if (sellerProfile && sellerProfile.sellerStatus === "REJECTED") {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Seller application rejected</h1>
          <p style={{ color: "var(--ink-soft)" }}>{sellerProfile.rejectionReason || "Your seller application was not approved."}</p>
        </div>
      </div>
    );
  }

  if (sellerProfile && sellerProfile.sellerStatus === "SUSPENDED") {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>🚫</div>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Your seller account has been suspended.</h1>
          <p style={{ color: "var(--ink-soft)" }}>Please contact Trelqo Support for assistance.</p>
        </div>
      </div>
    );
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.fullName.trim()) return setError("Please enter your full name.");
    if (!form.email.trim()) return setError("Please enter your email.");
    if (!form.phone.trim()) return setError("Please enter your phone number.");
    if (!form.city.trim()) return setError("Please enter your city.");
    if (!form.address.trim()) return setError("Please enter your complete address.");
    if (!form.agreementAccepted) return setError("Please accept the seller agreement.");

    setSubmitting(true);
    try {
      await createSellerApplication({
        userId: user.uid,
        userEmail: user.email,
        fullName: form.fullName,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        cnic: form.cnic,
        age: form.age,
        gender: form.gender,
        city: form.city,
        area: form.area,
        address: form.address,
        registrationDate: form.registrationDate,
        payoutMethod: form.payoutMethod,
        payoutAccountName: form.payoutAccountName,
        payoutAccountNumber: form.payoutAccountNumber,
        agreementAccepted: form.agreementAccepted,
      });
      navigate("/become-a-seller");
      window.location.reload();
    } catch (err) {
      setError(`${err.message || "Could not submit seller application."}${err.code ? ` (${err.code})` : ""}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ padding: "32px 20px", maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Become a Seller</h1>
        <p style={{ color: "var(--ink-soft)" }}>Submit your details for seller verification and start listing products after approval.</p>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="card" onSubmit={handleSubmit} style={{ padding: 28, display: "grid", gap: 22 }}>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Personal Information</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label className="field"><span>Full Name</span><input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} /></label>
            <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} /></label>
            <label className="field"><span>Phone Number</span><input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} /></label>
            <label className="field"><span>WhatsApp Number</span><input value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} /></label>
            <label className="field"><span>CNIC Number</span><input value={form.cnic} onChange={(e) => updateField("cnic", e.target.value)} placeholder="xxxxx-xxxxxxx-x" /></label>
            <label className="field"><span>Age</span><input type="number" min="18" value={form.age} onChange={(e) => updateField("age", e.target.value)} /></label>
            <label className="field"><span>Gender</span><select value={form.gender} onChange={(e) => updateField("gender", e.target.value)}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Location</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label className="field"><span>City</span><select value={form.city} onChange={(e) => updateField("city", e.target.value)}><option value="">Select city</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label className="field"><span>Area</span><input value={form.area} onChange={(e) => updateField("area", e.target.value)} /></label>
            <label className="field"><span>Registration Date</span><input type="date" value={form.registrationDate} readOnly /></label>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field"><span>Complete Address</span><textarea rows={3} value={form.address} onChange={(e) => updateField("address", e.target.value)} /></label>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Payout Information</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label className="field"><span>Payout Method</span><select value={form.payoutMethod} onChange={(e) => updateField("payoutMethod", e.target.value)}><option value="bank">Bank Transfer</option><option value="jazzcash">JazzCash</option><option value="easypaisa">EasyPaisa</option></select></label>
            <label className="field"><span>Account Name</span><input value={form.payoutAccountName} onChange={(e) => updateField("payoutAccountName", e.target.value)} /></label>
            <label className="field"><span>Account Number / IBAN</span><input value={form.payoutAccountNumber} onChange={(e) => updateField("payoutAccountNumber", e.target.value)} /></label>
          </div>
        </section>

        <section>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "var(--ink)", fontWeight: 600 }}>
            <input type="checkbox" checked={form.agreementAccepted} onChange={(e) => updateField("agreementAccepted", e.target.checked)} />
            <span>I agree to the Trelqo Seller Terms and Policies.</span>
          </label>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Link to="/" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Submitting..." : "Submit Application"}</button>
        </div>
      </form>
    </div>
  );
}
