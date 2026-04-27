/* Hit Zero — service worker
   Strategy:
     · Same-origin HTML / JS / JSX / CSS: NETWORK-FIRST so new deploys reach
       users immediately. Cache is only a fallback when offline.
     · Same-origin icons + images: cache-first (rarely change).
     · Cross-origin (React, Babel CDN): stale-while-revalidate.
   Bump CACHE_VERSION any time you re-deploy to force clients to refresh. */

const CACHE_VERSION = 'hz-v53-2026-04-27-mca-showcase';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Explicit SKIP_WAITING hook so the app can force-upgrade mid-session.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isCodeOrShell(url) {
  return /\.(html|js|jsx|css|webmanifest)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}
function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (isCodeOrShell(url)) {
      // Network-first: always try network, fall back to cache only if offline.
      event.respondWith(
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
      );
      return;
    }
    if (isStaticAsset(url)) {
      event.respondWith(
        caches.match(req).then((hit) =>
          hit || fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
        )
      );
      return;
    }
  }

  // Cross-origin: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(req).then((hit) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || fetchPromise;
      })
    )
  );
});
