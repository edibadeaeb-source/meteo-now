const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 const show=async()=>{await page.evaluate(()=>{inchideToast();_popAratat=true;_sfaturi=[{ico:'📊',text:'Ziua asta e cu <b>7.1°C</b> peste normalul ultimilor 30 de ani.',nivel:2}];aratăToast();clearTimeout(_sfatTimer);_sfatTimer=null;});await page.waitForTimeout(450);};
 const style=selector=>page.locator(selector).first().evaluate(el=>({highlight:getComputedStyle(el).webkitTapHighlightColor,selection:getComputedStyle(el).userSelect}));
 for(const width of [320,412,430]){
  await page.setViewportSize({width,height:915});await show();
  for(const selector of ['#stCard','#stText','#stText b','#stX','#mjLoc','.mb-card','#chatFab']){
   const s=await style(selector);assert.equal(s.highlight,'rgba(0, 0, 0, 0)',selector+' must not have native touch flash at '+width);assert.equal(s.selection,'none',selector+' must not become selected');
  }
  const name=await page.evaluate(()=>LOC.nume);
  const box=await page.locator('#stX').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await page.waitForTimeout(180);
  if(width===412)await page.screenshot({path:path.join(out,'toast-close-touch-no-highlight-412.png')});
  await cdpCity.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>!document.getElementById('sfatToast').classList.contains('vizibil'),null,{timeout:2000});
  assert.equal(await page.evaluate(()=>getSelection().toString()),'');assert.equal(await page.evaluate(()=>LOC.nume),name,'closing a message must not switch city');
  await show();const text=await page.locator('#stText').boundingBox();
  await cdpCity.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:text.x+30,y:text.y+15}]});await page.waitForTimeout(750);
  assert.equal(await page.evaluate(()=>getSelection().toString()),'','holding message text must not select it');
  await cdpCity.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>inchideToast());
 }
 await page.evaluate(()=>mobDeschideFoaie('orase'));await page.locator('#moCauta').fill('Moreni');
 const editable=await page.locator('#moCauta').evaluate(el=>{el.setSelectionRange(1,5);return {selection:getComputedStyle(el).userSelect,start:el.selectionStart,end:el.selectionEnd,value:el.value}});
 assert.deepEqual(editable,{selection:'text',start:1,end:5,value:'Moreni'},'search text remains editable and selectable');
 await page.evaluate(()=>mobInchideFoaie());await show();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#sfatToast').evaluate(el=>el.classList.contains('vizibil')),false,'keyboard dismissal remains available');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS: message close and long-touch at 320/412/430px; no native rectangular flash or text selection across app controls; search editing and Escape still work');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
