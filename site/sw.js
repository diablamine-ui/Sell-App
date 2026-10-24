const CACHE_NAME = 'dilam-b-v15';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

// Réseau d'abord pour les pages et l'API ; cache seulement pour les images et polices.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '/sw.js') return;
  // Les vidéos se lisent par morceaux (Range) : on laisse le navigateur gérer.
  if (url.pathname.startsWith('/media/vid/')) return;
  if (!/\.(png|jpe?g|webp|gif|svg|woff2?)$/i.test(url.pathname) && !url.pathname.startsWith('/media/')) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
      return cached || net;
    })
  );
});
