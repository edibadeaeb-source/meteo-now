const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function block(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return html.slice(a,b);}
function fixture(city='Moreni',day='2026-10-08',currentTime='00:48'){
 return {timezone:city==='Moreni'?'Europe/Bucharest':'America/New_York',utc_offset_seconds:city==='Moreni'?10800:-14400,
 current:{time:day+'T'+currentTime,temperature_2m:13,apparent_temperature:12,weather_code:3,is_day:0,uv_index:0,wind_speed_10m:5,wind_gusts_10m:8,precipitation:0},
 daily:{time:[day],sunrise:[day+'T07:20'],sunset:[day+'T18:28'],temperature_2m_max:[23],temperature_2m_min:[11],precipitation_sum:[0]},
 hourly:{time:[day+'T'+currentTime.slice(0,2)+':00'],is_day:[0],precipitation_probability:[0]}};
}
let clock=Date.parse('2026-10-07T21:48:00Z');
class ClockDate extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const elements={};const timers=[];
const c=vm.createContext({Date:ClockDate,Math,Intl,JSON,isFinite,window:{},_judeteGeo:null,esteRomania:()=>false,
 LOC:{nume:'Moreni',lat:44.983,lon:25.644,tz:'Europe/Bucharest'},LANG:'ro',UNIT:'C',sunTimes:null,
 esteMobil:()=>true,data:fixture(),mobDatePentruLoc:()=>c.data,
 document:{hidden:false,getElementById:id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',className:'',setAttribute(){},classList:{add(){},remove(){}},style:{setProperty(){}}})},
 fT:v=>Math.round(v)+'°',fDifAbs:v=>Math.round(Math.abs(v))+'°',setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}});
vm.runInContext(block('var _ctxSfatLoc = null;','// Datele suplimentare'),c);
// Reproduce the photo: a late NYC sunset looks 40 minutes away in Moreni at 00:48.
c.sunTimes={rise:clock-36000000,set:clock+2400000,lat:40.7128,lon:-74.006,utc_offset_seconds:-14400};
c.actualizeazaContext({temp:30,uv:9,probUrm:0});
assert.equal(c.CTX.noapte,true);assert.equal(c.CTX.minPanaApus,null);assert.equal(c.CTX.temp,13,'advice uses displayed current temperature, not another source or daily maximum');
assert.ok(c.calculeazaSfaturi().every(s=>!['apusCurand','ziPerfecta','uvExtrem','uvMare'].includes(s.id)));
assert.match(c.calculeazaSfaturi()[0].text,/noapte/);
c['aratăToast']();assert.match(elements.stText.innerHTML,/noapte/);assert.doesNotMatch(elements.stText.innerHTML,/Apusul/);
// The same UTC instant is still daytime in NYC; its own sunset really is 40 minutes away.
c.LOC={nume:'New York City',lat:40.7128,lon:-74.006,tz:'America/New_York'};c.data=fixture('NYC','2026-10-07','17:48');c.data.current.is_day=1;c.data.hourly.is_day=[1];
c.actualizeazaContext({media5:99});assert.equal(c.CTX.noapte,false);assert.equal(c.CTX.minPanaApus,40);assert.ok(c.calculeazaSfaturi().some(s=>s.id==='apusCurand'));
// Returning to Romania clears city-specific context and cannot borrow NYC solar data.
c.LOC={nume:'Moreni',lat:44.983,lon:25.644,tz:'Europe/Bucharest'};c.data=fixture();c.actualizeazaContext({});assert.equal(c.CTX.media5,undefined);assert.equal(c.CTX.noapte,true);assert.equal(c.CTX.minPanaApus,null);
// Recompute at display time, even if the app's six-second timer was suspended across sunset.
clock=Date.parse('2026-10-08T15:13:00Z');c.data=fixture('Moreni','2026-10-08','18:13');c.data.current.is_day=1;c.data.hourly.is_day=[1];c.actualizeazaContext({});assert.equal(c.CTX.minPanaApus,15);
clock+=30*60000;c['aratăToast']();assert.equal(c.CTX.noapte,true);assert.doesNotMatch(elements.stText.innerHTML,/Apusul/);assert.match(elements.stText.innerHTML,/noapte/);
// Heat safety remains relevant at night, with wording appropriate to the actual time.
c.data.current.apparent_temperature=40;c.actualizeazaContext({});assert.match(c.calculeazaSfaturi()[0].text,/noaptea/);assert.doesNotMatch(c.calculeazaSfaturi()[0].text,/11 și 17/);
c.LANG='en';assert.match(c.calculeazaSfaturi()[0].text,/tonight/);
// Polar day/night: absent sun events rely on a flag for this local hour, never an invented sunset.
c.data.daily.sunrise=[null];c.data.daily.sunset=[null];c.data.current.time='2026-10-08T18:43';c.data.hourly.time=['2026-10-08T18:00'];c.data.hourly.is_day=[1];c.actualizeazaContext({});assert.equal(c.CTX.noapte,false);assert.equal(c.CTX.minPanaApus,null);
c.data.hourly.is_day=[0];c.actualizeazaContext({});assert.equal(c.CTX.noapte,true);
// No own mobile forecast means no toast based on the previous city's weather.
c.data=null;assert.equal(c.calculeazaSfaturi().length,0);
c.document.hidden=true;c['aratăToast']();assert.equal(c._popAratat,false);
// Desktop fallback also requires today's solar data tagged with the current coordinates.
c.esteMobil=()=>false;c.document.hidden=false;clock=Date.parse('2026-10-08T15:13:00Z');
c.sunTimes={rise:Date.parse('2026-10-08T04:20:00Z'),set:Date.parse('2026-10-08T15:28:00Z'),lat:c.LOC.lat,lon:c.LOC.lon,utc_offset_seconds:10800};
c.actualizeazaContext({temp:13,resimtit:12,cod:3});assert.equal(c.CTX.noapte,false);assert.equal(c.CTX.minPanaApus,15);
c.sunTimes.rise-=86400000;c.sunTimes.set-=86400000;c.actualizeazaOraSfat(null);assert.equal(c.CTX.minPanaApus,null);assert.equal(c.CTX.noapte,null,'expired solar data is never treated as current');
(async()=>{
 // Both asynchronous legacy sources must discard replies requested for a city that is no longer selected.
 for(const [start,end,name] of [['function fetchWeather() {','/* ═','fetchWeather'],['function incarcaContextExtins() {','// ══','incarcaContextExtins']]){
  let resolve,mutations=0;
  const race=vm.createContext({Promise,Date,Math,LOC:{lat:40.7128,lon:-74.006},TGV:{lat:40.7128,lon:-74.006},location:{protocol:'https:'},LANG:'ro',sunTimes:null,
   fetch:()=>new Promise(r=>resolve=r),document:{getElementById:()=>{mutations++;return {}}},actualizeazaContext:()=>mutations++});
  vm.runInContext(block('function sfatAceeasiLocatie(', 'function sfatDateMobile()'),race);
  vm.runInContext(block(start,end),race);race[name]();race.LOC={lat:44.983,lon:25.644};race.TGV={...race.LOC};
  resolve({json:async()=>({weather:[{description:'senin',icon:'01d',id:800}],main:{temp:30},sys:{sunrise:clock/1000-10000,sunset:clock/1000+2400},daily:{},hourly:{},current:{}})});
  await new Promise(r=>setImmediate(r));assert.equal(mutations,0,name+' discards a late reply for another city');assert.equal(race.sunTimes,null);
 }
 console.log('PASS: Moreni 00:48, NYC local sunset, city ownership, current temperature, suspended timer, night heat, RO/EN, polar flags and late source replies');
})().catch(e=>{console.error(e);process.exitCode=1;});
