const CACHE_NAME = "lending-agent-pwa-v5";

// Install Event - skip waiting immediately
self.addEventListener("install", event => {
  self.skipWaiting();
});

// Activate Event - purge all old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          console.log("[Service Worker] Purging cache:", key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - ALWAYS NETWORK FIRST
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
