/* Technical categories only. No messages, stacks, URLs, locations or IDs leave the device. */
(function(root) {
    'use strict';
    var originalFetch = root.fetch, seen = Object.create(null), sent = 0, windowStart = Date.now();
    var release = '2026.10.11.1';
    var names = ['Error','TypeError','ReferenceError','SyntaxError','RangeError','TimeoutError','AbortError','NetworkError','InvalidStateError','SecurityError'];
    var scripts = ['index.html','diagnostics.js','weather-data-cache.js','weather-atmosphere.js','weather-library.js','weather-motion.js','weather-romania.js','weather-geography.js','ai-conversations.js','sw.js'];
    function platform() {
        var ua = root.navigator.userAgent || '';
        return /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'desktop';
    }
    function number(n, max) { return Number.isInteger(n) && n >= 0 && n <= max ? n : 0; }
    function script(url) {
        try {
            var u = new URL(url || '', root.location.href);
            if (u.origin !== root.location.origin) return 'external';
            var name = u.pathname === '/' ? 'index.html' : u.pathname.split('/').pop();
            return scripts.indexOf(name) >= 0 ? name : 'unknown';
        } catch(e) { return 'unknown'; }
    }
    function report(code, component, operation, error, details) {
        try {
            if (!originalFetch || root.navigator.onLine === false) return;
            var name = error && error.name;
            if (name === 'AbortError') return; // Navigation/cancelled requests are expected.
            details = details || {};
            var event = {code:code, component:component, operation:operation, release:release,
                platform:platform(), error:names.indexOf(name) >= 0 ? name : 'Other',
                script:script(details.filename), line:number(details.line,200000),
                column:number(details.column,200000), status:number(details.status,599)};
            var now = Date.now();
            if (now-windowStart >= 3600000) { seen=Object.create(null); sent=0; windowStart=now; }
            var key = JSON.stringify(event);
            if (sent >= 20 || (seen[key] && now-seen[key] < 15*60000)) return;
            seen[key]=now; sent++;
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = setTimeout(function(){if(controller)controller.abort();},4000);
            // Use the original fetch: telemetry failures must never report themselves.
            Promise.resolve(originalFetch.call(root, '/api/diagnostics', {
                method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(event),
                credentials:'omit', keepalive:true, signal:controller ? controller.signal : undefined
            })).catch(function(){}).finally(function(){clearTimeout(timer);});
        } catch(ignored) {}
    }
    function operation(input) {
        try {
            var u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, root.location.href);
            if (u.origin !== root.location.origin) return null;
            var p=u.pathname;
            if (p === '/ask') return ['ai','ai'];
            if (p === '/api/weather/forecast') return ['weather','forecast'];
            if (p === '/api/owm/weather') return ['weather','current'];
            if (p === '/api/owm/find') return ['weather','nearby'];
            if (p.indexOf('/api/owm/tile/') === 0) return ['maps','tile'];
            if (p.indexOf('/api/anm/') === 0) return ['maps','other'];
            if (p === '/api/widget/cities') return ['widgets','sync'];
            if (p === '/api/widget') return ['widgets','widget'];
            if (p.indexOf('/api/push/') === 0) return ['notifications','push'];
            if (p === '/api/clima') return ['weather','climate'];
        } catch(e) {}
        return null;
    }
    if (originalFetch) root.fetch = function(input) {
        var args=arguments, context=this, target=operation(input), promise;
        try { promise=originalFetch.apply(context,args); }
        catch(e) { if(target)report('request_failed',target[0],target[1],e); throw e; }
        return promise.then(function(response) {
            if(target && (response.status >= 500 || response.status === 429))
                report('http_error',target[0],target[1],null,{status:response.status});
            return response;
        },function(e) { if(target)report('request_failed',target[0],target[1],e); throw e; });
    };
    root.addEventListener('error',function(e) {
        if (e.target && e.target !== root) {
            var tag=e.target.tagName;
            if (tag==='SCRIPT') report('resource_error','app','resource',null,{filename:e.target.src});
            else if(tag==='VIDEO') report('resource_error','media','resource',null);
            return;
        }
        report('runtime_error','app','runtime',e.error,{filename:e.filename,line:e.lineno,column:e.colno});
    },true);
    root.addEventListener('unhandledrejection',function(e) { report('unhandled_rejection','app','runtime',e.reason); });
    root.MeteoDiagnostics = Object.freeze({report:report});
})(window);
