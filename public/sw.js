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

// Core files to cache (critical for offline functionality)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Runtime cache configuration
const RUNTIME_CACHE = 'rivvlock-runtime-v9';
const API_CACHE = 'rivvlock-api-v9';
const ASSET_CACHE = 'rivvlock-assets-v9';
const OFFLINE_PAGE_CACHE = 'rivvlock-offline-v9';

// Cache duration in milliseconds
const CACHE_DURATION = {
  api: 5 * 60 * 1000, // 5 minutes for API responses
  assets: 7 * 24 * 60 * 60 * 1000, // 7 days for static assets
};

// Offline fallback page
const OFFLINE_URL = '/offline.html';

// Installation du service worker
self.addEventListener('install', (event) => {
  devLog('🔧 [SW] Installing service worker v9...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          devLog('🔧 [SW] Caching core assets...');
          return cache.addAll(urlsToCache);
        }),
      caches.open(OFFLINE_PAGE_CACHE)
        .then((cache) => {
          devLog('🔧 [SW] Caching offline page...');
          return cache.add(new Request(OFFLINE_URL, {cache: 'reload'}));
        })
        .catch(() => {
          devLog('⚠️ [SW] Offline page not available yet');
        })
    ])
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
            if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_PAGE_CACHE || OLD_CACHE_NAMES.includes(cacheName)) {
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
          return caches.match('/index.html')
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((response) => response || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Strategy selection based on request type
  const isApiRequest = url.hostname === 'slthyxqruhfuyfmextwr.supabase.co';
  const isAsset = /\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);

  // API requests: Network-first with cache fallback
  if (isApiRequest) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(req, resClone);
            });
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) {
              devLog('🔄 [SW] Serving stale API response from cache:', req.url);
              return cached;
            }
            throw new Error('Network unavailable and no cache available');
          });
        })
    );
    return;
  }

  // Static assets: Cache-first with network fallback
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        if (cachedRes) {
          return cachedRes;
        }
        return fetch(req).then((networkRes) => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(ASSET_CACHE).then((cache) => {
              cache.put(req, resClone);
            });
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // Other requests: Network-first
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (req.method === 'GET' && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) {
            return cached;
          }
          if (req.method === 'GET') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ============= Push Notifications =============
self.addEventListener('push', (event) => {
  if (!event.data) {
    devLog('⚠️ [SW] Push event without data');
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || 'RIVVLOCK';
    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data || {},
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    devLog('❌ [SW] Error handling push event:', error);
  }
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenêtre est déjà ouverte, la focus
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});