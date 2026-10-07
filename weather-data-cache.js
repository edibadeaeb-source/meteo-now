/* Per-city forecasts survive app restarts. Network refreshes never clear the UI. */
(function(root) {
    'use strict';
    var entries = Object.create(null), pending = Object.create(null), db = null;
    var freshFor = 5 * 60000, visibleFor = 30 * 60000, limit = 16;
    function key(loc) { return (+loc.lat).toFixed(3) + ',' + (+loc.lon).toFixed(3); }
    function valid(d) { return d && d.current && d.hourly && d.daily && Array.isArray(d.hourly.time) && d.hourly.time.length && Array.isArray(d.daily.time) && d.daily.time.length && typeof d.current.temperature_2m==='number' && isFinite(d.current.temperature_2m); }
    function usable(x) { var age = x && Date.now() - x.t; return x && age >= 0 && age < visibleFor && valid(x.d); }
    function trim() {
        var keys = Object.keys(entries).sort(function(a,b) { return entries[b].t - entries[a].t; });
        keys.forEach(function(k,i) { if (i >= limit || !usable(entries[k])) delete entries[k]; });
    }
    function peek(loc) { var x = entries[key(loc)]; return usable(x) ? x.d : null; }
    function fresh(loc) { var x = entries[key(loc)]; return usable(x) && Date.now() - x.t < freshFor; }
    var ready = new Promise(function(resolve) {
        if (!root.indexedDB) { resolve(); return; }
        var settled = false, request;
        function finish() { if (!settled) { settled = true; resolve(); } }
        var timer = setTimeout(finish, 800);
        try {
            request = root.indexedDB.open('meteo-forecast-cache-v1', 1);
            request.onupgradeneeded = function() { request.result.createObjectStore('cities', {keyPath:'key'}); };
            request.onblocked = request.onerror = finish;
            request.onsuccess = function() {
                db = request.result;
                db.onversionchange = function() { db.close(); db = null; };
                var read = db.transaction('cities').objectStore('cities').getAll();
                read.onsuccess = function() {
                    read.result.forEach(function(x) {
                        if (usable(x) && (!entries[x.key] || entries[x.key].t < x.t)) entries[x.key] = {t:x.t, d:x.d};
                    });
                    trim(); persist(); clearTimeout(timer); finish();
                };
                read.onerror = finish;
            };
        } catch(e) { clearTimeout(timer); finish(); }
    });
    function persist(k) {
        if (!db) return;
        try {
            // Clone only the changed city, rather than all saved forecasts on every write.
            var tx = db.transaction('cities','readwrite'), store = tx.objectStore('cities');
            tx.onerror = function() {}; tx.onabort = function() {};
            if (k && entries[k]) store.put({key:k,t:entries[k].t,d:entries[k].d});
            var keys=store.getAllKeys();
            keys.onsuccess=function() { keys.result.forEach(function(old) { if (!entries[old]) store.delete(old); }); };
        } catch(e) {}
    }
    function put(loc,d) {
        if (!valid(d)) throw new Error('Incomplete weather response');
        entries[key(loc)] = {t:Date.now(),d:d}; trim();
        var k=key(loc);
        ready.then(function() {
            if(root.requestIdleCallback) root.requestIdleCallback(function() { persist(k); },{timeout:1500});
            else setTimeout(function() { persist(k); },32);
        }); return d;
    }
    async function network(loc) {
        for(var attempt=0;attempt<3;attempt++) {
            var controller=typeof AbortController!=='undefined'?new AbortController():null;
            var timer=setTimeout(function(){if(controller)controller.abort();},12000);
            try {
                var r=await fetch('/api/weather/forecast?latitude='+loc.lat+'&longitude='+loc.lon,
                    controller?{signal:controller.signal}:{});
                if(!r.ok) { var e=new Error('meteo: '+r.status);e.status=r.status;throw e; }
                var d=await r.json();return put(loc,d);
            } catch(e) {
                if(attempt===2 || (e.status && e.status<500)) throw e;
                if(root.navigator && root.navigator.onLine===false) throw e;
            } finally {clearTimeout(timer);}
            await new Promise(function(resolve){setTimeout(resolve,attempt?3000:1000);});
        }
    }
    function request(loc) {
        var k=key(loc);
        if(pending[k])return pending[k];
        pending[k]=ready.then(function(){return fresh(loc)?peek(loc):network(loc);})
            .finally(function(){delete pending[k];});
        return pending[k];
    }
    root.MeteoForecastCache = {ready:ready,peek:peek,fresh:fresh,put:put,request:request,key:key,entry:function(loc) { return entries[key(loc)] || null; }};
})(window);
