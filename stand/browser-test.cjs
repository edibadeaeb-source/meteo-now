const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.STAND_URL || 'http://127.0.0.1:8766';
const artifacts=process.env.STAND_ARTIFACTS;
let testServer, browser;
const archive=require('./station-archive.json');
const snapshot=(state='live',temperature=22)=>{
  const now=Date.now()/1000, stamp=state==='stale'?now-86400:now;
  const channels={};
  for(const key of ['esp','lora']){
    const history=Array.from({length:15},(_,i)=>({timestamp:stamp-(14-i)*10,temperature:temperature+i/30,humidity:48+i/10,pressure:1012+i/20,gas:120+i,iaq:key==='esp'?45:null,rssi:-72,snr:8.5}));
    channels[key]={history,current:history.at(-1),state,error:null};
  }
  return {app:'METEO-NOW-STAND',generatedAt:now,channels,archive};
};
(async()=>{
  if(process.env.STAND_START_SERVER==='1'){
    testServer=require('node:child_process').spawn(process.env.STAND_PYTHON || 'python',[path.join(__dirname,'server.py'),'--port',new URL(url).port],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let stderr='';testServer.stderr.on('data',chunk=>stderr+=chunk);
    process.on('exit',()=>testServer?.kill());
    let ready=false;
    for(let i=0;i<40;i++){if(testServer.exitCode!==null)throw new Error('Test server exited: '+stderr);try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}
    if(!ready)throw new Error('Test server did not become ready: '+stderr);
  }
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=await chromium.launch({headless:true,executablePath:process.env.STAND_BROWSER || (fs.existsSync(edge)?edge:undefined)});
  const context=await browser.newContext({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const external=[];page.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
  const mockedTiles=[];
  await page.route('https://tile.openstreetmap.org/**',async route=>{mockedTiles.push(route.request().url());await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"></svg>'});});
  let fixture=snapshot('stale'), fail=false;
  const chatCalls=[];
  let chatError=false;
  await page.route('**/api/chat',async route=>{
    chatCalls.push(route.request().postDataJSON());
    if(chatError)await route.fulfill({status:429,json:{error:'Limită temporară de test.'}});
    else await route.fulfill({json:{answer:'Wi-Fi și LoRaWAN sunt cele două trasee de transmisie ale stației.'}});
  });
  await page.route('**/api/station',async route=>{if(fail) await route.abort();else await route.fulfill({json:fixture});});
  const refresh=()=>page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.goto(url);await page.locator('#espState').filter({hasText:'Date vechi'}).waitFor();
  assert.match(await page.locator('#espCaption').innerText(),/nu trimite date recente/);
  assert.equal(await page.locator('#freshCount').innerText(),'0 / 2');
  assert.equal(await page.locator('#demoButton,#demoControls').count(),0);
  assert.match(await page.locator('.stand-location').innerText(),/Constantin Carabella.*Târgoviște/);
  assert.equal(await page.locator('#chartTemperature .point').count(),60,'archive remains visible with old readings');
  fixture=snapshot();await refresh();
  await page.locator('#espState').filter({hasText:'Date recente'}).waitFor();
  assert.equal(await page.locator('#freshCount').innerText(),'2 / 2');
  assert.ok(await page.locator('#espHumidityDial').getAttribute('aria-valuenow'));
  assert.ok(await page.locator('#loraTemperature').isVisible());
  assert.ok(await page.locator('#espIaq').isVisible());
  assert.equal(await page.locator('#loraIaq').count(),0,'LoRa does not invent IAQ');
  assert.equal(await page.locator('[data-sensor]').count(),0,'both sources visible without switches');
  for(const id of ['chartTemperature','chartHumidity','chartPressure','chartGas']){
    assert.match(await page.locator('#'+id).getAttribute('aria-label'),/90 puncte/);
  }
  for(const [value,bucket] of [[5,'cold'],[15,'cool'],[23,'mild'],[29,'warm'],[38,'hot']]){
    fixture=snapshot('live',value);await refresh();
    await page.waitForFunction(bucket=>document.querySelector('#espCard').dataset.thermal===bucket,bucket);
    assert.equal(await page.locator('#espCard').getAttribute('data-thermal'),bucket);
    assert.equal(await page.locator('#loraCard').getAttribute('data-thermal'),bucket);
  }
  for(const i of [1,2,3]){await page.locator(`[data-step="${i}"]`).click();assert.ok((await page.locator('#stepExplanation').innerText()).length>100);}
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportButton').click();const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/MASURATORI/);
  const content=await fs.promises.readFile(await download.path(),'utf8');assert.match(content,/ISTORIC;esp/);assert.match(content,/MASURAT;lora/);
  fixture=snapshot();await refresh();
  for(const series of await page.locator('#chartTemperature .plot').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')))){
    assert.equal(series.match(/M/g).length,2,'no line connecting July to the current session');
  }
  await page.locator('[data-step="0"]').click();
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1440,1080],[1366,768],[1024,768],[768,1024],[412,915],[320,740]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(80);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,`horizontal overflow at ${width}`);
    assert.ok(await page.locator('.shell').evaluate(el=>el.getBoundingClientRect().width>=innerWidth*.98),'dashboard should fill window width');
    for(const selector of ['#espTemperature','#loraTemperature','#espState','#loraState','.stand-location','#exportButton'])assert.ok(await page.locator(selector).isVisible());
    layouts.push({width,height,overflow});
    if(artifacts && [1440,1366,412].includes(width)){fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,`stand-${width}.png`),fullPage:true});}
    await page.locator('#themeButton').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`dark overflow at ${width}`);
    if(artifacts&&width===1440)await page.screenshot({path:path.join(artifacts,'stand-dark-full.png'),fullPage:true});
    await page.locator('#themeButton').click();
  }
  await page.setViewportSize({width:1440,height:1080});
  await page.locator('.venue-section').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-map-sensor]').count(),2);
  for(const sensor of ['esp','lora'])assert.ok(await page.locator(`[data-map-sensor="${sensor}"]`).isVisible());
  await page.locator('[data-map-sensor="esp"]').click();assert.match(await page.locator('#mapDeviceName').innerText(),/ESP32-C6/);assert.match(await page.locator('#mapDeviceReadings').innerText(),/Indice aer/);
  await page.locator('[data-map-sensor="lora"]').click();assert.match(await page.locator('#mapDeviceName').innerText(),/SparkFun/);assert.match(await page.locator('#mapDeviceReadings').innerText(),/Semnal radio/);assert.doesNotMatch(await page.locator('#mapDeviceReadings').innerText(),/Indice aer/);
  fixture=snapshot('live',29);await refresh();await page.waitForFunction(()=>document.querySelector('#mapDeviceReadings').textContent.includes('29,'));await page.locator('.venue-section').scrollIntoViewIfNeeded();assert.match(await page.locator('#mapDeviceReadings').innerText(),/29,/);
  const initialZoom=await page.evaluate(()=>window.StandVenueMap.getZoom());await page.locator('#mapZoomIn').click();await page.waitForFunction(z=>window.StandVenueMap.getZoom()>z,initialZoom);await page.locator('#mapReset').click();assert.equal(await page.evaluate(()=>window.StandVenueMap.getZoom()),17);await page.waitForFunction(()=>document.querySelectorAll('.leaflet-popup').length===0);
  await page.waitForFunction(()=>document.getElementById('appQr').complete&&document.getElementById('appQr').naturalWidth>0);
  if(artifacts){await page.locator('.venue-section').screenshot({path:path.join(artifacts,'venue-light.png')});await page.locator('#appQr').screenshot({path:path.join(artifacts,'qr-rendered-light.png')});}
  await page.locator('#themeButton').click();assert.equal(await page.evaluate(()=>localStorage.getItem('meteo-stand-theme')),'dark');
  const persisted=await page.context().newPage();await persisted.route('**/api/station',r=>r.fulfill({json:snapshot()}));await persisted.goto(url);assert.equal(await persisted.locator('html').getAttribute('data-theme'),'dark');await persisted.close();
  await page.locator('.venue-section').scrollIntoViewIfNeeded();
  if(artifacts){await page.locator('.venue-section').screenshot({path:path.join(artifacts,'venue-dark.png')});await page.locator('#appQr').screenshot({path:path.join(artifacts,'qr-rendered-dark.png')});}
  await page.context().setOffline(true);await page.locator('[data-map-sensor="esp"]').click();assert.match(await page.locator('#mapDeviceName').innerText(),/ESP32/);assert.ok(await page.locator('#appQr').evaluate(el=>el.complete&&el.naturalWidth>0));await page.context().setOffline(false);
  await page.locator('#themeButton').click();fixture=snapshot();await refresh();
  const strokes=await page.locator('[data-plot] .plot').evaluateAll(paths=>paths.map(p=>p.getAttribute('stroke')));for(const color of ['#d6473c','#2375ca','#178747'])assert.ok(strokes.includes(color));
  assert.match(await page.locator('#appQr').getAttribute('alt'),/https:\/\/meteo-now.onrender.com\//);
  await page.evaluate(()=>scrollTo(0,0));
  assert.ok(await page.locator('.metric strong').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=39));
  await page.locator('#fullscreenButton').click();
  await page.waitForFunction(()=>!!document.fullscreenElement);
  if(artifacts)await page.screenshot({path:path.join(artifacts,'stand-preview.png')});
  await page.locator('#chatLauncher').click();
  assert.ok(await page.locator('#chatInput').evaluate(el=>el===document.activeElement));
  if(artifacts)await page.screenshot({path:path.join(artifacts,'stand-ai-preview.png')});
  await page.locator('[data-question]').first().click();
  await page.locator('.chat-message.assistant').filter({hasText:'Wi-Fi și LoRaWAN'}).waitFor();
  assert.equal(chatCalls.length,1);assert.ok(chatCalls[0].sensors.esp.current);assert.ok(chatCalls[0].sensors.lora.current);
  await page.locator('#chatInput').fill('De ce diferă valorile?');await page.locator('#chatSend').click();
  await page.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant').length===3);
  assert.equal(chatCalls[1].history.length,2,'conversation history should accompany follow-up');
  await page.locator('#chatReset').click();assert.equal(await page.locator('.chat-message').count(),1);
  chatError=true;await page.locator('#chatInput').fill('Altă întrebare');await page.locator('#chatSend').click();await page.locator('.chat-message.error').filter({hasText:'Limită temporară'}).waitFor();chatError=false;
  const chatCount=chatCalls.length;await page.context().setOffline(true);await page.locator('#chatInput').fill('Întrebare offline');await page.locator('#chatSend').click();assert.match(await page.locator('#chatFeedback').innerText(),/nevoie de internet/);assert.equal(chatCalls.length,chatCount);await page.context().setOffline(false);
  await page.keyboard.press('Escape');assert.ok(await page.locator('#chatPanel').isHidden());
  await page.setViewportSize({width:320,height:740});await page.locator('#chatLauncher').click();
  const chatBounds=await page.locator('#chatPanel').boundingBox();assert.ok(chatBounds.x>=0&&chatBounds.y>=0&&chatBounds.x+chatBounds.width<=321&&chatBounds.y+chatBounds.height<=740);
  await page.locator('#chatClose').click();await page.setViewportSize({width:1440,height:1080});
  await page.locator('#fullscreenButton').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.step-icon').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  assert.ok(await page.locator('.metric>span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
  fixture=snapshot();await refresh();await page.locator('#espState').filter({hasText:'Date recente'}).waitFor();
  assert.match(await page.locator('#notice').innerText(),/Date recente pe ambele/);
  assert.equal(await page.locator('#freshCount').innerText(),'2 / 2');
  // A local-server outage must not leave a previously successful "live" badge.
  fail=true;await refresh();await page.locator('#espState').filter({hasText:'Fără conexiune'}).waitFor();
  assert.notEqual(await page.locator('#espTemperature').innerText(),'—');
  assert.match(await page.locator('#notice').innerText(),/indisponibilă/);
  fail=false;fixture=snapshot();await refresh();await page.locator('#espState').filter({hasText:'Date recente'}).waitFor();
  // Invalid sample time never creates a live badge.
  fixture=snapshot();fixture.channels.esp.current.timestamp=null;
  await refresh();await page.locator('#espState').filter({hasText:'Oră nevalidată'}).waitFor();
  fixture=snapshot();fixture.channels.esp.current.humidity=0;fixture.channels.lora.current.humidity=100;
  await refresh();await page.waitForFunction(()=>document.getElementById('espHumidityDial').getAttribute('aria-valuenow')==='0');
  assert.equal(await page.locator('#espHumidityArc').getAttribute('stroke-dasharray'),'0 100');
  assert.equal(await page.locator('#loraHumidityArc').getAttribute('stroke-dasharray'),'100 100');
  assert.equal(await page.locator('#espHumidityThumb').getAttribute('hidden'),null);
  fixture=snapshot();fixture.channels.esp.current.humidity=null;
  await refresh();await page.waitForFunction(()=>document.getElementById('espHumidityDial').getAttribute('aria-valuenow')===null);
  assert.ok(await page.locator('#espHumidityThumb').isHidden());
  assert.ok(mockedTiles.length>0,'standard online tile layer should be requested after map appears');
  assert.equal(external.filter(url=>!url.startsWith('https://tile.openstreetmap.org/')).length,0,'only the documented map tile provider is allowed');assert.deepEqual(errors,[]);
  await browser.close();
  const report={passed:true,layouts,jsErrors:errors,unexpectedExternalRequests:external.filter(url=>!url.startsWith('https://tile.openstreetmap.org/')).length,mockedMapTileRequests:mockedTiles.length,realMapTileDownloads:0,realAiRequests:0,checks:['standard Leaflet map with mocked tiles','light and dark themes at every size','theme persistence','both map pins visible by default','map parameters and live updates','map zoom/reset','offline map fallback and QR','red green and blue plot series','humidity gauges at zero and 100 percent','missing readings have no gauge needle','fresh-source counter excludes stale data','full-width layout','larger metric typography','station chatbot open/close','chat snapshot for both sources','chat conversation and reset','chat limit errors','chat offline','chat at 320px','both stations simultaneously','four comparative plots','five temperature color bands','readable metric labels','stale labels','live labels','historical and live points in the same plots','chart lines break across gaps','venue in the header','CSV provenance','no invented LoRa IAQ','explanations','no overflow','reduced motion','outage and recovery','invalid time']};
  if(artifacts)fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  testServer?.kill();
})().catch(async e=>{console.error(e);await browser?.close();testServer?.kill();process.exitCode=1;});
