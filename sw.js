// METEO NOW: versioned app files work offline; weather stays in its per-city store.
// No API, notification, conversation or account responses enter Cache Storage.

const CACHE = 'meteo-now-net-v65';
const SHELL = 'meteo-now-shell-v1';
const APP_FILES = [
  '/', '/diagnostics.js?v=1', '/ai-conversations.js?v=3', '/ai-glass.js?v=1',
  '/weather-glass.css?v=13', '/weather-ai.css?v=10',
  '/weather-geography.js?v=1', '/weather-library.js?v=6', '/weather-data-cache.js?v=6',
  '/weather-romania.js?v=3', '/weather-motion.js?v=9', '/weather-atmosphere.js?v=8',
  '/icon-192.png', '/icon-96.png', '/manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];
function shellFile(url,req) {
  if(APP_FILES.some(function(p){return new URL(p,self.location.origin).href===url.href;}))return true;
  return ['script','style','font'].includes(req.destination) &&
    ['cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com','www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname);
}
async function warmShell() {
  const cache=await caches.open(SHELL);let next=0;
  async function worker() {
    while(next<APP_FILES.length) {
      const url=new URL(APP_FILES[next++],self.location.origin);
      const controller=new AbortController(),timer=setTimeout(function(){controller.abort();},8000);
      try {
        const response=await fetch(url.href,{signal:controller.signal,credentials:'omit',mode:url.origin===self.location.origin?'same-origin':'no-cors'});
        if(response.ok || response.type==='opaque')await cache.put(url.href,response);
      }catch(e){}finally{clearTimeout(timer);}
    }
  }
  await Promise.all([worker(),worker()]);
  const keys=await cache.keys();
  const keep=new Set(APP_FILES.map(function(p){return new URL(p,self.location.origin).href;}));
  let count=keys.length;
  for(const req of keys){if(count<=100)break;if(!keep.has(req.url)){await cache.delete(req);count--;}}
}
async function shellResponse(req,event) {
  const cache=await caches.open(SHELL),cached=await cache.match(req);
  if(cached)return cached;
  const response=await fetch(req);
  if(response.ok || response.type==='opaque')event.waitUntil(cache.put(req,response.clone()).catch(function(){}));
  return response;
}
async function navigationResponse(req,key,event) {
  const cached=await caches.match(key);
  // A stalled connection must not hide an already installed app behind a blank page.
  const controller=new AbortController();
  const networkTimer=cached ? setTimeout(function(){controller.abort();},10000) : null;
  const network=fetch(req,{signal:controller.signal}).then(async function(response){
    // With a cached document, wait for its full replacement body. Headers alone
    // can arrive instantly while a 64kbps HTML download takes over a minute.
    if(response.ok) {
      const store=caches.open(CACHE).then(function(c){return c.put(key,response.clone());}).catch(function(){});
      event.waitUntil(store);
      if(cached)await store;
    }
    if(!response.ok && cached)return cached.clone();
    return response;
  }).finally(function(){clearTimeout(networkTimer);});
  let timer;
  try {
    if(!cached)return await network;
    event.waitUntil(network.then(function(){},function(){}));
    return await Promise.race([network,new Promise(function(resolve){timer=setTimeout(function(){resolve(cached.clone());},2000);})]);
  }catch(e){
    return cached || new Response('<h1>Fără conexiune</h1><p>Conectează-te pentru prima încărcare METEO NOW.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }finally{clearTimeout(timer);}
}
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

self.addEventListener('install', function(e) {
  e.waitUntil(warmShell());
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        // șterge cache-urile vechi (inclusiv cele din versiunile anterioare)
        return Promise.all(keys.filter(function(k) { return k !== CACHE && k !== SHELL && k !== WEATHER_ASSETS && k !== WEATHER_VIDEO; })
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
  if(req.mode!=='navigate' && shellFile(url,req)) {
    e.respondWith(shellResponse(req,e));return;
  }
  if (url.origin === self.location.origin && /^\/assets\/weather-video\/v[123456]\//.test(url.pathname) && url.pathname.endsWith('.mp4')) {
    e.respondWith(weatherVideoResponse(req));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/weather/v1/') || (/^\/assets\/weather-romania\/v[12]\//.test(url.pathname) && url.pathname.endsWith('.webp')) || (/^\/assets\/weather-video\/v[23456]\//.test(url.pathname) && url.pathname.endsWith('.webp')))) {
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
    // Informational pages must never replace the weather app's offline document.
    const navigationKey = url.pathname === '/' || url.pathname === '/index.html' ? '/' : url.pathname;
    e.respondWith(navigationResponse(req,navigationKey,e));
    return;
  }

  // Restul cererilor trec direct la rețea (fără cache), ca datele să fie mereu actuale
  // APIs are never cached here: let fetch reject so the caller can recover honestly.
  e.respondWith(fetch(req));
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
