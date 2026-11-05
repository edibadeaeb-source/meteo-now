'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const labels = {live:'Date recente', stale:'Date vechi', unavailable:'Fără conexiune', empty:'Fără date', unknown:'Oră nevalidată'};
  const state = {data:null, request:0, controller:null, timer:null, failed:false};
  const dateFormat = new Intl.DateTimeFormat('ro-RO', {timeZone:'Europe/Bucharest', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const sessionFormat = new Intl.DateTimeFormat('ro-RO', {timeZone:'Europe/Bucharest', day:'numeric', month:'short', year:'numeric'});
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
    const channels = state.data?.channels;
    const sensors={};
    ['esp','lora'].forEach(key=>{const channel=channels?.[key];sensors[key]={current:channel?.current||null,state:channel?channelState(channel):'empty'};});
    window.StandSnapshot={sensors};
    window.dispatchEvent(new Event('stand-context'));
    const captions = {live:'Măsurătoare recentă · în locul unde se află senzorul', stale:'Ultima valoare păstrată · senzorul nu trimite date recente', unknown:'Valoare fără o dată și oră validate', empty:'Conectează montajul pentru a primi măsurători', unavailable:'Conexiune întreruptă · valorile păstrate pot fi vechi'};
    ['esp','lora'].forEach(key=>{
      const channel=channels?.[key], current=channel?.current || {};
      const mode=channel?channelState(channel):state.failed?'unavailable':null;
      status(key+'State',mode);
      $(key+'Temperature').textContent=format(current.temperature);
      $(key+'Humidity').textContent=format(current.humidity);
      const humidity=finite(current.humidity)?Math.max(0,Math.min(100,current.humidity)):null;
      const dial=$(key+'HumidityDial'),arc=$(key+'HumidityArc'),thumb=$(key+'HumidityThumb');
      if(humidity===null){dial.removeAttribute('aria-valuenow');dial.setAttribute('aria-valuetext','Fără măsurătoare');}
      else{dial.setAttribute('aria-valuenow',String(humidity));dial.setAttribute('aria-valuetext',`${format(humidity)} % RH`);}
      arc.setAttribute('stroke-dasharray',`${humidity??0} 100`);arc.toggleAttribute('hidden',humidity===null);thumb.toggleAttribute('hidden',humidity===null);
      const angle=Math.PI*(1-(humidity??0)/100);thumb.setAttribute('cx',String(100+80*Math.cos(angle)));thumb.setAttribute('cy',String(100-80*Math.sin(angle)));
      const marker=$(key+'ThermalMarker');marker.toggleAttribute('hidden',!finite(current.temperature));marker.setAttribute('cx',String(Math.max(0,Math.min(240,((current.temperature??-10)+10)/55*240))));
      $(key+'Pressure').textContent=format(current.pressure,0);
      $(key+'Gas').textContent=format(current.gas,0);
      if(key==='esp')$('espIaq').textContent=format(current.iaq,0);
      const [bucket,label]=thermal(current.temperature);
      $(key+'Card').dataset.thermal=bucket;$(key+'Thermal').textContent=label;
      $(key+'Caption').textContent=captions[mode] || 'Așteptăm o măsurătoare validă';
      $(key+'Time').textContent=finite(current.timestamp)?`Ultimul pachet · ${dateFormat.format(current.timestamp*1000)}`:'Niciun pachet cu oră validă';
      $(key+'Age').textContent=finite(current.timestamp)?ageText(Date.now()/1000-current.timestamp):'';
      $(key+'Card').classList.toggle('is-live',mode==='live');
    });
    $('rssi').textContent=format(channels?.lora.current?.rssi,0);
    $('signalValue').textContent=format(channels?.lora.current?.rssi,0);
    $('snr').textContent=format(channels?.lora.current?.snr);
    const espState=channels?channelState(channels.esp):null,loraState=channels?channelState(channels.lora):null;
    $('freshCount').textContent=`${[espState,loraState].filter(s=>s==='live').length} / 2`;
    $('sampleCount').textContent=String(plotRows(channels,'esp').length + plotRows(channels,'lora').length);
    $('connectionNote').textContent='Date recente = pachet primit în ultimele 5 minute. Gateway-ul, ChirpStack și MQTT nu sunt verificate separat.';
    if(!channels){
      if(state.failed)showNotice('Dashboardul local nu răspunde. Reîncercăm automat; verifică dacă serverul este pornit.','warning');
      drawChart(null);return;
    }
    if (state.failed || espState === 'unavailable' || loraState === 'unavailable') showNotice('Conexiune la date indisponibilă pentru cel puțin un senzor. Păstrăm valorile primite și reîncercăm automat.', 'warning');
    else if (espState === 'live' && loraState === 'live') showNotice('Date recente pe ambele trasee. Dashboardul verifică automat stația la fiecare 20 de secunde.', 'good');
    else if (espState === 'live' || loraState === 'live') showNotice('Primim date recente pe un traseu. Celălalt senzor nu are încă măsurători recente.', 'good');
    else showNotice('Montajul nu transmite încă date recente. Graficele includ măsurătorile din arhivă.', 'warning');
    drawChart(channels);
  }
  function node(tag, attrs={}, content) {
    const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>element.setAttribute(key,String(value)));
    if(content!==undefined) element.textContent=content;
    return element;
  }
  function plotRows(channels,key){
    const now=Date.now()/1000;
    const archive=state.data?.archive?.[key] || [];
    const recent=(channels?.[key]?.history || []).filter(row=>finite(row.timestamp) && row.timestamp>=now-3600 && row.timestamp<=now+60).slice(-30);
    return [...new Map([...archive,...recent].map(row=>[row.timestamp,row])).values()].sort((a,b)=>a.timestamp-b.timestamp);
  }
  function drawChart(channels) {
    document.querySelectorAll('[data-plot]').forEach(svg=>drawPlot(svg,svg.dataset.plot,channels));
  }
  const chartInteractions=new WeakMap();
  function chartInteraction(svg){
    if(chartInteractions.has(svg))return chartInteractions.get(svg);
    const wrap=svg.closest('.chart-wrap'),tip=document.createElement('div');
    tip.id=svg.id+'Tooltip';tip.className='chart-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');wrap.append(tip);
    svg.setAttribute('tabindex','0');
    let entries=[],unit='',metric='',active=-1,frame=0,down=null;
    function hide(){if(active>=0)entries[active]?.point.classList.remove('is-active');active=-1;tip.hidden=true;svg.removeAttribute('aria-describedby');}
    function show(index,keyboard=false){
      if(!entries[index]){hide();return;}
      if(active>=0)entries[active]?.point.classList.remove('is-active');
      active=index;const entry=entries[index];entry.point.classList.add('is-active');tip.replaceChildren();
      const heading=document.createElement('span');heading.className='tooltip-heading';heading.textContent={temperature:'Temperatură',humidity:'Umiditate',pressure:'Presiune',gas:'Rezistență gaz'}[metric];
      const value=document.createElement('strong');value.className='tooltip-value';value.textContent=`${format(entry.value)} ${unit}`;
      const source=document.createElement('span');source.className='tooltip-source';source.textContent=entry.key==='esp'?'ESP32-C6 · Wi-Fi':'expLoRaBLE · LoRaWAN';
      const time=document.createElement('time');time.dateTime=new Date(entry.timestamp*1000).toISOString();time.textContent=dateFormat.format(entry.timestamp*1000);
      const provenance=document.createElement('small');provenance.textContent=Date.now()/1000-entry.timestamp>=300?'Înregistrare istorică':'Date măsurate';
      tip.append(heading,value,source,time,provenance);tip.hidden=false;tip.setAttribute('aria-live',keyboard?'polite':'off');svg.setAttribute('aria-describedby',tip.id);
      const point=entry.point.getBoundingClientRect(),bounds=wrap.getBoundingClientRect();
      const px=point.left+point.width/2-bounds.left,py=point.top+point.height/2-bounds.top;
      tip.style.left=Math.max(5,Math.min(bounds.width-tip.offsetWidth-5,px-tip.offsetWidth/2))+'px';
      const above=py-tip.offsetHeight-12;
      tip.style.top=Math.max(5,Math.min(bounds.height-tip.offsetHeight-5,above>=5?above:py+14))+'px';
    }
    function nearest(clientX,clientY,touch=false){
      const matrix=svg.getScreenCTM();if(!matrix||!entries.length){hide();return;}
      const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());let best=-1,distance=Infinity;
      entries.forEach((entry,index)=>{const d=Math.hypot((entry.x-point.x)*matrix.a,(entry.y-point.y)*matrix.d);if(d<distance){best=index;distance=d;}});
      if(distance<=(touch?44:32))show(best);else hide();
    }
    svg.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch'){if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>8){down.moved=true;hide();}return;}
      if(event.buttons)return;
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>nearest(event.clientX,event.clientY));
    });
    svg.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')down={x:event.clientX,y:event.clientY,moved:false};});
    svg.addEventListener('pointerup',event=>{if(event.pointerType==='touch'&&down&&!down.moved)nearest(event.clientX,event.clientY,true);down=null;});
    svg.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'){cancelAnimationFrame(frame);hide();}});
    svg.addEventListener('pointercancel',()=>{down=null;hide();});svg.addEventListener('blur',hide);
    document.addEventListener('pointerdown',event=>{if(!svg.contains(event.target))hide();},true);
    svg.addEventListener('keydown',event=>{
      if(event.key==='Escape'){hide();return;}
      if(!entries.length||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' '].includes(event.key))return;
      event.preventDefault();let index=active;
      if(event.key==='Home')index=0;else if(event.key==='End'||event.key==='Enter'||event.key===' ')index=active<0?entries.length-1:active;
      else if(event.key==='ArrowRight')index=active<0?0:Math.min(entries.length-1,active+1);
      else if(event.key==='ArrowLeft')index=active<0?entries.length-1:Math.max(0,active-1);
      else{const current=entries[Math.max(0,active)];let distance=Infinity;entries.forEach((entry,i)=>{const delta=Math.abs(entry.timestamp-current.timestamp);if(entry.key!==current.key&&delta<distance){index=i;distance=delta;}});}
      show(index,true);
    });
    const interaction={update(next,nextUnit,nextMetric){cancelAnimationFrame(frame);hide();entries=next.sort((a,b)=>a.timestamp-b.timestamp||a.key.localeCompare(b.key));unit=nextUnit;metric=nextMetric;}};
    chartInteractions.set(svg,interaction);return interaction;
  }
  function drawPlot(svg,metric,channels){
    const interaction=chartInteraction(svg);interaction.update([], '',metric);
    svg.replaceChildren();
    const card=svg.closest('.plot-card');card.dataset.metric=metric;
    if(!card.querySelector('.plot-series')){
      const legend=document.createElement('div');legend.className='plot-series';
      [['esp','ESP32 · continuă'],['lora','LoRaWAN · întreruptă']].forEach(([key,label])=>{const span=document.createElement('span');span.className='series-'+key;const mark=document.createElement('i');span.append(mark,document.createTextNode(label));legend.append(span);});
      card.insertBefore(legend,card.querySelector('.chart-wrap'));
    }
    const palette=getComputedStyle(card);
    const series=['esp','lora'].map(key=>({key,rows:plotRows(channels,key).filter(r=>finite(r[metric]))}));
    const all=series.flatMap(s=>s.rows); $('empty'+metric[0].toUpperCase()+metric.slice(1)).hidden=all.length>0;
    const unit={temperature:'°C',humidity:'%',pressure:'hPa',gas:'kΩ'}[metric];
    const width=Math.max(280,Math.round(svg.clientWidth));
    svg.setAttribute('viewBox',`0 0 ${width} 210`);
    const left=48,right=width-16,top=20,bottom=175;
    let min=all.length ? Math.min(...all.map(r=>r[metric])) : 0;
    let max=all.length ? Math.max(...all.map(r=>r[metric])) : 30;
    const padding=Math.max((max-min)*.15,metric==='pressure'?1:.5); min-=padding; max+=padding;
    // Space observations evenly so the months without samples do not flatten the two runs.
    const times=[...new Set(all.map(row=>row.timestamp))].sort((a,b)=>a-b);
    const indices=new Map(times.map((time,index)=>[time,index]));
    const x=t=>times.length===1?(left+right)/2:left+indices.get(t)/(times.length-1)*(right-left);
    const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
    for(let i=0;i<4;i++){
      const value=min+(max-min)*i/3, pos=y(value);
      svg.append(node('line',{x1:left,y1:pos,x2:right,y2:pos,class:'grid'}),node('text',{x:left-10,y:pos+4,'text-anchor':'end'},format(value,metric==='pressure'?0:1)));
    }
    svg.append(node('text',{x:8,y:11},unit));
    const ticks=times.length<=1?times:width<450?[times[0],times.at(-1)]:[...new Set([times[0],times[Math.floor(times.length/2)],times.at(-1)])];
    ticks.forEach((time,index)=>svg.append(node('text',{x:x(time),y:199,'text-anchor':ticks.length===1?'middle':index===0?'start':index===ticks.length-1?'end':'middle'},String(indices.get(time)+1))));
    const interactivePoints=[];
    series.forEach(({key,rows})=>{
      const color=palette.getPropertyValue(key==='esp'?'--series-esp':'--series-lora').trim(); let previous=null;
      const segments=[];
      rows.forEach(row=>{if(!segments.length||row.timestamp-segments.at(-1).at(-1).timestamp>600)segments.push([]);segments.at(-1).push(row);});
      segments.filter(segment=>segment.length>1).forEach(segment=>{
        const area=`M${x(segment[0].timestamp)},${bottom} `+segment.map(row=>`L${x(row.timestamp)},${y(row[metric])}`).join(' ')+` L${x(segment.at(-1).timestamp)},${bottom} Z`;
        svg.append(node('path',{d:area,fill:color,opacity:.13,stroke:'none',class:'plot-area'}));
      });
      const d=rows.map(row=>{const command=previous!==null && row.timestamp-previous<=600?'L':'M';previous=row.timestamp;return `${command}${x(row.timestamp).toFixed(2)},${y(row[metric]).toFixed(2)}`;}).join(' ');
      if(rows.length) svg.append(node('path',{d,class:'plot',stroke:color,'stroke-dasharray':key==='lora'?'5 3':'none'}));
      rows.forEach(row=>{const px=x(row.timestamp),py=y(row[metric]);const point=node('circle',{cx:px,cy:py,r:rows.length===1?4:2.4,fill:color,class:'point'});svg.append(point);interactivePoints.push({point,key,x:px,y:py,value:row[metric],timestamp:row.timestamp});});
    });
    interaction.update(interactivePoints,unit,metric);
    svg.setAttribute('aria-label',`${{temperature:'Temperatură',humidity:'Umiditate',pressure:'Presiune',gas:'Rezistență gaz'}[metric]}: ${all.length} puncte. Măsurători în ordinea înregistrării. Arhivă și date recente. Explorează valorile cu mouse-ul, atingere sau tastele săgeată.`);
  }
  async function poll(){
    clearTimeout(state.timer);
    if(document.hidden) return;
    const request=++state.request, controller=new AbortController(); state.controller=controller;
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/api/station',{signal:controller.signal,cache:'no-store'});
      if(!response.ok) throw new Error('local');
      const data=await response.json();
      if(data.app!=='METEO-NOW-STAND' || !data.channels?.esp || !data.channels?.lora) throw new Error('shape');
      if(request!==state.request) return;
      state.data=data;state.failed=false;render();
    }catch(error){if(request===state.request){state.failed=true;render();}}
    finally{clearTimeout(timeout);if(request===state.request) state.timer=setTimeout(poll,20000);}
  }
  document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    const [title,body]=explanations[Number(button.dataset.step)];const strong=document.createElement('strong');strong.textContent=title+' ';$('stepExplanation').replaceChildren(strong,document.createTextNode(body));
  }));
  document.querySelector('[data-step="0"]').click();
  $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{showNotice('Utilizează tasta F11 pentru modul pe tot ecranul.');}});
  document.addEventListener('fullscreenchange',()=>$('fullscreenButton').setAttribute('aria-label',document.fullscreenElement?'Ieși din ecranul complet':'Activează ecranul complet'));
  $('exportButton').addEventListener('click',()=>{
    const channels=state.data?.channels;
    if(!channels){showNotice('Nu avem încă măsurători pentru export.');return;}
    const rows=[['tip_date','senzor','data_ora_UTC','temperatura_C','umiditate_procente','presiune_hPa','gaz_kOhm','IAQ']];
    ['esp','lora'].forEach(key=>plotRows(channels,key).forEach(r=>rows.push([Date.now()/1000-r.timestamp>=300?'ISTORIC':'MASURAT',key,finite(r.timestamp)?new Date(r.timestamp*1000).toISOString():'',r.temperature,r.humidity,r.pressure,r.gas,r.iaq])));
    if(rows.length===1){showNotice('Nu există măsurători de exportat.');return;}
    const csv='\uFEFF'+rows.map(r=>r.map(v=>v??'').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`METEO-NOW-MASURATORI-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function tick(){const now=new Date();$('chartSession').textContent='Sesiune · '+sessionFormat.format(now);$('clock').textContent=clockFormat.format(now);$('date').textContent=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',weekday:'long',day:'numeric',month:'long'}).format(now);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){state.request++;state.controller?.abort();clearTimeout(state.timer);}else poll();});
  new ResizeObserver(()=>{const channels=state.data?.channels;drawChart(channels);}).observe(document.querySelector('.plots-grid'));
  window.addEventListener('stand-theme',()=>drawChart(state.data?.channels));
  tick();setInterval(tick,1000);setInterval(()=>{if(!document.hidden){render();}},10000);
  render();poll();
})();
