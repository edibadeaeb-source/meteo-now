const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cities=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v1/cities.json'),'utf8'));
const selections=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v2/sources.json'),'utf8'));
const films=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-video/v4/sources.json'),'utf8'));
const localFilms={
 'ro-bucharest-sunny-a':['bucharest',['clear-day']],
 'ro-bucharest-cloudy-a':['bucharest',['overcast']],
 'ro-brasov-sunny-a':['brasov',['clear-day']],
 'ro-brasov-sunny-b':['brasov',['clear-day']],
 'ro-cluj-cloudy-a':['cluj',['overcast']],
 'ro-cluj-cloudy-b':['cluj',['overcast']],
 'ro-timisoara-sunny-a':['timisoara',['clear-day']]
};
const records=films.filter(f=>localFilms[f.id]).map(f=>({slug:localFilms[f.id][0],scenes:localFilms[f.id][1],night:false,clip:{id:f.id,base:f.id,quality:f.quality,version:4,native:true,poster:'assets/weather-video/v4/'+f.id+'.webp'}}));
for(const p of selections)records.push({slug:p.slug,scenes:p.scenes,night:p.night,minTemperature:p.minTemperature??null,clip:{id:p.id,still:true,native:true,focus:p.focus,poster:p.poster}});
const source=`/* Fixed licensed Romanian city catalogue. No network lookups or location inference from temperature. */
(function(root){
 'use strict';
 var library=root.MeteoWeatherLibrary;if(!library)return;
 var nightFilms=${JSON.stringify(films.filter(f=>/^(partly-cloudy|overcast)-night-/.test(f.id)).map(f=>({id:f.id,base:f.id,quality:f.quality,version:4,native:true,poster:'assets/weather-video/v4/'+f.id+'.webp'})))};
 ['partly-cloudy-night','overcast-night'].forEach(function(pool){library.register(pool,nightFilms.filter(function(c){return c.id.indexOf(pool+'-')===0;}));});
 var cities=${JSON.stringify(cities.map(c=>({id:c.slug,name:c.name,lat:c.lat,lon:c.lon})))};
 var records=${JSON.stringify(records)};
 var pools=Object.create(null),limits=Object.create(null);
 function key(slug,scene,night){return 'ro-'+slug+'-'+scene+(night?'-night':'-day');}
 records.forEach(function(r){r.scenes.forEach(function(scene){var k=key(r.slug,scene,r.night);(pools[k]||(pools[k]=[])).push(r.clip);if(r.minTemperature!=null)limits[k]=r.minTemperature;});});
 Object.keys(pools).forEach(function(k){library.register(k,pools[k]);});
 function name(value){return String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
 var aliases={bucharest:'bucharest',bucuresti:'bucharest',cluj:'cluj',clujnapoca:'cluj',targumures:'targu-mures',tirgumures:'targu-mures',ramnicuvalcea:'ramnicu-valcea',rimnicuvalcea:'ramnicu-valcea',drobetaturnuseverin:'drobeta',turnuseverin:'drobeta',sfantugheorghe:'sfantu-gheorghe',sfintugheorghe:'sfantu-gheorghe'};
 cities.forEach(function(c){aliases[name(c.name)]=c.id;});
 function distance(lat,lon,c){return Math.hypot((lat-c.lat)*111.2,(lon-c.lon)*111.2*Math.cos(c.lat*Math.PI/180));}
 function cityFor(loc){
  if(!loc||loc.lat==null||loc.lon==null)return null;
  var lat=+loc.lat,lon=+loc.lon;
  if(!isFinite(lat)||!isFinite(lon)||lat<43.5||lat>48.4||lon<20.2||lon>29.9)return null;
  var country=name(loc.tara||loc.country_code||loc.country);
  if(country&&!/^(ro|rou|romania)$/.test(country))return null;
  var id=aliases[name(loc.nume||loc.name||loc.city)],named=id&&cities.find(function(c){return c.id===id;});
  if(named)return distance(lat,lon,named)<12?named:null;
  // Unnamed GPS forecasts may use city coordinates. A named nearby village keeps its own landscape.
  if(loc.nume||loc.name||loc.city)return null;
  var nearest=null,best=3;cities.forEach(function(c){var d=distance(lat,lon,c);if(d<best){best=d;nearest=c;}});return nearest;
 }
 function movie(scene,night,loc,temperature){var c=cityFor(loc);if(!c)return null;var k=key(c.id,scene,!!night);if(!pools[k])return null;if(limits[k]!=null&&(!isFinite(temperature)||temperature<limits[k]))return null;return k;}
 root.MeteoRomania={movie:movie,city:cityFor,cities:cities};
})(window);
`;
fs.writeFileSync(path.join(root,'weather-romania.js'),source);
console.log('Built '+cities.length+' city catalogue with '+records.length+' local assets and '+nightFilmsCount());
function nightFilmsCount(){return films.filter(f=>f.id.includes('-night-')).length+' distinct cloudy night films';}
