const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url='http://127.0.0.1:8878',artifacts=process.env.STAND_ARTIFACTS;
const stamp=Math.floor(Date.now()/1000);
const values={temperature:[0,21.7,27.4],humidity:[0,48.2,65.9],pressure:[1000,1012.3,1015.6],gas:[0,45.6,105.9]};
const units={temperature:'°C',humidity:'%',pressure:'hPa',gas:'kΩ'};
let server,browser;
function fixture(age=0,empty=false){
  const channels={};for(const key of ['esp','lora']){
    const history=empty?[]:[0,1,2].map(i=>({timestamp:stamp-age-(2-i)*60,...Object.fromEntries(Object.entries(values).map(([metric,rows])=>[metric,rows[i]+(key==='lora'?1:0)])),iaq:key==='esp'?45:null,rssi:-72,snr:8.5}));
    channels[key]={history,current:history.at(-1)||null,error:null};
  }return {app:'METEO-NOW-STAND',channels};
}
async function pointCenter(page,metric,index){
  const svg=page.locator(`[data-plot="${metric}"]`);await svg.scrollIntoViewIfNeeded();
  return svg.locator('.point').nth(index).evaluate(point=>{const r=point.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
}
(async()=>{
  server=require('node:child_process').spawn(process.env.STAND_PYTHON||'python',[path.join(__dirname,'server.py'),'--port','8878'],{windowsHide:true,stdio:'ignore'});
  process.on('exit',()=>server?.kill());
  let ready=false;for(let i=0;i<40;i++){try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready);
  browser=await chromium.launch({headless:true,executablePath:process.env.STAND_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));let data=fixture();
  await context.route('**/api/station',route=>route.fulfill({json:data}));
  await context.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'}));
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('#chartTemperature .point').length===6);
  for(const metric of Object.keys(values)){
    const point=await pointCenter(page,metric,1),tip=page.locator(`[data-plot="${metric}"]`).locator('..').locator('.chart-tooltip');
    await page.mouse.move(point.x+7,point.y+5);await tip.waitFor({state:'visible'});
    assert.equal(await tip.locator('.tooltip-value').innerText(),`${values[metric][1].toLocaleString('ro-RO',{minimumFractionDigits:1,maximumFractionDigits:1})} ${units[metric]}`);
    assert.match(await tip.locator('.tooltip-source').innerText(),/ESP32-C6/);
    assert.equal(await tip.locator('time').getAttribute('datetime'),new Date((stamp-60)*1000).toISOString());
    await page.mouse.move(0,0);assert.ok(await tip.isHidden());
    const svg=page.locator(`[data-plot="${metric}"]`);await svg.focus();await page.keyboard.press('Home');await tip.waitFor({state:'visible'});
    assert.equal(await tip.locator('.tooltip-value').innerText(),`${values[metric][0].toLocaleString('ro-RO',{minimumFractionDigits:1,maximumFractionDigits:1})} ${units[metric]}`);
    await page.keyboard.press('ArrowDown');assert.match(await tip.locator('.tooltip-source').innerText(),/LoRaWAN/);
    await page.keyboard.press('Escape');assert.ok(await tip.isHidden());
  }
  const layouts=[];
  for(const width of [1920,1366,768,412,320]){
    await page.setViewportSize({width,height:915});
    for(const theme of ['light','dark']){
      if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeButton').click();
      const point=await pointCenter(page,'temperature',2);await page.mouse.move(point.x,point.y);
      const tip=page.locator('#chartTemperatureTooltip');await tip.waitFor({state:'visible'});
      const box=await tip.boundingBox(),wrap=await page.locator('#chartTemperature').locator('..').boundingBox();
      assert.ok(box.x>=wrap.x-1&&box.x+box.width<=wrap.x+wrap.width+1&&box.y>=wrap.y-1&&box.y+box.height<=wrap.y+wrap.height+1,`tooltip outside chart ${width}/${theme}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      layouts.push({width,theme,contained:true});
      if(artifacts&&width===1366){fs.mkdirSync(artifacts,{recursive:true});await page.locator('.plot-card').first().screenshot({path:path.join(artifacts,`tooltip-${theme}.png`)});}
      await page.mouse.move(0,0);
    }
  }
  data=fixture(86400);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#chartTemperature .point').length===6);
  await page.locator('#chartTemperature').scrollIntoViewIfNeeded();await page.locator('#chartTemperature').focus();await page.keyboard.press('End');assert.match(await page.locator('#chartTemperatureTooltip').innerText(),/Înregistrare istorică/);
  data=fixture(0,true);await page.reload();await page.locator('#chartTemperature').scrollIntoViewIfNeeded();await page.locator('#chartTemperature').focus();await page.keyboard.press('End');assert.ok(await page.locator('#chartTemperatureTooltip').isHidden());
  const touch=await browser.newContext({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  await touch.route('**/api/station',route=>route.fulfill({json:fixture()}));
  await touch.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'}));
  const phone=await touch.newPage();phone.on('pageerror',error=>errors.push(error.message));await phone.goto(url);await phone.waitForFunction(()=>document.querySelectorAll('#chartTemperature .point').length===6);
  let point=await pointCenter(phone,'temperature',1);await phone.touchscreen.tap(point.x,point.y);await phone.locator('#chartTemperatureTooltip').waitFor({state:'visible'});assert.match(await phone.locator('#chartTemperatureTooltip .tooltip-value').innerText(),/21,7 °C/);
  const cdp=await touch.newCDPSession(phone);const before=await phone.evaluate(()=>scrollY);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-90}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.waitForTimeout(150);
  assert.ok(await phone.locator('#chartTemperatureTooltip').isHidden());assert.ok(await phone.evaluate(()=>scrollY)>before,'vertical scroll must remain available');
  assert.deepEqual(errors,[]);await browser.close();server.kill();
  const report={passed:true,layouts,jsErrors:errors,checks:['all four metrics hover and units','source and exact sample timestamp','zero values','keyboard navigation and Escape','tooltip stays within every chart','dark and light themes','stale provenance','no-data behavior','touch tap','touch scrolling remains functional'],realAiRequests:0,realMapTileDownloads:0};
  if(artifacts){fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'tooltip-results.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report,null,2));
})().catch(async error=>{console.error(error);await browser?.close();server?.kill();process.exitCode=1;});
