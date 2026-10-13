// Real Service Worker and IndexedDB; only external data providers are fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),out=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-notification-location');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8');
const {loc,second,forecast,geo,firebaseStub}=Function(source.slice(source.indexOf('const loc='),source.indexOf('(async()=>'))+';return {loc,second,forecast,geo,firebaseStub}')();
const vendorURLs=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/(?:src|href)="(https:\/\/(?:cdn.jsdelivr.net|www.gstatic.com|unpkg.com)[^"]+)"/g)].map(m=>m[1]);
const vendor=new Map();let failSync=false,writes=[],fail=false,temp=28,forecastCalls=0,linkKbps=0,shapedBytes=0;
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
 if(p==='/api/push/subscribe'){
 let text='';for await(const chunk of req)text+=chunk;
 const body=JSON.parse(text);writes.push({city:body.nume,lat:body.lat,lon:body.lon,accepted:!failSync});
 return json(res,failSync?{error:'temporary 503'}:{ok:true},failSync?503:200);
 }
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
 await Promise.all(vendorURLs.map(async(u,i)=>{
   if(u.includes('firebasejs')){vendor.set(i,{type:'text/javascript',body:firebaseStub});return;}
   const r=await fetch(u,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok,u);
   vendor.set(i,{type:r.headers.get('content-type'),body:Buffer.from(await r.arrayBuffer())});
 }));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ro-RO',permissions:['geolocation','notifications'],geolocation:{latitude:loc.lat,longitude:loc.lon},serviceWorkers:'allow'});
 let geocodes=0;
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname==='api.bigdatacloud.net'){
     geocodes++;const city=+url.searchParams.get('latitude')<44.7?second.nume:loc.nume;
     return route.fulfill({json:{city,countryCode:'RO',principalSubdivision:city===second.nume?'București':'Dâmbovița'}});
   }
   return route.abort();
 });
 await context.addInitScript(({loc,second})=>{
   localStorage.setItem('meteo-loc',JSON.stringify(loc));localStorage.setItem('meteo-orase',JSON.stringify([loc,second]));
   localStorage.setItem('meteo-lang','ro');localStorage.setItem('meteo-locatie-automata','0');localStorage.setItem('meteo-noutati','2026.08.13');
   Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,effectiveType:'2g',downlink:0.064}});
 },{loc,second});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#mbCardOre');
 await page.evaluate(async()=>{
   await navigator.serviceWorker.ready;
   Object.defineProperty(Notification,'permission',{configurable:true,get:()=>'granted'});
   Object.defineProperty(PushManager.prototype,'getSubscription',{configurable:true,value:async()=>({endpoint:'https://fcm.googleapis.com/fcm/send/isolated-browser-fixture',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/isolated-browser-fixture',keys:{auth:'fixture-auth',p256dh:'fixture-key'}})})});
   localStorage.setItem(LOC_AUTO_KEY,'1');_locAutoUltima=0;
 });
 await context.setGeolocation({latitude:second.lat,longitude:second.lon});
 await page.evaluate(()=>actualizeazaLocatieAutomat(true));
 assert.equal(await page.evaluate(()=>LOC.nume),second.nume);
 assert.equal(writes.at(-1).city,second.nume);
 const geoAfterMove=geocodes;
 await page.evaluate(async()=>{_locAutoUltima=0;await actualizeazaLocatieAutomat(true);});
 assert.equal(geocodes,geoAfterMove,'stationary GPS reuses confirmed city');
 const newYork={nume:'New York City',tara:'US',admin:'New York',lat:40.7128,lon:-74.006};
 await page.evaluate(city=>seteazaLocatie(city,true,'manual'),newYork);
 assert.equal(await page.evaluate(()=>LOC.nume),newYork.nume);
 assert.equal(writes.at(-1).city,second.nume,'manual browsing preserves GPS notification city');
 await context.setOffline(true);
 await context.setGeolocation({latitude:loc.lat,longitude:loc.lon});
 await page.evaluate(()=>{_locAutoUltima=0;return actualizeazaLocatieAutomat(true);});
 const beforeReconnect=writes.length;
 await context.setOffline(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(name=>JSON.parse(localStorage.getItem('meteo-gps-location')).nume===name,loc.nume);
 await page.waitForFunction(()=>_locAutoInCurs===false);
 assert.equal(writes.at(-1).city,loc.nume);
 assert.ok(writes.length>beforeReconnect);
 assert.equal(await page.evaluate(()=>LOC.nume),newYork.nume,'reconnect preserves manual preview');
 failSync=true;
 await page.evaluate(()=>actualizeazaLocatiaPush());
 assert.equal(await page.evaluate(()=>_pushSyncRetries),1);
 assert.ok(await page.evaluate(()=>!!_pushSyncTimer));
 failSync=false;
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>_pushSyncTimer===null&&_pushSyncRetries===0);
 assert.equal(writes.at(-1).accepted,true);
 const beforeDisable=writes.length;
 await page.evaluate(()=>{localStorage.setItem('meteo-push-disabled','1');return actualizeazaLocatiaPush();});
 assert.equal(writes.length,beforeDisable,'resume never enables disabled notifications');
 await context.setGeolocation({latitude:second.lat,longitude:second.lon});
 await page.evaluate(async()=>{_locAutoUltima=0;await actualizeazaLocatieAutomat(true);});
 assert.equal(await page.evaluate(()=>LOC.nume),second.nume,'returning brings current GPS town into view');
 // A foreground lookup delayed across hide/resume cannot publish the old town.
 // Exercise the actual visibility/focus handlers with an intentionally slow GPS.
 await page.evaluate(()=>{
   window.originalGPSLookup=pozitieCuReincercare;window.pendingGPSFixes=[];
   pozitieCuReincercare=()=>new Promise(resolve=>pendingGPSFixes.push(resolve));
   _locAutoUltima=0;window.beforeHideGPS=actualizeazaLocatieAutomat(true);
 });
 await page.waitForFunction(()=>pendingGPSFixes.length===1);
 await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
   Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
   window.dispatchEvent(new Event('focus'));
 });
 await page.evaluate(position=>pendingGPSFixes[0]({coords:{latitude:position.lat,longitude:position.lon}}),loc);
 await page.waitForFunction(()=>pendingGPSFixes.length===2);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('meteo-gps-location')).nume),second.nume,'the previous session cannot replace the confirmed GPS town');
 await page.evaluate(position=>pendingGPSFixes[1]({coords:{latitude:position.lat,longitude:position.lon}}),loc);
 await page.waitForFunction(name=>LOC.nume===name&&!_locAutoInCurs,loc.nume);
 assert.equal(await page.evaluate(()=>pendingGPSFixes.length),2,'focus and visibility share one fresh lookup');
 assert.equal(await page.evaluate(()=>_locManualPreview),false);
 assert.equal(writes.length,beforeDisable,'the return path keeps notifications disabled');
 await page.evaluate(()=>{pozitieCuReincercare=originalGPSLookup;delete document.hidden;});
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'gps-return-412.png')});
 const result={version:await page.locator('meta[name="application-version"]').getAttribute('content'),checkedAt:new Date().toISOString(),browser:'Edge mobile 412x915',realGeolocationAPI:true,realServiceWorker:true,weatherAndPush:'isolated local fixtures; no real push messages',moveBetweenTowns:true,stationaryGeocodeReuse:true,manualPreviewPreservesGPSAlerts:true,reconnectSync:true,transient503Recovery:true,disabledNotificationsPreserved:true,returnToGPSCity:true,staleHiddenGPSDiscarded:true,simultaneousResumeSharesFreshFix:true,javascriptErrors:errors,geocodes,subscriptionWrites:writes};
 // Deliver a browser-generated PushEvent to the real worker after closing the
 // actual app window. No VAPID request, real subscriber or remote send is used.
 const worker=context.serviceWorkers().find(w=>w.url()===base+'/sw.js');assert.ok(worker);
 const probe=await context.newPage(),cdp=await context.newCDPSession(probe),registrations=new Map();
 cdp.on('ServiceWorker.workerRegistrationUpdated',event=>event.registrations.forEach(r=>registrations.set(r.registrationId,r)));
 await cdp.send('ServiceWorker.enable');
 const deadline=Date.now()+5000;while(![...registrations.values()].some(r=>r.scopeURL===base+'/')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
 const registration=[...registrations.values()].find(r=>r.scopeURL===base+'/');assert.ok(registration,'real registration discovered');
 await page.close();
 assert.equal(await worker.evaluate(async()=> (await self.clients.matchAll({type:'window'})).length),0,'no app window remains');
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:base,registrationId:registration.registrationId,data:JSON.stringify({title:'Ploaia se oprește curând în Oraș QA',body:'Ploaia se oprește în următoarea oră.',tag:'meteo-qa-closed',url:'/'})});
 const delivered=await worker.evaluate(async()=>{
   const end=Date.now()+5000;let notifications=[];
   while(Date.now()<end){notifications=await self.registration.getNotifications({tag:'meteo-qa-closed'});if(notifications.length)break;await new Promise(r=>setTimeout(r,50));}
   const items=notifications.map(n=>({title:n.title,body:n.body,url:n.data.url,tag:n.tag}));notifications.forEach(n=>n.close());
   return {items,gpsInWorker:typeof navigator.geolocation!=='undefined'};
 });
 assert.equal(delivered.items.length,1);assert.equal(delivered.items[0].title,'Ploaia se oprește curând în Oraș QA');assert.equal(delivered.items[0].body,'Ploaia se oprește în următoarea oră.');assert.equal(delivered.items[0].url,'/');assert.equal(delivered.gpsInWorker,false);
 Object.assign(result,{realWorkerPushWithoutAppWindow:true,workerHasGeolocation:false,remoteFCMWakeupVerified:false,physicalPhoneTested:false});
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));console.log('PASS: '+JSON.stringify(result));
 await context.close();
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.closeAllConnections();server.close();process.exitCode=1;});
