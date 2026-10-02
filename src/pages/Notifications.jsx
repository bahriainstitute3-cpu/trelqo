import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listenToNotifications, markAllNotificationsRead } from "../lib/notifications";
import { registerPushToken } from "../lib/push";

function formatNotificationDate(value) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setPermissionTick] = useState(0); // re-render after the permission prompt
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.email) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = listenToNotifications(user.email, (items) => {
      setNotifications(items);
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.email]);

  if (!user) {
    return <div className="empty-state">Please login to view notifications.</div>;
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const canEnableBrowserAlerts = typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted";
  // iPhone/iPad only allow push once the site is added to the Home Screen.
  const needsIosInstall =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !("Notification" in window) &&
    !window.navigator.standalone;

  async function handleMarkAllRead() {
    await markAllNotificationsRead(notifications);
  }

  async function enableBrowserAlerts() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await registerPushToken(user);
      setPermissionTick((n) => n + 1);
    }
  }

  function openNotification(notification) {
    if (notification.link) navigate(notification.link);
  }

  return (
    <section className="notifications-page">
      <div className="notifications-page-header">
        <div>
          <span className="section-eyebrow">Your updates</span>
          <h1>Notifications</h1>
          <p>Order updates and important Trelqo activity in one place.</p>
        </div>
        <div className="notifications-page-actions">
          {canEnableBrowserAlerts && (
            <button type="button" className="btn btn-outline btn-sm" onClick={enableBrowserAlerts}>
              Enable alerts
            </button>
          )}
          {unreadCount > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {needsIosInstall && (
        <div className="card notifications-install-hint">
          To get notifications on iPhone: tap Share, then "Add to Home Screen", and open Trelqo from the Home Screen icon.
        </div>
      )}

      {loading ? (
        <div className="card notifications-empty">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="card notifications-empty">
          <strong>No notifications yet</strong>
          <span>New order updates will appear here automatically.</span>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <button
              type="button"
              className={`notification-item${notification.read ? "" : " is-unread"}`}
              key={notification.id}
              onClick={() => openNotification(notification)}
            >
              <span className="notification-item-icon">{notification.type === "order" ? "📦" : "🔔"}</span>
              <span className="notification-item-content">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                {notification.createdAt && <small>{formatNotificationDate(notification.createdAt)}</small>}
              </span>
              <span className="notification-item-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
