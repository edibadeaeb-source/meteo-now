/* Use the full app fixtures without live database writes. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.evaluate(()=>{
   const control=document.getElementById('setAnimations');control.checked=false;control.dispatchEvent(new Event('change'));
   salveazaOrase([LOC,{nume:'New York City',lat:40.7128,lon:-74.006,admin:'New York',tara:'US'},{nume:'Miami',lat:25.7617,lon:-80.1918,admin:'Florida',tara:'US'},{nume:'Sinaia',lat:45.35,lon:25.55,admin:'Prahova',tara:'RO'}]);
 });
 const open=()=>page.evaluate(()=>mobDeschideFoaie('orase'));
 assert.equal(await page.locator('#chatFab').isVisible(),true);
 for(const width of [320,360,393,412,430,820]){
   await page.setViewportSize({width,height:width===820?1100:915});await open();
   assert.equal(await page.locator('#chatFab').isVisible(),false,'AI hidden on cities at '+width);
   const styles=await page.locator('.mo-cauta').evaluate(el=>({image:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).backgroundColor}));
   assert.deepEqual(styles,{image:'none',color:'rgba(0, 0, 0, 0)'},'no rectangular background behind rounded search');
   const field=await page.locator('.mo-cauta-camp').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,radius:getComputedStyle(el).borderRadius,overflow:getComputedStyle(el).overflow}));
   assert.ok(field.left>=0&&field.right<=width,'search stays within sheet');assert.equal(field.radius,'20px');assert.equal(field.overflow,'hidden');
   assert.equal(await page.locator('#moCauta').evaluate(el=>getComputedStyle(el).fontSize),'16px','iOS focus must not zoom');
   assert.equal(await page.locator('#moStergeCautare').isVisible(),false);
   if(width===320||width===412)await page.screenshot({path:path.join(out,'city-search-'+width+'.png')});
   await page.evaluate(()=>mobInchideFoaie());assert.equal(await page.locator('#chatFab').isVisible(),true);
 }
 await page.setViewportSize({width:412,height:915});await open();
 let release,requested;const waiting=new Promise(r=>requested=r),delayed=new Promise(r=>release=r);
 const result={name:'Cluj-Napoca',admin1:'Cluj',country:'România',country_code:'RO',latitude:46.77,longitude:23.59};
 await page.route('**/geocoding-api.open-meteo.com/**',async route=>{
   if(new URL(route.request().url()).searchParams.get('name')==='Bucuresti'){requested();await delayed;}
   await route.fulfill({json:{results:[result]}});
 });
 await page.locator('#moCauta').fill('Cluj');await page.waitForFunction(()=>document.querySelector('#moRez [data-g]'));
 assert.equal(await page.locator('#moStergeCautare').isVisible(),true);
 await page.screenshot({path:path.join(out,'city-search-results-412.png')});
 await page.locator('#moStergeCautare').click();assert.equal(await page.locator('#moCauta').inputValue(),'');assert.equal(await page.locator('#moRez').isVisible(),false);
 assert.equal(await page.locator('#moCauta').evaluate(el=>el===document.activeElement),true);
 await page.locator('#moCauta').fill('Bucuresti');await waiting;await page.locator('#moStergeCautare').click();release();await page.waitForTimeout(350);
 assert.equal(await page.locator('#moRez').isVisible(),false,'late results cannot reappear after clearing');
 await page.locator('#moCauta').fill('Cluj');await page.waitForFunction(()=>document.querySelector('#moRez [data-g]'));
 await page.locator('#moRez [data-g]').first().click();
 assert.equal(await page.evaluate(()=>LOC.nume),'Cluj-Napoca');assert.equal(await page.locator('#mobFoaie').isVisible(),false);assert.equal(await page.locator('#chatFab').isVisible(),true);
 await open();await page.touchscreen.tap(20,20);assert.equal(await page.locator('#chatFab').isVisible(),true,'backdrop closing restores AI');
 await page.evaluate(()=>{LANG='en';mobDeschideFoaie('orase');});assert.equal(await page.locator('#moCauta').getAttribute('aria-label'),'Search for a city…');assert.equal(await page.locator('#moStergeCautare').getAttribute('aria-label'),'Clear search');
 await page.evaluate(()=>mobInchideFoaie());
 await page.evaluate(()=>{const c=document.getElementById('setChatVisible');c.checked=false;c.dispatchEvent(new Event('change'));});await open();await page.evaluate(()=>mobInchideFoaie());
 assert.equal(await page.locator('#chatFab').isVisible(),false,'closing must respect the disabled AI preference');
 assert.equal(await page.evaluate(()=>_nrPanouri),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(errors.filter(e=>!e.includes('getCurrentPosition')).length,0);
 console.log('PASS: city sheet hides/restores AI and respects preference; rounded glass search 320–820 px; search/clear/late results/city selection; translated labels; background unlock; no JavaScript errors');
 await context.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename);test.filename=__filename;test.paths=Module._nodeModulePaths(__dirname);test._compile(prefix+checks,__filename);
