const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const code=html.slice(html.indexOf('function wmoNight('),html.indexOf('function wmoText('));
const c=vm.createContext({});vm.runInContext(code,c);
for(const [city,rise,set]of [['Moreni','07:15','18:45'],['New York','07:01','18:31'],['Tokyo','05:43','17:20']]){
 const d={daily:{sunrise:['2026-10-06T'+rise,'2026-10-07T'+rise],sunset:['2026-10-06T'+set,'2026-10-07T'+set]}};
 for(const time of ['2026-10-06T00:00','2026-10-06T23:00','2026-10-07T00:00']){
  assert.equal(c.wmoNight(d,time),true,city+' midnight');
  assert.match(c.wmoIcon(0,c.wmoNight(d,time)),/<svg/);
  for(const code of [0,1,2,51,53,55])assert(!/[☀🌤🌦]/u.test(c.wmoIcon(code,true)),city+' night code '+code);
 }
 assert.equal(c.wmoNight(d,'2026-10-06T12:00'),false,city+' noon');
 assert.equal(c.wmoNight(d,'2026-10-06T'+rise),false,city+' sunrise');
 assert.equal(c.wmoNight(d,'2026-10-06T'+set),true,city+' sunset');
}
// Hour-specific flags cover polar daylight/night and transition hours accurately.
assert.equal(c.wmoNight({},'2026-06-21T00:00',1),false);
assert.equal(c.wmoNight({},'2026-12-21T12:00',0),true);
assert.equal(c.wmoNight({},'2026-10-06T00:00','0'),true);
assert.equal(c.wmoIcon(0,false),'☀️');
console.log('PASS: midnight, sunrise, sunset, next day, Moreni/New York/Tokyo and polar hour flags');
