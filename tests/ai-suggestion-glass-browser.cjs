const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
const prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace('await page.goto(base,',"await page.route('**/*.mp4',r=>r.fulfill({status:404,body:''}));await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#chatFab').click();
 const shots=path.resolve(out,'../ai-suggestions');fs.mkdirSync(shots,{recursive:true});
 const rawSend=cdpCity.send.bind(cdpCity);cdpCity.send=(method,args)=>{let timer;return Promise.race([rawSend(method,args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),20000);})]).finally(()=>clearTimeout(timer));};
 const reports=[];let asks=0;await page.route('**/ask',r=>{asks++;return r.fulfill({json:{answer:'Test'}});});
 const read=e=>{const s=getComputedStyle(e),g=getComputedStyle(e,'::after');return{
   parent:{background:s.background,color:s.color,transform:s.transform,filter:s.filter,font:s.font,border:s.border},
   gradient:g.backgroundImage,transform:g.transform,opacity:+g.opacity,transition:g.transitionProperty,duration:g.transitionDuration,
   willChange:g.willChange,width:g.width,height:g.height,sweep:getComputedStyle(e,'::before').animationName,pulse:e.classList.contains('ai-glass-pulse')};};
 const surface=()=>page.locator('#chatWindow').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,opacity:getComputedStyle(e).opacity};});
 for(const [width,height]of [[412,915],[360,800],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   const chips=page.locator('#chatWindow .chat-suggestion');assert.equal(await chips.count(),6);
   const panel=await surface();let samples=0;
   for(let i=0;i<await chips.count();i++){
     const chip=chips.nth(i);await chip.scrollIntoViewIfNeeded();
     // Inspect every position synchronously through the production handlers.
     // Native rendering is exercised separately below and by ai-sweep-browser.
     const states=await chip.evaluate((e,source)=>{
       const read=eval('('+source+')'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
       const rest=read(e);e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));
       getComputedStyle(e,'::after').opacity;e.getAnimations({subtree:true}).filter(a=>a.transitionProperty==='opacity').forEach(a=>a.finish());
       const entered=read(e),samples=[];
       for(const dx of [-8,-4,0,4,8,4,0,-4]){window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:x+dx,clientY:y}));samples.push(read(e));}
       e.dispatchEvent(new Event('touchcancel',{bubbles:true}));getComputedStyle(e,'::after').opacity;
       const a=e.getAnimations({subtree:true}).find(a=>a.transitionProperty==='opacity');let fade=null;
       if(a){a.pause();a.currentTime=90;fade=+getComputedStyle(e,'::after').opacity;a.finish();}
       return {rest,entered,samples,fade,final:read(e)};
     },read.toString());
     const {rest,entered}=states;assert.equal(rest.opacity,0);assert.equal(rest.width,'160px');assert.equal(rest.height,'160px');
     assert.equal(rest.transition,'opacity');assert.equal(rest.duration,'0.18s');assert.equal(rest.willChange,'transform, opacity');assert.equal(entered.opacity,1);
     const positions=new Set();
     for(const active of states.samples){
       positions.add(active.transform);assert.deepEqual(active.parent,rest.parent,'finger motion keeps the text/background/border stable');
       assert.equal(active.gradient,rest.gradient,'the reflection texture stays fixed');assert.equal(active.opacity,1);
       assert.equal(active.sweep,'none');assert.equal(active.pulse,false);assert.equal(active.willChange,rest.willChange);samples++;
     }
     assert.ok(positions.size>1,'the reflection follows the finger');assert.ok(states.fade>0&&states.fade<1,'release interpolates the light');assert.equal(states.final.opacity,0);
     assert.deepEqual(await surface(),panel);

   }
   const native=chips.first();await native.scrollIntoViewIfNeeded();const box=await native.boundingBox(),nx=box.x+box.width/2,ny=box.y+box.height/2;
   await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:nx,y:ny}]});
   await cdpCity.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:nx+6,y:ny}]});
   await page.waitForTimeout(220);assert.equal((await native.evaluate(read)).opacity,1);
   assert.equal(await native.evaluate(e=>e.classList.contains('ai-touch-down')),true);
   if(width===412)await page.screenshot({path:path.join(shots,'suggestion-finger-glass-412.png')});
   await cdpCity.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal(await native.evaluate(e=>e.classList.contains('ai-touch-down')),false);
   await page.waitForTimeout(240);assert.equal((await native.evaluate(read)).opacity,0);assert.deepEqual(await surface(),panel);
   reports.push({width,height,samples,stableChipSurface:true,staticReflectionTexture:true,smoothFade:true,fingerSheen:true});console.log('Suggestion glass '+width+'x'+height+' passed');
 }
 assert.equal(asks,0,'a glide or cancelled touch cannot submit a predefined question');
 await page.emulateMedia({reducedMotion:'reduce'});const chip=page.locator('.chat-suggestion').first();
 await chip.dispatchEvent('pointerdown',{pointerType:'touch',clientX:40,clientY:40});
 assert.equal((await chip.evaluate(read)).opacity,0,'reduced motion suppresses the reflection');
 await page.locator('#chatWindow').dispatchEvent('touchcancel',{touches:[],changedTouches:[]});
 await page.locator('#chatClose').click();assert.equal(await page.evaluate(()=>_nrPanouri),0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({version:'2026.10.12.11',nativeGestures:reports.length,reports,asks,errors},null,2));
 console.log('PASS: '+reports.reduce((n,r)=>n+r.samples,0)+' suggestion motion samples across three viewports; fixed texture, stable text/background, retained reflection, smooth fade, no repeated sweep or accidental AI request.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
