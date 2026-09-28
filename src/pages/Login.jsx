import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleGoogle() {
    setError("");
    setGoogleBusy(true);
    try {
      await loginWithGoogle();
      navigate(location.state?.from?.pathname || "/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: "60px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Welcome back</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 26 }}>Log in to continue shopping.</p>

      <button onClick={handleGoogle} disabled={googleBusy} className="btn btn-outline btn-block" style={{ gap: 10 }}>
        <GoogleIcon /> {googleBusy ? "Connecting…" : "Continue with Google"}
      </button>

      {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) return "Invalid email or password.";
  if (code.includes("email-already-in-use")) return "An account with this email already exists.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  return err.message || "Something went wrong. Please try again.";
}
