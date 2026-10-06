const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c=vm.createContext({window:{atob:s=>Buffer.from(s,'base64').toString('binary')},document:{getElementById:()=>null},localStorage:{getItem:()=>null},Date,Math,Promise,isFinite});
for(const name of ['weather-geography.js','weather-atmosphere.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
const select=c.window.MeteoAtmosphere.select,geo=c.window.MeteoGeography;
const locations={moreni:{lat:44.983,lon:25.644},newYork:{lat:40.7128,lon:-74.006},miami:{lat:25.7617,lon:-80.1918},constanta:{lat:44.1598,lon:28.6348},phuket:{lat:7.88,lon:98.39},singapore:{lat:1.29,lon:103.85},madrid:{lat:40.4168,lon:-3.7038},sydney:{lat:-33.8688,lon:151.2093},honolulu:{lat:21.3099,lon:-157.8581},reykjavik:{lat:64.1466,lon:-21.9426},suva:{lat:-18.1248,lon:178.4501},lima:{lat:-12.0464,lon:-77.0428}};
function data(code,temp=15,night=false){return {current:{weather_code:code,temperature_2m:temp,is_day:night?0:1,time:'2026-10-06T'+(night?'23':'12')+':00'},daily:{sunrise:['2026-10-06T07:00'],sunset:['2026-10-06T18:30']}};}
for(const city of ['constanta','phuket','singapore','sydney','honolulu','reykjavik','suva','lima'])assert.equal(geo.nearCoast(locations[city].lat,locations[city].lon),true,city+' coast');
for(const city of ['moreni','madrid'])assert.equal(geo.nearCoast(locations[city].lat,locations[city].lon),false,city+' inland');
assert.equal(geo.nearCoast(0,0),false);assert.equal(geo.nearCoast(NaN,20),false);
assert.equal(select(data(0,15),null,locations.newYork).movie,'new-york');
assert.equal(select(data(0,30),null,locations.miami).movie,'miami');
assert.equal(select(data(0,30),null,locations.moreni).movie,'clear-day','hot inland must not become a tropical beach');
assert.equal(select(data(0,30),null,locations.phuket).movie,'tropical-coast');
assert.equal(select(data(0,15),null,locations.constanta).movie,'coast');
assert.equal(select(data(2,23),null,locations.miami).movie,'coast-cloudy');
assert.equal(select(data(0,-2),null,locations.reykjavik).movie,'clear-day','no summer beach in polar cold');
for(const city of Object.values(locations)){
 for(const [code,expected]of [[3,'overcast'],[45,'fog'],[63,'rain'],[85,'snow'],[95,'storm']])assert.equal(select(data(code,30),null,city).movie,expected);
 for(const code of [0,1,2])assert.ok(!/miami|coast|new-york|highland/.test(select(data(code,30,true),null,city).movie),'no sunny landscape at night');
}
const high=data(0,10);high.elevation=1400;assert.equal(select(high,null,{lat:45.5,lon:25.5}).movie,'highland');
const f=data(0,86);f.current_units={temperature_2m:'°F'};assert.equal(select(f,null,locations.miami).thermal,'hot');
const cold=select(data(0,5),null,locations.newYork),hot=select(data(0,30),null,locations.newYork);assert.notEqual(cold.key,hot.key);
const polar=data(0,-5);polar.daily.sunrise=['2026-10-06T00:00'];polar.daily.sunset=['2026-10-06T00:00'];assert.equal(select(polar).night,false,'polar day uses the daylight flag when there is no sunset');
polar.current.is_day=0;assert.equal(select(polar).night,true,'polar night also uses the flag');
for(const loc of Object.values(locations))for(const code of [0,1,2,3,45,63,85,95]){const chosen=select(data(code,30),null,loc);assert.ok(fs.existsSync(path.join(__dirname,'..',chosen.url)),chosen.url);}
console.log('PASS: worldwide coast context, actual temperature units, NYC/Miami, inland heat, altitude, cold coasts and weather/night priority');
