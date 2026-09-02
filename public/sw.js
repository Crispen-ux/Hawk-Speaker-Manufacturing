/* Service worker for Web Push notifications.

   Line your push notifiations up against the payload written by lib/push.ts
   ({ title, body, url }) and open the right page when the notification is
   clicked. */
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {};
    }
  }
  const payload = data || {};
  const options = {
    body: String(payload.body || ""),
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: String(payload.url || "/") },
  };
  event.waitUntil(self.registration.showNotification(String(payload.title || "Notification"), options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if (new URL(client.url).pathname === new URL(url, self.location.origin).pathname) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});