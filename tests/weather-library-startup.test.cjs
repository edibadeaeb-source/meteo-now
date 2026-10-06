const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),loc={lat:44.9266,lon:25.4566};
for(const previous of ['clear-day','clear-day-a','clear-day-b']) {
 const key='44.927,25.457:clear-day:day',seen=[],loads=[];
 const values={
  'meteo-weather-rotation-v1':JSON.stringify({[key]:previous}),
  'meteo-loc':JSON.stringify(loc),
  'meteo-atmosphere-v1':JSON.stringify({at:Date.now(),...loc,selection:{scene:'clear-day',night:false,movie:'clear-day',thermal:'mild',key:'old-key',clip:{id:previous,version:99,base:'https://invalid.example/old.mp4'}}})
 };
 const layers=[],attrs={},el={setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],querySelectorAll:()=>layers,appendChild:v=>layers.push(v)};
 class Photo { set src(v){loads.push(v);} }
 const c=vm.createContext({window:{MeteoWeatherMotion:{update:v=>seen.push(v)}},localStorage:{getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v},Image:Photo,Date,Math,Promise,isFinite,
  document:{documentElement:{setAttribute(){}},getElementById:id=>id==='mobCer'?el:null,createElement:()=>({setAttribute(){},classList:{add(){},remove(){}}})}});
 for(const file of ['weather-library.js','weather-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const expected=previous==='clear-day'?'clear-day-a':previous==='clear-day-a'?'clear-day-b':'clear-day';
 assert.equal(attrs['data-clip'],expected,'startup immediately uses the current visit film');
 const forecast={current:{weather_code:0,time:'2026-10-06T12:00',is_day:1,temperature_2m:20},daily:{sunrise:['2026-10-06T07:00'],sunset:['2026-10-06T19:00']}};
 const fresh=c.window.MeteoAtmosphere.select(forecast,null,loc);
 assert.equal(fresh.clip.id,expected,'fresh forecast preserves the startup choice');
 assert.equal(fresh.key,seen[0].key,'startup and fresh forecast share a transition key');
 c.window.MeteoAtmosphere.render(forecast,null,loc);
 assert.equal(loads.length,1,'the matching poster is not loaded twice');
 assert.ok(!loads[0].includes('invalid.example'),'cached arbitrary asset paths are ignored');
}
console.log('PASS: original/a/b rotation starts before forecast, remains stable on refresh and ignores cached arbitrary paths');
