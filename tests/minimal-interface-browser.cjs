const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const prefix=fs.readFileSync(path.join(__dirname,'weather-browser.cjs'),'utf8').split(' // A tap used to')[0];
const checks=String.raw`
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).visibility==='hidden');
 const evidence=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-minimal-interface-20261025');fs.mkdirSync(evidence,{recursive:true});
 await page.evaluate(()=>{clearTimeout(_sfatTimer);_sfatTimer=null;_popAratat=true;document.querySelectorAll('video').forEach(v=>v.pause());});
 assert.equal(await page.locator('#mbContinut').getByText('Aici măsurăm noi',{exact:false}).count(),0,'obsolete sensor card removed for Targoviste');
 assert.equal(await page.locator('#mbContinut').getByText('Stațiile mele',{exact:false}).count(),0);
 assert.equal(await page.locator('#mbContinut .mb-info-footer a[href="weather-credits.html"]').count(),1,'credits available at bottom');
 assert.equal(await page.locator('#mbContinut .mb-info-footer a[href="privacy.html"]').count(),1);
 assert.equal(await page.locator('#mbContinut .mb-sursa-harta').count(),2,'map attributions retained');
 await page.evaluate(()=>document.getElementById('settingsBtn').click());
 assert.equal(await page.locator('#settingsSheet .set-info-links a').count(),2);
 assert.ok(!(await page.locator('#settingsSheet .set-info-links').innerText()).includes('Open-Meteo'),'settings uses short links');
 await page.screenshot({path:path.join(evidence,'minimal-settings.png')});
 const requests=[];page.on('request',request=>requests.push({url:request.url(),type:request.resourceType()}));
 const results=[];
 for(const width of [320,412,430]){
  await page.setViewportSize({width,height:915});
  for(const file of ['weather-credits.html','privacy.html']){
   requests.length=0;
   await page.goto(base+'/'+file,{waitUntil:'networkidle'});
   assert.equal(await page.locator('img,video,iframe').count(),0,'information pages have no embedded media');
   assert.equal(requests.filter(r=>['image','media','font'].includes(r.type)).length,0,'no duplicate media downloads');
   assert.equal(requests.filter(r=>new URL(r.url).hostname!=='127.0.0.1').length,0,'no external requests on information pages');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'page fits '+width);
   assert.equal(await page.locator('details[open]').count(),0,'details initially collapsed');
   await page.locator('#bEn').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.locator('#bRo').click();assert.equal(await page.locator('html').getAttribute('lang'),'ro');
   if(file==='weather-credits.html'){
    assert.equal(await page.locator('.media-list .work').count(),179,'136 photos and 43 film sources retained');
    await page.locator('main>details').nth(1).locator(':scope>summary').click();
    await page.locator('.media-group').first().locator(':scope>summary').click();
    assert.equal(await page.locator('.media-list .work').first().isVisible(),true);
    assert.ok((await page.locator('.media-list .byline').first().innerText()).includes('Madalin Pentelie'));
   }else{
    assert.equal(await page.locator('.policy-section').count(),14,'seven sections in each language');
    await page.locator('.sec-ro .policy-section').nth(1).locator('summary').click();
    assert.ok((await page.locator('.sec-ro .policy-content').nth(1).innerText()).includes('30 de zile'),'provider retention remains accessible');
   }
   if(width===412){await page.locator('details[open]').evaluateAll(items=>items.forEach(el=>el.open=false));await page.screenshot({path:path.join(evidence,'minimal-'+file+'.png')});}
   results.push({width,page:file,noMediaRequests:true,languageSwitch:true,noOverflow:true});
  }
 }
 await page.addStyleTag({content:'html{font-size:24px!important}'});
 await page.locator('.sec-ro .policy-section').nth(1).locator('summary').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'large policy text wraps');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({version:'2026.10.25.2',results,obsoleteSensorCardRemoved:true,mapAttributionsRetained:true,javascriptErrors:errors},null,2));
 await context.close();console.log('PASS: minimalist home/settings; RO/EN privacy and link-only credits at 320/412/430px; zero media/external requests');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});`;
const test=new Module(__filename,module);test.filename=__filename;test.paths=module.paths;test._compile(prefix+checks,__filename);
