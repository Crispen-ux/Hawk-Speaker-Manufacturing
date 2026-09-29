/* Service worker: app-shell caching + offline fallback + Web Push.

   Push payload is written by lib/push.ts ({ title, body, url }). */

const VERSION = "v1";
const SHELL_CACHE = `hsm-shell-${VERSION}`;
const PAGE_CACHE = `hsm-pages-${VERSION}`;
const STATIC_CACHE = `hsm-static-${VERSION}`;
const CACHES = [SHELL_CACHE, PAGE_CACHE, STATIC_CACHE];

const SHELL_URLS = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("hsm-") && !CACHES.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf)$/.test(url.pathname)
  );
}

const MAX_PAGES = 40;

async function cachePage(request, response) {
  if (response && response.ok && !response.redirected) {
    const cache = await caches.open(PAGE_CACHE);
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    if (keys.length > MAX_PAGES) {
      await Promise.all(keys.slice(0, keys.length - MAX_PAGES).map((k) => cache.delete(k)));
    }
  }
  return response;
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    return await cachePage(request, response);
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await caches.match("/offline");
    if (shell) return shell;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      cacheFirst(request).catch(() => caches.match(request).then((r) => r || Response.error()))
    );
  }
});

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
