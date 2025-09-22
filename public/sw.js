const CACHE_NAME = 'rivvlock-v2';
const OLD_CACHE_NAMES = ['rivvlock-v1']; // Liste des anciens caches à supprimer
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Installing service worker v2...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🔧 [SW] Caching app shell...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('🔧 [SW] Installation complete, taking control...');
        return self.skipWaiting(); // Force le nouveau SW à prendre le contrôle
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('🔧 [SW] Activating service worker v2...');
  event.waitUntil(
    Promise.all([
      // Supprimer tous les anciens caches
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
      // Prendre le contrôle de tous les clients
      self.clients.claim()
    ]).then(() => {
      console.log('🔧 [SW] Service worker v2 activated and controlling all clients');
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});