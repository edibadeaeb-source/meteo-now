const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs');
const prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace('await page.goto(base,',"await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 page.on('framenavigated',f=>{if(f===page.mainFrame())console.log('Navigation during gesture: '+f.url());});
 // Use the moving photographic fallback rather than decode video with SwiftShader.
 await page.route('**/*.mp4',route=>route.fulfill({status:404,body:''}));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#chatFab').click();console.log('AI opened with live animations');
 const shots=path.resolve(out,'../ai-sweep');fs.mkdirSync(shots,{recursive:true});
 // Keep live photographic weather and idle animations: this is deliberately different from the hold pixel test.
 await page.evaluate(()=>{
   window.sweepRefreshCalls=[];
   ['fetchWeather','loadSynopStations','refreshWarnings','loadFlood','loadPrecip','refreshRadarFrames'].forEach(name=>window[name]=()=>sweepRefreshCalls.push(name));
   window.sweepMutations=[];new MutationObserver(rs=>rs.forEach(r=>sweepMutations.push({id:r.target.id,attribute:r.attributeName})))
     .observe(chatWindow,{attributes:true,attributeFilter:['class','style','data-idle','data-composer-idle']});
 });
 const surface=()=>page.locator('#chatWindow').evaluate(e=>{
   const s=getComputedStyle(e),g=getComputedStyle(e,'::before'),r=e.getBoundingClientRect();
   return {transform:s.transform,filter:s.filter,backdrop:s.backdropFilter,opacity:s.opacity,
     glassBackdrop:g.backdropFilter,glassContent:g.content,glassPointer:g.pointerEvents,
     x:r.x,y:r.y,width:r.width,height:r.height,scrollY};
 });
 const original=await surface(),samples=[];
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overscrollBehavior),'none');
 assert.equal(original.backdrop,'none','interactive ancestor has no backdrop filter');
 assert.equal(original.glassBackdrop,'none','no live CSS blur remains in AI');
 const bitmap=()=>page.locator('.ai-glass-bitmap').evaluate(e=>{const pixels=e.getContext('2d').getImageData(0,0,e.width,e.height).data;let hash=2166136261,opaque=true;for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i]!==255)opaque=false;}return{width:e.width,height:e.height,hash:hash>>>0,opaque};});
 const liveBlurs=await page.locator('#chatWindow').evaluate(e=>[e,...e.querySelectorAll('*')].filter(node=>getComputedStyle(node).backdropFilter!=='none').map(node=>node.id||node.className));
 assert.deepEqual(liveBlurs,[],'AI has no live backdrop-filter surfaces');
 const frozen=await bitmap();assert.equal(frozen.opaque,true);assert.ok(frozen.width>300&&frozen.height>800);
 assert.equal(original.glassContent,'""');assert.equal(original.glassPointer,'none');
 const buttons=page.locator('#chatWindow button:visible:enabled');
 const cssState=e=>{const s=getComputedStyle(e);return{background:s.background,color:s.color,transform:s.transform,filter:s.filter,shadow:s.boxShadow,before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content,afterOpacity:getComputedStyle(e,'::after').opacity};};
 const cdp=cdpCity;await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const {root:dom}=await cdp.send('DOM.getDocument');
 const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:dom.nodeId,selector:'#chatWindow button'});
 // Mobile browsers can retain hover after a touch. Check actual inherited hover CSS too.
 for(const nodeId of nodeIds)await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
 const resting=await buttons.evaluateAll((els,fn)=>els.map(e=>eval('('+fn+')')(e)),cssState.toString());
 for(const nodeId of nodeIds)await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']});
 await page.waitForTimeout(300);
 console.log('Hover states sampled');
 const hovering=await buttons.evaluateAll((els,fn)=>els.map(e=>eval('('+fn+')')(e)),cssState.toString());
 assert.deepEqual(hovering,resting,'retained native hover cannot change the button geometry/filter');
 for(const nodeId of nodeIds)await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]});
 for(const state of resting){assert.equal(state.before,'""');assert.equal(state.after,'""');}
 for(const selector of ['.ai-header-actions','.ai-tabs','.chat-suggestions']){
   console.log('Sweep '+selector);
   const box=await page.locator(selector).boundingBox(),y=box.y+Math.min(box.height/2,18);
   for(const reverse of [false,true]){
     console.log('Direction '+(reverse?'left':'right'));
     const start=reverse?box.x+box.width-5:box.x+5,end=reverse?box.x+5:box.x+box.width-5;
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
     for(let n=1;n<=4;n++){
       await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*n/4,y}]});
       samples.push(await surface());await page.waitForTimeout(16);
     }
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),0);
     assert.equal(await page.locator('#chatWindow').getAttribute('data-mode'),'home','a swipe must not activate the crossed button');
   }
 }
 for(const sample of samples)assert.deepEqual(sample,original,'sweep cannot alter the glass surface or move the page');
 assert.deepEqual(await page.evaluate(()=>sweepRefreshCalls),[]);
 assert.deepEqual(await page.evaluate(()=>sweepMutations),[],'finger movement cannot change the dialog/idle animation state');
 const animation=await page.locator('.ai-edge-head').evaluate(e=>({state:e.getAnimations()[0]?.playState,offset:getComputedStyle(e).strokeDashoffset}));
 await page.waitForTimeout(180);
 assert.equal(animation.state,'running');
 assert.notEqual(animation.offset,await page.locator('.ai-edge-head').evaluate(e=>getComputedStyle(e).strokeDashoffset),'outline keeps moving during gestures');
 assert.equal(await page.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none','the real editor remains static');
 assert.equal(await page.locator('#chatPromptGlow').evaluate(e=>getComputedStyle(e).animationName),'aiPromptGlow');
 assert.deepEqual(await bitmap(),frozen,'finger movement never repaints the frosted weather bitmap');
 console.log('Live gestures passed; capturing surface');
 await page.screenshot({path:path.join(shots,'live-sweep-412.png'),timeout:15000});
 // Compare both the panel and editor while weather, contour and button sheen run.
 const editor=await page.locator('#chatInput').boundingBox(),composerPixels=[];
 const pixels=[];const tab=await page.locator('#chatTalkTab').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tab.x+10,y:tab.y+20}]});
 for(let n=0;n<4;n++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tab.x+10+n*24,y:tab.y+20}]});
   await page.waitForTimeout(170);pixels.push(await page.screenshot({clip:{x:40,y:160,width:330,height:35}}));
   composerPixels.push(await page.screenshot({clip:{x:editor.x+10,y:editor.y+editor.height-16,width:editor.width-20,height:8}}));
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 pixels.forEach((p,i)=>fs.writeFileSync(path.join(shots,'panel-'+i+'.png'),p));composerPixels.forEach((p,i)=>fs.writeFileSync(path.join(shots,'editor-'+i+'.png'),p));
 assert.ok(pixels.slice(1).every(p=>p.equals(pixels[0])),'moving across buttons cannot flash the glass while edge/text animations run');
 assert.ok(composerPixels.slice(1).every(p=>p.equals(composerPixels[0])),'the writing area cannot flash with the button sheen running');
 await page.locator('#chatTalkTab').evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+30,y=r.y+20;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:x+8,clientY:y}));});
 assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),1,'the original liquid reflection follows finger movement');
 const shine=await page.locator('#chatTalkTab').evaluate(e=>({x:e.style.getPropertyValue('--ai-press-x'),gradient:getComputedStyle(e,'::after').backgroundImage}));
 assert.equal(parseFloat(shine.x),38);assert.ok(shine.gradient.includes('radial-gradient'));
 await page.evaluate(()=>{window.dispatchEvent(new PointerEvent('pointercancel',{pointerType:'touch'}));document.getElementById('chatWindow').dispatchEvent(new PointerEvent('pointerleave',{pointerType:'touch'}));});
 assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),1,'Android native pointer cancellation does not end the physical touch reflection');
 await page.screenshot({path:path.join(shots,'finger-sheen-412.png')});
 await page.locator('#chatWindow').dispatchEvent('touchcancel',{touches:[],changedTouches:[]});
 await page.locator('#chatHistoryTab').click();assert.equal(await page.locator('#chatWindow').getAttribute('data-mode'),'history');
 await page.locator('#chatTalkTab').click();await page.locator('#chatInput').fill('Salut');
 assert.equal(await page.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.locator('#chatClose').click();assert.equal(await page.evaluate(()=>_nrPanouri),0);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('ai-is-open')),false);
 assert.equal(await page.locator('.ai-glass-bitmap').evaluate(e=>e.width+e.height),0,'closing releases the bitmap memory');
 await page.locator('#chatFab').click();assert.equal(await page.locator('.ai-glass-bitmap').count(),1);assert.equal((await bitmap()).opaque,true);await page.locator('#chatClose').click();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify({samples:samples.length,nativeHoverStable:true,liveAnimations:true,stableGlassPixels:true,stableComposerPixels:true,fingerSheen:true,bitmap:frozen,surface:original,errors},null,2));
 console.log('PASS: frosted bitmap unchanged, editor pixels stable, finger sheen preserved; live touch sweeps in both directions, retained hover, stable glass pixels with running glow, no accidental activation/refresh, editing and closing.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
