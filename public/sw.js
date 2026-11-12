const CACHE_NAME = 'etuvendo-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/logo-etuvendo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('etuvendo-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // L'API et les photos distantes ne sont jamais mises en cache par erreur.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put('/index.html', response.clone()));
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(caches.match(request).then(cached => {
      const update = fetch(request).then(response => {
        if (response.ok) {
          // Clone la réponse avant de la renvoyer : le navigateur peut
          // commencer à consommer son flux dès qu'elle est retournée.
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      });
      return cached || update;
    }));
  }
});
