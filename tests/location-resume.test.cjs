const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const body=html.slice(html.indexOf('async function actualizeazaLocatieAutomat('),html.indexOf('/** Aplică locația:',html.indexOf('async function actualizeazaLocatieAutomat(')));
function setup(){
 const values=new Map(),loc={nume:'București',tara:'RO',lat:44.4268,lon:26.1025};let synced=0,applied=0,geocodes=0;
 const c=vm.createContext({Promise,Date,Math,JSON,isFinite,LOC:loc,LOC_AUTO_KEY:'auto',_locAutoInCurs:false,_locAutoPromisiune:null,_locAutoGeneratieInCurs:0,_locAutoUltima:0,_locAutoGeneration:0,_locManualPreview:false,_locatiePregatita:true,
   document:{hidden:false},navigator:{geolocation:{},onLine:true},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))},
   urmarimLocatiaAutomat:async()=>true,pozitieCuReincercare:async()=>({coords:{latitude:loc.lat,longitude:loc.lon}}),
   numeLocatieDinPozitie:async p=>{geocodes++;return {...loc,lat:p.coords.latitude,lon:p.coords.longitude};},distantaLocatiiKm:()=>0,
   seteazaLocatie:async l=>{applied++;c.LOC=l;},actualizeazaLocatiaPush:async()=>{synced++;}});
 vm.runInContext(body,c);return {c,counts:()=>({synced,applied,geocodes})};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 // Focus and visibility can request the same slow fix. Neither may synchronize
 // notifications using the previous town before that shared lookup finishes.
 {
  const {c,counts}=setup();let finish,positions=0,returned=false;
  c.pozitieCuReincercare=()=>{positions++;return new Promise(r=>finish=r);};
  const first=c.actualizeazaLocatieAutomat(true);await tick();
  const second=c.actualizeazaLocatieAutomat(true).then(()=>{returned=true;});await tick();
  assert.equal(returned,false,'a concurrent resume must wait for the current GPS result');assert.equal(positions,1);
  finish({coords:{latitude:c.LOC.lat,longitude:c.LOC.lon}});await Promise.all([first,second]);
  assert.equal(returned,true);assert.equal(counts().synced,1);assert.equal(c._locAutoInCurs,false);assert.equal(c._locAutoPromisiune,null);
 }
 // A hidden-session lookup cannot become the GPS fix for the next foreground
 // session. Concurrent resume callers share one fresh replacement lookup.
 {
  const {c,counts}=setup();const finishes=[];c.pozitieCuReincercare=()=>new Promise(r=>finishes.push(r));
  const old=c.actualizeazaLocatieAutomat(true);await tick();c._locAutoGeneration++;c._locAutoUltima=0;
  const resume=c.actualizeazaLocatieAutomat(true),focus=c.actualizeazaLocatieAutomat(true);
  finishes[0]({coords:{latitude:45,longitude:25}});await tick();
  assert.equal(counts().geocodes,0,'discard the previous session before geocoding');assert.equal(finishes.length,2);
  finishes[1]({coords:{latitude:c.LOC.lat,longitude:c.LOC.lon}});await Promise.all([old,resume,focus]);
  assert.equal(counts().geocodes,1);assert.equal(counts().synced,1);assert.equal(c._locAutoPromisiune,null);
 }
 // Returning restores automatic following even if the manually viewed city is
 // already the current GPS town and needs no weather reload.
 {
  const {c,counts}=setup();c._locManualPreview=true;await c.actualizeazaLocatieAutomat(true);
  assert.equal(c._locManualPreview,false);assert.equal(counts().applied,0);assert.equal(counts().synced,1);
 }
 // Hidden pages and withdrawn permission must neither query GPS nor mutate the
 // confirmed notification town; the next allowed foreground check can recover.
 {
  const {c,counts}=setup();let positions=0;c.pozitieCuReincercare=async()=>{positions++;throw Error('must not query GPS');};
  c.document.hidden=true;await c.actualizeazaLocatieAutomat(true);c.document.hidden=false;
  c.urmarimLocatiaAutomat=async()=>false;await c.actualizeazaLocatieAutomat(true);
  assert.equal(positions,0);assert.deepEqual(counts(),{synced:0,applied:0,geocodes:0});assert.equal(c._locAutoInCurs,false);
 }
 console.log('PASS: shared GPS wait, fresh foreground session, restored following in the same city, and hidden/revoked permission isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
