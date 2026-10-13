const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function block(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start);
  return html.slice(a, b);
}
function store(initial = {}) {
  const values = {...initial};
  return {getItem:k => values[k] || null, setItem:(k,v) => values[k] = String(v), removeItem:k => delete values[k]};
}
function context(extra = {}) {
  const checkbox = {checked:true, disabled:false};
  return vm.createContext({Promise, Date, Math, JSON, Intl, isFinite, setTimeout, clearTimeout,
    _locAutoPromisiune:null, LANG:'ro', UNIT:'C', LOC:{nume:'Moreni', tara:'RO', admin:'Dâmbovița', lat:44.98, lon:25.64},
    document:{hidden:false, getElementById:() => checkbox}, localStorage:store(), sessionStorage:store(),
    pushNote:()=>{}, ...extra});
}
async function run() {
  // Returning from native permission checks reuses the existing subscription.
  for (const status of ['granted', 'denied', 'unconfirmed']) {
    let calls = 0;
    const c = context({navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>({unsubscribe:()=>{throw Error('must not unsubscribe');}})}})}},
      rezultatPermisiuneAndroid:async()=>{if(status==='unconfirmed') throw Error('permission result not confirmed'); return status;},
      pushSubscribe:async()=>{calls++; return true;}});
    vm.runInContext(block('async function revalideazaAbonamentAndroid(', '(function initPush()'), c);
    const result = await c.revalideazaAbonamentAndroid(true);
    assert.strictEqual(result, status === 'granted');
    assert.strictEqual(calls, status === 'granted' ? 1 : 0);
    assert.strictEqual(c.document.getElementById().disabled, false);
    assert.strictEqual(c.document.getElementById().checked, status !== 'denied');
    if (status === 'unconfirmed') assert.notStrictEqual(c.sessionStorage.getItem('meteo-android-notifications'), 'denied');
  }
  // City browsing preserves GPS notifications; toggling automatic mode off uses the viewed city.
  {
    const c = context({LOC_AUTO_KEY:'meteo-locatie-automata', _locAutoGeneration:0, _locManualPreview:false});
    c.localStorage.setItem(c.LOC_AUTO_KEY, '1');
    c.localStorage.setItem('meteo-gps-location', JSON.stringify({...c.LOC, nume:'București'}));
    vm.runInContext(block('function seteazaModLocatieAutomata(', 'async function urmarimLocatiaAutomat()'), c);
    vm.runInContext(block('function locatiePentruNotificari()', 'async function trimiteAbonament('), c);
    c.seteazaModLocatieAutomata('manual');
    assert.strictEqual(c.localStorage.getItem(c.LOC_AUTO_KEY), '1');
    assert.strictEqual(c.locatiePentruNotificari().nume, 'București');
    c.localStorage.setItem(c.LOC_AUTO_KEY,'0');
    assert.strictEqual(c.locatiePentruNotificari().nume, 'Moreni');
  }
  // A location result started before a manual city choice cannot overwrite it.
  {
    let finishGPS, positions = 0, applied = 0;
    const c = context({_locAutoInCurs:false, _locAutoPromisiune:null, _locAutoGeneratieInCurs:0, _locatiePregatita:true, _locAutoUltima:0,
      _locAutoGeneration:0, _locManualPreview:false, LOC_AUTO_KEY:'auto', navigator:{geolocation:{}},
      urmarimLocatiaAutomat:async()=>true,
      pozitieCuReincercare:()=>{positions++; return new Promise(resolve=>finishGPS=resolve);},
      numeLocatieDinPozitie:async()=>{throw Error('cancelled result must not be geocoded');},
      seteazaLocatie:()=>applied++, actualizeazaLocatiaPush:async()=>{}});
    vm.runInContext(block('async function actualizeazaLocatieAutomat(', '/** Aplică locația:'), c);
    const pending = c.actualizeazaLocatieAutomat(true);
    await new Promise(resolve=>setImmediate(resolve));
    const simultaneous = c.actualizeazaLocatieAutomat(true);
    assert.strictEqual(positions, 1);
    c._locAutoGeneration++;
    finishGPS({coords:{latitude:45,longitude:26}});
    await Promise.all([pending, simultaneous]);
    assert.strictEqual(applied, 0);
    assert.strictEqual(c._locAutoInCurs, false);
  }
  // Old in-flight saves finish before the latest city; the final server state is current.
  {
    const writes = []; let release;
    const c = context({_locatiePregatita:true, _pushSaveChain:Promise.resolve(), _pushSaveVersion:0,
      abonamentPushJSON:()=>({endpoint:'https://push.example.test',keys:{auth:'a',p256dh:'b'}}),
      locatiePentruNotificari:()=>c.LOC,
      pushFetch:async(url, opts)=>{
        writes.push(JSON.parse(opts.body).nume);
        if(writes.length === 1) await new Promise(resolve=>release=resolve);
        return {ok:true,json:async()=>({ok:true})};
      }});
    vm.runInContext(block('async function trimiteAbonament(', '/* Când utilizatorul schimbă orașul'), c);
    const first = c.trimiteAbonament({});
    await new Promise(resolve=>setImmediate(resolve));
    c.LOC = {...c.LOC, nume:'București'};
    const latest = c.trimiteAbonament({});
    release();
    await Promise.all([first,latest]);
    assert.deepStrictEqual(writes, ['Moreni','București']);
  }
  // Permission revalidation can save a subscription independently of the GPS
  // caller. It must wait for the new town, and recheck off after that wait.
  for (const turnOff of [false, true]) {
    let releaseGPS;const writes=[];
    const c=context({_locatiePregatita:true,_pushSaveChain:Promise.resolve(),_pushSaveVersion:0,
      abonamentPushJSON:()=>({endpoint:'https://push.example.test',keys:{auth:'a',p256dh:'b'}}),
      locatiePentruNotificari:()=>c.LOC,
      pushFetch:async(url,opts)=>{writes.push(JSON.parse(opts.body).nume);return {ok:true,json:async()=>({ok:true})};}});
    c._locAutoPromisiune=new Promise(resolve=>releaseGPS=resolve);
    vm.runInContext(block('async function trimiteAbonament(', '/* Când utilizatorul schimbă orașul'),c);
    const saving=c.trimiteAbonament({});await new Promise(resolve=>setImmediate(resolve));
    assert.deepStrictEqual(writes,[],'subscription must wait for the foreground GPS fix');
    c.LOC={...c.LOC,nume:'București'};if(turnOff)c.localStorage.setItem('meteo-push-disabled','1');
    const completed=c._locAutoPromisiune;c._locAutoPromisiune=null;releaseGPS();await completed;await saving;
    assert.deepStrictEqual(writes,turnOff?[]:['București']);
  }
  // Compile each executable inline script and the worker to catch syntax errors.
  // A resume/update cannot recreate a subscription that the user turned off.
  {
    const c = context({_locatiePregatita:true,
      abonamentPushJSON:()=>{throw Error('disabled push must not be saved');}});
    c.localStorage.setItem('meteo-push-disabled','1');
    vm.runInContext(block('async function trimiteAbonament(', '/* Când utilizatorul schimbă orașul'), c);
    await c.trimiteAbonament({});
  }
  // Compile each executable inline script and the worker to catch syntax errors.
  // Recovery after a GPS/network failure is not suppressed by the 2-minute throttle.
  {
    let attempts = 0, synced = 0;
    const c = context({_locAutoInCurs:false, _locAutoPromisiune:null, _locAutoGeneratieInCurs:0, _locatiePregatita:true, _locAutoUltima:0,
      _locAutoGeneration:0, _locManualPreview:false, LOC_AUTO_KEY:'auto', navigator:{geolocation:{}},
      urmarimLocatiaAutomat:async()=>true,
      pozitieCuReincercare:async()=>{if(++attempts === 1) throw Error('offline'); return {coords:{latitude:45,longitude:26}};},
      numeLocatieDinPozitie:async()=>({...c.LOC, nume:'București',lat:45,lon:26}),
      distantaLocatiiKm:()=>10, seteazaLocatie:async()=>{}, actualizeazaLocatiaPush:async()=>synced++});
    vm.runInContext(block('async function actualizeazaLocatieAutomat(', '/** Aplică locația:'), c);
    await c.actualizeazaLocatieAutomat(true);
    assert.strictEqual(c._locAutoUltima, 0);
    await c.actualizeazaLocatieAutomat(true);
    assert.strictEqual(attempts, 2);
    assert.strictEqual(synced, 1);
    assert.strictEqual(JSON.parse(c.localStorage.getItem('meteo-gps-location')).nume, 'București');
  }
  // Explicit opt-in still works on browsers whose Permissions API rejects geolocation.
  // A manual tap cancels GPS before waiting for the next city's network response.
  {
    const c = context({_locAutoGeneration:0,_locManualPreview:false,LOC_AUTO_KEY:'auto',_mobLocSerial:0,
      document:{hidden:false,getElementById:()=>null},
      window:{MeteoForecastCache:true},MeteoForecastCache:{ready:new Promise(()=>{})}, mobDateDinCache:()=>null});
    vm.runInContext(block('function seteazaModLocatieAutomata(', 'async function urmarimLocatiaAutomat()'),c);
    vm.runInContext(block('function mobSchimbaLocatie(', 'function mobPrefetchVecini()'),c);
    c.mobSchimbaLocatie({...c.LOC,nume:'București'},'manual');
    assert.strictEqual(c._locAutoGeneration,1);
    assert.strictEqual(c._locManualPreview,true);
  }
  // Explicit opt-in still works on browsers whose Permissions API rejects geolocation.
  {
    const c = context({LOC_AUTO_KEY:'auto', navigator:{permissions:{query:async()=>{throw Error('unsupported');}}}});
    vm.runInContext(block('async function urmarimLocatiaAutomat()', 'function distantaLocatiiKm('), c);
    assert.strictEqual(await c.urmarimLocatiaAutomat(), false);
    c.localStorage.setItem('auto','1');
    assert.strictEqual(await c.urmarimLocatiaAutomat(), true);
    c.localStorage.setItem('auto','0');
    assert.strictEqual(await c.urmarimLocatiaAutomat(), false);
  }
  // Staying within 100m reuses the confirmed locality; a different town is geocoded.
  {
    let geocodes = 0;
    const c = context({pushFetch:async()=>{geocodes++;return {ok:true,json:async()=>({city:'București',countryCode:'RO'})};}});
    vm.runInContext(block('function distantaLocatiiKm(', 'async function actualizeazaLocatieAutomat('), c);
    c.localStorage.setItem('meteo-gps-location',JSON.stringify(c.LOC));
    assert.strictEqual((await c.numeLocatieDinPozitie({coords:{latitude:44.9801,longitude:25.6401}})).nume,'Moreni');
    assert.strictEqual(geocodes,0);
    assert.strictEqual((await c.numeLocatieDinPozitie({coords:{latitude:44.43,longitude:26.1}})).nume,'București');
    assert.strictEqual(geocodes,1);
  }
  // A transient sync retries using the latest GPS location, never an old captured city.
  {
    let retry, sends = 0; const places = [];
    const c = context({_locatiePregatita:true,_pushSyncTimer:null,_pushSyncRetries:0,
      navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>({})}})}},
      esteAplicatiaAndroid:()=>false, Notification:{permission:'granted'},
      setTimeout:(fn)=>{retry=fn;return 123;},clearTimeout:()=>{},
      trimiteAbonament:async()=>{places.push(c.LOC.nume);if(++sends === 1)throw Error('temporary 503');}});
    vm.runInContext(block('async function actualizeazaLocatiaPush()', 'async function pushUnsubscribe()'),c);
    await c.actualizeazaLocatiaPush();
    assert.strictEqual(c._pushSyncTimer,123);
    c.LOC = {...c.LOC,nume:'București'};
    retry();
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepStrictEqual(places,['Moreni','București']);
    assert.strictEqual(c._pushSyncTimer,null);
    assert.strictEqual(c._pushSyncRetries,0);
    c.localStorage.setItem('meteo-push-disabled','1');
    await c.actualizeazaLocatiaPush();
    assert.strictEqual(sends,2);
  }
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(!/application\/(?:ld\+)?json/.test(match[1])) new vm.Script(match[2]);
  }
  new vm.Script(fs.readFileSync(require('path').join(__dirname,'..','sw.js'),'utf8'));
  console.log('notification flows and script syntax: ok');
}
run().catch(error=>{console.error(error); process.exitCode=1;});
