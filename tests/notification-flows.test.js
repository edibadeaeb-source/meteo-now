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
    LANG:'ro', UNIT:'C', LOC:{nume:'Moreni', tara:'RO', admin:'Dâmbovița', lat:44.98, lon:25.64},
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
    const c = context({_locAutoInCurs:false, _locatiePregatita:true, _locAutoUltima:0,
      _locAutoGeneration:0, _locManualPreview:false, LOC_AUTO_KEY:'auto', navigator:{geolocation:{}},
      urmarimLocatiaAutomat:async()=>true,
      pozitieCuReincercare:()=>{positions++; return new Promise(resolve=>finishGPS=resolve);},
      numeLocatieDinPozitie:async()=>{throw Error('cancelled result must not be geocoded');},
      seteazaLocatie:()=>applied++, actualizeazaLocatiaPush:async()=>{}});
    vm.runInContext(block('async function actualizeazaLocatieAutomat(', '/** Aplică locația:'), c);
    const pending = c.actualizeazaLocatieAutomat(true);
    await Promise.resolve();
    await c.actualizeazaLocatieAutomat(true);
    assert.strictEqual(positions, 1);
    c._locAutoGeneration++;
    finishGPS({coords:{latitude:45,longitude:26}});
    await pending;
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
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(!/application\/(?:ld\+)?json/.test(match[1])) new vm.Script(match[2]);
  }
  new vm.Script(fs.readFileSync(require('path').join(__dirname,'..','sw.js'),'utf8'));
  console.log('notification flows and script syntax: ok');
}
run().catch(error=>{console.error(error); process.exitCode=1;});
