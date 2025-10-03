// Development detection (logs fully disabled to avoid leaking info)
const isDev = self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1');
// No-op logger to avoid any console usage being flagged by scanners
const devLog = (..._args) => {};
const CACHE_NAME = 'rivvlock-v9';
const OLD_CACHE_NAMES = ['rivvlock-v1', 'rivvlock-v2', 'rivvlock-v3', 'rivvlock-v4', 'rivvlock-v5', 'rivvlock-v6', 'rivvlock-v7', 'rivvlock-v8'];
const WORKING_DOMAIN = 'https://rivvlock.lovable.app';
const OLD_DOMAINS = [
  'https://rivv-secure-escrow.lovable.app',
  'https://lovableproject.com'
];

// Minimal files to cache (add index.html for SPA fallback)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  devLog('🔧 [SW] Installing service worker v9...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        devLog('🔧 [SW] Caching core assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        devLog('🔧 [SW] Installation complete, taking control...');
        return self.skipWaiting();
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  devLog('🔧 [SW] Activating service worker v9...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME || OLD_CACHE_NAMES.includes(cacheName)) {
              devLog(`🧹 [SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ]).then(() => {
      devLog('🔧 [SW] Service worker v9 activated and controlling all clients');
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Force redirect for navigations coming from obsolete domains
  if (req.mode === 'navigate') {
    if (OLD_DOMAINS.includes(url.origin)) {
      const targetUrl = WORKING_DOMAIN + url.pathname + url.search + url.hash;
      devLog('🔄 [SW] Redirecting navigation from obsolete domain to:', targetUrl);
      event.respondWith(Response.redirect(targetUrl, 302));
      return;
    }

    // Network-first for navigations with SPA fallback to index.html
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 404) {
            devLog('🔄 [SW] 404 for navigation, serving index.html for SPA routing:', req.url);
            return caches.match('/index.html') || fetch('/index.html');
          }
          return networkRes;
        })
        .catch(() => {
          devLog('🔄 [SW] Network failed, trying cache fallback for navigation:', req.url);
          return caches.match('/index.html').then((cached) => cached || fetch('/index.html'));
        })
    );
    return;
  }

  // For non-navigation requests: cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      return (
        cachedRes ||
        fetch(req).then((networkRes) => {
          // Optionally cache successful GET responses
          if (req.method === 'GET' && networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return networkRes;
        }).catch(() => {
          // As a last resort, return index.html for GET requests to keep SPA usable
          if (req.method === 'GET') {
            return caches.match('/index.html');
          }
        })
      );
    })
  );
});