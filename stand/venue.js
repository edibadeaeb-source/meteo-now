'use strict';
(() => {
  const $=id=>document.getElementById(id);
  $('appQr').loading='eager';
  const center=[44.9294563,25.4521470];
  const names={esp:'ESP32-C6 · Wi-Fi',lora:'SparkFun expLoRaBLE · LoRaWAN'};
  const statusNames={live:'Date recente',stale:'Istoric · date vechi',empty:'Fără măsurători',unavailable:'Conexiune indisponibilă',unknown:'Oră nevalidată',demo:'Date simulate'};
  const map=L.map('venueMap',{center,zoom:17,minZoom:4,maxZoom:19,zoomControl:false,scrollWheelZoom:false,attributionControl:true});
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
  map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');
  L.control.scale({imperial:false,maxWidth:100,position:'bottomleft'}).addTo(map);
  const latSpan=240/111320,lonSpan=400/(111320*Math.cos(center[0]*Math.PI/180));
  L.imageOverlay('venue-plan.svg',[[center[0]-latSpan,center[1]-lonSpan],[center[0]+latSpan,center[1]+lonSpan]],{interactive:false,opacity:1}).addTo(map);
  let selected=null,tileLayer=null,tileSuccess=false,tileErrors=0,mapVisible=false;
  const markers={};
  function fieldsFor(sensor){return [['temperature','Temperatură','°C'],['humidity','Umiditate','% RH'],['pressure','Presiune','hPa'],['gas','Rezistență gaz','kΩ'],...(sensor==='esp'?[['iaq','Indice aer estimat','IAQ']]:[['rssi','Semnal radio','dBm'],['snr','Semnal / zgomot','dB']])];}
  function sensorData(sensor){const snapshot=window.StandSnapshot,source=snapshot?.sensors[sensor];return {current:source?.current||{},mode:snapshot?.mode==='demo'?'demo':source?.state||'empty'};}
  function fillReadings(list,sensor,current){
    list.replaceChildren();
    fieldsFor(sensor).forEach(([key,label,unit])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;const value=current[key];dd.textContent=typeof value==='number'&&Number.isFinite(value)?`${value.toLocaleString('ro-RO',{maximumFractionDigits:1})} ${unit}`:'—';row.append(dt,dd);list.append(row);});
  }
  function popupContent(sensor){const {current,mode}=sensorData(sensor);const box=document.createElement('section');box.className='station-map-popup';const title=document.createElement('h3');title.textContent=names[sensor];const status=document.createElement('p');status.className='map-popup-status';status.textContent=statusNames[mode]||'Se verifică';const list=document.createElement('dl');fillReadings(list,sensor,current);box.append(title,status,list);return box;}
  function iconFor(sensor){
    const width=map.getSize().x<500?104:140;
    const box=document.createElement('span');box.className='station-pin-body';
    const dot=document.createElement('i');dot.className='station-pin-dot';
    const label=document.createElement('strong');label.textContent=sensor==='esp'?'ESP32-C6':'expLoRaBLE';
    const temp=document.createElement('span');temp.className='station-pin-temp';temp.textContent='— °C';box.append(dot,label,temp);
    return L.divIcon({className:`station-map-pin pin-${sensor}`,html:box,iconSize:[width,54],iconAnchor:[sensor==='esp'?width+7:-7,27],popupAnchor:[sensor==='esp'?-width/2-7:width/2+7,-30]});
  }
  ['esp','lora'].forEach(sensor=>{
    const marker=L.marker(center,{icon:iconFor(sensor),keyboard:true,title:names[sensor],alt:names[sensor],riseOnHover:true}).addTo(map);
    const element=marker.getElement();element.dataset.mapSensor=sensor;element.setAttribute('aria-label',`${names[sensor]}: deschide măsurătorile`);
    marker.bindPopup(popupContent(sensor),{maxWidth:Math.min(290,map.getSize().x-60),minWidth:160,maxHeight:Math.min(260,map.getSize().y-90),className:'weather-map-popup',autoPanPadding:[12,12]});
    marker.on('click',()=>{selected=sensor;render();});markers[sensor]=marker;
  });
  function render(){
    ['esp','lora'].forEach(sensor=>{const {current}=sensorData(sensor);const element=markers[sensor].getElement();element.classList.toggle('is-selected',sensor===selected);element.setAttribute('aria-pressed',String(sensor===selected));element.querySelector('.station-pin-temp').textContent=typeof current.temperature==='number'?`${current.temperature.toLocaleString('ro-RO',{maximumFractionDigits:1})} °C`:'— °C';markers[sensor].setPopupContent(popupContent(sensor));});
    document.querySelectorAll('[data-select-sensor]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.selectSensor===selected)));
    if(!selected)return;
    const {current,mode}=sensorData(selected);
    $('mapDeviceName').textContent=names[selected];$('mapDeviceState').textContent=statusNames[mode]||'Se verifică';$('mapDeviceState').className=`status ${mode}`;
    fillReadings($('mapDeviceReadings'),selected,current);
    $('mapDeviceTime').textContent=current.timestamp?`${mode==='demo'?'Simulare':'Ultimul pachet'} · ${new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(current.timestamp*1000)}`:'Încă nu avem un pachet cu oră validă.';
  }
  function mapStatus(){
    $('mapConnection').textContent=!navigator.onLine?'Fără internet · hartă locală':tileSuccess?'Hartă OpenStreetMap':tileErrors?'Harta online nu răspunde · plan local':'Se încarcă harta…';
  }
  function connectTiles(){
    if(tileLayer||!navigator.onLine||!mapVisible){mapStatus();return;}
    tileLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:4,updateWhenIdle:true,keepBuffer:0,crossOrigin:false});
    tileLayer.on('tileload',()=>{tileSuccess=true;mapStatus();});tileLayer.on('tileerror',()=>{tileErrors++;mapStatus();});tileLayer.addTo(map);mapStatus();
  }
  const observer=new IntersectionObserver(entries=>{mapVisible=entries.some(entry=>entry.isIntersecting);if(mapVisible){map.invalidateSize({pan:false});connectTiles();}},{threshold:.05});observer.observe($('venueMap'));
  window.addEventListener('online',()=>{if(mapVisible){if(tileLayer)tileLayer.redraw();else connectTiles();}mapStatus();});window.addEventListener('offline',mapStatus);
  $('mapZoomIn').addEventListener('click',()=>map.zoomIn(1,{animate:false}));$('mapZoomOut').addEventListener('click',()=>map.zoomOut(1,{animate:false}));
  $('mapReset').addEventListener('click',()=>{map.closePopup();map.setView(center,17,{animate:false});});
  document.querySelectorAll('[data-select-sensor]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.selectSensor;render();markers[selected].openPopup();}));
  new ResizeObserver(()=>{map.invalidateSize({pan:false});['esp','lora'].forEach(sensor=>{markers[sensor].setIcon(iconFor(sensor));L.setOptions(markers[sensor].getPopup(),{maxWidth:Math.min(290,map.getSize().x-60),maxHeight:Math.min(260,map.getSize().y-90)});const element=markers[sensor].getElement();element.dataset.mapSensor=sensor;element.setAttribute('aria-label',`${names[sensor]}: deschide măsurătorile`);});render();}).observe($('venueMap'));
  window.addEventListener('stand-context',render);render();
  // Both markers use the configured venue coordinate. Pixel anchors separate
  // the cards without inventing two measured device coordinates.
  window.StandVenueMap=map;
})();
