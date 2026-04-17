// sw.js — network-first for navigation, fallback to /offline.html
const CACHE = "task-app-v1";
const OFFLINE_URLS = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigation requests: network-first → offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cached = await caches.match("/offline.html");
          return cached ?? new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Same-origin static assets: cache-first (lightweight)
  const url = new URL(req.url);
  if (url.origin === self.location.origin && /\.(?:js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached ?? new Response("", { status: 504 });
        }
      })
    );
  }
});
