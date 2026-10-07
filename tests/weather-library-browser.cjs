/* Reuse the full app's isolated weather/API fixtures, with no live database writes. */
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const fixture=path.join(__dirname,'weather-browser.cjs');
const prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 const films=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-video/v3/sources.json'),'utf8'));
 await page.evaluate(()=>{
   window.MeteoRomania=null; // This pass deliberately exercises the original generic pools.
   window.realFilmPick=MeteoWeatherLibrary.pick;
   MeteoWeatherLibrary.pick=(movie)=>{const clip=MeteoWeatherLibrary.restore(window.testFilm,movie);if(!clip)throw Error('Wrong weather pool: '+movie+'/'+testFilm);return clip;};
   const load=HTMLMediaElement.prototype.load;window.filmLoads=0;HTMLMediaElement.prototype.load=function(){filmLoads++;return load.call(this);};
 });
 const setFilm=async(id)=>page.evaluate(async id=>{
   const movie=id.replace(/-[ab]$/,''),codes={'clear-day':0,'clear-night':0,'partly-cloudy':2,overcast:3,rain:63,storm:95,snow:85,fog:45,twilight:1,'new-york':0,miami:0};
   window.testFilm=id;
   Object.assign(LOC,movie==='new-york'?{nume:'New York City',lat:40.7128,lon:-74.006}:movie==='miami'?{nume:'Miami',lat:25.7617,lon:-80.1918}:{nume:'Târgoviște',lat:44.9266,lon:25.4566});
   const hour=movie==='clear-night'?23:movie==='twilight'?19:12,date=MOBD.daily.time[0];
   Object.assign(MOBD.current,{weather_code:codes[movie],is_day:hour===23?0:1,time:date+'T'+hour+':00',temperature_2m:movie==='snow'?-2:30});
   MOBD.daily.sunrise[0]=date+'T06:40';MOBD.daily.sunset[0]=date+'T19:30';
   await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);mobAntet();window.scrollTo(0,0);
 },id);
 const checkedFilms=films.filter(f=>!process.env.METEO_LIBRARY_FILM||f.id.startsWith(process.env.METEO_LIBRARY_FILM));
 for(const film of checkedFilms){
   console.log('Checking new film: '+film.id);await setFilm(film.id);
   await page.waitForFunction(id=>{const v=document.querySelector('.weather-video.is-visible');return document.querySelector('#mobCer[data-video="playing"]')&&v?.currentSrc.includes('/'+id+'-')&&v.currentTime>.2;},film.id,{timeout:20000});
   const clip=await page.evaluate(id=>MeteoWeatherLibrary.restore(id,id.replace(/-[ab]$/,'')),film.id);
   const size=await page.locator('.weather-video.is-visible').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames}));
   assert.equal(size.width,clip.quality==='2k'?1440:1080);assert.equal(size.height,clip.quality==='2k'?2560:1920);assert.ok(size.frames>1);
   assert.ok((await page.locator('.weather-photo.is-visible').getAttribute('src')).endsWith(film.id+'.webp'));
   assert.equal(await page.locator('#mobCer').getAttribute('data-footage'),'native');assert.equal(await page.locator('.weather-video.is-visible').count(),1);assert.equal(await page.locator('.weather-video').count(),2);
   const loads=await page.evaluate(()=>filmLoads);await page.touchscreen.tap(210,120);await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>filmLoads),loads,'touch must not reload '+film.id);
   assert.equal(await page.locator('#mbContinut').evaluate(el=>el.classList.contains('gliseaza')),false);
   await page.waitForFunction(frames=>{const v=document.querySelector('.weather-video.is-visible');return v&&!v.paused&&v.getVideoPlaybackQuality().totalVideoFrames>frames;},size.frames,{timeout:10000});
   if(/^(rain|snow)-/.test(film.id)){
     const marks=await page.locator('.weather-precipitation').evaluate(c=>{
       const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,minY=c.height,maxY=-1;
       for(let i=3;i<p.length;i+=4)if(p[i]){count++;const y=Math.floor((i-3)/4/c.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
       return {count,minY,maxY,width:c.width,height:c.height};
     });
     assert.equal(marks.count,0,'native precipitation must not be doubled: '+JSON.stringify(marks));
   }
   if(['rain-a','snow-a','overcast-a','clear-night-a','clear-night-b','new-york-a','miami-a'].includes(film.id))await page.screenshot({path:path.join(out,'new-film-'+film.id+'-412.png')});
 }
 await page.evaluate(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,effectiveType:'3g'}}));await setFilm('miami-a');
 await page.waitForFunction(()=>document.querySelector('.weather-video.is-visible')?.currentSrc.endsWith('miami-a-lite.mp4'),null,{timeout:15000});assert.equal(await page.locator('.weather-video.is-visible').evaluate(v=>v.videoWidth),720);
 await page.evaluate(()=>delete navigator.connection);
 await page.route('**/rain-a-2k.mp4',r=>r.fulfill({status:404}));await setFilm('rain-a');
 await page.waitForFunction(()=>document.querySelector('.weather-video.is-visible')?.currentSrc.endsWith('rain-a-lite.mp4'),null,{timeout:15000});assert.equal(await page.locator('.weather-video.is-visible').evaluate(v=>v.videoWidth),720);
 await page.evaluate(()=>{document.dispatchEvent(new Event('scroll'));const c=document.getElementById('setAnimations');c.checked=false;c.dispatchEvent(new Event('change'));});
 // A fractional capped DPR rounds the bitmap height up. Clear its edge too,
 // including precipitation left at the last physical row before stopping.
 const edgePixels=await page.locator('.weather-precipitation').evaluate(canvas=>{
   const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);
   ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
   document.getElementById('setAnimations').dispatchEvent(new Event('change'));
   return ctx.getImageData(0,0,canvas.width,canvas.height).data.filter((v,i)=>i%4===3&&v!==0).length;
 });
 assert.equal(edgePixels,0,'stopping motion during scroll clears the complete rounded bitmap, including its physical edge');
 assert.equal(await page.locator('#mobCer').getAttribute('data-motion'),'off');assert.equal(await page.locator('.weather-video').evaluateAll(vs=>vs.every(v=>v.paused)),true);
 assert.equal(errors.filter(e=>!e.includes('getCurrentPosition')).length,0);await context.close();
 const offlineContext=await browser.newContext({serviceWorkers:'allow'}),offline=await offlineContext.newPage();await offline.goto(base+'/cache-test');
 await offline.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await offline.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline.evaluate(async()=>{await fetch('/assets/weather-video/v5/clear-night-a.webp');await fetch('/assets/weather-video/v5/clear-night-a-2k.mp4');await fetch('/assets/weather-video/v6/rain-a.webp');await fetch('/assets/weather-video/v6/rain-a-2k.mp4');});await offlineContext.setOffline(true);
 const cached=await offline.evaluate(async()=>{const p=await fetch('/assets/weather-video/v5/clear-night-a.webp'),v=await fetch('/assets/weather-video/v5/clear-night-a-2k.mp4',{headers:{Range:'bytes=0-127'}});return {photo:p.ok,video:v.status,bytes:(await v.arrayBuffer()).byteLength};});assert.deepEqual(cached,{photo:true,video:206,bytes:128});
 const rainCached=await offline.evaluate(async()=>{const p=await fetch('/assets/weather-video/v6/rain-a.webp'),v=await fetch('/assets/weather-video/v6/rain-a-2k.mp4',{headers:{Range:'bytes=0-127'}});return {photo:p.ok,video:v.status,bytes:(await v.arrayBuffer()).byteLength};});assert.deepEqual(rainCached,{photo:true,video:206,bytes:128});
 await offlineContext.close();console.log('PASS: '+checkedFilms.length+' films actually decode and play; matching posters; stable touch; two reusable layers; native rain/snow; data saver; HD failure fallback; animation toggle; complete bitmap cleanup during scroll; v3 photo/video ranges offline');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename);test.filename=__filename;test.paths=Module._nodeModulePaths(__dirname);test._compile(prefix+checks,__filename);
