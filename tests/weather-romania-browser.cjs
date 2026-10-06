const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
let prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
prefix=prefix.replace(" await page.waitForFunction(()=>document.querySelector('#mobCer[data-photo-ready=\"1\"]'),{timeout:15000});",` await page.evaluate(async()=>{Object.assign(LOC,{nume:'București',lat:44.4268,lon:26.1025});const date=MOBD.daily.time[0];Object.assign(MOBD.current,{weather_code:0,time:date+'T12:00',is_day:1});await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);});`);
const checks=String.raw`
 const films=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-video/v4/sources.json'),'utf8'));
 await page.evaluate(()=>{window.realFilmPick=MeteoWeatherLibrary.pick;MeteoWeatherLibrary.pick=(movie,night,loc)=>{if(!window.testFilm)return realFilmPick(movie,night,loc);const clip=MeteoWeatherLibrary.restore(testFilm,movie);if(!clip)throw Error('Wrong pool '+movie+' / '+testFilm);return clip;};});
 const setFilm=async(id,lite)=>page.evaluate(async({id,lite})=>{
  window.testFilm=id;Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:lite,effectiveType:lite?'3g':'4g'}});
  const city=id.includes('ro-bucharest')?{nume:'București',lat:44.4268,lon:26.1025}:id.includes('ro-brasov')?{nume:'Brașov',lat:45.6579,lon:25.6012}:id.includes('ro-cluj')?{nume:'Cluj-Napoca',lat:46.7712,lon:23.6236}:id.includes('ro-timisoara')?{nume:'Timișoara',lat:45.7489,lon:21.2087}:{nume:'New York City',lat:40.7128,lon:-74.006};
  Object.assign(LOC,city);delete LOC.tara;
  const night=id.includes('-night-'),date=MOBD.daily.time[0],code=id.includes('partly-cloudy')?2:id.includes('overcast')||id.includes('-cloudy-')?3:0;
  Object.assign(MOBD.current,{weather_code:code,is_day:night?0:1,time:date+'T'+(night?'23':'12')+':00',temperature_2m:20});MOBD.daily.sunrise[0]=date+'T07:00';MOBD.daily.sunset[0]=date+'T19:00';
  await MeteoAtmosphere.render(MOBD,mobDinIso(MOBD.current.time),LOC);mobAntet();window.scrollTo(0,0);
 },{id,lite});
 for(const film of films)for(const lite of [false,true]){
  console.log('Decode '+film.id+(lite?' lite':' '+film.quality));await setFilm(film.id,lite);
  await page.waitForFunction(({id,lite})=>{const v=document.querySelector('.weather-video.is-visible');return document.querySelector('#mobCer[data-video="playing"]')&&v?.currentSrc.endsWith(id+'-'+(lite?'lite':v.currentSrc.includes('-2k.')?'2k':'hd')+'.mp4')&&v.currentTime>.1;},{id:film.id,lite},{timeout:20000});
  const size=await page.locator('.weather-video.is-visible').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,frames:v.getVideoPlaybackQuality().totalVideoFrames}));
  assert.equal(size.width,lite?720:film.quality==='2k'?1440:1080);assert.ok(size.frames>1);assert.equal(await page.locator('.weather-video.is-visible').count(),1);assert.equal(await page.locator('.weather-video').count(),2);
  assert.ok((await page.locator('.weather-photo.is-visible').getAttribute('src')).endsWith(film.id+'.webp'));
  if(film.id.includes('-night-'))assert.equal(await page.locator('.weather-video.is-visible').evaluate(v=>getComputedStyle(v).filter),'none');
  const url=await page.locator('.weather-video.is-visible').getAttribute('src');await page.touchscreen.tap(205,130);await page.waitForTimeout(200);assert.equal(await page.locator('.weather-video.is-visible').getAttribute('src'),url);
  if(!lite)await page.screenshot({path:path.join(out,film.id+'-412.png')});
 }
 assert.equal(errors.filter(e=>!e.includes('getCurrentPosition')).length,0);await context.close();
 console.log('PASS: 11 new films / 22 actual mobile decodes, matching photos, correct local/night categories, untouched tap, two reused video elements');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename);test.filename=__filename;test.paths=Module._nodeModulePaths(__dirname);test._compile(prefix+checks,__filename);
