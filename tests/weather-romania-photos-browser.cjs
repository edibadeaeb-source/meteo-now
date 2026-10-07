const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 const photos=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v2/sources.json'),'utf8'));
 // Decode every produced image using the browser's WebP decoder.
 await page.evaluate(async urls=>{for(const url of urls){const im=new Image();im.src=url;await im.decode();if(!im.naturalWidth||!im.naturalHeight)throw Error('Invalid photo '+url);}},photos.map(p=>p.poster));
 await page.evaluate(()=>{window.realPick=MeteoWeatherLibrary.pick;window.selectedPhoto=null;MeteoWeatherLibrary.pick=(movie,night,loc)=>selectedPhoto?MeteoWeatherLibrary.restore(selectedPhoto,movie):realPick(movie,night,loc);});
 const codes={'clear-day':0,'clear-night':0,'partly-cloudy':2,overcast:3,twilight:1,snow:85,rain:63};
 const show=async p=>page.evaluate(async({p,code})=>{
  selectedPhoto=p.id;Object.assign(LOC,{nume:p.city,lat:p.lat,lon:p.lon,tara:'RO'});const date=MOBD.daily.time[0],hour=p.night?'23':p.scenes[0]==='twilight'?'18':'12';
  Object.assign(MOBD.current,{weather_code:code,is_day:p.night?0:1,time:date+'T'+hour+':30',temperature_2m:p.scenes[0]==='snow'?-2:23});MOBD.daily.sunrise[0]=date+'T07:00';MOBD.daily.sunset[0]=date+'T19:00';
  if(!await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC))throw Error('Photo failed '+p.id);mobAntet();window.scrollTo(0,0);
 },{p,code:codes[p.scenes[0]]});
 const samples=['ro-targoviste-search-day-3','ro-moreni-lead-day-0','ro-constanta-search-night-1','ro-iasi-search-night-1','ro-sinaia-search-day-2','ro-turda-lead-day-0','ro-slobozia-search-day-1','ro-bucharest-extra-night-2','ro-calarasi-extra-day-1'];
 for(const id of samples){const p=photos.find(p=>p.id===id);await show(p);await page.waitForTimeout(850);
  assert.equal(await page.locator('#mobCer').getAttribute('data-media'),'photo');assert.equal(await page.locator('.weather-video.is-visible').count(),0);assert.equal(await page.locator('.weather-video').evaluateAll(vs=>vs.every(v=>v.paused)),true);
  const image=page.locator('.weather-photo.is-visible');assert.equal(await image.count(),1);assert.ok((await image.getAttribute('src')).endsWith(p.id+'.webp'));assert.equal(await image.evaluate(v=>getComputedStyle(v).filter),'none');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const geometry=await image.evaluate(v=>({height:parseFloat(getComputedStyle(v).height),screen:document.getElementById('mobCer').getBoundingClientRect().height}));
  assert.ok(geometry.height/geometry.screen<=.41,'city stays beneath a dominant sky');
  assert.equal(await page.locator('.weather-city-sky').evaluate(v=>v.complete&&v.naturalWidth>0),true,'matching sky decoded');
  const transform=await image.evaluate(v=>getComputedStyle(v).transform);await page.waitForTimeout(150);assert.notEqual(await image.evaluate(v=>getComputedStyle(v).transform),transform,'photo must move subtly');
  await page.touchscreen.tap(200,120);await page.waitForTimeout(300);assert.equal(await page.locator('#mobCer').getAttribute('data-clip'),p.id);
  await page.screenshot({path:path.join(out,p.id+'-412.png')});
 }
 // A loaded film and a delayed stale film must both disappear when a city photograph is selected.
 await page.evaluate(async()=>{selectedPhoto=null;Object.assign(LOC,{nume:'București',lat:44.4268,lon:26.1025,tara:'RO'});const date=MOBD.daily.time[0];Object.assign(MOBD.current,{weather_code:0,is_day:1,time:date+'T12:00'});await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);});
 await page.waitForFunction(()=>document.querySelector('#mobCer[data-video="playing"]'),null,{timeout:20000});
 await show(photos.find(p=>p.id===samples[0]));await page.waitForTimeout(300);assert.equal(await page.locator('.weather-video.is-visible').count(),0);
 await page.route('**/ro-cluj-cloudy-a-*.mp4',async r=>{await new Promise(resolve=>setTimeout(resolve,1100));await r.continue().catch(()=>{});});
 await page.evaluate(async()=>{selectedPhoto=null;Object.assign(LOC,{nume:'Cluj-Napoca',lat:46.7712,lon:23.6236});MOBD.current.weather_code=3;await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);});
 await show(photos.find(p=>p.id===samples[1]));await page.waitForTimeout(1800);assert.equal(await page.locator('.weather-video.is-visible').count(),0);assert.equal(await page.locator('#mobCer').getAttribute('data-clip'),samples[1]);
 await page.evaluate(()=>{const box=document.getElementById('setAnimations');box.checked=false;box.dispatchEvent(new Event('change'));});assert.equal(await page.locator('.weather-photo.is-visible').evaluate(v=>getComputedStyle(v).animationPlayState),'paused');
 await page.evaluate(()=>{const box=document.getElementById('setAnimations');box.checked=true;box.dispatchEvent(new Event('change'));});await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.weather-photo.is-visible').evaluate(v=>getComputedStyle(v).animationName),'none');
 assert.equal(errors.filter(e=>!e.includes('getCurrentPosition')).length,0);await context.close();
 const offlineContext=await browser.newContext({serviceWorkers:'allow'}),offline=await offlineContext.newPage();await offline.goto(base+'/cache-test');await offline.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await offline.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const poster=photos.find(p=>p.id===samples[0]).poster;await offline.evaluate(async poster=>{await fetch('/'+poster);await fetch('/assets/weather-video/v4/partly-cloudy-night-a.webp');await fetch('/assets/weather-video/v4/partly-cloudy-night-a-hd.mp4');},poster);await offlineContext.setOffline(true);
 const cached=await offline.evaluate(async poster=>{const p=await fetch('/'+poster),v=await fetch('/assets/weather-video/v4/partly-cloudy-night-a-hd.mp4',{headers:{Range:'bytes=0-127'}}),thumbnail=await fetch('/assets/weather-video/v4/partly-cloudy-night-a.webp');return {photo:p.ok,thumbnail:thumbnail.ok,video:v.status,bytes:(await v.arrayBuffer()).byteLength};},poster);assert.deepEqual(cached,{photo:true,thumbnail:true,video:206,bytes:128});
 await offlineContext.close();console.log('PASS: all '+photos.length+' real photos decode, city/weather/night rendering, gentle motion, no lingering or stale film, no tap reset, motion preference, cached photos and v4 ranged video offline');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename);test.filename=__filename;test.paths=Module._nodeModulePaths(__dirname);test._compile(prefix+checks,__filename);
