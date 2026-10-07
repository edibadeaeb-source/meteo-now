/* Per-city forecasts survive app restarts. Network refreshes never clear the UI. */
(function(root) {
    'use strict';
    var entries = Object.create(null), pending = Object.create(null), rainPending = Object.create(null), rainRetry = Object.create(null), db = null;
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
            request = root.indexedDB.open('meteo-forecast-cache-v2', 1);
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
    function hourStamp(iso,d) {
        if (/[Zz]$|[+-]\d\d:\d\d$/.test(iso)) return Date.parse(iso)/1000;
        // Ask Intl for the city's offset at this specific hour (including DST).
        var utc=Date.parse(iso+'Z');
        try {
            var fmt=new Intl.DateTimeFormat('en-CA',{timeZone:d.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
            var guess=utc;
            for(var step=0;step<2;step++) {
                var p={};fmt.formatToParts(new Date(guess)).forEach(function(x){p[x.type]=x.value;});
                var local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
                guess=utc-(local-guess);
            }
            return guess/1000;
        } catch(e) {return utc/1000-(d.utc_offset_seconds||0);}
    }
    function enrich(loc,d) {
        if(!valid(d))return Promise.resolve(false);
        var times=d.hourly.time, values=d.hourly.precipitation_probability||[];
        var now=Date.now()/1000;
        var missing=times.some(function(t,i){var stamp=hourStamp(t,d);return stamp>=now-3600&&stamp<now+25*3600&&values[i]==null;});
        var k=key(loc);
        var uv=d.current.uv_index, uvMissing=typeof uv!=='number'||!isFinite(uv)||uv<0;
        if((!missing && !uvMissing) || Date.now()<(rainRetry[k]||0))return Promise.resolve(false);
        if(rainPending[k])return rainPending[k];
        // A missing optional field never delays painting the usable forecast.
        var controller=typeof AbortController!=='undefined'?new AbortController():null;
        var timer=setTimeout(function(){if(controller)controller.abort();},8000);
        rainPending[k]=fetch('https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(loc.lat)+'&longitude='+encodeURIComponent(loc.lon)+'&hourly=precipitation_probability,uv_index&current=uv_index&daily=uv_index_max&forecast_days=10&timezone=auto&timeformat=unixtime',controller?{signal:controller.signal}:{})
            .then(function(r){if(!r.ok)throw new Error('Optional probability unavailable');return r.json();})
            .then(function(raw){
                if(!entries[k]||entries[k].d!==d)return false;
                var h=raw.hourly||{}, lookup=Object.create(null),uvLookup=Object.create(null),changed=false,rainChanged=false,uvChanged=false;
                (h.time||[]).forEach(function(t,i){var v=(h.precipitation_probability||[])[i];if(typeof t==='number'&&typeof v==='number'&&isFinite(v)&&v>=0&&v<=100)lookup[t]=Math.round(v);});
                (h.time||[]).forEach(function(t,i){var v=(h.uv_index||[])[i];if(typeof t==='number'&&typeof v==='number'&&isFinite(v)&&v>=0)uvLookup[t]=v;});
                d.hourly.precipitation_probability=values;
                d.weather_sources=d.weather_sources||{};
                var provenance=d.weather_sources.precipitation_probability=d.weather_sources.precipitation_probability||{};
                provenance.hourly=provenance.hourly||times.map(function(){return null;});
                times.forEach(function(t,i){var v=lookup[hourStamp(t,d)];if(values[i]==null&&v!=null){values[i]=v;provenance.hourly[i]='Open-Meteo';changed=rainChanged=true;}});
                var currentUV=raw.current||{}, uvStamp=typeof currentUV.time==='number'?currentUV.time:Date.parse(currentUV.time)/1000;
                if(uvMissing && typeof currentUV.uv_index==='number' && isFinite(currentUV.uv_index) && currentUV.uv_index>=0 && isFinite(uvStamp) && Math.abs(now-uvStamp)<=1800){
                    d.current.uv_index=currentUV.uv_index;uvChanged=changed=true;
                    d.weather_sources.uv_index={source:'Open-Meteo',time:new Date(uvStamp*1000).toISOString(),kind:'Current UV; never the daily maximum'};
                }
                var uvs=d.hourly.uv_index=d.hourly.uv_index||times.map(function(){return null;});
                times.forEach(function(t,i){var value=uvLookup[hourStamp(t,d)];if(uvs[i]==null && value!=null){uvs[i]=value;uvChanged=changed=true;}});
                var dailyUV=raw.daily||{}, uvMax=d.daily.uv_index_max=d.daily.uv_index_max||d.daily.time.map(function(){return null;});
                (dailyUV.time||[]).forEach(function(stamp,i){
                    var value=(dailyUV.uv_index_max||[])[i];if(typeof value!=='number'||!isFinite(value)||value<0)return;
                    var day=null;
                    try {var p={};new Intl.DateTimeFormat('en-CA',{timeZone:raw.timezone||d.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp*1000)).forEach(function(x){p[x.type]=x.value;});day=p.year+'-'+p.month+'-'+p.day;}catch(e){}
                    var j=d.daily.time.indexOf(day);if(j>=0&&uvMax[j]==null){uvMax[j]=value;uvChanged=changed=true;}
                });
                if(uvChanged)d.weather_sources.uv_supplement='Open-Meteo current and hourly UV, UTC timestamp matching; native daily UV maxima in the city timezone';
                if(rainChanged){
                    var daily=d.daily, maxima=daily.precipitation_probability_max||daily.time.map(function(){return null;});
                    provenance.daily=provenance.daily||daily.time.map(function(){return null;});
                    daily.time.forEach(function(day,i){if(maxima[i]!=null&&provenance.daily[i]!=='OpenWeather')return;var known=values.filter(function(v,j){return times[j].slice(0,10)===day&&v!=null;});if(known.length){maxima[i]=Math.max.apply(null,known);provenance.daily[i]='Covered hourly probabilities';}});
                    daily.precipitation_probability_max=maxima;
                    provenance.hourly_supplement='Open-Meteo; matched by UTC timestamp; missing values only';
                }
                if(changed)persist(k);
                return changed;
            }).catch(function(){return false;})
            .finally(function(){clearTimeout(timer);delete rainPending[k];rainRetry[k]=Date.now()+60000;});
        return rainPending[k];
    }
    root.MeteoForecastCache = {ready:ready,peek:peek,fresh:fresh,put:put,request:request,enrich:enrich,key:key,entry:function(loc) { return entries[key(loc)] || null; }};
})(window);
