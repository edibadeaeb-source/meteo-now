/* Offline coastal context. Natural Earth 1:50m coastline is public domain. */
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const input=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261006/filmari-originale/ne_50m_coastline.geojson');
function distance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
function simplify(points){if(points.length<3)return points;let best=.015,index=0;for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>best){best=d;index=i;}}return index?simplify(points.slice(0,index+1)).slice(0,-1).concat(simplify(points.slice(index))):[points[0],points.at(-1)];}
const lines=[];
for(const f of JSON.parse(fs.readFileSync(input)).features){
 for(const c of (f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates)){
  const p=simplify(c).map(p=>p.map(v=>+v.toFixed(4)));
  const xs=p.map(p=>p[0]),ys=p.map(p=>p[1]);
  const box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  // The inland Caspian Sea is included by Natural Earth; it is not a sea-coast scene.
  if(box[0]>43&&box[2]<56&&box[1]>35&&box[3]<48)continue;
  lines.push([box,p]);
 }
}
const packed=[];
function put(n){n=n<0?-n*2-1:n*2;while(n>127){packed.push((n&127)|128);n=Math.floor(n/128);}packed.push(n);}
put(lines.length);for(const [,p]of lines){put(p.length);let x=0,y=0;for(const point of p){const nx=Math.round(point[0]*1000),ny=Math.round(point[1]*1000);put(nx-x);put(ny-y);x=nx;y=ny;}}
const code=`/* Natural Earth 1:50m coastline, simplified for decorative context; public domain.\n   Source: https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-coastline/ */
(function(root){'use strict';var packed='${Buffer.from(packed).toString('base64')}',lines,memo=Object.create(null);
function decode(){var raw=root.atob(packed),pos=0;function get(){var n=0,m=1,b;do{b=raw.charCodeAt(pos++);n+=(b&127)*m;m*=128;}while(b&128);return n%2?-(n+1)/2:n/2;}var total=get();lines=[];while(total--){var count=get(),p=[],x=0,y=0,box=[180,90,-180,-90];while(count--){x+=get();y+=get();var lon=x/1000,lat=y/1000;p.push([lon,lat]);box[0]=Math.min(box[0],lon);box[1]=Math.min(box[1],lat);box[2]=Math.max(box[2],lon);box[3]=Math.max(box[3],lat);}lines.push([box,p]);}packed='';}
function coast(lat,lon){if(!isFinite(lat)||!isFinite(lon)||Math.abs(lat)>85)return false;if(!lines)decode();var key=lat.toFixed(3)+':'+lon.toFixed(3);if(key in memo)return memo[key];var scale=Math.max(.08,Math.cos(lat*Math.PI/180)),pad=.32/scale;
for(var i=0;i<lines.length;i++){var box=lines[i][0];if(lat<box[1]-.32||lat>box[3]+.32||lon<box[0]-pad||lon>box[2]+pad)continue;var p=lines[i][1];for(var j=1;j<p.length;j++){var a=p[j-1],b=p[j];if(Math.abs(a[0]-b[0])>180)continue;var ax=(a[0]-lon)*scale,ay=a[1]-lat,bx=(b[0]-lon)*scale,by=b[1]-lat,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(ax+t*dx,ay+t*dy)*111.2<=28){memo[key]=true;return true;}}}
memo[key]=false;return false;}
root.MeteoGeography={nearCoast:coast};})(window);\n`;
fs.writeFileSync(path.join(root,'weather-geography.js'),code);console.log('Coastline: '+lines.length+' lines, '+Buffer.byteLength(code)+' bytes');
