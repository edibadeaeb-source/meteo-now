const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
let prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0].replace('deviceScaleFactor:2','deviceScaleFactor:1').replace('await page.goto(base,',"await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#chatFab').click();
 // Freeze only the weather/idle artwork so pixel comparisons measure press feedback.
 await page.addStyleTag({content:'#mobCer{visibility:hidden!important}'});
 await page.evaluate(()=>{document.querySelectorAll('video').forEach(v=>v.pause());document.getAnimations().forEach(a=>a.pause());});
 let asks=0;await page.route('**/ask',route=>{asks++;return route.fulfill({json:{answer:'Test'}});});
 const shots=path.resolve(out,'../ai-long-press');fs.mkdirSync(shots,{recursive:true});
 const buttons=page.locator('#chatWindow button:visible:enabled');const count=await buttons.count();assert.ok(count>=10);
 const results=[];
 for(let i=0;i<count;i++){
   const button=buttons.nth(i),box=await button.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   const before=await page.locator('#chatWindow').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{transform:s.transform,opacity:s.opacity,backdrop:s.backdropFilter,x:r.x,y:r.y,width:r.width,height:r.height};});
   await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   const samples=[];let bitmap;
   for(const delay of [220,450,600]){
     await page.waitForTimeout(delay);
     samples.push(await button.evaluate(e=>{const s=getComputedStyle(e),after=getComputedStyle(e,'::after');return{transform:s.transform,filter:s.filter,before:getComputedStyle(e,'::before').animationName,after:after.animationName};}));
     if(i===2){const image=await page.screenshot({clip:{x:40,y:160,width:330,height:40}});if(bitmap)assert.ok(bitmap.equals(image),'holding a button must not flash the glass surface');bitmap=image;}
   }
   for(const [phase,s] of samples.entries()){assert.equal(s.transform,'none');assert.equal(s.filter,'none');if(phase===0)assert.ok(['none','aiGlassSweep'].includes(s.before));else assert.equal(s.before,'none','the entry sheen never loops while held');assert.equal(s.after,'none');}
   const after=await page.locator('#chatWindow').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{transform:s.transform,opacity:s.opacity,backdrop:s.backdropFilter,x:r.x,y:r.y,width:r.width,height:r.height};});
   assert.deepEqual(after,before,'a sustained button press cannot change the glass panel');
   if(i===2)await page.screenshot({path:path.join(shots,'held-button-412.png')});
   await cdpCity.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),0,'cancel releases feedback');
   results.push({button:await button.getAttribute('id')||await button.textContent(),holdMs:1270,stable:true});
 }
 assert.equal(asks,0,'canceling a hold must not send a question');
 await page.locator('#chatInput').fill('Text editabil');
 const edit=await page.locator('#chatInput').evaluate(e=>{e.setSelectionRange(0,4);return{selection:e.selectionEnd-e.selectionStart,userSelect:getComputedStyle(e).userSelect};});
 assert.equal(edit.selection,4);assert.equal(edit.userSelect,'text');
 // Pointer movement out of a button also ends its feedback, without moving the panel.
 await page.locator('#chatTalkTab').dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointermove',{clientX:0,clientY:0})));
 assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),0);
 await page.locator('#chatClose').click();assert.equal(await page.evaluate(()=>_nrPanouri),0);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({buttons:results,stableGlassPixels:true,errors},null,2));
 console.log('PASS: '+count+' real long touches, stable glass pixels and geometry, one entry sheen without looping/filter/transform, cancellation, pointer exit, text editing and close restored.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
