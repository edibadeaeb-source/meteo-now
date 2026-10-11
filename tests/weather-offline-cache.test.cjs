const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let now=Date.parse('2026-10-11T12:00Z'),calls=0,reply,mode='success';const events={};
class Clock extends Date{static now(){return now;}}
const window={navigator:{onLine:true},addEventListener:(n,f)=>events[n]=f};
const data=()=>({timezone:'Europe/Bucharest',current:{temperature_2m:22},hourly:{time:['2026-10-11T15:00']},daily:{time:['2026-10-11']}});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../weather-data-cache.js'),'utf8'),{
 window,Date:Clock,Intl,AbortController,Promise,setTimeout,clearTimeout,
 fetch:async()=>{calls++;if(mode==='limited')return{ok:false,status:429,headers:{get:()=> '120'}};
 if(mode==='hold')return new Promise(r=>reply=r);return{ok:true,json:async()=>data()};}
});
(async()=>{
 const c=window.MeteoForecastCache,a={lat:44.9,lon:25.6},b={lat:40.7,lon:-74};await c.ready;
 c.put(a,data());assert.equal(c.state(a).saved,false);
 now+=2*3600000;assert.equal(c.peek(a).current.temperature_2m,22);assert.equal(c.state(a).saved,true);
 window.navigator.onLine=false;events.offline();await assert.rejects(c.request(a));assert.equal(calls,0,'offline creates no network retries');
 assert.equal(c.state(a).offline,true);assert.equal(c.peek(b),null,'never use another city');
 window.navigator.onLine=true;events.online();await c.request(a);assert.equal(calls,1);assert.equal(c.state(a).saved,false);
 await c.request(a);assert.equal(calls,1,'fresh entry reuses data');
 await c.request(a,{force:true});assert.equal(calls,2,'manual/online refresh bypasses freshness');
 now+=6*60000;mode='limited';await assert.rejects(c.request(a));assert.equal(calls,3);
 await assert.rejects(c.request(a));assert.equal(calls,3,'repeated UI events respect provider Retry-After');
 now+=90000;await assert.rejects(c.request(a));assert.equal(calls,3);
 now+=31000;mode='hold';const p=c.request(a),p2=c.request(a);assert.equal(p,p2);await new Promise(r=>setImmediate(r));
 reply({ok:true,json:async()=>data()});await p;assert.equal(calls,4);
 c.put(b,{...data(),weather_sources:{stale:true,retrieved_at:new Clock(now-20*60000).toISOString()}});
 assert.equal(c.state(b).saved,true);assert.equal(c.state(b).updatedAt,now-20*60000,'do not pretend stale server data was measured now');
 const midnight={lat:45,lon:26};
 c.put(midnight,{...data(),daily:{time:['2026-10-11','2026-10-12'],temperature_2m_max:[31,19],temperature_2m_min:[14,10]},weather_sources:{daily:['yesterday','today']}});
 now=Date.parse('2026-10-12T00:30Z');
 assert.equal(c.peek(midnight).daily.time[0],'2026-10-12','saved forecasts roll over in the city timezone');
 assert.equal(c.peek(midnight).daily.temperature_2m_max[0],19);
 assert.equal(c.peek(midnight).weather_sources.daily[0],'today');
 now+=24*3600000+1;assert.equal(c.peek(a),null,'expired saved data cannot be displayed indefinitely');
 console.log('PASS: 24h bounded saved data, offline without requests, city isolation, honest server timestamp, recovery, forced refresh, shared request and 429 cooldown');
})().catch(e=>{console.error(e);process.exitCode=1});
