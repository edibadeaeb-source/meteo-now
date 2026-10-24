const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=path.join(__dirname,'..'),out=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-widget-toast-20261024');
 const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=source.indexOf('        #sfatToast {');
 const css=source.slice(start,source.indexOf('        .hero-extra',start))+fs.readFileSync(path.join(root,'app-messages.css'),'utf8');
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:412,height:300}});
 await page.setContent('<style>body{margin:0;background:#152744;font-family:system-ui;height:300px}'+css+'</style><div id="sfatToast"><div class="st-card"><span class="st-ico">🌧️</span><div class="st-mij"><div class="st-et">Moreni</div><div class="st-text">Averse posibile în următoarea oră.</div></div><button class="st-x">×</button></div></div>');
 await page.addScriptTag({path:path.join(root,'app-messages.js')});
 await page.evaluate(()=>new Promise(resolve=>{MeteoMessages.open(document.getElementById('sfatToast'));setTimeout(()=>{document.querySelectorAll('#sfatToast *').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=100;}));resolve();},40);}));
 const circle=await page.locator('.st-card').evaluate(el=>({clip:getComputedStyle(el).clipPath,animations:el.getAnimations().map(a=>a.animationName)}));
 assert.ok(circle.animations.includes('messageUnfold'));assert.notEqual(circle.clip,'none');
 await page.screenshot({path:path.join(out,'motion-circle.png')});
 await page.evaluate(()=>document.querySelectorAll('#sfatToast *').forEach(el=>el.getAnimations().forEach(a=>a.currentTime=600)));
 const expanded=await page.locator('.st-card').evaluate(el=>getComputedStyle(el).clipPath);
 assert.notEqual(circle.clip,expanded,'the circle must actually expand');
 await page.screenshot({path:path.join(out,'motion-expanded.png')});
 fs.writeFileSync(path.join(out,'motion-results.json'),JSON.stringify({realBrowserCSSAnimation:true,circleClip:circle.clip,expandedClip:expanded},null,2));
 console.log('PASS: real CSS animation transforms a circular mask into the expanded message');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
