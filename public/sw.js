// public/sw.js
// Service Worker untuk Resilio-Health PWA
// Offline-First Caching & Background Sync API Support

const CACHE_NAME = "resilio-health-v0.2";
const STATIC_ASSETS = [
  "/",
  "/beranda",
  "/login",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("ServiceWorker pre-caching non-fatal warning:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Hanya intercept GET requests; navigasi dan static assets
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Jangan cache API routes atau server actions
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback offline UI jika ada
          return caches.match("/");
        });
      })
  );
});

// Background Sync API Handler: sync-medical-records
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-medical-records") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "RESILIO_TRIGGER_OFFLINE_SYNC",
            timestamp: new Date().toISOString(),
          });
        });
      })
    );
  }
});
