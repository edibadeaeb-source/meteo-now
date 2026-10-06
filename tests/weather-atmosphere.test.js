const assert = require('assert'), vm = require('vm'), fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname,'..','weather-atmosphere.js'),'utf8');
function storage(){const v={};return {getItem:k=>v[k]||null,setItem:(k,x)=>v[k]=x};}
function classes(){const s=new Set();return {add:k=>s.add(k),remove:k=>s.delete(k),contains:k=>s.has(k)};}
const root = {attrs:{},layers:[],setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},querySelectorAll(){return this.layers;},appendChild(x){this.layers.push(x);}};
const loads=[];
class FakeImage {set src(v){this.url=v; loads.push(this);}decode(){return Promise.resolve();}}
const document={documentElement:{setAttribute(){}},getElementById:id=>id==='mobCer'?root:null,createElement:()=>({classList:classes(),setAttribute(){}})};
const c=vm.createContext({window:{},document,Image:FakeImage,Date,Promise,isFinite,localStorage:storage()});
vm.runInContext(code,c);
const api=c.window.MeteoAtmosphere;
const forecast=(wmo,time='2026-10-06T12:00',day=1)=>({current:{weather_code:wmo,time,is_day:day},daily:{sunrise:['2026-10-06T07:00'],sunset:['2026-10-06T18:30']}});
for(const [wmo,expected] of [[0,'clear-day'],[1,'partly-cloudy'],[2,'partly-cloudy'],[3,'overcast'],[45,'fog'],[48,'fog'],[51,'rain'],[67,'rain'],[71,'snow'],[77,'snow'],[80,'rain'],[82,'rain'],[85,'snow'],[86,'snow'],[95,'storm'],[99,'storm']]){
  assert.strictEqual(api.select(forecast(wmo)).scene,expected);
  assert(fs.existsSync(path.join(__dirname,'..',api.select(forecast(wmo)).url)));
}
assert.strictEqual(api.select(forecast(0,'2026-10-06T22:00',0)).scene,'clear-night');
assert.strictEqual(api.select(forecast(63,'2026-10-06T22:00',0)).night,true);
assert.strictEqual(api.select(forecast(0,'2026-10-06T18:20')).scene,'twilight');
assert.strictEqual(api.select(forecast(2,'2026-10-06T07:10')).scene,'twilight');
assert.strictEqual(api.select(forecast(95,'2026-10-06T18:20')).scene,'storm');
assert.strictEqual(api.select(forecast(45,'2026-10-06T07:10')).scene,'fog');
assert.strictEqual(api.select(forecast(0,'2026-10-06T20:00',1)).night,true);
// Day index changes in cached forecasts; use sunrise for the current city date.
const next=forecast(0,'2026-10-07T07:05');next.daily.sunrise.push('2026-10-07T07:01');next.daily.sunset.push('2026-10-07T18:29');
assert.strictEqual(api.select(next).scene,'twilight');
(async()=>{
  const old=api.render(forecast(0)), latest=api.render(forecast(95));
  loads[1].onload(); await latest;
  loads[0].onload(); await old;
  assert.strictEqual(root.attrs['data-scene'],'storm');
  assert.strictEqual(root.layers.filter(x=>x.classList.contains('is-visible')).length,1);
  const count=loads.length;
  await api.render(forecast(95));assert.strictEqual(loads.length,count,'same scene must reuse its decoded photo');
  const failed=api.render(forecast(45));loads.at(-1).onerror();await failed;
  assert.strictEqual(root.attrs['data-scene'],'fog');
  assert.strictEqual(root.layers.filter(x=>x.classList.contains('is-visible')).length,0,'failure must not show the old weather');
  console.log('weather selection, city time, decode reuse, loading race and offline fallback: ok');
})().catch(e=>{console.error(e);process.exitCode=1;});
