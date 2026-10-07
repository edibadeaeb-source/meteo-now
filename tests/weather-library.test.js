const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'weather-library.js'),'utf8');
const values={};const localStorage={getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v};
function visit(){const c=vm.createContext({window:{},localStorage,Math});vm.runInContext(source,c);return c.window.MeteoWeatherLibrary;}
const loc={lat:44.9266,lon:25.4566},other={lat:40.7128,lon:-74.006};
const weather=['clear-day','clear-night','partly-cloudy','overcast','rain','storm','snow','fog'];
let first=visit();
for(const movie of weather){
 const original=first.pick(movie,false,loc);assert.equal(original.id,movie);assert.equal(original.version,2);
 assert.equal(first.pick(movie,false,loc).id,movie,'repeat updates must not rotate a film');
 for(const suffix of ['a','b'])assert.ok(first.restore(movie+'-'+suffix,movie),'two additions for '+movie);
 assert.equal(first.restore('https://evil.invalid/video.mp4',movie),null);
 assert.equal(first.restore('miami-a',movie),null,'another weather/location pool is not a valid cache entry');
}
for(const suffix of ['a','b']){
 const next=visit();
 for(const movie of weather){
  const clip=next.pick(movie,false,loc);assert.equal(clip.id,movie+'-'+suffix);assert.equal(clip.version,movie==='rain'?6:movie==='clear-night'&&suffix==='a'?5:3);
  const dir=path.join(root,'assets/weather-video/v'+clip.version);
  for(const file of [clip.base+'-lite.mp4',clip.base+'-'+clip.quality+'.mp4',clip.base+'.webp'])assert.ok(fs.existsSync(path.join(dir,file)),file);
  assert.equal(next.pick(movie,false,loc).id,clip.id);assert.equal(next.pick(movie,false,other).id,suffix==='a'?movie:movie+'-a','another city owns its rotation');
 }
}
assert.equal(visit().restore('twilight-a','twilight'),null,'withdrawn flare footage cannot be restored from old cache');
for(const id of ['twilight','twilight-b','twilight']) { const lib=visit(),clip=lib.pick('twilight',false,loc);assert.equal(clip.id,id);assert.equal(lib.pick('twilight',false,loc).id,id); }
const last=visit();for(const movie of weather)assert.equal(last.pick(movie,false,loc).id,movie,'original films remain in the rotation');
// Separate day/night choices, corrupted storage, and a bounded history.
assert.equal(last.pick('partly-cloudy',true,loc).id,'partly-cloudy');
values['meteo-weather-rotation-v1']='17';assert.equal(visit().pick('rain',false,loc).id,'rain');
const bounded=visit();for(let i=0;i<100;i++)bounded.pick('rain',false,{lat:i/10,lon:20});assert.equal(Object.keys(JSON.parse(values['meteo-weather-rotation-v1'])).length,64);
values['meteo-weather-rotation-v1']=JSON.stringify({'44.927,25.457:twilight:day':'twilight-a'});
assert.equal(visit().pick('twilight',false,loc).id,'twilight','an old withdrawn choice selects an available film');
console.log('PASS: weather variants rotate safely, poor twilight film withdrawn, originals retained, stable visits, city/night isolation, real assets, safe cached IDs and bounded rotation history');
