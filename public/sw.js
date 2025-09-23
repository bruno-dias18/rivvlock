const CACHE_NAME = 'rivvlock-v4';
const OLD_CACHE_NAMES = ['rivvlock-v1', 'rivvlock-v2', 'rivvlock-v3'];
const WORKING_DOMAIN = 'https://id-preview--cfd5feba-e675-4ca7-b281-9639755fdc6f.lovable.app';
const OLD_DOMAINS = [
  'https://rivv-secure-escrow.lovable.app',
  'https://lovableproject.com'
];

// Minimal files to cache (avoid caching HTML to prevent stale pages)
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Installing service worker v4...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🔧 [SW] Caching core assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('🔧 [SW] Installation complete, taking control...');
        return self.skipWaiting();
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('🔧 [SW] Activating service worker v4...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME || OLD_CACHE_NAMES.includes(cacheName)) {
              console.log(`🧹 [SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ]).then(() => {
      console.log('🔧 [SW] Service worker v4 activated and controlling all clients');
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
      console.log('🔄 [SW] Redirecting navigation from obsolete domain to:', targetUrl);
      event.respondWith(Response.redirect(targetUrl, 302));
      return;
    }

    // Network-first for navigations with SPA fallback
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // If we get a 404 for a navigation request, serve the root HTML so React Router can handle it
          if (networkRes.status === 404) {
            console.log('🔄 [SW] 404 for navigation, serving root HTML for SPA routing:', req.url);
            return caches.match('/') || fetch('/');
          }
          return networkRes;
        })
        .catch(() => {
          // Network failed, try cache fallback
          console.log('🔄 [SW] Network failed, trying cache fallback for:', req.url);
          return caches.match(req).then((cached) => cached || caches.match('/'));
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
        })
      );
    })
  );
});