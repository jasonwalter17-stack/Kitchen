/* Kitchen service worker — caches the app shell so it opens offline.
   Bump CACHE_NAME when you change index.html or assets to force an update. */
const CACHE_NAME = "kitchen-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* Fetch strategy:
 *  - App shell (same-origin GETs): cache-first, update in background.
 *  - Everything else (e.g. Supabase API calls): pass through to network untouched,
 *    so data is never stale and writes aren't cached. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // let cross-origin go straight to network

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
