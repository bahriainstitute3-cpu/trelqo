import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { friendlyError, GoogleIcon } from "./Login";

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password should be at least 6 characters.");
    setBusy(true);
    try {
      await signup(form);
      navigate("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleBusy(true);
    try {
      await loginWithGoogle();
      navigate("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: "60px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Create your account</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 26 }}>Join Trelqo in seconds.</p>

      <button onClick={handleGoogle} disabled={googleBusy} className="btn btn-outline btn-block" style={{ marginBottom: 18, gap: 10 }}>
        <GoogleIcon /> {googleBusy ? "Connecting…" : "Continue with Google"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0", color: "var(--ink-soft)", fontSize: 12.5 }}>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        OR
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full Name</label>
          <input required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="field">
          <label>Mobile Number</label>
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="03xx-xxxxxxx" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input type="password" required value={form.confirm} onChange={(e) => update("confirm", e.target.value)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating account…" : "Sign Up"}</button>
      </form>

      <p style={{ marginTop: 20, fontSize: 14 }}>
        Already have an account? <Link to="/login" style={{ color: "var(--teal)", fontWeight: 700 }}>Log in</Link>
      </p>
    </div>
  );
}
