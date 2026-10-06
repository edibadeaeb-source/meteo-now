// Service worker — METEO Târgoviște
// Rol: (1) face aplicația instalabilă ca aplicație reală (WebAPK, fără bara de browser)
//      (2) NU păstrează pagina în cache — conținutul vine mereu proaspăt din rețea.
// Cache-ul e folosit DOAR ca rezervă când nu ai internet.

const CACHE = 'meteo-now-net-v30';
const WEATHER_ASSETS = 'meteo-weather-assets-v1';
const WEATHER_VIDEO = 'meteo-weather-video-v2';
const videoLoads = new Map();
let videoCacheQueue = Promise.resolve();

function storeWeatherVideo(cache,key,response) {
  // Serialize mutations so simultaneous players cannot defeat the storage budget.
  videoCacheQueue = videoCacheQueue.catch(function() {}).then(async function() {
    await cache.delete(key);
    await cache.put(key,response);
    const keys = await cache.keys();
    let total = 0;
    const sizes = [];
    for (const req of keys) {
      const item = await cache.match(req);
      let bytes = +(item.headers.get('Content-Length') || 0);
      if (!bytes) bytes = (await item.clone().arrayBuffer()).byteLength;
      sizes.push({req:req,bytes:bytes}); total += bytes;
    }
    while (total > 96 * 1024 * 1024 && sizes.length > 1) {
      const oldest = sizes.shift(); await cache.delete(oldest.req); total -= oldest.bytes;
    }
  });
  return videoCacheQueue;
}

async function weatherVideoResponse(req) {
  // Cache whole files; native players request byte ranges, including while offline.
  const key = new URL(req.url); key.search = '';
  const cache = await caches.open(WEATHER_VIDEO);
  let response = await cache.match(key.href);
  if (!response) {
    if (!videoLoads.has(key.href)) {
      const load = fetch(key.href).then(async function(r) {
        if (r.status === 200) await storeWeatherVideo(cache,key.href,r.clone()).catch(function() {});
        return r;
      });
      videoLoads.set(key.href, load);
      load.finally(function() { videoLoads.delete(key.href); }).catch(function() {});
    }
    response = (await videoLoads.get(key.href)).clone();
  }
  const range = req.headers.get('Range');
  if (!range || response.status !== 200) return response;
  const bytes = await response.arrayBuffer(), total = bytes.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : total - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, total - +m[2]); end = total - 1; }
  if (!m || (!m[1] && !m[2]) || start >= total || end < start) {
    return new Response(null, {status:416, headers:{'Content-Range':'bytes */' + total}});
  }
  end = Math.min(end, total - 1);
  const headers = new Headers(response.headers);
  headers.set('Content-Type','video/mp4'); headers.set('Accept-Ranges','bytes');
  headers.set('Content-Range','bytes ' + start + '-' + end + '/' + total);
  headers.set('Content-Length',String(end - start + 1)); headers.delete('Content-Encoding');
  return new Response(bytes.slice(start,end + 1), {status:206, headers:headers});
}

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        // șterge cache-urile vechi (inclusiv cele din versiunile anterioare)
        return Promise.all(keys.filter(function(k) { return k !== CACHE && k !== WEATHER_ASSETS && k !== WEATHER_VIDEO; })
                              .map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

// Fetch handler — necesar pentru instalare. Strategie: MEREU din rețea întâi.
self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin && /^\/assets\/weather-video\/v[123]\//.test(url.pathname) && url.pathname.endsWith('.mp4')) {
    e.respondWith(weatherVideoResponse(req));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/weather/v1/') || (/^\/assets\/weather-video\/v[23]\//.test(url.pathname) && url.pathname.endsWith('.webp')))) {
    e.respondWith(caches.open(WEATHER_ASSETS).then(function(cache) {
      return cache.match(req).then(function(cached) {
        if (cached) return cached;
        return fetch(req).then(function(response) {
          if (response.ok) { e.waitUntil(cache.put(req, response.clone()).catch(function() {})); }
          return response;
        });
      });
    }));
    return;
  }

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
  catch (err) { d = { title: 'METEO NOW', body: (e.data && e.data.text()) || '' }; }

  if (!d || typeof d !== 'object') d = {};
  var titlu = d.title || 'METEO NOW';
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
