/* Living photographic skies: compositor motion and one bounded precipitation canvas. */
(function (root) {
    'use strict';
    var el = document.getElementById('mobCer');
    if (!el || !root.matchMedia) return;
    var mobile = root.matchMedia('(max-width: 900px), (max-height: 560px) and (pointer: coarse)');
    var reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    var control = document.getElementById('setAnimations');
    var canvas, ctx, sprite, particles = [], scene = '', frame = 0, last = 0;
    var width = 0, height = 0, scrollTimer = 0, resizeTimer = 0, scrolling = false;

    function enabled() {
        return mobile.matches && !reduced.matches && !document.hidden && !scrolling &&
            (!control || control.checked);
    }
    function precipitation() { return scene === 'rain' || scene === 'storm' || scene === 'snow'; }
    function ensureLayers() {
        if (canvas) return;
        var haze = document.createElement('div');
        haze.className = 'weather-haze'; haze.setAttribute('aria-hidden', 'true'); el.appendChild(haze);
        canvas = document.createElement('canvas'); canvas.className = 'weather-precipitation';
        canvas.setAttribute('aria-hidden', 'true'); el.appendChild(canvas);
        ctx = canvas.getContext('2d', {alpha:true});
        sprite = document.createElement('canvas'); sprite.width = sprite.height = 24;
        var s = sprite.getContext('2d'), g = s.createRadialGradient(12,12,0,12,12,12);
        g.addColorStop(0,'rgba(244,250,255,1)'); g.addColorStop(.35,'rgba(244,250,255,.9)');
        g.addColorStop(1,'rgba(244,250,255,0)'); s.fillStyle = g; s.fillRect(0,0,24,24);
    }
    function size() {
        if (!canvas || !ctx) return;
        width = el.clientWidth; height = el.clientHeight;
        // CSS pixels keep trajectories consistent across screen sizes; cap bitmap cost.
        var ratio = Math.min(root.devicePixelRatio || 1, 1.25);
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        ctx.setTransform(ratio,0,0,ratio,0,0);
        seed();
    }
    function seed() {
        particles = [];
        if (!precipitation() || !width || !height) return;
        var count = Math.round(Math.min(1.5, width * height / 377000) * (scene === 'snow' ? 44 : scene === 'storm' ? 76 : 58));
        for (var i = 0; i < count; i++) {
            var depth = .35 + Math.random() * .65;
            particles.push({x:Math.random() * (width + 80) - 40, y:Math.random() * height,
                depth:depth, phase:Math.random() * Math.PI * 2, length:10 + depth * 18});
        }
    }
    function stop(clear) {
        if (frame) root.cancelAnimationFrame(frame);
        frame = 0; last = 0;
        if (clear && ctx) ctx.clearRect(0,0,width,height);
    }
    function sync() {
        var on = enabled() && !!scene;
        el.setAttribute('data-motion', on ? 'on' : 'off');
        if (!on || !precipitation() || !ctx) { stop(!scrolling); return; }
        if (!frame) frame = root.requestAnimationFrame(draw);
    }
    function draw(time) {
        frame = 0;
        if (!enabled() || !precipitation() || !ctx) { sync(); return; }
        var dt = last ? Math.min((time - last) / 1000, .04) : 0;
        last = time; ctx.clearRect(0,0,width,height);
        var snow = scene === 'snow';
        if (!snow) { ctx.lineWidth = .75; ctx.lineCap = 'round'; }
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.y += dt * (snow ? 19 + p.depth * 31 : 350 + p.depth * 380);
            p.x += dt * (snow ? 6 + Math.sin(time / 2300 + p.phase) * 12 : -35 - p.depth * 28);
            if (p.y > height + 30) { p.y = -30; p.x = Math.random() * (width + 80) - 40; }
            if (p.x < -40) p.x = width + 35;
            if (p.x > width + 40) p.x = -35;
            if (snow) {
                var radius = 1.2 + p.depth * 2.6;
                ctx.globalAlpha = .25 + p.depth * .45;
                ctx.drawImage(sprite,p.x-radius,p.y-radius,radius*2,radius*2);
            } else {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = 'rgba(210,232,248,' + (.10 + p.depth * .16) + ')';
                ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+2.5,p.y-p.length); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        frame = root.requestAnimationFrame(draw);
    }
    function update(chosen) {
        if (!chosen) return;
        var next = chosen.scene;
        if (next !== scene) {
            stop(true); scene = next;
            // No bitmap allocation on a desktop or when the user has disabled movement.
            if (mobile.matches && !reduced.matches && (!control || control.checked)) ensureLayers();
            if (canvas) size();
        }
        sync();
    }
    function refresh() {
        if (scene && mobile.matches && !reduced.matches && (!control || control.checked)) {
            ensureLayers(); if (!width) size();
        }
        sync();
    }
    if (control) control.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    [mobile,reduced].forEach(function (query) {
        if (query.addEventListener) query.addEventListener('change', refresh);
        else if (query.addListener) query.addListener(refresh);
    });
    root.addEventListener('resize', function () {
        stop(false); root.clearTimeout(resizeTimer);
        resizeTimer = root.setTimeout(function () { size(); refresh(); }, 180);
    }, {passive:true});
    // Let gestures and glass-panel scrolling have priority over decorative frames.
    function scroll() {
        if (!scrolling) { scrolling = true; sync(); }
        root.clearTimeout(scrollTimer);
        scrollTimer = root.setTimeout(function () { scrolling = false; sync(); }, 180);
    }
    document.addEventListener('scroll', scroll, {passive:true,capture:true});
    root.MeteoWeatherMotion = {update:update};
})(window);
