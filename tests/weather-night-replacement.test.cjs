const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),loc={lat:44.983,lon:25.644,nume:'Moreni',tara:'RO'};
const seen=[],loads=[],values={
 'meteo-weather-rotation-v1':JSON.stringify({'44.983,25.644:partly-cloudy-night:night':'partly-cloudy-night-a'}),
 'meteo-loc':JSON.stringify(loc),
 'meteo-atmosphere-v1':JSON.stringify({at:Date.now(),...loc,selection:{scene:'partly-cloudy',night:true,movie:'partly-cloudy-night',thermal:'mild',key:'old-key',clip:{id:'partly-cloudy-night-b',version:4}}})
};
const layers=[],attrs={},el={setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],querySelectorAll:()=>layers.filter(x=>x.className==='weather-photo'),querySelector:()=>null,appendChild:v=>layers.push(v)};
class Photo{set src(v){loads.push(v);}}
const c=vm.createContext({window:{MeteoWeatherMotion:{update:v=>seen.push(v)}},localStorage:{getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v},Image:Photo,Date,Math,Promise,isFinite,
 document:{documentElement:{setAttribute(){}},getElementById:id=>id==='mobCer'?el:null,createElement:()=>({style:{},setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}})}});
for(const file of ['weather-library.js','weather-romania.js','weather-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
assert.equal(seen[0].clip.id,'partly-cloudy-night-b');assert.equal(seen[0].clip.version,8);
assert.equal(loads[0],'assets/weather-video/v8/partly-cloudy-night-b.jpg','old cached snapshot must immediately use new media');
assert.equal(c.window.MeteoWeatherLibrary.restore('partly-cloudy-night-a','partly-cloudy-night').version,4,'other night variant stays intact');
assert.equal(c.window.MeteoWeatherLibrary.restore('overcast-night-b','overcast-night').version,7,'overcast stays intact');
console.log('PASS: Moreni cached-night startup replaces old v4 media with v8; other night variants preserved');
