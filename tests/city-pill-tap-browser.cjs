const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>{const s=document.getElementById('splash');return !s||getComputedStyle(s).visibility==='hidden';});
 await page.evaluate(()=>{
  document.getElementById('setAnimations').checked=false;document.getElementById('setAnimations').dispatchEvent(new Event('change'));
  salveazaOrase([LOC,...Array.from({length:7},(_,i)=>({nume:'Oraș '+i,lat:44+i*.1,lon:25+i*.1,tara:'RO'}))]);
 });
 for(const width of [320,412,430]){
  await page.setViewportSize({width,height:915});await page.waitForTimeout(650);
  for(const fraction of [.2,.5,.8]){
   const before=await page.evaluate(()=>LOC.nume),r=await page.locator('#mjLoc').boundingBox();
   await page.touchscreen.tap(r.x+r.width*fraction,r.y+r.height/2);await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>LOC.nume),before,'short tap must not choose a newly revealed city');
   assert.equal(await page.locator('#mobFoaie').evaluate(el=>el.classList.contains('deschis')),true);
   assert.equal(await page.locator('.mo-oras').count(),8);
   await page.evaluate(()=>mobInchideFoaie());await page.waitForTimeout(350);
  }
 }
 await page.locator('#mjLoc').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('.mo-oras').count(),8);await page.locator('.mo-oras[data-i="2"]').click();
 await page.waitForFunction(()=>LOC.nume==='Oraș 1');assert.equal(await page.locator('#mobFoaie').evaluate(el=>el.classList.contains('deschis')),false);
 await page.evaluate(()=>mobInchideFoaie());
 const r=await page.locator('#mjLoc').boundingBox();
 const touch=async(type,x)=>cdpCity.send('Input.dispatchTouchEvent',{type,touchPoints:/End|Cancel/.test(type)?[]:[{x,y:r.y+r.height/2}]});
 const before=await page.evaluate(()=>LOC.nume);
 await touch('touchStart',r.x+r.width*.8);await touch('touchMove',r.x+r.width*.2);await touch('touchEnd');
 await page.waitForFunction(old=>LOC.nume!==old,before,{timeout:8000});
 assert.equal(await page.locator('#mobFoaie').evaluate(el=>el.classList.contains('deschis')),false,'swipe must not also open list');
 assert.equal(errors.filter(e=>!e.includes('getCurrentPosition')).length,0);
 console.log('PASS: short touch across pill at 320/412/430px, eight cities, no click-through, keyboard selection and preserved city swipe');
 await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename);test.filename=__filename;test.paths=Module._nodeModulePaths(__dirname);test._compile(prefix+checks,__filename);
