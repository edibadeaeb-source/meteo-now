'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const labels = {live:'Date recente', stale:'Date vechi', unavailable:'Fără conexiune', empty:'Fără date', unknown:'Oră nevalidată', demo:'Simulat'};
  const state = {mode:'live', data:null, demo:null, request:0, controller:null, timer:null, failed:false};
  const dateFormat = new Intl.DateTimeFormat('ro-RO', {timeZone:'Europe/Bucharest', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const clockFormat = new Intl.DateTimeFormat('ro-RO', {timeZone:'Europe/Bucharest', hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const format = (n, digits=1) => finite(n) ? n.toLocaleString('ro-RO', {minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—';
  const explanations = [
    ['Un mic laborator pe o placă.', 'Senzorul BME680 măsoară temperatura, umiditatea, presiunea și rezistența electrică a elementului pentru gaze. ESP32 calculează și un indice orientativ al aerului.'],
    ['Aceeași măsurătoare, două trasee.', 'ESP32 trimite date prin Wi-Fi. expLoRaBLE le transmite prin radio LoRaWAN către gateway; de acolo trec prin ChirpStack și puntea MQTT. Dashboardul verifică doar sosirea datelor, nu fiecare echipament intermediar.'],
    ['Pachetele devin un istoric.', 'Firebase păstrează măsurătorile împreună cu data și ora. Acest dashboard citește doar ramurile publice ale stației; nu scrie date și nu transmite comenzi.'],
    ['Numere pe care le poți explora.', 'Aici comparăm senzorii și urmărim graficele. Măsurătorile descriu locul în care se află montajul; prognoza din METEO NOW folosește separat furnizori de date meteo.']
  ];
  function ageText(seconds) {
    if (!finite(seconds) || seconds < -60) return 'Oră nevalidată';
    seconds = Math.max(0, seconds);
    if (seconds < 60) return 'Acum câteva secunde';
    if (seconds < 3600) return `Acum ${Math.floor(seconds/60)} min`;
    if (seconds < 86400) return `Acum ${Math.floor(seconds/3600)} ore`;
    return `Acum ${Math.floor(seconds/86400)} zile`;
  }
  function channelState(channel) {
    if (state.mode === 'demo') return 'demo';
    if (state.failed || channel.error) return 'unavailable';
    const current = channel.current;
    if (!current) return 'empty';
    const age = Date.now()/1000-current.timestamp;
    if (!finite(current.timestamp) || age < -60) return 'unknown';
    return age < 300 ? 'live' : 'stale';
  }
  function status(id, value) { $(id).textContent=labels[value] || 'Se verifică'; $(id).className=`status ${value}`; }
  function showNotice(text, style='') { $('notice').textContent=text; $('notice').className=`notice ${style}`; }
  function thermal(value) {
    if(!finite(value)) return ['unknown','—'];
    return value<10?['cold','Rece']:value<18?['cool','Răcoros']:value<26?['mild','Moderat']:value<32?['warm','Cald']:['hot','Foarte cald'];
  }
  function render() {
    const channels = (state.mode === 'demo' ? state.demo : state.data)?.channels;
    document.body.classList.toggle('demo-mode', state.mode === 'demo');
    $('demoControls').hidden = state.mode !== 'demo';
    const captions = {live:'Măsurătoare recentă · în locul unde se află senzorul', stale:'Ultima valoare păstrată · senzorul nu trimite date recente', unknown:'Valoare fără o dată și oră validate', empty:'Conectează montajul pentru a primi măsurători', unavailable:'Conexiune întreruptă · valorile păstrate pot fi vechi', demo:'Valoare simulată · experimentează cu reglajele de mai jos'};
    ['esp','lora'].forEach(key=>{
      const channel=channels?.[key], current=channel?.current || {};
      const mode=channel?channelState(channel):state.failed?'unavailable':null;
      status(key+'State',mode);
      $(key+'Temperature').textContent=format(current.temperature);
      $(key+'Humidity').textContent=format(current.humidity);
      $(key+'Pressure').textContent=format(current.pressure,0);
      $(key+'Gas').textContent=format(current.gas,0);
      if(key==='esp')$('espIaq').textContent=format(current.iaq,0);
      const [bucket,label]=thermal(current.temperature);
      $(key+'Card').dataset.thermal=bucket;$(key+'Thermal').textContent=label;
      $(key+'Caption').textContent=captions[mode] || 'Așteptăm o măsurătoare validă';
      $(key+'Time').textContent=finite(current.timestamp)?`${state.mode==='demo'?'Simulare':'Ultimul pachet'} · ${dateFormat.format(current.timestamp*1000)}`:'Niciun pachet cu oră validă';
      $(key+'Age').textContent=finite(current.timestamp)?ageText(Date.now()/1000-current.timestamp):'';
      $(key+'Card').classList.toggle('is-live',mode==='live');
    });
    $('rssi').textContent=format(channels?.lora.current?.rssi,0);
    $('snr').textContent=format(channels?.lora.current?.snr);
    const espState=channels?channelState(channels.esp):null,loraState=channels?channelState(channels.lora):null;
    if(!channels){
      if(state.failed)showNotice('Dashboardul local nu răspunde. Reîncercăm automat; verifică dacă serverul este pornit.','warning');
      drawChart(null);return;
    }
    if (state.mode === 'demo') showNotice('MOD DEMONSTRATIV · Toate valorile și graficele sunt simulate pe acest laptop. Nu sunt măsurători ale senzorilor.', 'demo');
    else if (state.failed || espState === 'unavailable' || loraState === 'unavailable') showNotice('Conexiune la date indisponibilă pentru cel puțin un senzor. Păstrăm valorile primite și reîncercăm automat.', 'warning');
    else if (espState === 'live' && loraState === 'live') showNotice('Date recente pe ambele trasee. Dashboardul verifică automat stația la fiecare 20 de secunde.', 'good');
    else if (espState === 'live' || loraState === 'live') showNotice('Primim date recente pe un traseu. Celălalt senzor nu are încă măsurători recente.', 'good');
    else showNotice('Montajul nu transmite încă date recente. Valorile existente sunt istoric; poți explora separat modul demonstrativ.', 'warning');
    $('footerMode').textContent=state.mode === 'demo' ? 'DEMONSTRAȚIE · DATE SIMULATE LOCAL' : 'DOAR CITIRE · FĂRĂ COMENZI CĂTRE SENZORI';
    drawChart(channels);
  }
  function node(tag, attrs={}, content) {
    const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>element.setAttribute(key,String(value)));
    if(content!==undefined) element.textContent=content;
    return element;
  }
  function drawChart(channels) {
    $('chartRange').textContent=state.mode==='demo' ? 'Historicul este simulat · ultimele 10 minute' : 'Ultimele 60 de măsurători / senzor · istoric inclus';
    document.querySelectorAll('[data-plot]').forEach(svg=>drawPlot(svg,svg.dataset.plot,channels));
  }
  function drawPlot(svg,metric,channels){
    svg.replaceChildren();
    const series=['esp','lora'].map(key=>({key,rows:(channels?.[key].history || []).filter(r=>finite(r[metric]) && finite(r.timestamp) && r.timestamp<=Date.now()/1000+60)}));
    const all=series.flatMap(s=>s.rows); $('empty'+metric[0].toUpperCase()+metric.slice(1)).hidden=all.length>0;
    const unit={temperature:'°C',humidity:'%',pressure:'hPa',gas:'kΩ'}[metric];
    const width=Math.max(280,Math.round(svg.clientWidth));
    svg.setAttribute('viewBox',`0 0 ${width} 210`);
    const left=48,right=width-16,top=20,bottom=175;
    let min=all.length ? Math.min(...all.map(r=>r[metric])) : 0;
    let max=all.length ? Math.max(...all.map(r=>r[metric])) : 30;
    const padding=Math.max((max-min)*.15,metric==='pressure'?1:.5); min-=padding; max+=padding;
    let start=all.length?Math.min(...all.map(r=>r.timestamp)):Date.now()/1000-600;
    let end=all.length?Math.max(...all.map(r=>r.timestamp)):Date.now()/1000;
    if(start===end){start-=30;end+=30;}
    const x=t=>left+(t-start)/(end-start)*(right-left), y=v=>bottom-(v-min)/(max-min)*(bottom-top);
    for(let i=0;i<4;i++){
      const value=min+(max-min)*i/3, pos=y(value);
      svg.append(node('line',{x1:left,y1:pos,x2:right,y2:pos,class:'grid'}),node('text',{x:left-10,y:pos+4,'text-anchor':'end'},format(value,metric==='pressure'?0:1)));
    }
    svg.append(node('text',{x:8,y:11},unit));
    if(all.length) [0,.5,1].forEach((p,index)=>svg.append(node('text',{x:left+(right-left)*p,y:199,'text-anchor':index===0?'start':index===2?'end':'middle'},new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'}).format((start+(end-start)*p)*1000))));
    series.forEach(({key,rows})=>{
      const color=key==='esp'?'#39765f':'#457da7'; let previous=null;
      const d=rows.map(row=>{const command=previous!==null && row.timestamp-previous<=600?'L':'M';previous=row.timestamp;return `${command}${x(row.timestamp).toFixed(2)},${y(row[metric]).toFixed(2)}`;}).join(' ');
      if(rows.length) svg.append(node('path',{d,class:'plot',stroke:color}));
      rows.forEach(row=>{const point=node('circle',{cx:x(row.timestamp),cy:y(row[metric]),r:rows.length===1?4:2.4,fill:color,class:'point'});point.append(node('title',{},`${key==='esp'?'ESP32':'LoRaWAN'} · ${dateFormat.format(row.timestamp*1000)} · ${format(row[metric])} ${unit}`));svg.append(point);});
    });
    svg.setAttribute('aria-label',`${{temperature:'Temperatură',humidity:'Umiditate',pressure:'Presiune',gas:'Rezistență gaz'}[metric]}: ${all.length} puncte. ${state.mode==='demo'?'Date simulate.':'Istoric din stație; verifică vechimea ultimului pachet.'}`);
  }
  function demoRecord(key,t,index,baseTemp=23,baseHum=48){
    const offset=key==='lora'?.25:0;
    return {timestamp:t,temperature:baseTemp+Math.sin(index*.23)*.65+offset,humidity:baseHum+Math.cos(index*.19)*1.8-offset,pressure:1013+Math.sin(index*.08)*1.3,gas:120+Math.sin(index*.15)*14,iaq:key==='esp'?45+Math.cos(index*.12)*4:null,rssi:key==='lora'?-72:null,snr:key==='lora'?8.5:null};
  }
  function createDemo(){
    const now=Date.now()/1000, temp=Number($('demoTemp').value),hum=Number($('demoHum').value);
    const channels={};
    ['esp','lora'].forEach(key=>{const history=Array.from({length:60},(_,i)=>demoRecord(key,now-(59-i)*10,i,temp,hum));channels[key]={history,current:history.at(-1),error:null};});
    state.demo={channels};
    $('demoTempValue').textContent=`${temp} °C`; $('demoHumValue').textContent=`${hum} %`;
  }
  async function poll(){
    clearTimeout(state.timer);
    if(state.mode!=='live' || document.hidden) return;
    const request=++state.request, controller=new AbortController(); state.controller=controller;
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/api/station',{signal:controller.signal,cache:'no-store'});
      if(!response.ok) throw new Error('local');
      const data=await response.json();
      if(data.app!=='METEO-NOW-STAND' || !data.channels?.esp || !data.channels?.lora) throw new Error('shape');
      if(request!==state.request || state.mode!=='live') return;
      state.data=data;state.failed=false;render();
    }catch(error){if(request===state.request && state.mode==='live'){state.failed=true;render();}}
    finally{clearTimeout(timeout);if(request===state.request && state.mode==='live') state.timer=setTimeout(poll,20000);}
  }
  function setMode(mode){
    if(state.mode===mode) return;
    state.mode=mode;state.request++;state.controller?.abort();clearTimeout(state.timer);
    $('liveButton').setAttribute('aria-pressed',String(mode==='live'));$('demoButton').setAttribute('aria-pressed',String(mode==='demo'));
    if(mode==='demo'){createDemo();render();}
    else{state.failed=false;render();poll();}
  }
  $('liveButton').addEventListener('click',()=>setMode('live'));
  $('demoButton').addEventListener('click',()=>setMode('demo'));
  document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    const [title,body]=explanations[Number(button.dataset.step)];const strong=document.createElement('strong');strong.textContent=title+' ';$('stepExplanation').replaceChildren(strong,document.createTextNode(body));
  }));
  document.querySelector('[data-step="0"]').click();
  ['demoTemp','demoHum'].forEach(id=>$(id).addEventListener('input',()=>{createDemo();render();}));
  $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showNotice('Utilizează tasta F11 pentru modul pe tot ecranul.');}});
  document.addEventListener('fullscreenchange',()=>$('fullscreenButton').setAttribute('aria-label',document.fullscreenElement?'Ieși din ecranul complet':'Activează ecranul complet'));
  $('exportButton').addEventListener('click',()=>{
    const channels=(state.mode==='demo'?state.demo:state.data)?.channels;
    if(!channels){showNotice('Nu avem încă măsurători pentru export.');return;}
    const rows=[['tip_date','senzor','data_ora_UTC','temperatura_C','umiditate_procente','presiune_hPa','gaz_kOhm','IAQ']];
    ['esp','lora'].forEach(key=>(channels[key].history||[]).forEach(r=>rows.push([state.mode==='demo'?'SIMULAT':'MASURAT',key,finite(r.timestamp)?new Date(r.timestamp*1000).toISOString():'',r.temperature,r.humidity,r.pressure,r.gas,r.iaq])));
    if(rows.length===1){showNotice('Nu există măsurători de exportat.');return;}
    const csv='\uFEFF'+rows.map(r=>r.map(v=>v??'').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`METEO-NOW-${state.mode==='demo'?'DEMO-SIMULAT':'MASURATORI'}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function tick(){const now=new Date();$('clock').textContent=clockFormat.format(now);$('date').textContent=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long'}).format(now);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){state.request++;state.controller?.abort();clearTimeout(state.timer);}else if(state.mode==='live')poll();});
  new ResizeObserver(()=>{const channels=(state.mode==='demo'?state.demo:state.data)?.channels;drawChart(channels);}).observe(document.querySelector('.plots-grid'));
  tick();setInterval(tick,1000);setInterval(()=>{if(!document.hidden){if(state.mode==='demo')createDemo();render();}},10000);
  render();poll();
})();
