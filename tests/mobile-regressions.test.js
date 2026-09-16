const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function between(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i + a.length);
  assert(i >= 0 && j > i, `missing block ${a}`);
  return html.slice(i, j);
}

// The min/max row gets one degree sign from fT, never a second one.
{
  var UNIT = 'C';
  eval(between('function cv(c)', '/** Diferență de temperatură'));
  const els = {};
  ['mbOras','mbTara','mbTemp','mbStare','mbMm','mbBaraOras','mbBaraSub','mjLocText'].forEach(id => els[id] = { textContent: '', innerHTML: '' });
  var document = { getElementById: id => els[id] || null };
  var LOC = { nume: 'Târgoviște', admin: 'Dâmbovița' };
  var MOBD = { current: { temperature_2m: 12.4, weather_code: 2 }, daily: { temperature_2m_max: [19], temperature_2m_min: [8] } };
  var T = k => ({maxScurt:'Max',minScurt:'Min'}[k] || k);
  var wmoText = () => 'Parțial noros';
  var mobPuncte = () => {};
  eval(between('function mobAntet()', '/* ══ BANDA PE ORE'));
  mobAntet();
  assert.strictEqual(els.mbTemp.innerHTML, '12<sup>°</sup>');
  assert.strictEqual(els.mbMm.textContent, 'Max: 19°  Min: 8°');
  assert(!els.mbMm.textContent.includes('°°'));
}

// A map detached for a foreign city remains available for the return to Romania.
{
  let live = {};
  function element(id) {
    return { id, isConnected: true, remove() { this.isConnected = false; delete live[id]; },
      replaceWith(old) { this.isConnected = false; old.isConnected = true; live[id] = old; } };
  }
  const oldMapElement = element('mbHartaAnmJos'); live.mbHartaAnmJos = oldMapElement;
  var document = { getElementById: id => live[id] || null };
  var _mobHarti = { mbHartaAnmJos: {} };
  eval(between('var _mobElementePastrate = {};', 'function mobRandare()'));
  mobDetaseazaHarti();                  // Romania -> New York
  mobReataseazaHarti(_mobElementePastrate); // no ANM placeholder abroad
  live.mbHartaAnmJos = element('mbHartaAnmJos');
  mobReataseazaHarti(_mobElementePastrate); // New York -> Romania
  assert.strictEqual(live.mbHartaAnmJos, oldMapElement);
  assert.strictEqual(oldMapElement.isConnected, true);
}

// Weather data is owned by coordinates, so another city's values are rejected.
{
  var MOBD = { current: { temperature_2m: 7 } }, _mobDateCheie = '44.927,25.457', _mobCache = {};
  eval(between('function mobCheieLoc(loc)', 'function mobPuneCache(loc, d)'));
  assert.strictEqual(mobDatePentruLoc({lat:44.9266,lon:25.4566}), MOBD);
  assert.strictEqual(mobDatePentruLoc({lat:40.7128,lon:-74.006}), null);
}

// The AI snapshot uses current.temperature_2m; daily maximum stays separately labelled.
{
  const dom = {};
  ['mbOras','mbTara','mbTemp','mbStare','mbMm','mbContinut','mfContinut','mlFaza','mlData','mlIlum','mlRas','mlApus','mlPlina','mlDist']
    .forEach(id => dom[id] = { isConnected:true, innerText:'', textContent:'' });
  var document = { getElementById:id => dom[id] || null, querySelector:() => null };
  var LOC = { nume:'New York City', admin:'New York', tara:'US', lat:40.7128, lon:-74.006, tz:'America/New_York' };
  var LANG='ro', UNIT='C', _ccDate=null, _ccUltimaLoc=null, _mobCache={'40.713,-74.006':{t:Date.now()}};
  const times = Array.from({length:12}, (_,i)=>`2026-09-16T${String(i+10).padStart(2,'0')}:00`);
  var MOBD = { current:{time:'2026-09-16T10:15',temperature_2m:12.3,apparent_temperature:11.4,weather_code:2,relative_humidity_2m:60,surface_pressure:1015,precipitation:0,wind_speed_10m:8,wind_gusts_10m:14,wind_direction_10m:250,uv_index:3,is_day:1},
    hourly:{time:times,temperature_2m:Array(12).fill(13),weather_code:Array(12).fill(2),precipitation_probability:Array(12).fill(10),precipitation:Array(12).fill(0),wind_speed_10m:Array(12).fill(8),wind_gusts_10m:Array(12).fill(14),visibility:Array(12).fill(10000)},
    daily:{time:['2026-09-16'],temperature_2m_min:[8],temperature_2m_max:[31],weather_code:[2],sunrise:['2026-09-16T06:40'],sunset:['2026-09-16T19:05'],precipitation_sum:[0],precipitation_probability_max:[10],uv_index_max:[5],wind_speed_10m_max:[16],wind_gusts_10m_max:[28]} };
  var esteMobil=()=>true, mobCheieLoc=l=>(+l.lat).toFixed(3)+','+(+l.lon).toFixed(3), mobDatePentruLoc=()=>MOBD;
  var cv=x=>x, fT=(x,n)=>Number(x).toFixed(n)+'°C', wmoText=()=> 'Parțial noros', mobAcumLocal=()=>new Date(2026,8,16,10,15), mobDinIso=s=>new Date(s), mobOra=s=>s.slice(11,16), esteRomania=()=>false;
  eval(between('function textSimplu(id, limita)', 'function sendChatMessage(text)'));
  const snap=getAppWeatherSnapshot();
  assert.strictEqual(snap.localitate.nume,'New York City');
  assert.strictEqual(snap.curent.temperatura_c,12.3);
  assert.strictEqual(snap.azi.maxima,'31.0°C');
  assert.notStrictEqual(snap.curent.temperatura,snap.azi.maxima);
}

assert(html.includes("Math.round(cv(esteAcum ? MOBD.current.temperature_2m : o.temperature_2m[k]))"));
console.log('mobile regressions: ok');
