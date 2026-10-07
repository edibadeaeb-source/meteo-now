const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../weather-data-cache.js'),'utf8');
const now=Date.parse('2026-11-01T04:30Z');
class TestDate extends Date {static now(){return now;}}
let calls=[],resolve;
const w={navigator:{onLine:true}};
vm.runInNewContext(code,{window:w,Date:TestDate,Intl,Promise,AbortController,setTimeout,clearTimeout,fetch:(url)=>{calls.push(url);return new Promise(r=>resolve=r);}});
function data(){return {timezone:'America/New_York',current:{temperature_2m:17},hourly:{time:['2026-11-01T00:00-04:00','2026-11-01T01:00-04:00','2026-11-01T01:00-05:00','2026-11-01T02:00-05:00'],precipitation_probability:[null,null,null,42]},daily:{time:['2026-11-01'],precipitation_probability_max:[null]}};}
const a={lat:40.7128,lon:-74.006},b={lat:44.983,lon:25.644};
const raw={hourly:{time:[now/1000-1800,now/1000+1800,now/1000+5400,now/1000+9000],precipitation_probability:[0,73,20,99]}};
(async()=>{
 await w.MeteoForecastCache.ready;
 const d=data();w.MeteoForecastCache.put(a,d);
 const first=w.MeteoForecastCache.enrich(a,d),second=w.MeteoForecastCache.enrich(a,d);
 assert.equal(first,second,'coalesce requests for one city');assert.equal(calls.length,1);
 assert.ok(calls[0].includes('latitude=40.7128'));assert.ok(calls[0].includes('timeformat=unixtime'));
 resolve({ok:true,json:async()=>raw});assert.equal(await first,true);
 assert.deepEqual(d.hourly.precipitation_probability,[0,73,20,42],'UTC timestamps distinguish repeated DST hours and preserve existing probabilities');
 assert.equal(d.daily.precipitation_probability_max[0],73);assert.equal(d.current.temperature_2m,17);
 assert.equal(w.MeteoForecastCache.entry(a).t,now,'optional fields cannot extend weather freshness');
 assert.equal(await w.MeteoForecastCache.enrich(a,d),false);assert.equal(calls.length,1);
 const old=data();w.MeteoForecastCache.put(b,old);const waiting=w.MeteoForecastCache.enrich(b,old);
 const newer=data();newer.current.temperature_2m=28;w.MeteoForecastCache.put(b,newer);
 resolve({ok:true,json:async()=>raw});assert.equal(await waiting,false,'do not apply a delayed supplement to an obsolete forecast');
 assert.deepEqual(newer.hourly.precipitation_probability,[null,null,null,42]);
 const c={lat:45.35,lon:25.55},unavailable=data();w.MeteoForecastCache.put(c,unavailable);
 const failed=w.MeteoForecastCache.enrich(c,unavailable);resolve({ok:false,status:429});
 assert.equal(await failed,false);assert.equal(w.MeteoForecastCache.peek(c),unavailable);
 console.log('Probability cache: zero, DST, provenance, request coalescing, stale response and optional failure passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
