const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),cp=require('node:child_process');
const fixture=path.join(__dirname,'weather-browser.cjs');
const probe=cp.spawnSync('C:/Users/ediba/scoop/apps/python313/current/python.exe', ['-X','utf8','-c',
 "import json;from app import app;r=app.test_client().get('/');print(json.dumps({k:v for k,v in r.headers.items() if k in ('Content-Security-Policy','Permissions-Policy','X-Content-Type-Options','X-Frame-Options','Referrer-Policy')}));r.close()"],
 {cwd:path.join(__dirname,'..'),encoding:'utf8'});
if(probe.status!==0)throw Error(probe.stderr);
const headers=JSON.parse(probe.stdout.trim().split(/\r?\n/).at(-1));
let prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace('const server=http.createServer((req,res)=>{', 'const server=http.createServer((req,res)=>{Object.entries('+JSON.stringify(headers)+').forEach(([k,v])=>res.setHeader(k,v));')
 .replace("await page.goto(base,", "await page.addInitScript(()=>{window.securityViolations=[];document.addEventListener('securitypolicyviolation',e=>securityViolations.push({directive:e.effectiveDirective,resource:e.blockedURI}));});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 assert.ok(await page.locator('#mbCardOre').count());assert.ok(await page.locator('.mb-uv-card').count());
 await page.evaluate(()=>mobDeschideFoaie('orase'));assert.ok(await page.locator('#mobFoaie.deschis').count());
 await page.evaluate(()=>mobInchideFoaie());
 assert.ok(await page.evaluate(()=>!!MeteoChat&&!!MeteoConversations));
 const payload='<img src=x onerror="window.cityInjection=1">';
 await page.evaluate(payload=>{localStorage.setItem('meteo-orase',JSON.stringify([{nume:payload,admin:'<b>Injected</b>',tara:'RO',lat:45,lon:26}]));mobDeschideFoaie('orase');},payload);
 assert.ok((await page.locator('.mo-nume').textContent()).includes(payload));
 assert.equal(await page.locator('#mfContinut .mo-oras img, #mfContinut .mo-sub b').count(),0);
 assert.equal(await page.evaluate(()=>window.cityInjection),undefined);
 await page.evaluate(()=>mobInchideFoaie());
 await page.route('**/ask',route=>route.fulfill({json:{answer:payload,model:'claude-sonnet-5-5'}}));
 await page.locator('#chatFab').click();await page.locator('#chatInput').fill('Test securitate');await page.locator('#chatSend').click();
 await page.waitForFunction(payload=>document.querySelector('#chatMessages').textContent.includes(payload),payload);
 assert.equal(await page.locator('#chatMessages img').count(),0,'AI answers remain plain text');
 assert.equal(await page.evaluate(()=>window.cityInjection),undefined);
 await page.unroute('**/ask');await page.route('**/ask',route=>route.fulfill({status:429,json:{error:'Rate limited'},headers:{'Retry-After':'60'}}));
 await page.locator('#chatInput').fill('Altă întrebare');await page.locator('#chatSend').click();
 await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('limită temporară de utilizare'));
 assert.deepEqual(await page.evaluate(()=>securityViolations),[],'CSP must preserve scripts, fonts, textures and weather media');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS: actual security headers preserve mobile startup, forecast, UV, city picker and weather media; city and AI HTML injection cannot execute');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
