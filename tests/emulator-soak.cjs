/* Bounded Android APK soak test. Own emulator only; no AI requests or push subscriptions. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const minutes=Number(args.minutes||120),interval=Number(args.interval||180),pilot=args.pilot==='true';
assert(minutes>0&&minutes<=120,'duration must be bounded to 120 minutes');
assert(interval>=20,'no rapid request loops');
const serial='emulator-5556',adb='C:/Users/ediba/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const pkg='com.onrender.meteo_targoviste.twa',origin='https://meteo-now.onrender.com';
const root=path.resolve(__dirname,'../../..');
const label=args.label||(pilot?'pilot':'run');assert(/^[a-z0-9-]+$/.test(label),'safe report folder');
const out=path.join(root,'03-Testare-si-capturi/tests/artifacts-emulator-soak-20261026',label);
fs.mkdirSync(out,{recursive:true});
const statusFile=path.join(out,'status.json'),stopFile=path.join(out,'STOP');
if(fs.existsSync(statusFile)&&JSON.parse(fs.readFileSync(statusFile,'utf8')).state==='running')throw Error('An unfinished run already owns this report');
const started=Date.now(),deadline=started+minutes*60000;
const state={state:'starting',pid:process.pid,serial,apkVersion:'1.0.27',webOrigin:origin,requestedMinutes:minutes,
 startedAt:new Date(started).toISOString(),expectedEnd:new Date(deadline).toISOString(),cycles:0,passed:0,failed:0,
 runtimeErrors:0,networkFailures:0,widgetPasses:0,pilot,physicalDevice:false,realWeather:true,
 limitations:['No physical battery measurement','No OEM Samsung/Xiaomi firmware','No real push delivery or AI calls','Widget checks use synthetic data'],lastStep:'startup'};
function save(){state.updatedAt=new Date().toISOString();const temp=statusFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2));fs.renameSync(temp,statusFile);}
function record(event,data={}){fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),event,...data})+'\n');}
function command(...cmd){return execFileSync(adb,['-s',serial,...cmd],{encoding:'utf8',timeout:45000,windowsHide:true,maxBuffer:2*1024*1024}).trim();}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const clean=text=>String(text).replace(/https?:\/\/[^\s)]+/g,s=>{try{const u=new URL(s);return u.origin+u.pathname;}catch{return '[url]';}}).slice(0,700);
let browser,page,cdp,expectedNetworkFailure=false,stopping=false;
const watched=new WeakSet();
function watch(p){
 if(watched.has(p))return;watched.add(p);
 p.on('pageerror',err=>{state.runtimeErrors++;record('javascript-error',{message:clean(err.message),expectedOffline:expectedNetworkFailure});save();});
 p.on('requestfailed',req=>{if(!expectedNetworkFailure&&req.url().startsWith(origin)){state.networkFailures++;record('request-failed',{path:new URL(req.url()).pathname,reason:clean(req.failure()?.errorText)});}});
}
async function configureCDP(){
 cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');
 await cdp.send('Network.setBlockedURLs',{urls:[origin+'/ask*',origin+'/api/push/test*',origin+'/api/push/subscribe*']});
}
function memorySample(label){
 for(const target of [pkg,'com.android.chrome']){
  try{const text=command('shell','dumpsys','meminfo',target),match=text.match(/TOTAL PSS:\s*(\d+)/);
   record('android-memory',{label,target,totalPssKiB:match?Number(match[1]):null});
  }catch(err){record('memory-sample-unavailable',{label,target});}
 }
}
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
save();
async function connect(){
 command('forward','tcp:9224','localabstract:chrome_devtools_remote');
 browser=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:20000});
 const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url().startsWith(origin));
 assert(pages.length,'APK must expose its own weather page');page=pages.at(-1);page.setDefaultTimeout(20000);
 watch(page);page.context().on('page',watch);await configureCDP();
}
async function ready(){
 await page.waitForFunction(()=>window.MOBD&&document.getElementById('mbTemp')&&getComputedStyle(document.getElementById('splash')).visibility==='hidden',null,{timeout:60000});
 const snapshot=await page.evaluate(()=>({version:document.querySelector('meta[name="application-version"]')?.content,
 city:LOC.nume,temp:document.getElementById('mbTemp').textContent,cards:document.querySelectorAll('#mbContinut .mb-card').length,
 width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+2,
 heap:performance.memory?.usedJSHeapSize||null,dom:document.getElementsByTagName('*').length,
 bodyLocked:document.body.style.position==='fixed'}));
 assert(snapshot.temp&&!snapshot.temp.includes('--'),'current temperature is available');
 assert(snapshot.cards>5,'weather cards rendered');assert(!snapshot.overflow,'no page-wide horizontal overflow');
 return snapshot;
}
async function scrollCheck(){
 await page.evaluate(()=>window.scrollTo(0,0));
 // Input goes through Android Chrome's touch pipeline, not only scrollTop assignment.
 await cdp.send('Input.synthesizeScrollGesture',{x:200,y:600,yDistance:-430,speed:650,gestureSourceType:'touch'});
 await pause(850);
 const y=await page.evaluate(()=>scrollY);assert(y>40,'home scroll works after overlays close');
 await page.evaluate(()=>window.scrollTo(0,0));
}
async function tap(locator){
 await locator.waitFor({state:'visible'});await locator.scrollIntoViewIfNeeded();
 const box=await locator.boundingBox();assert(box&&box.width>0&&box.height>0,'visible touch target');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,radiusX:1,radiusY:1,force:1,id:1}]});
 await pause(70);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function cycle(index){
 state.lastStep='forecast';save();const before=await ready();
 await page.evaluate(()=>{if(window.inchideToast)inchideToast();});
 state.lastStep='saved-city-sheet';save();
 await tap(page.locator('#mjLoc'));
 await page.waitForFunction(()=>document.getElementById('mobFoaie').classList.contains('deschis'));
 const cities=await page.locator('#mfContinut .mo-oras').count();assert(cities>=2,'saved cities are available');
 const chosen=index%cities;
 const city=await page.locator('#mfContinut .mo-oras').nth(chosen).locator('.mo-nume').textContent();
 await tap(page.locator('#mfContinut .mo-oras').nth(chosen));
 await page.waitForFunction(()=>!document.getElementById('mobFoaie').classList.contains('deschis'));
 await page.waitForFunction(name=>LOC.nume===name.replace(/^➤\s*/,''),city,{timeout:45000});
 await page.waitForFunction(()=>mobDatePentruLoc()&&document.getElementById('mbTemp').textContent.trim()!=='--°',null,{timeout:45000});
 state.lastStep='settings';save();
 await page.locator('#settingsBtn').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.getElementById('settingsSheet').classList.contains('open'));
 assert.equal(await page.locator('#settingsSheet .set-privacy-btn').count(),1);
 await tap(page.locator('#settingsClose'));
 await page.waitForFunction(()=>!document.getElementById('settingsSheet').classList.contains('open'));
 state.lastStep='ai-panel-no-api-call';save();
 await tap(page.locator('#chatFab'));
 await page.waitForFunction(()=>document.getElementById('chatWindow').classList.contains('open'));
 await pause(600);await tap(page.locator('#chatClose'));
 await page.waitForFunction(()=>!document.getElementById('chatWindow').classList.contains('open'));
 state.lastStep='radar-overlay';save();
 await page.evaluate(()=>deschideRadarPlin());
 await page.waitForFunction(()=>document.getElementById('mobRadarPlin').classList.contains('deschis'));
 await pause(1000);await tap(page.locator('#mrInchide'));
 await page.waitForFunction(()=>!document.getElementById('mobRadarPlin').classList.contains('deschis'));
 await scrollCheck();
 if(index%3===0){
  state.lastStep='offline-and-reconnect';save();expectedNetworkFailure=true;
  try{
   await cdp.send('Network.enable');
   await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
   await pause(1800);const offline=await ready();assert.equal(offline.city,(await page.evaluate(()=>LOC.nume)));
   assert(offline.temp&&!offline.temp.includes('--'),'last forecast remains while offline');
  }finally{await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});expectedNetworkFailure=false;}
  await pause(1200);
 }
 if(index%4===0){
  state.lastStep='background-resume';save();command('shell','input','keyevent','KEYCODE_HOME');await pause(2500);
  command('shell','am','start','-n',pkg+'/.LauncherActivity');await pause(2000);
  const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url().startsWith(origin));
  if(pages.length>1){const fresh=pages.at(-1);for(const p of pages.slice(0,-1))await p.close();page=fresh;page.setDefaultTimeout(20000);watch(page);await configureCDP();}
 }
 if(index%5===0){state.lastStep='reload';save();await page.reload({waitUntil:'domcontentloaded',timeout:60000});}
 if(index%10===0){
  state.lastStep='synthetic-widget-regression';save();
  const output=command('shell','am','instrument','-w',pkg+'.widgetqa.test/'+pkg+'.widget.WidgetRenderingInstrumentation');
  assert.match(output,/PASS: \d+ Android widget checks/,'widget rendering regression');state.widgetPasses++;
  memorySample('cycle-'+index);
 }
 const after=await ready();record('cycle-passed',{index,from:before.city,to:after.city,snapshot:after});
 return after;
}
(async()=>{
 try{
  assert(command('get-state')==='device','only the named emulator may be used');
  await connect();await ready();
  // Only this isolated emulator profile is changed; the user's phone is never addressed.
  await page.evaluate(()=>{localStorage.setItem('meteo-locatie-automata','0');});
  state.state='running';save();record('started',{requestedMinutes:minutes,pid:process.pid});memorySample('start');
  await page.screenshot({path:path.join(out,'start.png'),timeout:20000});
  while(Date.now()<deadline&&!stopping&&!fs.existsSync(stopFile)){
   const cycleStarted=Date.now(),index=++state.cycles;
   try{await cycle(index);state.passed++;state.lastStep='idle';}
   catch(err){
    state.failed++;record('cycle-failed',{index,step:state.lastStep,message:clean(err.stack||err)});
    if(state.failed<=3)try{await page.screenshot({path:path.join(out,'failure-'+index+'.png'),timeout:10000});}catch(ignore){}
    // Recover to a known page, while retaining the failure in the final report.
    try{await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});expectedNetworkFailure=false;await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});}catch(ignore){}
   }
   state.elapsedSeconds=Math.round((Date.now()-started)/1000);save();
   const next=Math.min(deadline,cycleStarted+interval*1000);
   while(Date.now()<next&&!stopping&&!fs.existsSync(stopFile)){await pause(Math.min(5000,next-Date.now()));}
  }
  state.state=stopping||fs.existsSync(stopFile)?'stopped':state.failed||state.runtimeErrors?'completed_with_issues':'completed';
  try{await page.screenshot({path:path.join(out,'end.png'),timeout:10000});}catch(ignore){}
 }catch(err){state.state='failed';state.failure=clean(err.stack||err);record('fatal',{message:state.failure});}
 finally{
  state.finishedAt=new Date().toISOString();state.elapsedSeconds=Math.round((Date.now()-started)/1000);save();
  try{
   const lines=command('logcat','-b','crash','-v','epoch','-d','-t','160').split(/\r?\n/).filter(line=>{
    const timestamp=Number(line.trim().split(/\s/)[0]);
    return timestamp>=started/1000&&/AndroidRuntime|com\.onrender\.meteo|com\.android\.chrome|FATAL EXCEPTION|ANR/.test(line);
   });
   fs.writeFileSync(path.join(out,'android-crash-buffer.txt'),lines.join('\n'));
   state.androidCrashLines=lines.length;
   if(lines.length&&state.state==='completed')state.state='completed_with_issues';
  }catch(ignore){}
  memorySample('end');
  if(!pilot){
   try{command('shell','wm','size','1080x1920');command('shell','wm','density','320');command('shell','settings','put','global','stay_on_while_plugged_in','1');command('forward','--remove','tcp:9224');command('emu','kill');state.emulatorStopped=true;}catch(err){state.cleanupError=clean(err.message);}
   save();
  }
  console.log(JSON.stringify(state,null,2));process.exit(state.state==='failed'||state.state==='completed_with_issues'?1:0);
 }
})();
