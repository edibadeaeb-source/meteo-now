const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c=vm.createContext({self:{addEventListener(){}},Map,Promise,URL,Headers,Response});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),c);
const items=new Map(),cache={delete:async k=>items.delete(typeof k==='string'?k:k.url),put:async(k,r)=>items.set(k,r),keys:async()=>Array.from(items.keys(),url=>({url})),match:async k=>items.get(typeof k==='string'?k:k.url)};
const response=size=>new Response('test',{headers:{'Content-Length':String(size)}});
(async()=>{
 await Promise.all([c.storeWeatherVideo(cache,'old',response(50*1024*1024)),c.storeWeatherVideo(cache,'new',response(50*1024*1024))]);
 assert.deepEqual(Array.from(items.keys()),['new'],'concurrent writes still enforce the 96MiB budget');
 await c.storeWeatherVideo(cache,'small',response(2*1024*1024));assert.equal(items.size,2);
 await c.storeWeatherVideo(cache,'new',response(50*1024*1024));assert.deepEqual(Array.from(items.keys()),['small','new']);
 console.log('PASS: serialized video cache writes, replacement order and storage budget');
})().catch(e=>{console.error(e);process.exitCode=1;});
