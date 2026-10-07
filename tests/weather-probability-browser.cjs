const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
const prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 let probabilityCalls=0;
 await page.route('https://api.open-meteo.com/v1/forecast?**',async route=>{
   const u=new URL(route.request().url());if(u.searchParams.get('timeformat')!=='unixtime')return route.fallback();
   probabilityCalls++;
   const raw=await page.evaluate(()=>({hourly:{time:MOBD.hourly.time.map(t=>Date.parse(t+'Z')/1000),precipitation_probability:MOBD.hourly.time.map((t,i)=>i%2?73:0)}}));
   await new Promise(r=>setTimeout(r,600));await route.fulfill({json:raw});
 });
 const originalTemp=await page.locator('#mbTemp').textContent();
 await page.evaluate(()=>{
   MOBD.timezone='UTC';MOBD.utc_offset_seconds=0;
   MOBD.hourly.precipitation_probability=MOBD.hourly.time.map(()=>null);
   MOBD.daily.precipitation_probability_max=MOBD.daily.time.map(()=>null);
   MeteoForecastCache.put(LOC,MOBD);_mobOraMod='precip';mobRandare();
   window.unchangedMap=document.getElementById('mbHartaAnmJos');
   mobCompleteazaPloaie({...LOC},MOBD);
 });
 assert.ok((await page.locator('#mbCardOre').textContent()).includes('—'));
 await page.waitForFunction(()=>document.querySelector('#mbCardOre').textContent.includes('73%'));
 assert.equal(await page.locator('#mbTemp').textContent(),originalTemp);
 assert.ok((await page.locator('#mbCardOre').textContent()).includes('0%'));
 assert.equal(await page.evaluate(()=>document.getElementById('mbHartaAnmJos')===unchangedMap),true,'do not recreate the warning map');
 assert.ok((await page.locator('#mbCardZile').textContent()).includes('73%'));
 await page.locator('#mbSeg button[data-m="temp"]').click();
 assert.equal(await page.evaluate(()=>_mobOraMod),'temp','replaced card remains interactive');
 await page.evaluate(()=>mobCompleteazaPloaie({...LOC},MOBD));
 assert.equal(probabilityCalls,1,'switching forecast display does not reload probabilities');
 assert.deepEqual(errors,[]);
 console.log('Browser: real card shows 0%/73%, preserves current weather and ANM map, remains interactive, one supplement request');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
