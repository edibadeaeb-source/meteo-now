const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const handlers={},items=new Map();let online=true;
const context=vm.createContext({self:{location:{origin:'https://meteo.test'},addEventListener:(event,handler)=>handlers[event]=handler},Map,Promise,URL,Headers,Response,
 caches:{open:async()=>({put:async(k,r)=>items.set(k,r)}),match:async k=>items.get(k)?.clone()},
 fetch:async req=>{if(!online)throw Error('offline');const u=new URL(req.url);return new Response(u.pathname==='/weather-credits.html'?'PHOTO CREDITS':u.pathname==='/privacy.html'?'PRIVACY':'WEATHER APP');}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),context);
async function navigate(page){let response;handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://meteo.test'+page},respondWith:p=>response=p});const result=await response;await new Promise(resolve=>setImmediate(resolve));return result.text();}
(async()=>{
 assert.equal(await navigate('/'),'WEATHER APP');assert.equal(await navigate('/weather-credits.html'),'PHOTO CREDITS');assert.equal(await navigate('/privacy.html'),'PRIVACY');
 online=false;assert.equal(await navigate('/'),'WEATHER APP','credits/privacy must not overwrite the offline app');assert.equal(await navigate('/index.html?widget=1'),'WEATHER APP');
 assert.equal(await navigate('/weather-credits.html'),'PHOTO CREDITS');assert.equal(await navigate('/privacy.html'),'PRIVACY');
 console.log('PASS: visiting credits and privacy preserves the offline weather app and each separate page');
})().catch(e=>{console.error(e);process.exitCode=1});
