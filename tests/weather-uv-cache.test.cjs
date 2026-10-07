const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../weather-data-cache.js'),'utf8');
const now=Date.parse('2026-10-07T17:15Z');class Clock extends Date{static now(){return now;}}
let requests=[],resolve;const window={navigator:{onLine:true}};
vm.runInNewContext(code,{window,Date:Clock,Intl,Promise,AbortController,setTimeout,clearTimeout,fetch:url=>{requests.push(url);return new Promise(r=>resolve=r);}});
function data(){return {timezone:'America/New_York',current:{temperature_2m:17,time:'2026-10-07T13:10',uv_index:null},hourly:{time:['2026-10-07T12:00-04:00','2026-10-07T13:00-04:00','2026-10-07T14:00-04:00'],precipitation_probability:[0,0,0],uv_index:[null,null,null]},daily:{time:['2026-10-07'],uv_index_max:[null],precipitation_probability_max:[0]}};}
const raw={timezone:'America/New_York',current:{time:now/1000-900,uv_index:3.2},hourly:{time:[now/1000-4500,now/1000-900,now/1000+2700],uv_index:[3,3.2,2.8],precipitation_probability:[70,70,70]},daily:{time:[Date.parse('2026-10-07T04:00Z')/1000],uv_index_max:[5.9]}};
const loc={lat:40.7128,lon:-74.006};
(async()=>{
 await window.MeteoForecastCache.ready;const d=data();window.MeteoForecastCache.put(loc,d);
 const first=window.MeteoForecastCache.enrich(loc,d),second=window.MeteoForecastCache.enrich(loc,d);assert.equal(first,second);
 assert.equal(requests.length,1,'UV is fetched even when all rain percentages are already known');assert.ok(requests[0].includes('current=uv_index'));assert.ok(requests[0].includes('timezone=auto'));
 resolve({ok:true,json:async()=>raw});assert.equal(await first,true);
 assert.equal(d.current.uv_index,3.2);assert.equal(d.current.temperature_2m,17);assert.equal(d.current.time,'2026-10-07T13:10');
 assert.deepEqual(d.hourly.uv_index,[3,3.2,2.8]);assert.equal(d.daily.uv_index_max[0],5.9);assert.notEqual(d.current.uv_index,d.daily.uv_index_max[0]);
 assert.deepEqual(d.hourly.precipitation_probability,[0,0,0],'valid rain values are preserved');assert.equal(window.MeteoForecastCache.entry(loc).t,now);
 const nightLoc={lat:44.4268,lon:26.1025},night=data();window.MeteoForecastCache.put(nightLoc,night);const waiting=window.MeteoForecastCache.enrich(nightLoc,night);
 resolve({ok:true,json:async()=>({...raw,current:{time:now/1000-300,uv_index:0}})});await waiting;assert.equal(night.current.uv_index,0,'a genuine zero is available, not missing');
 const staleLoc={lat:44.983,lon:25.644},stale=data();window.MeteoForecastCache.put(staleLoc,stale);const old=window.MeteoForecastCache.enrich(staleLoc,stale);
 resolve({ok:true,json:async()=>({...raw,current:{time:now/1000-7200,uv_index:8}})});await old;assert.equal(stale.current.uv_index,null,'old UV cannot masquerade as current or use the daily maximum');
 const tokyoLoc={lat:35.68,lon:139.69},tokyo=data();tokyo.timezone='Asia/Tokyo';tokyo.daily.time=['2026-10-08'];window.MeteoForecastCache.put(tokyoLoc,tokyo);const jp=window.MeteoForecastCache.enrich(tokyoLoc,tokyo);
 resolve({ok:true,json:async()=>({...raw,timezone:'Asia/Tokyo',daily:{time:[Date.parse('2026-10-07T15:00Z')/1000],uv_index_max:[4.5]}})});await jp;assert.equal(tokyo.daily.uv_index_max[0],4.5,'native daily UV matches the city date rather than the UTC date');
 const failedLoc={lat:43,lon:27},failed=data();window.MeteoForecastCache.put(failedLoc,failed);const bad=window.MeteoForecastCache.enrich(failedLoc,failed);resolve({ok:false,status:429});assert.equal(await bad,false);assert.equal(failed.current.uv_index,null);assert.equal(window.MeteoForecastCache.peek(failedLoc),failed,'UV failure cannot blank usable weather');
 console.log('PASS: UV with known rain, one shared request, genuine night zero, current versus daily maximum, stale UV rejection, UTC/city dates and optional failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
