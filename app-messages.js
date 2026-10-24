(function () {
    'use strict';
    var states = new WeakMap(), active = null, noticeTimer = null, lastNotice = '';
    function reduced() {
        var toggle = document.getElementById('setAnimations');
        return matchMedia('(prefers-reduced-motion: reduce)').matches || (toggle && !toggle.checked);
    }
    function cancel(el) {
        var old = states.get(el); if (old) { clearTimeout(old.timer); clearTimeout(old.delay); }
        var state = {}; states.set(el, state); return state;
    }
    function close(el) {
        if (!el) return;
        var wasVisible = el.classList.contains('vizibil'), state = cancel(el);
        el.classList.remove('vizibil'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
        if (active === el) active = null;
        if (!wasVisible || reduced()) { delete el.dataset.messageState; return; }
        el.dataset.messageState = 'closing';
        state.timer = setTimeout(function () {
            if (states.get(el) === state) delete el.dataset.messageState;
        }, 390);
    }
    function open(el) {
        if (!el) return;
        var wait = active && active !== el ? 390 : 0;
        if (wait) close(active);
        var state = cancel(el);
        el.dataset.messageState = 'waiting'; el.inert = true;
        function begin() {
            if (states.get(el) !== state || document.hidden) { close(el); return; }
            var card = el.querySelector('.st-card'), icon = el.querySelector('.st-ico');
            var box = card.getBoundingClientRect(), ib = icon.getBoundingClientRect();
            el.style.setProperty('--message-icon-x', (box.left + box.width / 2 - ib.left - ib.width / 2) + 'px');
            el.style.setProperty('--message-icon-y', (box.top + box.height / 2 - ib.top - ib.height / 2) + 'px');
            el.classList.add('vizibil'); el.inert = false; el.setAttribute('aria-hidden', 'false'); active = el;
            el.dataset.messageState = reduced() ? 'open' : 'opening';
            state.timer = setTimeout(function () {
                if (states.get(el) === state && el.classList.contains('vizibil')) el.dataset.messageState = 'open';
            }, 690);
        }
        state.delay = setTimeout(begin, wait);
    }
    function notify(text, options) {
        if (!text || document.hidden) return;
        options = options || {};
        var el = document.getElementById('appNotice');
        var settings = document.getElementById('settingsSheet');
        var parent = settings && settings.classList.contains('open') ? settings : document.body;
        // Modal isolation owns the inert state of existing body children.
        // Do not move such a node into the modal and reuse its saved state.
        if (el && el.parentNode !== parent) { close(el); el.remove(); el = null; }
        if (text === lastNotice && el && el.classList.contains('vizibil')) return;
        lastNotice = text;
        if (!el) {
            el = document.createElement('div'); el.id = 'appNotice';
            el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true');
            el.innerHTML = '<div class="st-card"><span class="st-ico" aria-hidden="true"></span><div class="st-mij"><div class="st-et"></div><div class="st-text"></div></div><button type="button" class="st-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
            el.querySelector('.st-card').addEventListener('click', function () { close(el); });
            var y;
            el.addEventListener('touchstart', function (e) { y = e.touches[0].clientY; }, {passive: true});
            el.addEventListener('touchend', function (e) { if (y != null && y - e.changedTouches[0].clientY > 30) close(el); y = null; }, {passive: true});
        }
        parent.appendChild(el);
        el.querySelector('.st-ico').textContent = options.icon || '🔔';
        el.querySelector('.st-et').textContent = options.title || 'METEO NOW';
        el.querySelector('.st-text').textContent = text;
        el.querySelector('.st-x').setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Dismiss message' : 'Închide mesajul');
        clearTimeout(noticeTimer); open(el);
        noticeTimer = setTimeout(function () { close(el); }, options.duration || 6500);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden && active) close(active); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && active) close(active); });
    window.MeteoMessages = {open: open, close: close, notify: notify};
})();
