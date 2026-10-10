// Local emulator only: never send these write probes to the real database.
const assert=require('node:assert/strict');
const base='http://127.0.0.1:9100';
const namespace='demo-meteo-security-20261011-default-rtdb';
const privateBranches=['push_subs','push_android_status','push_state','push_anm_state','push_weather_state','push_summary_state','push_test_state','widget_cities_e2e'];
async function request(path,method='GET',data,admin=false){
 return fetch(base+'/'+path+'.json?ns='+namespace,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer owner'}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
}
async function denied(path,method='GET',data){const r=await request(path,method,data);assert.ok([401,403].includes(r.status),method+' '+path+' must be denied; got '+r.status);}
(async()=>{
 const initial=Object.fromEntries(privateBranches.map(x=>[x,{fixture:{test:true}}]));
 assert.equal((await request('','PUT',initial,true)).status,200);
 await denied('');await denied('','PUT',{});
 for(const branch of privateBranches){await denied(branch);await denied(branch+'/fixture','PUT',{changed:true});}
 await denied('comenzi');await denied('comenzi','PUT',{reset:true});
 await denied('unknown_branch','PUT',{test:true});
 await denied('senzori/unknown_device','PUT',{test:true});
 await denied('','PATCH',{'status/test':true,'push_subs/fixture/test':false});
 for(const p of ['senzori/bme680','senzori/lorawan','istoric/lorawan','esp32_location','sparkfun_location','status','status_lorawan']){
  assert.equal((await request(p,'PUT',{fixture:true})).status,200,p+' temporary station writer compatibility');
  assert.equal((await request(p)).status,200,p+' public station read');
 }
 const untouched=await (await request('push_subs/fixture','GET',undefined,true)).json();assert.equal(untouched.test,true,'denied writes must not alter private data');
 assert.equal((await request('push_subs/fixture','PUT',{server:true},true)).status,200,'trusted server can write private data');
 console.log('PASS: root, notification/widget branches, commands, unknown paths and atomic mixed writes denied; trusted server and explicit station compatibility preserved. Station anonymous writes remain a documented IoT migration task.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
