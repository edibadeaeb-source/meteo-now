const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),values={};
const c=vm.createContext({window:{atob:s=>Buffer.from(s,'base64').toString('binary')},document:{getElementById:()=>null},localStorage:{getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v},Date,Math,Promise,isFinite});
for(const file of ['weather-geography.js','weather-library.js','weather-romania.js','weather-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
const {MeteoRomania:ro,MeteoWeatherLibrary:library,MeteoAtmosphere:atmosphere}=c.window;
function forecast(code,night=false,temp=20){return {current:{weather_code:code,temperature_2m:temp,time:'2026-10-07T'+(night?'23':'12')+':00',is_day:night?0:1},daily:{sunrise:['2026-10-07T07:00'],sunset:['2026-10-07T19:00']}};}
const select=(code,loc,night=false,temp=20)=>atmosphere.select(forecast(code,night,temp),null,loc);
assert.equal(ro.cities.length,48);
let covered=0;
for(const city of ro.cities){const loc={lat:city.lat,lon:city.lon,nume:city.name,tara:'RO'};
 assert.equal(ro.city(loc).id,city.id);assert.equal(ro.city({lat:city.lat,lon:city.lon}).id,city.id);
 let daytime=false;for(const code of [0,1,2,3]){const a=select(code,loc);if(a.movie.startsWith('ro-'))daytime=true;assert.equal(a.night,false);assert.equal(select(code,loc).clip?.id,a.clip?.id,'same visit must keep frame');}
 assert.ok(daytime,city.name+' must have a genuine local daytime asset');covered++;
 for(const code of [0,1,2,3,45,63,85,95])for(const night of [false,true]){const a=select(code,loc,night,code===85?-2:20);
  assert.ok(fs.existsSync(path.join(root,a.url)),a.url);
  assert.equal(a.night,night);assert.ok(a.clip&&library.restore(a.clip.id,a.movie));
  if(night)assert.ok(!a.movie.endsWith('-day')&&!a.clip.id.includes('-sunny-'),'night must never select a sunny city frame');
  if([45,95].includes(code))assert.equal(a.movie,code===45?'fog':'storm','local scenery must not replace fog or storms');
  if(code===63&&!a.movie.startsWith('ro-slobozia-rain')&&!a.movie.startsWith('ro-miercurea-ciuc-rain'))assert.equal(a.movie,'rain');
 }
}
for(const [code,movie]of [[2,'partly-cloudy-night'],[3,'overcast-night']]){const a=select(code,{lat:40.7128,lon:-74.006,nume:'New York City'},true);assert.equal(a.movie,movie);assert.ok(a.clip.id.startsWith(movie));assert.equal(a.clip.version,code===3?7:4);}
for(const loc of [{nume:'Arad',lat:31.26,lon:35.21},{nume:'Alexandria',lat:31.2,lon:29.9},{nume:'Sfântu Gheorghe',lat:44.9,lon:29.6,tara:'RO'},{nume:'Satu Mare',lat:46.8,lon:25.4,tara:'RO'},{nume:'București',lat:44.4268,lon:26.1025,tara:'MD'},{nume:'Voluntari',lat:44.435,lon:26.105,tara:'RO'},{nume:'București',lat:null,lon:null}])assert.equal(ro.city(loc),null,'unrelated place must not get a Romanian city frame');
for(const spelling of ['Bucharest','Bucuresti','București'])assert.equal(ro.city({name:spelling,lat:44.4268,lon:26.1025}).id,'bucharest');
assert.ok(!select(0,{nume:'Mangalia',lat:43.817,lon:28.578},false,5).movie.startsWith('ro-mangalia'),'no summer resort in cold weather');
assert.equal(select(0,{lat:40.7128,lon:-74.006},false,20).movie,'new-york');assert.equal(select(0,{lat:25.7617,lon:-80.1918},false,30).movie,'miami');
console.log('PASS: '+covered+' Romanian cities, every weather/day/night combination, asset existence, stable visit, actual location/foreign names, cold coast and separate cloudy night scenes');
