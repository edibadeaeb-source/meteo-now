const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../ai-conversations.js'),'utf8');
function load(storage){const w={localStorage:storage};vm.runInNewContext(source,{window:w,Date,Math,isFinite});return w.MeteoConversations;}
const memory={};const storage={getItem:k=>memory[k]||null,setItem:(k,v)=>{memory[k]=v;}};
let store=load(storage),city={nume:'Moreni',lat:44.983,lon:25.644};
assert.equal(store.active(),null);const a=store.start(city);
store.append(a.id,'user','Plouă azi?',city);store.append(a.id,'model','Șansa este 0%.',city);
store=load(storage);assert.equal(store.active().id,a.id);assert.equal(store.active().messages[1].text,'Șansa este 0%.');
const b=store.start({nume:'New York City'});store.append(b.id,'user','Cum e vremea?',{nume:'New York City'});
store.append(a.id,'model','Răspuns întârziat pentru Moreni.',city);
assert.equal(store.active().id,b.id);assert.equal(store.active().messages.length,1,'delayed reply belongs to original conversation');
assert.equal(store.get(a.id).messages[2].city,'Moreni');
store.select(a.id);store.append(a.id,'error','Reîncearcă.',city);assert.equal(store.context(a.id).length,3,'errors are not sent as history');
store.blank();assert.equal(load(storage).active(),null,'new blank conversation survives restart');
store.remove(a.id);assert.equal(load(storage).get(a.id),null,'deletion persists');
for(let i=0;i<45;i++){const c=store.start(city);store.append(c.id,'user','Întrebarea '+i,city);}
assert.equal(store.list().length,30,'conversation count is bounded');
const big=store.active();for(let i=0;i<160;i++)store.append(big.id,i%2?'model':'user','x'.repeat(8000),city);
assert.ok(memory['meteo-ai-conversations-v1'].length<=220000,'actual storage payload is bounded');
assert.ok(store.get(big.id).truncated);assert.ok(store.context(big.id).length<=40);
const failed=load({getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}}),c=failed.start(city);
assert.equal(failed.saved(),false);assert.equal(failed.append(c.id,'user','Salut',city),true);assert.equal(failed.active().messages.length,1,'storage failure preserves in-memory chat');
const invalid=load({getItem:()=>'{broken',setItem:()=>{}});assert.equal(invalid.active(),null);
console.log('AI conversations: restart, per-thread replies, deletion, context filtering, storage limits and unavailable storage passed');
