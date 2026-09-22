// EazyOPC Canvas Tools — Service Worker
// Navigations: network-first (fresh HTML on every visit, cached copy offline).
// Same-origin static assets: stale-while-revalidate. Cross-origin: untouched.
const CACHE_NAME = 'eazyopc-canvas-v2';
const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/manifest.json'
];

function isCacheable(res) {
  return !!res && res.ok && !res.redirected && res.type === 'basic';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // let the browser handle cross-origin requests

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match('/').then((cached) => cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
        )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (isCacheable(res)) cache.put(request, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })
    )
  );
});
