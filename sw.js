// Service worker — METEO Târgoviște
// Rol: (1) face aplicația instalabilă ca aplicație reală (WebAPK, fără bara de browser)
//      (2) NU păstrează pagina în cache — conținutul vine mereu proaspăt din rețea.
// Cache-ul e folosit DOAR ca rezervă când nu ai internet.

const CACHE = 'meteo-tgv-net-v1';

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        // șterge cache-urile vechi (inclusiv cele din versiunile anterioare)
        return Promise.all(keys.filter(function(k) { return k !== CACHE; })
                              .map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

// Fetch handler — necesar pentru instalare. Strategie: MEREU din rețea întâi.
self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Doar navigarea (documentul HTML) primește rezervă offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function(resp) {
          var copy = resp.clone();
          caches.open(CACHE).then(function(c) { c.put('/', copy); }).catch(function() {});
          return resp;
        })
        .catch(function() {
          return caches.match('/').then(function(r) {
            return r || new Response('<h1>Offline</h1><p>Nu există conexiune la internet.</p>',
                                     { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          });
        })
    );
    return;
  }

  // Restul cererilor trec direct la rețea (fără cache), ca datele să fie mereu actuale
  e.respondWith(fetch(req).catch(function() { return caches.match(req); }));
});
