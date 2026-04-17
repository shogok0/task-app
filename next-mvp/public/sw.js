self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("task-mvp-v1").then((cache) =>
      cache.addAll(["/", "/login", "/register", "/manifest.webmanifest"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const copy = response.clone();
          caches.open("task-mvp-v1").then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("/"));
    }),
  );
});
