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

// ═══════════════════════════════════════════════════════════
//  NOTIFICĂRI PUSH — sosesc chiar dacă aplicația e închisă
// ═══════════════════════════════════════════════════════════
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (err) { d = { title: 'METEO Târgoviște', body: (e.data && e.data.text()) || '' }; }

  var titlu = d.title || '⚠️ METEO Târgoviște';
  var optiuni = {
    body: d.body || 'Avertizare meteorologică în zona ta.',
    icon: 'icon-192.png',
    badge: 'icon-96.png',
    tag: d.tag || 'meteo-tgv',
    renotify: true,
    requireInteraction: (d.nivel || 0) >= 2,      // codurile portocaliu/roșu rămân pe ecran
    vibrate: (d.nivel || 0) >= 2 ? [200, 100, 200, 100, 200] : [150, 80, 150],
    data: { url: d.url || '/' },
    actions: [{ action: 'deschide', title: 'Vezi detalii' }]
  };
  e.waitUntil(self.registration.showNotification(titlu, optiuni));
});

// Apăsarea pe notificare deschide aplicația (sau o aduce în față)
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var tinta = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) {
          if ('navigate' in list[i]) { try { list[i].navigate(tinta); } catch (err) {} }
          return list[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(tinta);
    })
  );
});
