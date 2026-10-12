const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=path.join(__dirname,'weather-browser.cjs'),prefix=fs.readFileSync(fixture,'utf8').split(' // A tap used to')[0]
 .replace('deviceScaleFactor:2','deviceScaleFactor:1')
 .replace("await page.goto(base,", "await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base,");
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.evaluate(()=>document.querySelectorAll('video').forEach(v=>v.pause()));
 console.log('AI browser ready');
 let requests=[],lateReply;
 await page.route('**/ask',async route=>{
   const body=route.request().postDataJSON();requests.push(body);
   if(body.question==='Răspuns lent')await new Promise(r=>lateReply=r);
   await route.fulfill({json:{answer:'Răspuns pentru '+body.question,model:'claude-sonnet-5-5'}});
 });
 const show=()=>page.locator('#chatFab').click();
 await show();assert.equal(await page.locator('#chatHome').isVisible(),true);
 console.log('AI home opened');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overscrollBehavior),'none','AI disables browser edge navigation');
 const backgroundRetry=await page.locator('#chatTalkTab').evaluate(e=>{const o=new MutationObserver(()=>{});o.observe(document.getElementById('mobCer'),{attributes:true,attributeFilter:['data-motion','data-video']});e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));const changes=o.takeRecords().map(r=>r.attributeName);o.disconnect();return changes;});
 assert.deepEqual(backgroundRetry,[],'AI finger release cannot restart weather/autoplay behind the glass');
 assert.equal(await page.locator('#chatWindow').getAttribute('aria-hidden'),'false');
 assert.equal(await page.locator('#mobApp').evaluate(e=>e.hasAttribute('inert')),true,'background cannot be touched');
 // Exercise the actual global pull handler as well as chat touch isolation.
 await page.evaluate(()=>{
   window.aiRefreshCalls=[];window.aiRefreshOriginals={};
   ['fetchWeather','loadSynopStations','refreshWarnings','loadFlood','loadPrecip','refreshRadarFrames'].forEach(name=>{
     aiRefreshOriginals[name]=window[name];window[name]=()=>aiRefreshCalls.push(name);
   });
   window.aiTouch=(target,type,y=150,count=1)=>{
     const touch=new Touch({identifier:1,target,clientX:200,clientY:y});
     const fingers=Array.from({length:count},(_,i)=>new Touch({identifier:i+1,target,clientX:200+i*20,clientY:y}));
     target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:/end|cancel/.test(type)?[]:fingers,changedTouches:[touch]}));
   };
   window.aiPull=target=>{aiTouch(target,'touchstart',150);aiTouch(target,'touchmove',310);aiTouch(target,'touchend',310);};
   window.aiScrollBefore=scrollY;
   ['.chat-header','#chatMain','#chatInput','#chatBackdrop'].forEach(sel=>aiPull(document.querySelector(sel)));
   // Direct window events bypass panel stopPropagation and must still be gated.
   aiPull(window);
 });
 assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[],'AI gestures cannot refresh weather');
 assert.equal(await page.evaluate(()=>scrollY),await page.evaluate(()=>aiScrollBefore),'background scroll stays fixed');
 assert.ok((await page.locator('#pullRefresh').getAttribute('style')).includes('-60px'),'refresh indicator stays hidden');
 assert.equal(await page.locator('#chatWindow').evaluate(e=>getComputedStyle(e).touchAction),'pan-x pan-y','panel allows internal scrolling without page pinch zoom');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-idle'),'true');
 assert.equal(await page.locator('.ai-ambient-glow').evaluate(e=>getComputedStyle(e).opacity),'0','reduced motion hides moving reflections');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-composer-idle'),'true');

 assert.equal(await page.locator('.ai-ambient-glow').evaluate(e=>getComputedStyle(e.querySelector('rect')).animationName),'none','reduced motion disables edge lighting');
 await page.locator('#chatInput').fill(' ');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-idle'),'false','glow fades with the first typed character');
 assert.equal(await page.locator('.ai-ambient-glow').evaluate(e=>getComputedStyle(e).opacity),'0');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-composer-idle'),'false');
 assert.equal(await page.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('#chatInput').evaluate(e=>getComputedStyle(e,'::placeholder').textShadow),'none');
 await page.locator('#chatInput').fill('');assert.equal(await page.locator('#chatWindow').getAttribute('data-idle'),'true');
 // A real upward swipe must still scroll a long chat, without moving the page.
 await page.evaluate(()=>{const filler=document.createElement('div');filler.id='aiScrollProbe';filler.style.cssText='height:1800px;flex-shrink:0';chatMain.append(filler);chatMain.scrollTop=0;});
 const area=await page.locator('#chatMain').boundingBox();
 await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:210,y:area.y+area.height-20}]});
 for(let i=1;i<=5;i++){await cdpCity.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:210,y:area.y+area.height-20-i*30}]});await page.waitForTimeout(35);}
 await cdpCity.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>chatMain.scrollTop>30);
 assert.equal(await page.evaluate(()=>scrollY),await page.evaluate(()=>aiScrollBefore));
 assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[]);
 await page.evaluate(()=>{document.getElementById('aiScrollProbe').remove();chatMain.scrollTop=0;});
 await page.locator('#chatHistoryTab').click();await page.evaluate(()=>aiPull(document.getElementById('chatArchive')));
 assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[]);
 assert.equal(await page.locator('#chatWindow').getAttribute('data-idle'),'true','white reflection covers history too when not drafting');
 await page.locator('#chatTalkTab').click();await page.locator('#chatClose').click();
 // Opening and closing AI midway through a weather pull must cancel the gesture.
 await page.evaluate(()=>{aiTouch(window,'touchstart',150);aiTouch(window,'touchmove',310);});
 await show();await page.locator('#chatClose').click();
 await page.evaluate(()=>aiTouch(window,'touchend',310));assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[]);
 await page.evaluate(()=>{aiTouch(window,'touchstart',150);aiTouch(window,'touchmove',310);aiTouch(window,'touchcancel',310);aiTouch(window,'touchend',310);});
 assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[],'canceled touches cannot refresh');
 await page.evaluate(()=>{aiTouch(window,'touchstart',150);aiTouch(window,'touchmove',310,2);aiTouch(window,'touchend',310);});
 assert.deepEqual(await page.evaluate(()=>aiRefreshCalls),[],'pinching cannot refresh');
 await page.evaluate(()=>aiPull(window));
 assert.equal(await page.evaluate(()=>aiRefreshCalls.length),6,'weather pull works again after closing AI');
 await page.evaluate(()=>{Object.assign(window,aiRefreshOriginals);});await show();
 console.log('AI gestures isolated; native chat scrolling, canceled/mid-open gestures, restored weather refresh and idle glow passed');
 const send=async q=>{await page.locator('#chatInput').fill(q);await page.locator('#chatSend').click();};
 await send('Plouă azi?');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Plouă azi?'));
 console.log('First AI answer received');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-idle'),'true','white reflection covers ongoing conversations');
 assert.equal(await page.locator('#chatWindow').getAttribute('data-composer-idle'),'true','empty composer glows in an ongoing conversation too');
 assert.equal(requests.length,1);assert.equal(requests[0].locatie.nume,loc.nume);assert.equal(requests[0].vremea.curent.temperatura_c,28);
 const background=async()=>{await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(50);assert.equal(await page.locator('#chatWindow').getAttribute('aria-hidden'),'true');assert.equal(await page.evaluate(()=>MeteoConversations.active()),null);assert.equal(await page.locator('#mobApp').evaluate(e=>e.hasAttribute('inert')),false);await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('#chatWindow').getAttribute('aria-hidden'),'true','resume stays on weather');};
 await background();await show();assert.equal(await page.locator('#chatHome').isVisible(),true,'retained Android tab returns to AI landing screen');await page.locator('#chatClose').click();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MOBD&&window.MeteoChat);await show();
 assert.equal(await page.locator('#chatHome').isVisible(),true,'fresh restart does not reopen a conversation');assert.equal(await page.locator('#chatMessages').isVisible(),false);
 await page.locator('#chatHistoryTab').click();await page.locator('.ai-history-open').filter({hasText:'Plouă azi?'}).click();
 assert.ok((await page.locator('#chatMessages').textContent()).includes('Răspuns pentru Plouă azi?'),'saved history can be reopened manually');
 console.log('AI restart and resume keep history without reopening it');
 await send('Dar mâine?');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Dar mâine?'));
 assert.equal(requests[1].history.length,2);assert.equal(requests[1].history[0].text,'Plouă azi?');
 await page.locator('#chatNew').click();await send('Răspuns lent');await page.waitForFunction(()=>document.querySelector('.chat-msg.typing'));
 const slowId=await page.evaluate(()=>MeteoConversations.active().id);
 await background();await show();assert.equal(await page.locator('#chatHome').isVisible(),true);await send('Altă discuție');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Altă discuție'));
 lateReply();await page.waitForFunction(id=>MeteoConversations.get(id).messages.some(m=>m.role==='model'),slowId);
 console.log('AI replies stayed in their own conversations');
 assert.ok(!(await page.locator('#chatMessages').textContent()).includes('Răspuns lent'),'late reply does not leak into another conversation');
 await page.locator('#chatHistoryTab').click();assert.equal(await page.locator('.ai-history-row').count(),3);
 await page.locator('.ai-history-open').filter({hasText:'Răspuns lent'}).click();
 assert.ok((await page.locator('#chatMessages').textContent()).includes('Răspuns pentru Răspuns lent'));
 await page.locator('#chatHistoryTab').click();
 const firstRow=page.locator('.ai-history-row').first();await firstRow.locator('[data-action="delete"]').click();await firstRow.locator('[data-action="confirm"]').click();
 assert.equal(await page.locator('.ai-history-row').count(),2);
 await page.locator('#chatClose').click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MOBD&&window.MeteoChat);await show();await page.locator('#chatHistoryTab').click();assert.equal(await page.locator('.ai-history-row').count(),2);
 await page.locator('#chatTalkTab').click();await page.locator('#chatNew').click();
 const shots=path.resolve(out,'../ai-interface');fs.mkdirSync(shots,{recursive:true});
 for(const [width,height] of [[320,568],[360,800],[412,915],[430,932],[932,430],[1280,800]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
   const boxes=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return{window:rect('chatWindow'),input:rect('chatInput'),send:rect('chatSend'),vw:innerWidth,vh:innerHeight,overflow:document.getElementById('chatWindow').scrollWidth>document.getElementById('chatWindow').clientWidth};});
   assert.ok(boxes.window.x>=0&&boxes.window.right<=boxes.vw+1,'dialog horizontal fit '+width);
   assert.ok(boxes.window.y>=0&&boxes.window.bottom<=boxes.vh+1,'dialog vertical fit '+width);
   assert.ok(boxes.send.bottom<=boxes.window.bottom&&boxes.input.right<=boxes.window.right,'editor fit '+width);
   assert.equal(boxes.overflow,false,'no horizontal overflow '+width);
   assert.equal(await page.locator('.ai-tabs').evaluate(e=>getComputedStyle(e).touchAction),'pan-y','tabs cannot trigger horizontal browser navigation');
   assert.equal(await page.locator('.chat-suggestions').evaluate(e=>getComputedStyle(e).touchAction),width<=380||height<=700?'pan-x':'pan-y','narrow suggestion rows retain native horizontal scrolling');
   const home=await page.evaluate(()=>{const r=document.getElementById('chatHomeTitle').getBoundingClientRect(),main=document.getElementById('chatMain').getBoundingClientRect();return{top:r.top,bottom:r.bottom,mainTop:main.top,mainBottom:main.bottom};});
   assert.ok(home.top>=home.mainTop-1&&home.bottom<=home.mainBottom+1,'welcome heading stays visible '+width);
   if([320,412,1280].includes(width))await page.screenshot({path:path.join(shots,'ai-home-'+width+'.png')});
 }
 await page.setViewportSize({width:412,height:915});
 const typography=await page.locator('#chatInput').evaluate(e=>{const s=getComputedStyle(e);return{placeholder:e.placeholder,top:parseFloat(s.paddingTop),left:parseFloat(s.paddingLeft),line:parseFloat(s.lineHeight)};});
 assert.ok(typography.placeholder.startsWith('Întreabă-mă'));assert.ok(typography.top>=6&&typography.left>=4&&typography.line>=24,'diacritics have space inside the textarea');
 const suggestionPress=await page.locator('.chat-suggestion').first().evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse'}));return{pressed:e.classList.contains('ai-touch-down'),old:e.classList.contains('presat')};});assert.equal(suggestionPress.pressed,true);assert.equal(suggestionPress.old,false,'AI suggestions use one press animation');await page.evaluate(()=>document.getElementById('chatMain').dispatchEvent(new Event('scroll')));assert.equal(await page.locator('.chat-suggestion').first().evaluate(e=>e.classList.contains('ai-touch-down')),false,'scroll releases button');
 const actualPress=await page.locator('#chatHistoryTab').evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:220,clientY:90}));return{pressed:e.classList.contains('ai-touch-down'),pulse:e.classList.contains('ai-glass-pulse'),animation:getComputedStyle(e,'::before').animationName,transform:getComputedStyle(e).transform};});
 await page.locator('#chatHistoryTab').evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+30,y=r.y+20;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:x+8,clientY:y}));});
 assert.equal(await page.locator('#chatWindow .ai-touch-down').count(),1,'the sheen follows the finger inside the button');
 assert.equal(actualPress.pressed,true);assert.equal(actualPress.pulse,true);assert.equal(actualPress.animation,'none','reduced motion disables shimmer');assert.equal(actualPress.transform,'none');
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel')));await page.waitForTimeout(600);
 assert.equal(await page.locator('#chatHistoryTab').evaluate(e=>e.classList.contains('ai-touch-down')||e.classList.contains('ai-glass-pulse')),false,'cancel releases all press effects');
 await page.locator('#chatWindow').dispatchEvent('touchcancel',{touches:[],changedTouches:[]});
 await page.locator('#chatSend').dispatchEvent('pointerdown',{pointerType:'touch'});assert.equal(await page.locator('#chatSend').evaluate(e=>e.classList.contains('ai-glass-pulse')),false,'disabled send does not animate');
 // Isolate the short animation from headless software rendering of weather videos.
 const motionPage=await context.newPage();await motionPage.goto(base+'/cache-test');await motionPage.emulateMedia({reducedMotion:'no-preference'});
 const realButtonHandlers=fs.readFileSync(path.join(root,'index.html'),'utf8').split('var pressedChatButton=null;')[1].split('function addMessage(text, isUser)')[0];
 const markup=await page.locator('#chatWindow').evaluate(e=>e.outerHTML);
 await motionPage.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#18243e;font-family:Inter,system-ui,sans-serif}#chatWindow{position:fixed;overflow:hidden;height:880px;max-height:none;display:flex;flex-direction:column;margin:12px}.chat-messages{display:flex;flex-direction:column}</style><link rel="stylesheet" href="'+base+'/weather-ai.css">'+markup);
 await motionPage.addScriptTag({content:"var chatWindow=document.getElementById('chatWindow');var pressedChatButton=null;"+realButtonHandlers});

 const glass=await motionPage.locator('#chatHistoryTab').evaluate(e=>{e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:220,clientY:90}));return{pressed:e.classList.contains('ai-touch-down'),transform:getComputedStyle(e).transform,before:getComputedStyle(e,'::before').animationName,after:getComputedStyle(e,'::after').animationName};});
 assert.equal(glass.pressed,true);assert.equal(glass.transform,'none');assert.equal(glass.before,'aiGlassSweep');assert.equal(glass.after,'none');
 const edge=await motionPage.locator('.ai-edge-light').evaluate(e=>({count:e.querySelectorAll('rect').length,fill:getComputedStyle(e.querySelector('rect')).fill,animation:getComputedStyle(e.querySelector('rect')).animationName,pointer:getComputedStyle(e.parentElement).pointerEvents}));
 assert.equal(edge.count,3);assert.equal(edge.fill,'none','edge lighting never fills the panel');assert.equal(edge.animation,'aiEdgeCircuit');assert.equal(edge.pointer,'none');
 assert.equal(await motionPage.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none','real editor has no animated paint');
 assert.equal(await motionPage.locator('#chatPromptGlow').evaluate(e=>getComputedStyle(e).animationName),'aiPromptGlow');
 const phases=await motionPage.locator('.ai-edge-head').evaluate(e=>{const a=e.getAnimations()[0];a.pause();return[0,1500,3000,4500].map(t=>{a.currentTime=t;return parseFloat(getComputedStyle(e).strokeDashoffset);});});
 assert.deepEqual(phases,[0,-25,-50,-75],'light travels around the perimeter');
 const prompt=await motionPage.locator('#chatPromptGlow').evaluate(e=>{const a=e.getAnimations()[0];a.pause();return[0,1400].map(t=>{a.currentTime=t;return getComputedStyle(e).opacity;});});
 assert.notEqual(prompt[0],prompt[1],'separate prompt glow pulses while the editor stays stable');
 await motionPage.screenshot({path:path.join(shots,'ai-edge-lighting-412.png')});
 await motionPage.locator('#chatWindow').evaluate(e=>e.dataset.composerIdle='false');
 assert.equal(await motionPage.locator('#chatPromptGlow').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await motionPage.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none');
 await motionPage.locator('#chatWindow').evaluate(e=>e.dataset.composerIdle='true');
 await motionPage.locator('#chatWindow').evaluate(e=>e.dataset.idle='false');
 assert.equal(await motionPage.locator('.ai-edge-head').evaluate(e=>getComputedStyle(e).animationName),'none','typing stops edge lighting');
 await motionPage.locator('#chatWindow').evaluate(e=>{e.dataset.idle='true';e.classList.remove('open');});
 assert.equal(await motionPage.locator('.ai-edge-head').evaluate(e=>getComputedStyle(e).animationName),'none','closed AI consumes no edge animation');
 assert.equal(await motionPage.locator('#chatInput').evaluate(e=>getComputedStyle(e).animationName),'none','closed composer consumes no prompt animation');
 await motionPage.locator('#chatWindow').evaluate(e=>e.classList.add('open'));
 await motionPage.screenshot({path:path.join(shots,'ai-glass-press-412.png')});await motionPage.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup')));await motionPage.waitForTimeout(600);
 assert.equal(await motionPage.locator('#chatHistoryTab').evaluate(e=>e.classList.contains('ai-touch-down')||e.classList.contains('ai-glass-pulse')),false);await motionPage.close();await page.bringToFront();if(await page.locator('#chatWindow').getAttribute('aria-hidden')==='true')await show();
 await page.evaluate(()=>{window.realChatViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:350,offsetTop:0}});window.dispatchEvent(new Event('resize'));});
 assert.equal(await page.locator('#chatWindow').getAttribute('data-keyboard'),'true');
 const keyboardFit=await page.evaluate(()=>{const dialog=document.getElementById('chatWindow').getBoundingClientRect(),send=document.getElementById('chatSend').getBoundingClientRect();return send.bottom<=dialog.bottom&&dialog.bottom<=350;});assert.equal(keyboardFit,true,'keyboard keeps send button in view');
 await page.evaluate(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:realChatViewport});window.dispatchEvent(new Event('resize'));});
 await page.locator('#chatNew').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'chatInput','focus stays in the dialog');
 await page.evaluate(()=>aplicaLimba('en'));assert.equal(await page.locator('#chatHistoryTab').textContent(),'Conversations');
 await page.locator('#chatInput').fill('<img src=x onerror=alert(1)>');await page.locator('#chatSend').click();await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru <img'));
 assert.equal(await page.locator('#chatMessages img').count(),0,'messages are plain text');
 await page.screenshot({path:path.join(shots,'ai-conversation-412.png')});
 await page.locator('#chatClose').click();await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>_nrPanouri),0,'switching AI tabs cannot leak background scroll locks');
 assert.deepEqual(errors,[]);
 console.log('AI browser passed: restart/resume landing screen, liquid glass/reduced motion, placeholder diacritics, fresh weather, conversation history, delayed replies, deletion, keyboard/accessibility, RO/EN and six screen sizes');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
