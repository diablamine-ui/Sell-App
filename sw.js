const CACHE_NAME = 'dilam-b-v4';

// Install - skip waiting immediately
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// Activate - delete ALL old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        return caches.delete(key);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch - ALWAYS network first, NEVER cache HTML
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  
  var url = e.request.url;
  
  // Never cache HTML files or API calls
  if (
    url.includes('.html') ||
    url.endsWith('/') ||
    url.includes('supabase') ||
    url.includes('cloudinary') ||
    url.includes('facebook') ||
    url.includes('graph.facebook')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // For static assets (images, fonts) - cache then network
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});
