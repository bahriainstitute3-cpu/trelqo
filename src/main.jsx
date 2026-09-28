import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import "./styles/index.css";

function startServiceWorker() {
  // Force reload the moment a new service worker takes control of this
  // page, so a fresh redeploy shows up without the user manually
  // refreshing. Guarded so it only fires once.
  let reloaded = false;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Check for a new deploy periodically...
      setInterval(() => registration.update(), 60 * 1000);
      // ...and every time the tab regains focus (covers the common case:
      // user had the tab open/backgrounded, comes back, should get latest).
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update();
      });
    },
  });
}

if (document.readyState === "complete") {
  startServiceWorker();
} else {
  window.addEventListener("load", startServiceWorker, { once: true });
}

function Root() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <React.StrictMode>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);