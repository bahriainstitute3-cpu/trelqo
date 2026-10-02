/* Trelqo background push handler.
 *
 * This file is pulled into the generated service worker (sw.js) through
 * `workbox.importScripts` in vite.config.js, so it runs even when the site
 * is closed, the phone is locked or the browser is not open on screen.
 *
 * The server (netlify/functions/send-push.mjs) sends "data" messages, so the
 * browser never shows anything by itself - we always show it here. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { data: { body: event.data ? event.data.text() : "" } };
  }

  // FCM wraps the message: { data: {...} } (data messages) or
  // { notification: {...}, data: {...} } - support both.
  const d = Object.assign({}, payload.notification || {}, payload.data || {});

  const title = d.title || "Trelqo";
  const options = {
    body: d.body || d.message || "You have a new Trelqo update.",
    icon: "/icons/icon-192.PNG",
    badge: "/icons/icon-192.PNG",
    // Same tag the in-app listener uses, so an open tab and the push never
    // show the same notification twice (the later one replaces the earlier).
    tag: d.notificationId ? "trelqo -notification-" + d.notificationId : undefined,
    data: { link: d.link || "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let target = self.location.origin + "/";
  try {
    const url = new URL((event.notification.data && event.notification.data.link) || "/", self.location.origin);
    if (url.origin === self.location.origin) target = url.href;
  } catch (e) {}

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(target); } catch (e) {}
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
