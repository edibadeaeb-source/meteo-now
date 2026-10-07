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
 assert.equal(await page.locator('#chatWindow').getAttribute('aria-hidden'),'false');
 assert.equal(await page.locator('#mobApp').evaluate(e=>e.hasAttribute('inert')),true,'background cannot be touched');
 const send=async q=>{await page.locator('#chatInput').fill(q);await page.locator('#chatSend').click();};
 await send('Plouă azi?');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Plouă azi?'));
 console.log('First AI answer received');
 assert.equal(requests.length,1);assert.equal(requests[0].locatie.nume,loc.nume);assert.equal(requests[0].vremea.curent.temperatura_c,28);
 await page.locator('#chatClose').click();
 assert.equal(await page.locator('#mobApp').evaluate(e=>e.hasAttribute('inert')),false);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MOBD&&window.MeteoChat);await show();
 assert.ok((await page.locator('#chatMessages').textContent()).includes('Răspuns pentru Plouă azi?'),'history survives page/app restart');
 console.log('AI history restored after restart');
 await send('Dar mâine?');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Dar mâine?'));
 assert.equal(requests[1].history.length,2);assert.equal(requests[1].history[0].text,'Plouă azi?');
 await page.locator('#chatNew').click();await send('Răspuns lent');await page.waitForFunction(()=>document.querySelector('.chat-msg.typing'));
 const slowId=await page.evaluate(()=>MeteoConversations.active().id);
 await page.locator('#chatNew').click();await send('Altă discuție');await page.waitForFunction(()=>document.getElementById('chatMessages').textContent.includes('Răspuns pentru Altă discuție'));
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
   const home=await page.evaluate(()=>{const r=document.getElementById('chatHomeTitle').getBoundingClientRect(),main=document.getElementById('chatMain').getBoundingClientRect();return{top:r.top,bottom:r.bottom,mainTop:main.top,mainBottom:main.bottom};});
   assert.ok(home.top>=home.mainTop-1&&home.bottom<=home.mainBottom+1,'welcome heading stays visible '+width);
   if([320,412,1280].includes(width))await page.screenshot({path:path.join(shots,'ai-home-'+width+'.png')});
 }
 await page.setViewportSize({width:412,height:915});
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
 console.log('AI browser passed: restart, fresh weather, conversation history, delayed replies, deletion, keyboard/accessibility, RO/EN and six screen sizes');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(fixture,module);m.filename=fixture;m.paths=Module._nodeModulePaths(path.dirname(fixture));m._compile(prefix+checks,fixture);
