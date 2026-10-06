const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),out=path.resolve(__dirname,'../../../03-Testare-si-capturi/tests/artifacts-liquid-glass');fs.mkdirSync(out,{recursive:true});
const record=process.env.METEO_WEATHER_VIDEO==='1'; // Optional: install Playwright ffmpeg for recordings.
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(req.url.split('?')[0]);
 if(name==='/cache-test'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Weather cache test</title><p>Weather cache test</p>');return;}
 if(name==='/')name='/index.html';
 if(name==='/api/moon/color')name='/moon_color.jpg';if(name==='/api/moon/elev')name='/moon_elev.jpg';
 const p=path.resolve(root,'.'+name);if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.mp4')?'video/mp4':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':p.endsWith('.jpg')?'image/jpeg':p.endsWith('.png')?'image/png':'application/octet-stream');res.end(b);});
});
const loc={nume:'Târgoviște',lat:44.9266,lon:25.4566,tara:'RO',admin:'Dâmbovița',tz:'Europe/Bucharest'};
const second={nume:'București',lat:44.4268,lon:26.1025,tara:'RO'};
const midnight=new Date();midnight.setHours(0,0,0,0);
const iso=d=>new Date(d).toISOString().slice(0,19);
const days=Array.from({length:16},(_,i)=>iso(+midnight+i*86400000).slice(0,10));
const hours=Array.from({length:384},(_,i)=>iso(+midnight+i*3600000));
const fill=(n,v)=>Array.from({length:n},()=>v);
const daily={time:days,temperature_2m_max:fill(16,28),temperature_2m_min:fill(16,17),weather_code:fill(16,1),weathercode:fill(16,1),sunrise:days.map(d=>d+'T06:40'),sunset:days.map(d=>d+'T19:45'),uv_index_max:fill(16,5),precipitation_sum:fill(16,0),precipitation_probability_max:fill(16,10),wind_speed_10m_max:fill(16,12),wind_gusts_10m_max:fill(16,20)};
const hourly={time:hours};for(const [k,v]of Object.entries({temperature_2m:25,weather_code:1,weathercode:1,precipitation_probability:10,precipitation:0,wind_speed_10m:12,wind_gusts_10m:20,visibility:24000,is_day:1,relative_humidity_2m:45,surface_pressure:1013}))hourly[k]=fill(384,v);
hourly.is_day=hours.map(t=>{const h=+t.slice(11,13);return h>=7&&h<20?1:0;});
const forecast={latitude:loc.lat,longitude:loc.lon,timezone:'Europe/Bucharest',utc_offset_seconds:10800,daily,hourly,current:{time:iso(Date.now()),temperature_2m:28,apparent_temperature:29,relative_humidity_2m:45,is_day:1,weather_code:1,precipitation:0,surface_pressure:1013,wind_speed_10m:12,wind_direction_10m:100,wind_gusts_10m:20,uv_index:5},current_weather:{temperature:28,weathercode:1,windspeed:12,winddirection:100,is_day:1}};
const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Dâmbovița',mnemonic:'DB',cod:'DB'},geometry:{type:'Polygon',coordinates:[[[25,44.5],[26,44.5],[26,45.3],[25,45.3],[25,44.5]]]}}]};
const warning={numeTipMesaj:'COD GALBEN',culoare:'galben',fenomeneVizate:'Averse torențiale și descărcări electrice',intervalul:'11 septembrie, 14:00–20:00',zonaAfectata:'Județul Dâmbovița',mesaj:'Cantități de apă de 20–30 l/mp.'};
const firebaseStub=`(()=>{const snap={val:()=>null,forEach:()=>{},exists:()=>false};const ref={on:()=>{},once:(event,cb)=>{if(cb)cb(snap);return Promise.resolve(snap)},orderByChild(){return this},orderByKey(){return this},limitToLast(){return this},startAt(){return this},endAt(){return this},set:()=>Promise.resolve(),push:()=>Promise.resolve(),remove:()=>Promise.resolve()};window.firebase={initializeApp:()=>{},database:()=>({ref:()=>ref})};window.firebase.database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}}})()`;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=user-gesture-required']});
 try{
 const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ro-RO',serviceWorkers:'block',
   ...(record?{recordVideo:{dir:path.join(out,'motion-preview'),size:{width:412,height:915}}}:{}),
   geolocation:{latitude:loc.lat,longitude:loc.lon},permissions:['geolocation']});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 const cdpCity=await context.newCDPSession(page);
 await page.addInitScript(({loc,second})=>{localStorage.setItem('meteo-loc',JSON.stringify(loc));localStorage.setItem('meteo-orase',JSON.stringify([loc,second]));localStorage.setItem('meteo-lang','ro');localStorage.setItem('meteo-unit','C');localStorage.setItem('meteo-noutati','2026.08.13');},{loc,second});
 await page.route('**/*',async route=>{
 const u=new URL(route.request().url()),s=u.href;
 const json=b=>route.fulfill({json:b});
 if(s.includes('firebasejs'))return route.fulfill({contentType:'text/javascript',body:firebaseStub});
 if(s.includes('firebasedatabase')||s.includes('firebaseio'))throw Error('Unexpected live Firebase access');
 if(s.includes('open-meteo.com')&&!s.includes('geocoding'))return json(forecast);
 if(s.includes('geocoding-api'))return json({results:[]});
 if(s.includes('/api/owm/weather')||s.includes('api.openweathermap.org/data/2.5/weather'))return json({main:{temp:28,feels_like:29,humidity:45,pressure:1013},weather:[{id:801,icon:'02d',description:'cer parțial noros'}],wind:{speed:3,deg:100},sys:{sunrise:Date.now()/1000-20000,sunset:Date.now()/1000+20000},name:'Târgoviște',dt:Date.now()/1000});
 if(s.includes('/api/owm/find'))return json({list:[]});
 if(s.includes('/api/judete')||s.includes('raw.githubusercontent.com'))return json(geo);
 if(s.includes('avertizari-generale'))return json({avertizare:[warning]});
 if(s.includes('/api/anm/')||s.includes('meteoromania.ro'))return json({avertizare:[],statii:[]});
 if(s.includes('/api/clima'))return json({ani:30,valori:Array.from({length:30},(_,i)=>({an:1996+i,max:20+i%8,min:12})),mmdd:'09-10'});
 if(s.includes('api.bigdatacloud.net'))return json({city:'T\u00e2rgovi\u0219te',locality:'T\u00e2rgovi\u0219te',principalSubdivision:'D\u00e2mbovi\u021ba',countryCode:'RO'});
 if(s.includes('api.rainviewer.com'))return json({host:'https://tilecache.rainviewer.com',radar:{past:[{time:Math.floor(Date.now()/1000),path:'/v2/radar/test'}],nowcast:[]},satellite:{infrared:[]}});
 if(s.includes('tilecache.rainviewer.com')||s.includes('basemaps.cartocdn.com'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(out,'radar-empty.png'))});
 if(s.includes('services.swpc.noaa.gov'))return json({});
 if(u.hostname==='127.0.0.1')return route.continue();
 if(['cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com','tile.openstreetmap.org','server.arcgisonline.com','services.arcgisonline.com'].includes(u.hostname))return route.continue();
 return json({});
 });
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.MOBD&&window.MeteoAtmosphere&&document.querySelector('#mbCardOre'),{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#mobCer[data-photo-ready="1"]'),{timeout:15000});
 await page.evaluate(()=>{localStorage.setItem('meteo-locatie-automata','0');inchideToast();});
 const scenes=[['clear-day',0,12,1],['partly-cloudy',2,12,1],['overcast',3,12,1],['rain',63,12,1],['storm',95,12,1],['snow',85,12,1],['fog',45,12,1],['clear-night',0,23,0],['twilight',1,19,1]]
   .filter(s=>!process.env.METEO_WEATHER_SCENE||s[0]===process.env.METEO_WEATHER_SCENE);
 const canvasDigest=()=>page.locator('.weather-precipitation').evaluate(el=>{
   const pixels=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
   let alpha=0,hash=0;for(let i=3;i<pixels.length;i+=4){alpha+=pixels[i];hash=(Math.imul(hash,31)+pixels[i])|0;}return {alpha,hash};
 });
 for(const [scene,wmo,hour,day] of scenes){
   console.log('Checking scene: '+scene);
   await page.evaluate(async({wmo,hour,day})=>{
     const date=MOBD.daily.time[0];
     MOBD.current.weather_code=wmo;MOBD.current.is_day=day;
     MOBD.current.time=date+'T'+String(hour).padStart(2,'0')+':00';
     MOBD.current.temperature_2m=wmo===85?-2:day?23:15;
     MOBD.daily.sunrise[0]=date+'T06:40';MOBD.daily.sunset[0]=date+'T19:30';
     const clock=mobDinIso(MOBD.current.time);
     await Promise.race([MeteoAtmosphere.render(MOBD,clock,LOC),new Promise((_,reject)=>setTimeout(()=>reject(Error('Scene loading timeout: '+wmo)),15000))]);mobAntet();
     window.scrollTo(0,0);
   },{wmo,hour,day});
   await page.waitForTimeout(850);
   assert.equal(await page.locator('#mobCer').getAttribute('data-scene'),scene);
   assert.equal(await page.locator('#mobCer .weather-photo.is-visible').count(),1);
   assert.equal(await page.locator('#mobStele').evaluate(el=>getComputedStyle(el).display),'none');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'on');
   await page.waitForFunction(()=>document.querySelector('#mobCer[data-video="playing"] .weather-video.is-visible'),null,{timeout:15000});
   assert.equal(await page.locator('.weather-video.is-visible').count(),1);
   const videoDigest=()=>page.locator('.weather-video.is-visible').evaluate(v=>{
     const c=document.createElement('canvas');c.width=32;c.height=56;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,32,56);
     let hash=0;for(const p of ctx.getImageData(0,0,32,56).data)hash=(Math.imul(hash,31)+p)|0;
     return {time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,hash,muted:v.muted,inline:v.playsInline,controls:v.controls};
   });
   const before=await videoDigest();await page.waitForTimeout(500);const after=await videoDigest();
   assert.ok(after.frames>before.frames,'decoded frames advance in '+scene);
   assert.notEqual(after.hash,before.hash,'actual video pixels change in '+scene);
   assert.equal(after.muted,true);assert.equal(after.inline,true);assert.equal(after.controls,false);
   const precipitation=['rain','storm'].includes(scene),first=await canvasDigest();
   if(precipitation){
     assert.ok(first.alpha>0,'visible precipitation in '+scene);
     await page.waitForTimeout(250);
     assert.notEqual((await canvasDigest()).hash,first.hash,'precipitation moves in '+scene);
     if(record)await page.waitForTimeout(2000);
   }else assert.equal(first.alpha,0,'no stale precipitation in '+scene);
   await page.screenshot({path:path.join(out,scene+'-412.png'),animations:'disabled'});
 }
 const reuse=await page.evaluate(async()=>{
   const v=document.querySelector('.weather-video.is-visible'),before=v.getVideoPlaybackQuality().totalVideoFrames;
   await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),{lat:40.7128,lon:-74.006,nume:'New York City'});
   await new Promise(r=>setTimeout(r,500));
   return {same:v===document.querySelector('.weather-video.is-visible'),advanced:v.getVideoPlaybackQuality().totalVideoFrames>before};
 });assert.deepEqual(reuse,{same:true,advanced:true});
 // Real touch magnification stays locked even after the assistant is closed.
 await page.evaluate(()=>{setChatLock(true);setChatLock(false);});
 assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'),/user-scalable=no/);
 await cdpCity.send('Input.synthesizePinchGesture',{x:200,y:160,scaleFactor:1.7,gestureSourceType:'touch'});
 assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 const gestures=await page.evaluate(()=>{
   const e=new Event('gesturestart',{bubbles:true,cancelable:true});document.getElementById('mbHero').dispatchEvent(e);
   const map=document.createElement('div');map.className='leaflet-container';document.body.appendChild(map);
   const m=new Event('gesturestart',{bubbles:true,cancelable:true});map.dispatchEvent(m);map.remove();
   return {pageBlocked:e.defaultPrevented,mapAllowed:!m.defaultPrevented};
 });assert.deepEqual(gestures,{pageBlocked:true,mapAllowed:true});
 // Render complete hourly rows with the phone clock different from city clocks.
 const hourlyRows=await page.evaluate(()=>{
   const saved=MOBD,clock=mobAcumLocal;const results=[];
   for(const city of ['Moreni','New York City','Tokyo']){
     const time=['2026-10-06T23:00','2026-10-07T00:00','2026-10-07T07:00','2026-10-07T12:00'];
     MOBD={...saved,current:{...saved.current,time:time[0],weather_code:0,is_day:0},
       hourly:{...saved.hourly,time,weather_code:[0,0,0,0],is_day:[0,0,1,1]},
       daily:{...saved.daily,sunrise:['2026-10-06T06:40','2026-10-07T06:40'],sunset:['2026-10-06T19:30','2026-10-07T19:30']}};
     mobAcumLocal=()=>new Date(2026,9,6,23,30);
     const box=document.createElement('div');box.innerHTML=mobCardOre();
     const rows=[...box.querySelectorAll('.mb-ora')];
     const midnight=rows.find(r=>r.querySelector('.o-t').textContent==='00:00');
     const noon=rows.find(r=>r.querySelector('.o-t').textContent==='12:00');
     results.push({city,nightMoon:!!midnight.querySelector('.o-i svg'),noonSun:noon.querySelector('.o-i').textContent.includes('☀')});
   }MOBD=saved;mobAcumLocal=clock;return results;
 });assert.ok(hourlyRows.every(r=>r.nightMoon&&r.noonSun));
 // The user's switch and accessibility preference stop both image and particles.
 await page.evaluate(async()=>{MOBD.current.weather_code=63;await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);});
 await page.waitForTimeout(300);
 assert.ok((await canvasDigest()).alpha>0);
 await page.evaluate(()=>{const c=document.getElementById('setAnimations');c.checked=false;c.dispatchEvent(new Event('change'));});
 assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'off');
 assert.equal((await canvasDigest()).alpha,0);
 assert.equal(await page.locator('.weather-video').evaluateAll(vs=>vs.every(v=>v.paused)),true);
 const paused=await page.locator('.weather-photo.is-visible').evaluate(el=>getComputedStyle(el).transform);
 await page.waitForTimeout(250);
 assert.equal(await page.locator('.weather-photo.is-visible').evaluate(el=>getComputedStyle(el).transform),paused);
 await page.evaluate(()=>{const c=document.getElementById('setAnimations');c.checked=true;c.dispatchEvent(new Event('change'));});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'off');
 assert.equal((await canvasDigest()).alpha,0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForTimeout(250);assert.ok((await canvasDigest()).alpha>0);
 // Simulate the visibility signal delivered when Android backgrounds the TWA.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'off');
 assert.equal((await canvasDigest()).alpha,0);
 await page.waitForTimeout(250);assert.equal((await canvasDigest()).alpha,0);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(250);assert.ok((await canvasDigest()).alpha>0);
 await page.evaluate(async()=>{MOBD.current.weather_code=1;await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);});
 const heroHeight=await page.locator('#mbHero').evaluate(el=>el.getBoundingClientRect().height);
 await page.mouse.wheel(0,1200);
 await page.waitForFunction(()=>scrollY>500,null,{timeout:5000});
 assert.equal(await page.locator('#mbHero').evaluate(el=>el.getBoundingClientRect().height),heroHeight);
 assert.equal(await page.evaluate(()=>_cerAnim),null);
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'on');
 await page.evaluate(()=>{window.scrollTo(0,0);deschideSetari();});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('setari-deschise')),true);
 assert.equal(await page.locator('#mobApp').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const sheet=await page.locator('#settingsSheet .sheet').evaluate(el=>({background:getComputedStyle(el).background,blur:getComputedStyle(el).backdropFilter,width:el.getBoundingClientRect().width}));
 assert.match(sheet.blur,/blur/);assert.ok(sheet.width<=412);
 await page.screenshot({path:path.join(out,'settings-412.png')});
 await page.locator('#settingsSheet .sheet-body').evaluate(el=>el.scrollTop=300);
 await page.waitForTimeout(200);
 assert.ok(await page.locator('#settingsSheet .sheet-body').evaluate(el=>el.scrollTop>0));
 await page.evaluate(()=>{inchideSetari();mobDeschideFoaie('orase');});
 await page.waitForTimeout(450);
 assert.equal(await page.locator('#moLocalizeaza').isVisible(),true);
 await page.screenshot({path:path.join(out,'cities-412.png')});
 await page.evaluate(()=>mobInchideFoaie());
 assert.equal(await page.evaluate(()=>_nrPanouri),0);
 for(const width of [320,360,393,430,820]){
   await page.setViewportSize({width,height:width===820?1100:852});
   await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
   const panels=await page.locator('#mbContinut > .mb-card').evaluateAll(els=>els.map(el=>el.getBoundingClientRect()).map(r=>({left:r.left,right:r.right})));
   assert.ok(panels.every(r=>r.left>=0&&r.right<=width),'card bounds at '+width);
   if(width===320||width===393)await page.screenshot({path:path.join(out,'twilight-'+width+'.png')});
 }
 const severe=errors.filter(e=>!e.includes('getCurrentPosition'));
 fs.writeFileSync(path.join(out,'browser-errors.json'),JSON.stringify(severe,null,2));
 assert.equal(severe.length,0,'Unexpected browser errors: '+JSON.stringify(severe));
 const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,'weather-motion-mobile.webm'));
 const cacheContext=await browser.newContext({serviceWorkers:'allow'});
 const cachePage=await cacheContext.newPage();
 await cachePage.goto(base+'/cache-test');
 await cachePage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await cachePage.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:10000});
 const warm=await cachePage.evaluate(async()=>{const r=await fetch('/assets/weather/v1/rain.webp');return {ok:r.ok,bytes:(await r.blob()).size};});
 assert.equal(warm.ok,true);assert.ok(warm.bytes>10000);
 await cachePage.waitForFunction(async()=>!!(await (await caches.open('meteo-weather-assets-v1')).match('/assets/weather/v1/rain.webp')),{timeout:10000});
 const movie=await cachePage.evaluate(async()=>{const r=await fetch('/assets/weather-video/v1/clear-day.mp4');return {ok:r.ok,size:(await r.arrayBuffer()).byteLength};});
 assert.ok(movie.ok&&movie.size>10000);
 await cacheContext.setOffline(true);
 const offline=await cachePage.evaluate(async()=>{const r=await fetch('/assets/weather/v1/rain.webp');return {ok:r.ok,bytes:(await r.blob()).size};});
 assert.deepEqual(offline,warm);
 const ranges=await cachePage.evaluate(async()=>{
   const first=await fetch('/assets/weather-video/v1/clear-day.mp4',{headers:{Range:'bytes=0-127'}});
   const suffix=await fetch('/assets/weather-video/v1/clear-day.mp4',{headers:{Range:'bytes=-128'}});
   const invalid=await fetch('/assets/weather-video/v1/clear-day.mp4',{headers:{Range:'bytes=999999999-'}});
   return {first:first.status,bytes:(await first.arrayBuffer()).byteLength,range:first.headers.get('Content-Range'),suffix:suffix.status,suffixBytes:(await suffix.arrayBuffer()).byteLength,invalid:invalid.status};
 });assert.deepEqual(ranges,{first:206,bytes:128,range:'bytes 0-127/'+movie.size,suffix:206,suffixBytes:128,invalid:416});
 await cachePage.evaluate(async()=>{
   const v=document.createElement('video');v.id='offline-movie';v.muted=true;v.playsInline=true;v.loop=true;
   v.src='/assets/weather-video/v1/clear-day.mp4';document.body.appendChild(v);await v.play();
 });
 await cachePage.waitForFunction(()=>document.getElementById('offline-movie').currentTime>.3,null,{timeout:10000});
 assert.ok(await cachePage.evaluate(()=>document.getElementById('offline-movie').getVideoPlaybackQuality().totalVideoFrames>1));
 await cacheContext.close();
 console.log('PASS: '+scenes.length+' native video scenes with advancing decoded frames/pixels; midnight moon; pinch zoom blocked after chat; map gestures allowed; animation switch; reduced motion; background pause/resume; stable scroll; settings isolation; 320/360/393/412/430/820 px; zero JavaScript errors');
 console.log('PASS: weather photo and native video byte ranges work offline, including suffix and invalid ranges');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
