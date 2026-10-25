const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{clearTimeout(_sfatTimer);_sfatTimer=null;_popAratat=true;document.querySelectorAll('video').forEach(v=>v.pause());});
 const evidence=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-compact-messages-20261025');fs.mkdirSync(evidence,{recursive:true});
 const results=[];
 for(const width of [320,360,412,430]){
  await page.setViewportSize({width,height:915});
  await page.evaluate(()=>{
   document.getElementById('stEt').textContent='Moreni';document.getElementById('stKind').textContent='Vremea acum';
   document.getElementById('stIco').textContent='🌦️';document.getElementById('stText').innerHTML='<b>19°C</b>, cer parțial noros. Averse posibile în următoarea oră.';
   MeteoMessages.open(document.getElementById('sfatToast'));
  });
  await page.waitForFunction(()=>document.getElementById('sfatToast').dataset.messageState==='open');
  const weather=await page.locator('#sfatToast .st-card').evaluate(card=>{
   const box=card.getBoundingClientRect(),text=card.querySelector('.st-text').getBoundingClientRect(),close=card.querySelector('.st-x').getBoundingClientRect();
   return {height:box.height,left:box.left,right:box.right,textRight:text.right,closeLeft:close.left,closeWidth:close.width,textClipped:card.querySelector('.st-text').scrollHeight>card.querySelector('.st-text').clientHeight+1};
  });
  assert.ok(weather.left>=0&&weather.right<=width+1,'weather toast stays in viewport');
  assert.ok(weather.height<=(width>=360?105:125),'weather advice is compact at '+width+': '+weather.height);
  assert.ok(weather.textRight<=weather.closeLeft+1,'text cannot overlap dismiss target');
  assert.equal(weather.closeWidth,44,'dismiss target remains touch friendly');assert.equal(weather.textClipped,false);
  if(width===412)await page.screenshot({path:path.join(evidence,'compact-weather.png')});
  await page.locator('#sfatToast .st-x').tap();
  await page.waitForFunction(()=>!document.getElementById('sfatToast').classList.contains('vizibil'));
  await page.evaluate(()=>MeteoMessages.notify('Locația a fost actualizată.',{title:'Locația ta',icon:'📍',duration:60000}));
  await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
  const notice=await page.locator('#appNotice .st-card').boundingBox();assert.ok(notice.height<=85,'short notice stays compact');
  if(width===412)await page.screenshot({path:path.join(evidence,'compact-location.png')});
  await page.locator('#appNotice .st-x').tap();
  results.push({width,weatherHeight:weather.height,noticeHeight:notice.height,fullText:true,touchTarget:44});
 }
 await page.setViewportSize({width:320,height:915});
 const long='Averse torențiale, descărcări electrice și intensificări ale vântului. Evită deplasările în zone expuse și urmărește actualizările avertizării.';
 await page.addStyleTag({content:'html{font-size:24px!important}'});
 await page.evaluate(long=>MeteoMessages.notify(long,{title:'Drobeta-Turnu Severin · Avertizare meteo',icon:'⚠️',duration:60000}),long);
 await page.waitForFunction(()=>document.getElementById('appNotice')?.dataset.messageState==='open');
 const enlarged=await page.locator('#appNotice .st-card').evaluate(card=>{
  const text=card.querySelector('.st-text'),r=card.getBoundingClientRect(),t=text.getBoundingClientRect();
  return {height:r.height,clipped:text.scrollHeight>text.clientHeight+1,inside:t.bottom<=r.bottom,scroll:card.scrollWidth>card.clientWidth+1};
 });
 assert.equal(enlarged.clipped,false);assert.equal(enlarged.inside,true);assert.equal(enlarged.scroll,false);
 assert.equal(await page.locator('#appNotice .st-text').textContent(),long,'warning is not truncated');
 await page.screenshot({path:path.join(evidence,'compact-large-font.png')});
 await page.locator('#appNotice .st-x').tap();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'compact-results.json'),JSON.stringify({version:'2026.10.25.1',results,largeFont:enlarged,javascriptErrors:errors},null,2));
 await context.close();console.log('PASS: compact weather/location messages at 320/360/412/430px; full warnings, large fonts and 44px dismiss targets');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
