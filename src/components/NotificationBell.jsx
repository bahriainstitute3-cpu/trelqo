import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listenToNotifications, markAllNotificationsRead } from "../lib/notifications";
import { registerPushToken } from "../lib/push";

// Plays a short two-tone "ding" using the Web Audio API — no audio file
// needed, so it costs nothing extra to load and works instantly.
function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // Ignore — sound is a nice-to-have, never block on it.
  }
}

function showBrowserNotification(notification) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const browserNotification = new Notification(notification.title || "Trelqo notification", {
      body: notification.message || "You have a new Trelqo update.",
      icon: "/icons/icon-192.PNG",
      badge: "/icons/icon-192.PNG",
      tag: `trelqo -notification-${notification.id}`,
    });
    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
      if (notification.link) window.location.assign(notification.link);
    };
  } catch {}
}

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const knownIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user?.email) {
      setNotifications([]);
      return;
    }
    const unsubscribe = listenToNotifications(user.email, (items) => {
      const ids = new Set(items.map((n) => n.id));
      if (!isFirstLoad.current) {
        const hasNewUnread = items.some((n) => !n.read && !knownIds.current.has(n.id));
        if (hasNewUnread) {
          playNotificationSound();
          items.filter((n) => !n.read && !knownIds.current.has(n.id)).forEach(showBrowserNotification);
        }
      }
      isFirstLoad.current = false;
      knownIds.current = ids;
      setNotifications(items);
    });
    return () => unsubscribe();
  }, [user?.email]);

  // If the user already allowed notifications, make sure this device's push
  // token is saved (runs on every login / app start).
  useEffect(() => {
    if (user?.uid) registerPushToken(user);
  }, [user?.uid]);

  useEffect(() => {
    const openPanel = () => setIsOpen((prev) => !prev);
    window.addEventListener("toggle-notifications-panel", openPanel);
    return () => window.removeEventListener("toggle-notifications-panel", openPanel);
  }, []);

  if (!user?.email) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotifClick = (notif) => {
    setIsOpen(false);
    navigate(notif.link || "/");
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead(notifications);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="navbar-bell-btn"
        onClick={() => {
          if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().then((p) => { if (p === "granted") registerPushToken(user); }).catch(() => {});
          setIsOpen((p) => !p);
        }}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: "4px",
          display: "flex", alignItems: "center", color: "#374151", position: "relative",
        }}
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2, background: "#ef4444", color: "#fff",
            borderRadius: "999px", fontSize: "10px", fontWeight: 800, minWidth: "16px", height: "16px",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div style={{
            position: "absolute", top: "36px", right: 0, width: "300px", maxHeight: "380px",
            overflowY: "auto", backgroundColor: "#fff", borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)", border: "1px solid #f3f4f6", zIndex: 70,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>Notifications</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link to="/notifications" onClick={() => setIsOpen(false)} style={{ color: "#24534b", fontSize: "12px", fontWeight: 700 }}>
                  View all
                </Link>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: "20px 14px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                Koi notification nahi hai
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    padding: "12px 14px", borderBottom: "1px solid #f9fafb", cursor: "pointer",
                    backgroundColor: n.read ? "#fff" : "#f0f9ff",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>{n.title}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{n.message}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}