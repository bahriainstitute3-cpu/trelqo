import { useEffect, useState } from "react";
import "./SplashScreen.css";

const SPLASH_LOGO = "/icons/icon-512.PNG";
const SPLASH_BG_COLOR = "#111827";
const SPLASH_TEXT_COLOR = "#ffffff";
const SPLASH_ARROW_COLOR = "#F97316"; // arrow ka color, alag rakha hai taake highlight ho
const MIN_DISPLAY_MS = 1200;

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => onFinish?.(), 400);
    }, MIN_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`splash-screen ${fadeOut ? "splash-screen--fade-out" : ""}`}
      style={{ backgroundColor: SPLASH_BG_COLOR }}
    >
      <img src={SPLASH_LOGO} alt="Trelqo" className="splash-screen__logo" />

      <div className="splash-screen__wordmark">
        <h1 className="splash-screen__text" style={{ color: SPLASH_TEXT_COLOR }}>
          Trelqo
        </h1>
        <svg
          className="splash-screen__arrow"
          viewBox="0 0 120 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* curved swoosh, left se right tak */}
          <path
            d="M4 4C30 20 90 20 116 4"
            stroke={SPLASH_ARROW_COLOR}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* arrow head, right end pe */}
          <path
            d="M108 2L117 5L112 13"
            stroke={SPLASH_ARROW_COLOR}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}