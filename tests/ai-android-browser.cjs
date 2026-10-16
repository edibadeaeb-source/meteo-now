// Requires the local test AVD and adb forward tcp:9222 localabstract:chrome_devtools_remote.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
const prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace(/const browser=await chromium\.launch\([\s\S]*?\);/,"let androidPage;const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');")
 .replace(/const context=await browser\.newContext\([\s\S]*?\}\);/,'const context=browser.contexts()[0];')
 .replace('const page=await context.newPage(),errors=[];',"const page=androidPage=await context.newPage(),errors=[];")
 .replace("const base='http://127.0.0.1:'", "require('node:child_process').execFileSync('C:/Users/ediba/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','emulator-5554','reverse','tcp:'+server.address().port,'tcp:'+server.address().port]);const base='http://127.0.0.1:'")
 .replace('await page.goto(base,',"await page.route('**/*.mp4',r=>r.fulfill({status:404,body:''}));await page.addInitScript(()=>{navigator.serviceWorker.register=()=>Promise.resolve({});});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.route('**/*.mp4',route=>route.fulfill({status:404,body:''}));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>document.getElementById('chatFab').click());
 console.log('Android Chrome AI opened');const rawSend=cdpCity.send.bind(cdpCity);cdpCity.send=(method,args)=>Promise.race([rawSend(method,args),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Android CDP timeout: '+method)),60000);timer.unref();})]);
 const shots=path.resolve(out,'../ai-android');fs.mkdirSync(shots,{recursive:true});
 page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 const device=await page.evaluate(()=>({ua:navigator.userAgent,dpr:devicePixelRatio,width:innerWidth,height:innerHeight,version:document.querySelector('meta[name="application-version"]').content}));
 device.browser=browser.version();device.sdk=require('node:child_process').execFileSync('C:/Users/ediba/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','emulator-5554','shell','getprop','ro.build.version.sdk'],{encoding:'utf8'}).trim();
 assert.ok(/Android/.test(device.ua));assert.equal(device.version,'2026.10.17.2');
 const shape=()=>page.locator('#chatWindow').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,opacity:s.opacity,backdrop:s.backdropFilter,glass:getComputedStyle(e,'::before').backdropFilter};});
 const before=await shape();assert.equal(before.backdrop,'none');assert.equal(before.glass,'none');
 const bitmap=()=>page.locator('.ai-glass-bitmap').evaluate(e=>{const data=e.getContext('2d').getImageData(0,0,e.width,e.height).data;let hash=2166136261;for(const n of data)hash=Math.imul(hash^n,16777619);return hash>>>0;});
 const original=await bitmap();let gestures=0;
 for(const selector of ['.ai-header-actions','.ai-tabs','.chat-suggestions']){
   const r=await page.locator(selector).boundingBox(),y=r.y+18;
   for(const reverse of [false,true]){
     const start=reverse?r.x+r.width-6:r.x+6,end=reverse?r.x+6:r.x+r.width-6;
     await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y,radiusX:8,radiusY:8,force:1}]});
     for(let n=1;n<=4;n++)await cdpCity.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*n/4,y,radiusX:8,radiusY:8,force:1}]});
     await cdpCity.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     assert.deepEqual(await shape(),before);assert.equal(await page.locator('#chatWindow').getAttribute('data-mode'),'home');gestures++;console.log('Android sweep '+gestures+' passed');
   }
 }
 assert.equal(await bitmap(),original,'Android touch gestures do not redraw the frosted texture');
 const tab=await page.locator('#chatTalkTab').boundingBox();
 await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tab.x+20,y:tab.y+20}]});
 await cdpCity.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tab.x+38,y:tab.y+20}]});
 const sheen=await page.locator('#chatTalkTab').evaluate(e=>({pressed:e.classList.contains('ai-touch-down'),gradient:getComputedStyle(e,'::after').backgroundImage}));
 assert.equal(sheen.pressed,true);assert.ok(sheen.gradient.includes('radial-gradient'));
 await page.screenshot({path:path.join(shots,'android-finger-sheen.png')});
 await cdpCity.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal(await page.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('#chatPromptGlow').evaluate(e=>getComputedStyle(e).animationName),'aiPromptGlow');
 await page.locator('#chatInput').fill('Salut');assert.equal(await page.locator('#chatPromptGlow').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.evaluate(()=>document.getElementById('chatClose').click());
 assert.equal(await page.locator('.ai-glass-bitmap').evaluate(e=>e.width+e.height),0);assert.equal(await page.evaluate(()=>_nrPanouri),0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({device,gestures,glassBitmapStable:true,fingerSheen:true,staticEditor:true,errors},null,2));
 console.log('PASS: Android Chrome native renderer, '+gestures+' touch sweeps, stable glass texture, finger reflection and independent editor glow.');
 await page.close();
 }finally{if(androidPage&&!androidPage.isClosed())await androidPage.close();require('node:child_process').execFileSync('C:/Users/ediba/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','emulator-5554','reverse','--remove','tcp:'+server.address().port]);await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
