const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.addStyleTag({content:'#mobCer *,#mobStele *{animation-play-state:paused!important}'});
 await page.evaluate(()=>document.querySelectorAll('video').forEach(v=>v.pause()));
 await page.evaluate(()=>{clearTimeout(_sfatTimer);_sfatTimer=null;_popAratat=true;document.getElementById('setAnimations').checked=true;});
 const evidence=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-widget-toast-20261024');fs.mkdirSync(evidence,{recursive:true});
 const results=[];
 for(const width of [320,412,430]){
  await page.setViewportSize({width,height:915});
  const before=await page.locator('#mbTemp').boundingBox();
  await page.evaluate(()=>MeteoMessages.notify('Mesaj de test pentru animația din METEO NOW.',{title:'Moreni',icon:'🌧️',duration:60000}));
  await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='opening');
  if(width===412){
   await page.waitForTimeout(80);await page.screenshot({path:path.join(evidence,'message-circle.png')});
   await page.waitForTimeout(240);await page.screenshot({path:path.join(evidence,'message-expanding.png')});
  }
  await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
  const rect=await page.locator('#appNotice').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'message fits viewport');
  const after=await page.locator('#mbTemp').boundingBox();assert.equal(after.y,before.y,'message must not move weather content');
  if(width===412)await page.screenshot({path:path.join(evidence,'message-open.png')});
  await page.locator('#appNotice .st-x').tap();
  assert.equal(await page.locator('#appNotice').getAttribute('data-message-state'),'closing');
  await page.waitForFunction(()=>!document.getElementById('appNotice')?.hasAttribute('data-message-state'));
  assert.equal(await page.locator('#appNotice').isVisible(),false);
  results.push({width,openClose:true,noLayoutShift:true});
 }
 await page.evaluate(()=>{MeteoMessages.notify('Primul mesaj',{duration:800});});await page.waitForTimeout(250);
 await page.evaluate(()=>{MeteoMessages.notify('Mesajul nou',{duration:4000});});await page.waitForTimeout(900);
 assert.equal(await page.locator('#appNotice .st-text').textContent(),'Mesajul nou');
 assert.equal(await page.locator('#appNotice').getAttribute('data-message-state'),'open','old timer cannot close new message');
 await page.keyboard.press('Escape');await page.waitForTimeout(430);
 await page.evaluate(()=>document.getElementById('settingsBtn').click());
 await page.evaluate(()=>{const notify=MeteoMessages.notify;MeteoMessages.notify=(text,options)=>notify(text,{...options,duration:60000});pushNote('Confirmare <img src=x onerror=alert(1)>','var(--green)');});
 await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
 assert.equal(await page.locator('#settingsSheet #appNotice').count(),1,'settings notice stays inside modal isolation');
 assert.equal(await page.locator('#appNotice img').count(),0,'message content remains text');
 assert.equal(await page.locator('#appNotice').evaluate(el=>el.inert),false,'modal notice must not inherit background inert state');
 await page.locator('#appNotice .st-x').tap();
 await page.waitForFunction(()=>!document.getElementById('appNotice')?.hasAttribute('data-message-state'));
 await page.evaluate(()=>document.getElementById('settingsClose').click());
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>mobMesajLoc('Locația se actualizează.'));
 await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
 assert.equal(await page.locator('#appNotice .st-card').evaluate(el=>el.getAnimations().length),0);
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{document.getElementById('setAnimations').checked=false;MeteoMessages.notify('Fără animații');});
 await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
 assert.equal(await page.locator('#appNotice .st-card').evaluate(el=>el.getAnimations().length),0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({version:'2026.10.24.1',results,repeatedMessages:true,settingsIsolation:true,reducedMotion:true,animationsToggle:true,javascriptErrors:errors},null,2));
 await context.close();console.log('PASS: circle/capsule animation at 320/412/430px; dismissal, replacement, settings isolation, reduced motion and animation toggle');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
