// Real Service Worker and IndexedDB; only external data providers are fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),out=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-network');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8');
const {loc,second,forecast,geo,firebaseStub}=Function(source.slice(source.indexOf('const loc='),source.indexOf('(async()=>'))+';return {loc,second,forecast,geo,firebaseStub}')();
const vendorURLs=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/(?:src|href)="(https:\/\/(?:cdn.jsdelivr.net|www.gstatic.com|unpkg.com)[^"]+)"/g)].map(m=>m[1]);
const vendor=new Map();let fail=false,temp=28,forecastCalls=0,linkKbps=0,shapedBytes=0;
function adapt(s){vendorURLs.forEach((u,i)=>s=s.split(u).join('/test-vendor/'+i));return s;}
function send(res,body,status,headers={}){
 res.writeHead(status,headers);if(!linkKbps){res.end(body);return;}
 // Shape at the HTTP server as well: worker fetches use their own browser target.
 const chunk=Math.max(32,Math.floor(linkKbps*1000/8/20));let at=0,timer;
 function pump(){if(res.destroyed)return;if(at>=body.length){res.end();return;}const next=Math.min(body.length,at+chunk);res.write(body.subarray(at,next));shapedBytes+=next-at;at=next;timer=setTimeout(pump,50);}
 timer=setTimeout(pump,400);res.on('close',()=>clearTimeout(timer));
}
function json(res,data,status=200){const body=zlib.gzipSync(Buffer.from(JSON.stringify(data)));send(res,body,status,{'Content-Type':'application/json','Content-Encoding':'gzip','Cache-Control':'no-store'});}
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://test'),p=u.pathname;
 if(p.startsWith('/test-vendor/')){const v=vendor.get(+p.split('/').at(-1));res.setHeader('Content-Type',v.type);res.end(v.body);return;}
 if(p==='/api/weather/forecast'){
   forecastCalls++;if(fail)return json(res,{error:'Provider unavailable'},503);
   const d=structuredClone(forecast);d.current.temperature_2m=+u.searchParams.get('latitude')===second.lat?17:temp;return json(res,d);
 }
 if(p==='/api/weather/current')return json(res,u.searchParams.get('latitude').split(',').map(()=>({current:forecast.current})));
 if(p.includes('judete'))return json(res,geo);
 if(p==='/api/clima')return json(res,{ani:30,valori:[],mmdd:'10-11'});
 if(p.startsWith('/api/'))return json(res,{avertizare:[],statii:[],list:[]});
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let body=await fs.promises.readFile(file);if(p==='/' || p==='/index.html' || p==='/sw.js')body=Buffer.from(adapt(body.toString()));
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.mp4')?'video/mp4':'application/octet-stream');
 send(res,body,200);
 }catch(e){res.writeHead(404);res.end();}
});
(async()=>{
 // Official pinned libraries are mirrored locally for this isolated test only.
 await Promise.all(vendorURLs.map(async(u,i)=>{
   if(u.includes('firebasejs')){vendor.set(i,{type:'text/javascript',body:firebaseStub});return;}
   const r=await fetch(u,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok,u);
   vendor.set(i,{type:r.headers.get('content-type'),body:Buffer.from(await r.arrayBuffer())});
 }));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ro-RO',serviceWorkers:'allow'});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await context.addInitScript(({loc,second})=>{
   if(!localStorage.getItem('meteo-loc')){localStorage.setItem('meteo-loc',JSON.stringify(loc));localStorage.setItem('meteo-orase',JSON.stringify([loc,second]));}
   localStorage.setItem('meteo-lang','ro');localStorage.setItem('meteo-locatie-automata','0');localStorage.setItem('meteo-noutati','2026.08.13');
   Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,effectiveType:'2g',downlink:0.064}});
 },{loc,second});
 let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#mbCardOre');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.waitForFunction(async()=>{const c=await caches.open('meteo-now-shell-v1');return !!(await c.match('/weather-data-cache.js?v=6'))&&!!(await c.match('/test-vendor/6'));});
 assert.equal(await page.locator('#mbConnection').isVisible(),false);
 const storedURLs=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys()){for(const req of await (await caches.open(name)).keys())urls.push(req.url);}return urls;});
 assert.equal(storedURLs.some(u=>new URL(u).pathname.startsWith('/api/')||new URL(u).pathname==='/ask'),false,'API and private responses never enter the offline shell');
 // Persist two-hour-old forecasts for two cities, then close the app entirely.
 await page.evaluate(({second,forecast})=>{
   const d=structuredClone(forecast);d.current.temperature_2m=17;MeteoForecastCache.put(second,d);
   const a=MeteoForecastCache.entry(LOC),b=MeteoForecastCache.entry(second);a.t-=2*3600000;b.t-=2*3600000;
   return new Promise((resolve,reject)=>{const o=indexedDB.open('meteo-forecast-cache-v2');o.onsuccess=()=>{const tx=o.result.transaction('cities','readwrite');const s=tx.objectStore('cities');s.put({key:MeteoForecastCache.key(LOC),...a});s.put({key:MeteoForecastCache.key(second),...b});tx.oncomplete=()=>{o.result.close();resolve()};tx.onerror=reject;};o.onerror=reject;});
 },{second,forecast});
 await page.waitForTimeout(100);await context.setOffline(true);await page.close();
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 let start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForSelector('#mbCardOre',{timeout:5000});
 const offlineStartupMs=Date.now()-start;assert.ok(offlineStartupMs<7000,'installed app opens offline');
 await page.waitForFunction(()=>document.getElementById('mbConnectionTitle').textContent==='Fără conexiune');
 assert.equal(await page.locator('#mbConnection .connection-off').isVisible(),true);
 assert.equal(await page.locator('#mbConnection .connection-clock').isVisible(),false);
 assert.equal(await page.locator('#mbTemp').innerText(),'28°');assert.match(await page.locator('#mbConnectionDetail').innerText(),/Ultima actualizare/);
 assert.equal(await page.locator('.mb-ora.acum .o-t').innerText(),'Salvat');
 await page.evaluate(second=>seteazaLocatie(second,true,'manual'),second);assert.equal(await page.locator('#mbTemp').innerText(),'17°');
 await page.evaluate(()=>seteazaLocatie({nume:'Oraș fără date',tara:'RO',lat:48.77,lon:27.88},true,'manual'));
 assert.equal(await page.evaluate(()=>LOC.nume),second.nume,'uncached cities cannot take another city’s data');
 await page.screenshot({path:path.join(out,'offline-saved-weather-412.png')});
 await context.setOffline(false);await page.waitForFunction(()=>document.getElementById('mbConnection').hidden,{timeout:15000});
 await page.evaluate(loc=>seteazaLocatie(loc,true,'manual'),loc);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 const slow=async kbps=>{linkKbps=kbps;return cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:kbps*1000/8,uploadThroughput:kbps*1000/8,connectionType:'cellular2g'});};
 await slow(64);start=Date.now();await page.reload({waitUntil:'domcontentloaded',timeout:20000});await page.waitForSelector('#mbCardOre',{timeout:5000});
 const slowStartupMs=Date.now()-start;assert.ok(slowStartupMs>=1900&&slowStartupMs<8000,'64kbps HTML body must fall back after two seconds, not wait for download');
 // An extremely weak link and an API outage keep the correct city visible.
 await slow(8);fail=true;await page.evaluate(()=>{MeteoForecastCache.entry(LOC).t-=6*60000;mobIncarca();});
 await page.waitForTimeout(2500);assert.equal(await page.locator('#mbTemp').innerText(),'28°');assert.ok(await page.locator('#mbCardZile').count());
 await context.setOffline(true);await page.waitForFunction(()=>document.getElementById('mbConnectionTitle').textContent==='Fără conexiune');
 await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 fail=false;temp=23;linkKbps=0;await context.setOffline(false);await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.getElementById('mbTemp').textContent==='23°'&&document.getElementById('mbConnection').hidden,{timeout:20000});
 // First install with no saved city data gets an honest recovery card, never an endless splash.
 await context.setOffline(true);await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await page.evaluate(()=>MeteoForecastCache.reconnect());await page.waitForTimeout(2000);
 await page.evaluate(()=>new Promise((resolve,reject)=>{const o=indexedDB.open('meteo-forecast-cache-v2');o.onsuccess=()=>{const tx=o.result.transaction('cities','readwrite');tx.objectStore('cities').clear();tx.oncomplete=()=>{o.result.close();resolve()};tx.onerror=reject;};o.onerror=reject;}));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#mbWeatherError',{timeout:5000});
 assert.equal(await page.locator('#splash').evaluate(el=>el.classList.contains('hide')),true);
 assert.equal(await page.locator('#mbConnectionTitle').innerText(),'Fără conexiune');
 await context.setOffline(false);await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForSelector('#mbCardOre',{timeout:15000});assert.equal(await page.locator('#mbWeatherError').count(),0);
 assert.deepEqual(errors,[]);
 const result={offlineStartupMs,slow64kbpsStartupMs:slowStartupMs,extreme8kbps:'saved forecast stays visible',networkShaping:'HTTP response chunks at 64/8kbps + 400ms delay, and browser CDP',shapedBytes,realServiceWorker:true,realIndexedDB:true,offlineRestart:true,uncachedCityIsolation:true,automaticRecovery:true,emptyCacheRecovery:true,forecastCalls,externalProviders:'simulated; libraries pinned and locally mirrored'};
 fs.writeFileSync(path.join(out,'network-results.json'),JSON.stringify(result,null,2));console.log('PASS: '+JSON.stringify(result));await context.close();
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.closeAllConnections();server.close();process.exitCode=1;});
