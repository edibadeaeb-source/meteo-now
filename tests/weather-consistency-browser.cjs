const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
let prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace("const loc={nume:'Târgoviște',lat:44.9266,lon:25.4566,tara:'RO',admin:'Dâmbovița',tz:'Europe/Bucharest'};", "const loc={nume:'București',lat:44.4268,lon:26.1025,tara:'RO',admin:'București',tz:'Europe/Bucharest'};")
 .replace("localStorage.setItem('meteo-loc',", "localStorage.setItem('meteo-locatie-automata','0');localStorage.setItem('meteo-loc',")
 .replace("await page.goto(base,", "await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 let supplementCalls=0;
 await page.route('https://api.open-meteo.com/v1/forecast?**',async route=>{
  const u=new URL(route.request().url());if(u.searchParams.get('timeformat')!=='unixtime')return route.fallback();
  supplementCalls++;
  const raw=await page.evaluate(()=>({timezone:'Europe/Bucharest',current:{time:Math.floor(Date.now()/1000),uv_index:0},hourly:{time:MOBD.hourly.time.map(t=>Date.parse(t+'+03:00')/1000),uv_index:MOBD.hourly.time.map(()=>0),precipitation_probability:MOBD.hourly.time.map(()=>90)},daily:{time:MOBD.daily.time.map(day=>Date.parse(day+'T00:00+03:00')/1000),uv_index_max:MOBD.daily.time.map(()=>4.5)}}));
  await new Promise(r=>setTimeout(r,500));await route.fulfill({json:raw});
 });
 await page.evaluate(()=>{
  MOBD.current.weather_code=2;MOBD.current.precipitation=0;MOBD.current.precipitation_interval_seconds=3600;MOBD.current.is_day=0;
  MOBD.current.uv_index=null;MOBD.hourly.uv_index=MOBD.hourly.time.map(()=>null);MOBD.daily.uv_index_max=MOBD.daily.time.map(()=>null);
  MOBD.hourly.precipitation_probability=MOBD.hourly.time.map(()=>0);MOBD.daily.precipitation_probability_max=MOBD.daily.time.map(()=>0);
  MeteoForecastCache.put(LOC,MOBD);_mobOraMod='precip';mobRandareAcum();window.sameWarningMap=document.getElementById('mbHartaAnmJos');window.sameBackground=document.getElementById('mobCer');
 });
 assert.ok((await page.locator('.mb-uv-card .mb-val').textContent()).includes('—'));
 const card=page.locator('#mbCardOre');assert.equal(await card.locator('.mb-ora.acum .o-v').textContent(),'0.0mm/h');assert.ok((await card.textContent()).includes('0%'));
 assert.ok((await card.textContent()).includes('Șanse de ploaie în orele următoare'));
 await page.evaluate(()=>mobCompleteazaPloaie({...LOC},MOBD));await page.waitForFunction(()=>document.querySelector('.mb-uv-card .mb-val').textContent==='0');
 assert.equal(await page.locator('.mb-uv-card .mb-sub').textContent(),'Scăzut');assert.equal(await page.locator('.mb-uv-marker').count(),1);
 assert.equal(await page.evaluate(()=>MOBD.daily.uv_index_max[0]),4.5,'daily peak stays separate from current zero');assert.equal(await page.evaluate(()=>MOBD.current.uv_index),0);
 assert.equal(await page.evaluate(()=>document.getElementById('mbHartaAnmJos')===sameWarningMap&&document.getElementById('mobCer')===sameBackground),true,'UV update preserves map and background');
 assert.equal(supplementCalls,1,'UV works when rain is already known and shares one supplement request');
 const shots=path.resolve(out,'../weather-consistency');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'bucharest-dry-night.png')});await page.locator('.mb-uv-card').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'uv-night-zero.png')});
 // Real precipitation now can coexist with a later dry forecast without a bogus current 0%.
 await page.evaluate(()=>{MOBD.current.precipitation=.65;MOBD.current.weather_code=61;document.getElementById('mbCardOre').outerHTML=mobCardOre();mobLeaga(true);});
 assert.equal(await page.locator('#mbCardOre .mb-ora.acum .o-v').textContent(),'0.7mm/h');
 // UV has its actual gradient position and category at a nonzero daytime value.
 await page.evaluate(()=>{MOBD.current.uv_index=5.4;MOBD.current.is_day=1;document.querySelector('.mb-uv-card').outerHTML=mobCardUV();});
 assert.equal(await page.locator('.mb-uv-card .mb-val').textContent(),'5');assert.equal(await page.locator('.mb-uv-card .mb-sub').textContent(),'Moderat');
 assert.ok((await page.locator('.mb-uv-marker').getAttribute('style')).includes('41.67%'));
 await page.screenshot({path:path.join(shots,'uv-day-value.png')});
 assert.deepEqual(errors,[]);console.log('PASS: Bucuresti dry current versus later chance, honest current precipitation rate, UV night zero/day value, daily peak separated, marker/category, one request, maps/background retained');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
