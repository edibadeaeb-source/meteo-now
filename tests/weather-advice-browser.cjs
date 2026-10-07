const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
let prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace('inchideToast();','')
 .replace("localStorage.setItem('meteo-loc',", "localStorage.setItem('meteo-locatie-automata','0');localStorage.setItem('meteo-loc',")
 .replace('avertizare:[warning]','avertizare:[]')
 .replace("const loc={nume:'Târgoviște',lat:44.9266,lon:25.4566,tara:'RO',admin:'Dâmbovița',tz:'Europe/Bucharest'};", "const loc={nume:'Moreni',lat:44.983,lon:25.644,tara:'RO',admin:'Dâmbovița',tz:'Europe/Bucharest'};")
 .replace("page.on('pageerror',e=>errors.push(e.stack||e.message));", "page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('Browser page error:',e.message)});")
 .replace('temperature_2m:28,apparent_temperature:29','temperature_2m:13,apparent_temperature:12')
 .replace('weather_code:1,precipitation:0,surface_pressure','weather_code:3,precipitation:0,surface_pressure')
 .replace('uv_index:5},current_weather','uv_index:0},current_weather')
 .replace('sunset:Date.now()/1000+20000','sunset:Date.now()/1000+2400')
 .replace("await page.goto(base,", "await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{const D=Date,fixed=D.parse('2026-10-07T21:48:00Z');window.Date=class extends D{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>document.getElementById('sfatToast').classList.contains('vizibil'),{timeout:20000});
 assert.equal(await page.locator('#stEt').textContent(),'Moreni');
 assert.equal(await page.evaluate(()=>CTX.noapte),true);assert.equal(await page.evaluate(()=>CTX.minPanaApus),null);
 assert.equal(await page.evaluate(()=>CTX.temp),13,'popup uses the current temperature displayed in the app');
 const message=await page.locator('#stText').textContent();assert.ok(!/Apusul|lumina bună|Sunset/.test(message),message);
 assert.ok((await page.evaluate(()=>calculeazaSfaturi().map(s=>s.id))).every(id=>!['apusCurand','ziPerfecta','uvExtrem','uvMare'].includes(id)));
 assert.equal(await page.locator('#mbTemp').innerText(),'13°');
 const shots=path.resolve(out,'../weather-advice');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'moreni-night-0048.png')});
 await page.locator('#stX').click();assert.equal(await page.locator('#sfatToast').getAttribute('aria-hidden'),'true');
 // A late old-city reply still cannot inject a countdown while the new city is displayed.
 await page.evaluate(()=>{sunTimes={rise:Date.now()-36000000,set:Date.now()+2400000,lat:40.7128,lon:-74.006};actualizeazaContext({});});
 assert.equal(await page.evaluate(()=>CTX.minPanaApus),null);assert.equal(await page.evaluate(()=>CTX.noapte),true);
 assert.deepEqual(errors,[]);console.log('PASS: S24-size Moreni at 00:48, current 13°C, no sunset/daytime toast, dismissal and foreign solar response ignored');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
