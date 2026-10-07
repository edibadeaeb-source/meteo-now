const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
let prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const research=path.resolve(__dirname,'../../../03-Testare-si-capturi/tests');
const moreni=JSON.parse(fs.readFileSync(path.join(research,'met-fallback-Moreni-20261007.json'),'utf8'));
const caragiale=JSON.parse(fs.readFileSync(path.join(research,'met-fallback-Caragiale-20261007.json'),'utf8'));
const target={nume:'I. L. Caragiale',admin:'Dâmbovița',tara:'RO',lat:44.914,lon:25.701};
prefix=prefix.replace(/const forecast=.+?;\r?\nconst geo=/,'const forecast='+JSON.stringify(moreni)+';\nconst geo=');
prefix=prefix.replace(/const loc=.+?;\r?\nconst second=/,'const loc='+JSON.stringify({nume:'Moreni',admin:'Dâmbovița',tara:'RO',lat:44.983,lon:25.644})+';\nconst second=');
prefix=prefix.replace('const page=await context.newPage(),errors=[];',`const target=${JSON.stringify(target)},targetData=${JSON.stringify(caragiale)},counts={};let failAll=false;const page=await context.newPage(),errors=[];`);
prefix=prefix.replace("await page.route('**/*'",`await page.addInitScript(()=>{Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true}});localStorage.setItem('meteo-locatie-automata','0');});\n await page.route('**/*'`);
prefix=prefix.replace("if(s.includes('/api/weather/forecast'))return json(forecast);",`if(s.includes('/api/weather/forecast')){const lat=+u.searchParams.get('latitude');counts[lat]=(counts[lat]||0)+1;if(failAll||(lat===target.lat&&counts[lat]<3))return route.fulfill({status:502,json:{error:'Temporary provider failure'}});await new Promise(r=>setTimeout(r,250));return json(lat===target.lat?targetData:forecast);}`);
prefix=prefix.replace("await page.waitForFunction(()=>window.MOBD",`await page.evaluate(target=>seteazaLocatie(target,true,'gps'),target);\n await page.waitForTimeout(200);assert.equal(await page.locator('#splash').evaluate(el=>el.classList.contains('hide')),false,'cold startup stays branded until a valid forecast arrives');\n await page.waitForFunction(()=>window.MOBD`);
prefix=prefix.replace('geolocation:{latitude:loc.lat,longitude:loc.lon}',`geolocation:{latitude:${target.lat},longitude:${target.lon}}`);
prefix=prefix.replace(/if\(s.includes\('api.bigdatacloud.net'\)\)return json\(.+?\);/,`if(s.includes('api.bigdatacloud.net'))return json({city:'I. L. Caragiale',locality:'I. L. Caragiale',principalSubdivision:'Dâmbovița',countryCode:'RO'});`);
const checks=String.raw`
 assert.equal(counts[target.lat],3,'two temporary failures recover automatically');
 assert.equal(await page.evaluate(()=>LOC.nume),target.nume);
 assert.equal(await page.evaluate(()=>_mobDateCheie),target.lat.toFixed(3)+','+target.lon.toFixed(3));
 assert.equal(await page.locator('#mbTemp').innerText(),Math.round(targetData.current.temperature_2m)+'°');
 assert.ok(await page.locator('#mbCardOre').count());assert.equal(await page.locator('.mb-zi').count(),targetData.daily.time.length);
 assert.equal(await page.locator('.mb-uv-card .mb-val').innerText(),'—','missing UV must not become zero');
 await page.evaluate(()=>{_mobOraMod='precip';mobRandareAcum();});
 assert.equal(await page.locator('.mb-ora.acum .o-v').innerText(),'—','missing probability must not become 0%');
 assert.equal(await page.locator('#mbContinut').innerText().then(t=>/NaN|undefined|null/.test(t)),false);
 assert.equal(await page.locator('#splash').evaluate(el=>el.classList.contains('hide')),true);
 await page.screenshot({path:path.join(out,'cold-gps-provider-recovery-412.png')});
 // Empty the disk cache before a second cold startup with every provider unavailable.
 await page.evaluate(()=>new Promise((resolve,reject)=>{const o=indexedDB.open('meteo-forecast-cache-v1');o.onsuccess=()=>{const t=o.result.transaction('cities','readwrite');t.objectStore('cities').clear();t.oncomplete=()=>{o.result.close();resolve()};t.onerror=reject};o.onerror=reject;}));
 failAll=true;await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('#mbWeatherError',{timeout:15000});
 assert.equal(await page.locator('#splash').evaluate(el=>el.classList.contains('hide')),true,'a genuine outage shows recovery controls instead of an endless splash');
 failAll=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForSelector('#mbCardOre',{timeout:15000});assert.equal(await page.locator('#mbWeatherError').count(),0,'network recovery restores the forecast without manual intervention');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS: cold GPS startup, automatic retry, latest-city ownership, real MET fallback panels, honest missing UV/probabilities, complete outage and automatic network recovery');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
