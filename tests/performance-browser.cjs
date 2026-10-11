// Real Service Worker and IndexedDB; only external data providers are fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),out=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-performance');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8');
const {loc,second,forecast,geo,firebaseStub}=Function(source.slice(source.indexOf('const loc='),source.indexOf('(async()=>'))+';return {loc,second,forecast,geo,firebaseStub}')();
const vendorURLs=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/(?:src|href)="(https:\/\/(?:cdn.jsdelivr.net|www.gstatic.com|unpkg.com)[^"]+)"/g)].map(m=>m[1]);
const phase=process.env.METEO_PERF_BASELINE==='1'?'before':'after',traffic=[];const vendor=new Map();
function adapt(s){vendorURLs.forEach((u,i)=>s=s.split(u).join('/test-vendor/'+i));return s;}
function send(res,body,status,headers={}){
 res.writeHead(status,headers);res.end(body);
}
function json(res,data,status=200){const body=zlib.gzipSync(Buffer.from(JSON.stringify(data)));send(res,body,status,{'Content-Type':'application/json','Content-Encoding':'gzip','Cache-Control':'no-store'});}
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://test'),p=u.pathname;
 const entry={path:p,bytes:0};traffic.push(entry); if(p.startsWith('/test-vendor/')){const v=vendor.get(+p.split('/').at(-1));res.setHeader('Content-Type',v.type);res.end(v.body);return;}
 if(p==='/api/weather/forecast'){
   const d=structuredClone(forecast);d.current.temperature_2m=+u.searchParams.get('latitude')===second.lat?17:28;return json(res,d);
 }
 if(p==='/api/weather/current')return json(res,u.searchParams.get('latitude').split(',').map(()=>({current:forecast.current})));
 if(p.includes('judete'))return json(res,geo);
 if(p==='/api/clima')return json(res,{ani:30,valori:[],mmdd:'10-11'});
 if(p.startsWith('/api/'))return json(res,{avertizare:[],statii:[],list:[]});
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let body=await fs.promises.readFile(phase==='before' && ['/index.html','/','/weather-motion.js'].includes(p)?path.join(out,'baseline',p==='/weather-motion.js'?'weather-motion.js':'index.html'):file);entry.bytes=body.length;if(p==='/' || p==='/index.html' || p==='/sw.js')body=Buffer.from(adapt(body.toString()));
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
 const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ro-RO',serviceWorkers:'allow'});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await context.addInitScript(({loc,second})=>{
   localStorage.setItem('meteo-loc',JSON.stringify(loc));localStorage.setItem('meteo-orase',JSON.stringify([loc,second]));
   localStorage.setItem('meteo-lang','ro');localStorage.setItem('meteo-locatie-automata','0');localStorage.setItem('meteo-noutati','2026.08.13');
   Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:false,effectiveType:'4g'}});
   const native=window.setInterval;window.__intervalProbe=[];
   window.setInterval=function(fn,ms,...args){
     if(typeof fn==='function')__intervalProbe.push({fn,ms,args,app:/http:\/\/127\.0\.0\.1:\d+\/(?:index\.html)?:\d+:\d+/.test(new Error().stack||'')&&!/test-vendor/.test(new Error().stack||'')});
     return native.call(window,fn,ms,...args);
   };
 },{loc,second});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#mbCardOre');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.waitForTimeout(3000);
 const movieBytes=()=>traffic.filter(x=>x.path.endsWith('.mp4')).reduce((n,x)=>n+x.bytes,0);
 const select=async(scene)=>{
   await page.evaluate(scene=>MeteoWeatherMotion.update({scene,movie:scene}),scene);
   await page.waitForFunction(scene=>[...document.querySelectorAll('.weather-video')].some(v=>v.src.includes('/'+scene+'-')&&!v.paused&&v.readyState>=3&&v.classList.contains('is-visible')),scene,{timeout:20000});
   await page.waitForTimeout(300);
 };
 await select('clear-night');
 const bytesCold=movieBytes();await select('snow');await select('clear-night');
 await page.waitForTimeout(300);
 const retainedSources=await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].filter(v=>v.hasAttribute('src')).length);
 const playbackBefore=await page.evaluate(()=>{const v=document.querySelector('.weather-video.is-visible'),q=v.getVideoPlaybackQuality();return {frames:q.totalVideoFrames,dropped:q.droppedVideoFrames,width:v.videoWidth,height:v.videoHeight,time:v.currentTime};});
 await page.waitForTimeout(3000);
 const playbackAfter=await page.evaluate(()=>{const v=document.querySelector('.weather-video.is-visible'),q=v.getVideoPlaybackQuality();return {frames:q.totalVideoFrames,dropped:q.droppedVideoFrames,time:v.currentTime};});
 assert.ok(playbackAfter.frames>playbackBefore.frames,'real film decodes and advances');
 const warmStart=movieBytes();await select('snow');await select('clear-night');
 const warmVideoBytes=movieBytes()-warmStart;assert.equal(warmVideoBytes,0,'revisited films come from the Service Worker cache');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].every(v=>v.paused)),true);
 const pausedTime=await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].map(v=>v.currentTime));
 await page.waitForTimeout(1500);
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].map(v=>v.currentTime)),pausedTime);
 const apiStart=traffic.filter(x=>x.path.startsWith('/api/')).length;
 // Deterministic callback pass, not a claim of observing 30 real background minutes.
 const intervals=await page.evaluate(()=>{const a=__intervalProbe.filter(t=>t.app);for(const t of a)t.fn.apply(window,t.args);return a.map(t=>t.ms);});
 assert.ok(intervals.includes(1000)&&intervals.includes(300000)&&intervals.length>=10,'probe must actually capture app clocks and refresh timers');
 await page.waitForTimeout(500);
 const hiddenRequests=traffic.filter(x=>x.path.startsWith('/api/')).slice(apiStart).map(x=>x.path);
 const resumeStart=movieBytes();
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await select('clear-night');
 const resumeVideoBytes=movieBytes()-resumeStart;assert.equal(resumeVideoBytes,0);
 await page.evaluate(()=>{Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,effectiveType:'2g'}});MeteoWeatherMotion.update({scene:'clear-night',movie:'clear-night'});});
 await page.waitForFunction(()=>[...document.querySelectorAll('.weather-video')].some(v=>v.src.includes('clear-night-lite')&&!v.paused&&v.readyState>=3));
 const lite=await page.evaluate(()=>{const v=document.querySelector('.weather-video.is-visible');return {width:v.videoWidth,height:v.videoHeight};});
 const qualityFiles=traffic.filter(x=>/clear-night-(2k|lite)\.mp4$/.test(x.path));
 if(phase==='after'){
   await page.evaluate(()=>{MeteoWeatherMotion.update({scene:'snow'});MeteoWeatherMotion.update({scene:'clear-night'});MeteoWeatherMotion.update({scene:'overcast',clip:{still:true}});});
   await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].filter(v=>v.hasAttribute('src')).length),0,'photographic scene cancels pending films and releases both sources');
   await select('clear-night');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.weather-video')].filter(v=>v.hasAttribute('src')).length),1,'film resumes after rapid transitions and a photograph');
   await page.evaluate(()=>{
     // Weather refresh/resume was exercised above. For this subsystem probe,
     // keep its injected rain scene from being replaced by the sunny fixture.
     window.mobIncarca=function(){return Promise.resolve();};
     window.MeteoAtmosphere.render=function(){return Promise.resolve(true);};
     MeteoWeatherMotion.update({scene:'rain',clip:{still:true}});
   });
   for(let n=0;n<6;n++){
     await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(80);
     await page.emulateMedia({reducedMotion:'reduce'});
     await page.waitForFunction(()=>document.getElementById('mobCer').getAttribute('data-motion')==='off');
     const bitmap=await page.evaluate(()=>{const c=document.querySelector('.weather-precipitation'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<a.length;i+=4)alpha+=a[i];return {alpha,width:c.width,height:c.height,transform:x.getTransform().toString()};});
     assert.equal(bitmap.alpha,0,JSON.stringify(bitmap));
   }
   await page.emulateMedia({reducedMotion:'no-preference'});
   for(let n=0;n<6;n++){
     try {
       await page.waitForFunction(()=>{const c=document.querySelector('.weather-precipitation'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0);},null,{timeout:5000,polling:50});
     } catch(error) {
       console.log('Rain suspension probe: '+JSON.stringify(await page.evaluate(n=>({cycle:n,hidden:document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,checked:document.getElementById('setAnimations').checked,attributes:[...document.getElementById('mobCer').attributes].map(a=>[a.name,a.value])}),n)));
       throw error;
     }
     await page.evaluate(()=>{
       // Freeze during a gesture first: no dependence on a pending frame ID.
       document.dispatchEvent(new Event('scroll'));
       Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
     });
     assert.equal(await page.evaluate(()=>{const c=document.querySelector('.weather-precipitation'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<a.length;i+=4)alpha+=a[i];return alpha;}),0,'hidden canvas must be empty even when scrolling had already stopped its frame');
     await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   }
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(80);
   const physicalClear=await page.evaluate(()=>{
     const c=document.querySelector('.weather-precipitation'),x=c.getContext('2d');
     // A restored canvas context starts with identity, while the bitmap retains
     // its fractional-DPR size. Fill the whole bitmap to test the physical edges.
     x.setTransform(1,0,0,1,0,0);x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
     const control=document.getElementById('setAnimations');control.checked=false;control.dispatchEvent(new Event('change'));
     const a=x.getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<a.length;i+=4)alpha+=a[i];return alpha;
   });assert.equal(physicalClear,0,'clear must cover every physical pixel after context transform reset');
 }
 if(phase==='after'){assert.equal(hiddenRequests.length,0,'hidden app interval callbacks perform no HTTP requests');assert.equal(retainedSources,1,'only the current film retains a decoder/source');}
 assert.deepEqual(errors,[]);
 const report={phase,environment:'Headless Edge, mobile viewport 412x915 at DPR 2; fixture weather; real video decoding, SW and IndexedDB',intervalTest:'Invoke each registered app interval once while hidden; not wall-clock battery measurement',intervals,hiddenRequests,retainedSources,bytesCold,warmVideoBytes,resumeVideoBytes,qualityFiles,lite,playback:{width:playbackBefore.width,height:playbackBefore.height,frames:playbackAfter.frames-playbackBefore.frames,dropped:playbackAfter.dropped-playbackBefore.dropped},errors};
 fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await page.screenshot({path:path.join(out,phase+'-412.png')});await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
