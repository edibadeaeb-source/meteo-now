const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function construiestePuncteZona('),end=html.indexOf('function initForecastMap()',start);
const context=vm.createContext({LOC:{lat:44.9266,lon:25.4566,nume:'Târgoviște'},LANG:'ro',Math,Promise,fetch:()=>{throw Error('Generated map coordinates cannot use client GPS geocoding');}});
vm.runInContext(html.slice(start,end),context);
(async()=>{
 for(const [language,prefix]of [['ro','Zona de '],['en','Area to the ']]){
  context.LANG=language;const points=context.construiestePuncteZona();
  const coords=points.map(p=>[p.lat,p.lon]);await context.numesteePuncte(points);
  assert.equal(points.length,13);assert.equal(points[0].n,'Târgoviște');
  assert(points.slice(1).every(p=>p.n.startsWith(prefix)));
  assert.deepEqual(points.map(p=>[p.lat,p.lon]),coords);
  assert.equal(points.find(p=>p.lat>context.LOC.lat&&p.lon>context.LOC.lon).n,prefix+(language==='ro'?'nord-est':'north-east'));
 }
 console.log('PASS: 13 forecast points retain coordinates and get local RO/EN labels without GPS-provider misuse');
})().catch(e=>{console.error(e);process.exitCode=1;});
