const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EDGE_CANDIDATES = [
  path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
];
const EDGE = EDGE_CANDIDATES.find(fs.existsSync);
assert(EDGE, 'Microsoft Edge is required for the real viewport test');

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8' })[ext] || 'application/octet-stream';
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.seq = 0;
    this.pending = new Map();
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const pending = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message));
      else pending.resolve(msg.result);
    };
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const sitePort = server.address().port;
  const debugPort = 9337;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'meteo-device-test-'));
  const edge = childProcess.spawn(EDGE, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  try {
    let version;
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch('http://127.0.0.1:' + debugPort + '/json/version');
        if (response.ok) { version = await response.json(); break; }
      } catch (_) {}
      await wait(100);
    }
    assert(version, 'Edge DevTools did not start');

    const created = await fetch('http://127.0.0.1:' + debugPort + '/json/new?http://127.0.0.1:' + sitePort + '/', { method: 'PUT' });
    const page = await created.json();
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    const devices = [
      { name: 'iPhone SE', width: 320, height: 568, mobile: true },
      { name: 'Xiaomi compact', width: 360, height: 800, mobile: true },
      { name: 'Samsung S24 Ultra', width: 412, height: 915, mobile: true },
      { name: 'iPhone Pro Max', width: 430, height: 932, mobile: true },
      { name: 'foldable/tablet compact', width: 820, height: 1180, mobile: true },
      { name: 'phone landscape', width: 932, height: 430, mobile: true, landscape: true },
      { name: 'desktop', width: 1280, height: 800, mobile: false },
    ];

    const expression = '(' + function() {
      const q = s => document.querySelector(s);
      const display = s => q(s) ? getComputedStyle(q(s)).display : null;
      if (q('#welcome')) q('#welcome').classList.add('show');
      if (q('#settingsSheet')) q('#settingsSheet').classList.add('open');
      const rect = s => {
        const e = q(s); if (!e) return null;
        const r = e.getBoundingClientRect();
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
      };
      return {
        width: innerWidth, height: innerHeight,
        coarse: matchMedia('(pointer: coarse)').matches,
        mobileQuery: matchMedia('(max-width: 900px), (max-height: 560px) and (pointer: coarse)').matches,
        htmlScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        mob: display('#mobApp'), desktop: display('body > header.topbar'),
        welcome: rect('#welcome'), primary: rect('#wLocatie'),
        search: rect('#wCauta'), secondary: rect('#wTargoviste'),
        settings: rect('#settingsSheet .sheet')
      };
    }.toString() + ')()';

    const results = [];
    for (const d of devices) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: d.width, height: d.height, deviceScaleFactor: d.mobile ? 3 : 1,
        mobile: d.mobile,
        screenOrientation: d.landscape
          ? { type: 'landscapePrimary', angle: 90 }
          : { type: 'portraitPrimary', angle: 0 }
      });
      await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + sitePort + '/?device=' + encodeURIComponent(d.name) });
      for (let i = 0; i < 80; i++) {
        const ready = await cdp.send('Runtime.evaluate', {
          expression: 'document.readyState', returnByValue: true
        });
        if (ready.result.value === 'complete') break;
        await wait(50);
      }
      const evaluated = await cdp.send('Runtime.evaluate', {
        returnByValue: true, expression
      });
      const x = evaluated.result.value;
      assert(x.htmlScrollWidth <= x.width + 1, d.name + ': document overflows horizontally');
      assert(x.bodyScrollWidth <= x.width + 1, d.name + ': body overflows horizontally');
      for (const key of ['primary', 'search', 'secondary', 'settings']) {
        const box = x[key];
        assert(box && box.left >= -1 && box.right <= x.width + 1, d.name + ': ' + key + ' leaves viewport');
      }
      if (d.mobile) {
        assert(x.mobileQuery, d.name + ': mobile media query is inactive');
        assert.notStrictEqual(x.mob, 'none', d.name + ': mobile application is hidden');
        assert.strictEqual(x.desktop, 'none', d.name + ': desktop UI is still visible');
      } else {
        assert(!x.mobileQuery, 'desktop incorrectly matches mobile query');
        assert.strictEqual(x.mob, 'none', 'desktop incorrectly shows mobile application');
        assert.notStrictEqual(x.desktop, 'none', 'desktop UI is hidden');
      }
      results.push(d.name + ' ' + x.width + 'x' + x.height);
    }
    console.log('Device layout checks passed: ' + results.join(', '));
    cdp.ws.close();
  } finally {
    edge.kill();
    if (process.platform === 'win32' && edge.pid) {
      childProcess.spawnSync('taskkill', ['/pid', String(edge.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true });
    }
    server.close();
    await wait(250);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    catch (_) {}
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});