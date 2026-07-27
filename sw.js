// KILL-SWITCH — service worker de auto-distrugere.
// Browserul verifică periodic acest fișier; când vede versiunea nouă,
// îl instalează, apoi el se dezinstalează singur, golește tot cache-ul
// și reîncarcă paginile deschise, ca să dispară versiunile vechi blocate.
self.addEventListener('install', function() {
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil((async function() {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      var cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(function(c) { c.navigate(c.url); });
    } catch (err) {}
  })());
});
// nu mai interceptăm niciun fetch — totul merge direct în rețea
