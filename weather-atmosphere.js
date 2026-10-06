/* Photographic atmosphere. Weather selection is independent of the device time zone. */
(function (root) {
    'use strict';
    var ASSETS = 'assets/weather/v1/';
    var decoded = Object.create(null), serial = 0, active = -1, applied = '', pendingKey = '', pending;

    function wallTime(iso) {
        var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
    }
    function context(data, loc) {
        loc = loc || {};
        var lat = +(loc.lat == null ? data.latitude : loc.lat), lon = +(loc.lon == null ? data.longitude : loc.lon);
        var c = data.current || {}, units = data.current_units || {};
        var temp = c.temperature_2m == null ? NaN : +c.temperature_2m;
        if (/F/.test(units.temperature_2m || '')) temp = (temp - 32) / 1.8;
        var thermal = !isFinite(temp) ? 'mild' : temp <= 10 ? 'cool' : temp >= 30 ? 'hot' : temp >= 24 ? 'warm' : 'mild';
        var area = 'inland';
        function near(a,b,r) { return isFinite(lat) && isFinite(lon) && Math.hypot((lat-a)*111.2,(lon-b)*111.2*Math.cos(a*Math.PI/180)) < r; }
        if (near(40.7128,-74.006,26)) area = 'new-york';
        else if (near(25.7617,-80.1918,40)) area = 'miami';
        else if (isFinite(+data.elevation) && +data.elevation >= 900) area = 'highland';
        else if (root.MeteoGeography && root.MeteoGeography.nearCoast(lat,lon)) area = Math.abs(lat) <= 28 ? 'tropical-coast' : 'coast';
        return {area:area, thermal:thermal, temperature:temp};
    }
    function selection(data, localClock, loc) {
        data = data || {};
        var c = data.current || {}, daily = data.daily || {};
        var now = wallTime(c.time);
        if (localClock && isFinite(localClock.getTime())) {
            now = Date.UTC(localClock.getFullYear(), localClock.getMonth(), localClock.getDate(), localClock.getHours(), localClock.getMinutes());
        }
        var rises = daily.sunrise || [], sets = daily.sunset || [];
        var rise = NaN, set = NaN;
        for (var i = 0; i < Math.max(rises.length, sets.length); i++) {
            var candidate = wallTime(rises[i]);
            if (isFinite(candidate) && Math.floor(candidate / 86400000) === Math.floor(now / 86400000)) {
                rise = candidate; set = wallTime(sets[i]); break;
            }
        }
        var night = c.is_day === 0 || c.is_day === '0';
        var solarDay = isFinite(rise) && isFinite(set) && set > rise;
        if (solarDay && isFinite(now)) night = now < rise || now >= set;
        else if (c.is_day == null && isFinite(now)) { var hour = new Date(now).getUTCHours(); night = hour < 6 || hour >= 20; }
        var code = c.weather_code == null ? -1 : +c.weather_code;
        var scene = night ? 'clear-night' : 'clear-day';
        if (code >= 95 && code <= 99) scene = 'storm';
        else if ((code >= 71 && code <= 77) || code === 85 || code === 86) scene = 'snow';
        else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) scene = 'rain';
        else if (code === 45 || code === 48) scene = 'fog';
        else if (code === 3) scene = 'overcast';
        else if (code === 1 || code === 2) scene = 'partly-cloudy';
        if (code >= 0 && code <= 2 && solarDay && isFinite(now) &&
            ((isFinite(rise) && Math.abs(now - rise) <= 45 * 60000) ||
             (isFinite(set) && Math.abs(now - set) <= 45 * 60000))) {
            scene = 'twilight'; night = false;
        }
        var place = context(data,loc), movie = scene;
        // Landscape can enrich fair weather, but never override clouds, rain or night.
        if (!night && (scene === 'clear-day' || (scene === 'partly-cloudy' && code === 1))) {
            if (place.area === 'new-york') movie = 'new-york';
            else if (place.area === 'miami' && place.temperature >= 22) movie = 'miami';
            else if (place.area === 'tropical-coast' && place.temperature >= 22) movie = 'tropical-coast';
            else if ((place.area === 'coast' || place.area === 'miami') && place.temperature >= 8) movie = 'coast';
            else if (place.area === 'highland') movie = 'highland';
        }
        if (scene === 'partly-cloudy' && code === 2 && !night && /^(coast|miami|tropical-coast)$/.test(place.area)) movie = 'coast-cloudy';
        var poster = movie !== scene ? 'assets/weather-video/v2/' + movie + '.webp' : ASSETS + scene + '.webp';
        return {scene:scene, night:night, area:place.area, thermal:place.thermal, movie:movie,
            key:scene + (night ? ':night' : ':day') + ':' + movie + ':' + place.thermal, url:poster};
    }
    function load(url) {
        if (!decoded[url]) {
            decoded[url] = new Promise(function (resolve, reject) {
                var photo = new Image(); photo.decoding = 'async'; photo.fetchPriority = 'high';
                photo.onload = function () {
                    var ready = typeof photo.decode === 'function' ? photo.decode().catch(function () {}) : Promise.resolve();
                    ready.then(function () { resolve(url); });
                };
                photo.onerror = function () { delete decoded[url]; reject(new Error('Weather background unavailable')); };
                photo.src = url;
            });
        }
        return decoded[url];
    }
    function attributes(el, chosen) {
        el.className = 'weather-atmosphere';
        el.setAttribute('data-scene', chosen.scene);
        el.setAttribute('data-night', chosen.night ? '1' : '0');
        el.setAttribute('data-area', chosen.area || 'inland');
        el.setAttribute('data-thermal', chosen.thermal || 'mild');
        el.setAttribute('data-movie', chosen.movie || chosen.scene);
        document.documentElement.setAttribute('data-weather-night', chosen.night ? '1' : '0');
        document.documentElement.setAttribute('data-weather-scene', chosen.scene);
        if (root.MeteoWeatherMotion) root.MeteoWeatherMotion.update(chosen);
    }
    function remember(chosen, loc) {
        if (!loc || !isFinite(loc.lat) || !isFinite(loc.lon)) return;
        try { localStorage.setItem('meteo-atmosphere-v1', JSON.stringify({at:Date.now(), lat:+loc.lat, lon:+loc.lon, selection:chosen})); } catch (e) {}
    }
    function render(data, clock, loc) {
        var el = document.getElementById('mobCer');
        if (!el) return Promise.resolve(false);
        var chosen = selection(data, clock, loc);
        remember(chosen, loc);
        return show(el, chosen);
    }
    function show(el, chosen) {
        if (!el) return Promise.resolve(false);
        if (root._cerAnim) { root.cancelAnimationFrame(root._cerAnim); root._cerAnim = null; }
        var oldCanvas = document.getElementById('mobStele');
        if (oldCanvas) oldCanvas.classList.remove('pornit');
        if (pendingKey === chosen.key && pending) return pending;
        var ticket = ++serial;
        pendingKey = chosen.key;
        if (applied === chosen.key) { pendingKey = ''; attributes(el,chosen); return Promise.resolve(true); }
        var layers = el.querySelectorAll('.weather-photo');
        if (!layers.length) {
            for (var i = 0; i < 2; i++) {
                var image = document.createElement('img'); image.className = 'weather-photo';
                image.alt = ''; image.setAttribute('aria-hidden','true'); image.decoding = 'async';
                el.appendChild(image);
            }
            layers = el.querySelectorAll('.weather-photo');
        }
        // Immediately stop the old city's video even while the new poster loads.
        attributes(el, chosen);
        if (active >= 0 && layers[active].src.indexOf(chosen.url) < 0) layers[active].classList.remove('is-visible');
        pending = load(chosen.url).then(function () {
            if (ticket !== serial) return false;
            var next = active === 0 ? 1 : 0;
            layers[next].src = chosen.url;
            layers[next].setAttribute('data-scene', chosen.scene);
            layers[next].setAttribute('data-night', chosen.night ? '1' : '0');
            attributes(el, chosen);
            layers[next].classList.add('is-visible');
            if (active >= 0) layers[active].classList.remove('is-visible');
            active = next; applied = chosen.key; pendingKey = '';
            el.setAttribute('data-photo-ready','1');
            return true;
        }).catch(function () {
            if (ticket !== serial) return false;
            attributes(el, chosen);
            for (var i = 0; i < layers.length; i++) layers[i].classList.remove('is-visible');
            active = -1; applied = ''; pendingKey = '';
            el.removeAttribute('data-photo-ready');
            return false;
        });
        return pending;
    }
    root.MeteoAtmosphere = {select:selection, render:render};
    // Reopen with the last atmosphere only when it belongs to the selected city.
    try {
        var cached = JSON.parse(localStorage.getItem('meteo-atmosphere-v1') || 'null');
        var loc = JSON.parse(localStorage.getItem('meteo-loc') || 'null');
        if (cached && loc && Date.now() - cached.at < 2 * 3600000 &&
            Math.abs(cached.lat - loc.lat) < .01 && Math.abs(cached.lon - loc.lon) < .01 &&
            /^(clear-day|clear-night|partly-cloudy|overcast|rain|storm|snow|fog|twilight)$/.test(cached.selection.scene)) {
            var movie = cached.selection.movie;
            if (!/^(new-york|miami|tropical-coast|coast|coast-cloudy|highland)$/.test(movie)) movie = cached.selection.scene;
            cached.selection.movie = movie;
            cached.selection.url = movie !== cached.selection.scene ? 'assets/weather-video/v2/' + movie + '.webp' : ASSETS + cached.selection.scene + '.webp';
            show(document.getElementById('mobCer'), cached.selection);
        }
    } catch (e) {}
})(window);
