/* Photographic atmosphere. Weather selection is independent of the device time zone. */
(function (root) {
    'use strict';
    var ASSETS = 'assets/weather/v1/';
    var decoded = Object.create(null), serial = 0, active = -1, applied = '', pendingKey = '', pending;

    function wallTime(iso) {
        var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
    }
    function selection(data, localClock) {
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
        if (isFinite(rise) && isFinite(set) && isFinite(now)) night = now < rise || now >= set;
        else if (c.is_day == null && isFinite(now)) { var hour = new Date(now).getUTCHours(); night = hour < 6 || hour >= 20; }
        var code = c.weather_code == null ? -1 : +c.weather_code;
        var scene = night ? 'clear-night' : 'clear-day';
        if (code >= 95 && code <= 99) scene = 'storm';
        else if ((code >= 71 && code <= 77) || code === 85 || code === 86) scene = 'snow';
        else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) scene = 'rain';
        else if (code === 45 || code === 48) scene = 'fog';
        else if (code === 3) scene = 'overcast';
        else if (code === 1 || code === 2) scene = 'partly-cloudy';
        if (code >= 0 && code <= 2 && isFinite(now) &&
            ((isFinite(rise) && Math.abs(now - rise) <= 45 * 60000) ||
             (isFinite(set) && Math.abs(now - set) <= 45 * 60000))) {
            scene = 'twilight'; night = false;
        }
        return {scene:scene, night:night, key:scene + (night ? ':night' : ':day'), url:ASSETS + scene + '.webp'};
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
        document.documentElement.setAttribute('data-weather-night', chosen.night ? '1' : '0');
        document.documentElement.setAttribute('data-weather-scene', chosen.scene);
    }
    function remember(chosen, loc) {
        if (!loc || !isFinite(loc.lat) || !isFinite(loc.lon)) return;
        try { localStorage.setItem('meteo-atmosphere-v1', JSON.stringify({at:Date.now(), lat:+loc.lat, lon:+loc.lon, selection:chosen})); } catch (e) {}
    }
    function render(data, clock, loc) {
        var el = document.getElementById('mobCer');
        if (!el) return Promise.resolve(false);
        var chosen = selection(data, clock);
        remember(chosen, loc);
        return show(el, chosen);
    }
    function show(el, chosen) {
        if (root._cerAnim) { root.cancelAnimationFrame(root._cerAnim); root._cerAnim = null; }
        var oldCanvas = document.getElementById('mobStele');
        if (oldCanvas) oldCanvas.classList.remove('pornit');
        if (pendingKey === chosen.key && pending) return pending;
        var ticket = ++serial;
        pendingKey = chosen.key;
        if (applied === chosen.key) return Promise.resolve(true);
        var layers = el.querySelectorAll('.weather-photo');
        if (!layers.length) {
            for (var i = 0; i < 2; i++) {
                var image = document.createElement('img'); image.className = 'weather-photo';
                image.alt = ''; image.setAttribute('aria-hidden','true'); image.decoding = 'async';
                el.appendChild(image);
            }
            layers = el.querySelectorAll('.weather-photo');
        }
        if (active < 0) attributes(el, chosen);
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
            cached.selection.url = ASSETS + cached.selection.scene + '.webp';
            show(document.getElementById('mobCer'), cached.selection);
        }
    } catch (e) {}
})(window);
