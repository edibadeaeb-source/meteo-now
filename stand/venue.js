'use strict';
(() => {
  const $=id=>document.getElementById(id),map=$('venueMap');
  $('appQr').loading='eager';
  const names={esp:'ESP32-C6 · Wi-Fi',lora:'SparkFun expLoRaBLE · LoRaWAN'};
  const statusNames={live:'Date recente',stale:'Istoric · date vechi',empty:'Fără măsurători',unavailable:'Conexiune indisponibilă',unknown:'Oră nevalidată',demo:'Date simulate'};
  let selected=null,view=[0,0,1000,600],drag=null;
  function applyView(){map.setAttribute('viewBox',view.join(' '));}
  function zoom(factor){const width=Math.max(300,Math.min(1000,view[2]*factor)),height=width*.6;view=[view[0]+(view[2]-width)/2,view[1]+(view[3]-height)/2,width,height];applyView();}
  $('mapZoomIn').addEventListener('click',()=>zoom(.75));$('mapZoomOut').addEventListener('click',()=>zoom(1.333333));$('mapReset').addEventListener('click',()=>{view=[0,0,1000,600];applyView();});
  function render(){
    if(!selected)return;
    const snapshot=window.StandSnapshot,source=snapshot?.sensors[selected],current=source?.current||{},mode=snapshot?.mode==='demo'?'demo':source?.state||'empty';
    $('mapDeviceName').textContent=names[selected];$('mapDeviceState').textContent=statusNames[mode]||'Se verifică';$('mapDeviceState').className=`status ${mode}`;
    const list=$('mapDeviceReadings');list.replaceChildren();
    const fields=[['temperature','Temperatură','°C'],['humidity','Umiditate','% RH'],['pressure','Presiune','hPa'],['gas','Rezistență gaz','kΩ'],...(selected==='esp'?[['iaq','Indice aer estimat','IAQ']]:[['rssi','Semnal radio','dBm'],['snr','Semnal / zgomot','dB']])];
    fields.forEach(([key,label,unit])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;const value=current[key];dd.textContent=typeof value==='number'&&Number.isFinite(value)?`${value.toLocaleString('ro-RO',{maximumFractionDigits:1})} ${unit}`:'—';row.append(dt,dd);list.append(row);});
    $('mapDeviceTime').textContent=current.timestamp?`${mode==='demo'?'Simulare':'Ultimul pachet'} · ${new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(current.timestamp*1000)}`:'Încă nu avem un pachet cu oră validă.';
    document.querySelectorAll('[data-map-sensor]').forEach(pin=>{pin.classList.toggle('is-selected',pin.dataset.mapSensor===selected);pin.setAttribute('aria-pressed',String(pin.dataset.mapSensor===selected));});
    document.querySelectorAll('[data-select-sensor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.selectSensor===selected)));
  }
  function select(sensor){selected=sensor;render();}
  document.querySelectorAll('[data-map-sensor]').forEach(pin=>{pin.addEventListener('click',()=>select(pin.dataset.mapSensor));pin.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(pin.dataset.mapSensor);}});});
  document.querySelectorAll('[data-select-sensor]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.selectSensor)));
  window.addEventListener('stand-context',render);
  map.addEventListener('pointerdown',event=>{if(event.target.closest('[data-map-sensor]')||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,view:[...view]};map.setPointerCapture(event.pointerId);});
  map.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const rect=map.getBoundingClientRect();view=[drag.view[0]-(event.clientX-drag.x)*drag.view[2]/rect.width,drag.view[1]-(event.clientY-drag.y)*drag.view[3]/rect.height,drag.view[2],drag.view[3]];view[0]=Math.max(-300,Math.min(1000-view[2]+300,view[0]));view[1]=Math.max(-180,Math.min(600-view[3]+180,view[1]));applyView();});
  function end(event){if(drag?.id===event.pointerId){if(map.hasPointerCapture(event.pointerId))map.releasePointerCapture(event.pointerId);drag=null;}}
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>map.addEventListener(name,end));
  map.addEventListener('keydown',event=>{if(event.target!==map)return;if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();if(event.key==='+'||event.key==='=')zoom(.75);else if(event.key==='-')zoom(1.333333);else if(event.key==='0'){view=[0,0,1000,600];applyView();}else{if(event.key==='ArrowLeft')view[0]-=30;if(event.key==='ArrowRight')view[0]+=30;if(event.key==='ArrowUp')view[1]-=30;if(event.key==='ArrowDown')view[1]+=30;applyView();}}});
})();
