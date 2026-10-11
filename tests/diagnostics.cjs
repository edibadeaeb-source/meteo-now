const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../diagnostics.js'),'utf8');
function fixture(rejectReports=false){
 const calls=[],listeners={};let nextStatus=200,failure=null;
 const root={navigator:{userAgent:'Android test',onLine:true},location:{href:'https://meteo-now.onrender.com/',origin:'https://meteo-now.onrender.com'},
  addEventListener:(name,handler)=>{listeners[name]=handler;},
  fetch:(url,options)=>{calls.push({url,options});if(url==='/api/diagnostics')return rejectReports?Promise.reject(new Error('private transport failure')):Promise.resolve({status:202});return failure?Promise.reject(failure):Promise.resolve({status:nextStatus});}};
 vm.runInNewContext(source,{window:root,URL,AbortController,Promise,Date,setTimeout,clearTimeout});
 return {root,calls,listeners,status:x=>nextStatus=x,fail:x=>failure=x,reports:()=>calls.filter(x=>x.url==='/api/diagnostics').map(x=>JSON.parse(x.options.body))};
}
(async()=>{
 const x=fixture();
 x.listeners.error({target:x.root,error:{name:'TypeError',message:'SECRET CITY',stack:'https://private/?token=SECRET'},filename:'https://meteo-now.onrender.com/index.html?lat=44.123456&token=SECRET',lineno:123,colno:4});
 x.listeners.error({target:x.root,error:{name:'TypeError'},filename:'https://meteo-now.onrender.com/index.html',lineno:123,colno:4});
 assert.equal(x.reports().length,1,'duplicate errors suppressed');
 assert.equal(x.reports()[0].line,123);
 assert.ok(!JSON.stringify(x.reports()).includes('SECRET'));
 assert.ok(!JSON.stringify(x.reports()).includes('44.123456'));
 const y=fixture();y.status(503);
 const response=await y.root.fetch('/ask',{method:'POST',body:'PRIVATE AI CONVERSATION'});
 assert.equal(response.status,503,'response is preserved');
 assert.equal(y.reports()[0].component,'ai');
 assert.ok(!JSON.stringify(y.reports()).includes('CONVERSATION'));
 await y.root.fetch('/api/diagnostics',{method:'POST',body:'{}'});
 assert.equal(y.reports().length,2,'diagnostics requests never recursively report');
 const z=fixture(),error=new TypeError('PRIVATE URL AND LOCATION');z.fail(error);
 await assert.rejects(z.root.fetch('/api/weather/forecast?latitude=44.123456'),e=>e===error);
 assert.equal(z.reports()[0].operation,'forecast');
 assert.ok(!JSON.stringify(z.reports()).includes('44.123456'));
 const offline=fixture();offline.root.navigator.onLine=false;offline.root.MeteoDiagnostics.report('runtime_error','app','runtime');assert.equal(offline.reports().length,0);
 const aborted=fixture();aborted.fail(Object.assign(new Error('cancel'),{name:'AbortError'}));
 await assert.rejects(aborted.root.fetch('/ask'));assert.equal(aborted.reports().length,0);
 const cap=fixture();for(let i=0;i<40;i++)cap.root.MeteoDiagnostics.report('runtime_error','app','runtime',null,{line:i});assert.equal(cap.reports().length,20);
 const unavailable=fixture(true);unavailable.root.MeteoDiagnostics.report('runtime_error','app','runtime');
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(unavailable.reports().length,1,'failed report transport never recurses or rejects globally');
 console.log('PASS: private fields excluded, fetch results/errors preserved, duplicates/hourly floods bounded, offline/cancellation ignored and reporting never recurses.');
})().catch(e=>{console.error(e);process.exitCode=1;});
