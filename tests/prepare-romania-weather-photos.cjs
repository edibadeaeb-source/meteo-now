// Reviewed Commons metadata is kept beside the prepared assets for reproducible attribution.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/weather-romania/v1');
const review=path.resolve(root,'../../03-Testare-si-capturi/tests/romania-photo-selection.json');
const archive=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261007/fotografii-romania');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(archive,{recursive:true});
const selections=JSON.parse(fs.readFileSync(review,'utf8'));
const previousFile=path.join(out,'sources.json');
const previous=Object.fromEntries((fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):[]).map(p=>[p.id,p]));
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
let next=0;const records=[];let renditions={};
async function prepareRenditions(){
 const file=path.join(archive,'renditions.json');if(fs.existsSync(file))renditions=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const width of [2560,1600,800]){const group=selections.filter(p=>(!renditions[p.title]||(p.highResolution&&!renditions[p.title].includes('/3840px-')))&&(p.highResolution||p.width>=3840?2560:p.width>=1920?1600:800)===width);
  for(let start=0;start<group.length;start+=45){const photos=group.slice(start,start+45),params=new URLSearchParams({action:'query',format:'json',titles:photos.map(p=>p.title).join('|'),prop:'imageinfo',iiprop:'url',iiurlwidth:String(width)});let r;
   for(let retry=0;retry<4;retry++){await new Promise(resolve=>setTimeout(resolve,2000));r=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:AbortSignal.timeout(45000)});if(r.ok)break;const delay=Math.max(60,+r.headers.get('retry-after')||0)*1000;console.log('Rendition metadata retry '+r.status);await new Promise(resolve=>setTimeout(resolve,delay));}
   if(!r.ok)throw Error('Image metadata '+r.status);const d=await r.json();for(const p of Object.values(d.query.pages)){const info=p.imageinfo?.[0];if(info)renditions[p.title]=info.thumburl||info.url;}
   fs.writeFileSync(file,JSON.stringify(renditions,null,2));
  }
 }
}
async function worker(){while(next<selections.length){const p=selections[next++],m=p.extmetadata||{};
 const license=plain(m.LicenseShortName?.value);if(!/CC BY|CC0|Public domain/i.test(license)||/NC|ND/.test(license))throw Error('License needs review: '+p.title);
 const original=path.join(archive,p.id+path.extname(new URL(p.url).pathname));
 const source=fs.existsSync(original)?original:path.join(archive,p.id+(p.highResolution?'.large':'')+'.source');
 const target=path.join(out,p.id+'.webp');
 if(!fs.existsSync(source)){let r;for(let retry=0;retry<4;retry++){const clean=new URL(renditions[p.title]||p.url);clean.search='';r=await fetch(clean,{headers:{'User-Agent':'MeteoNowAssetResearch/1.0'},signal:AbortSignal.timeout(90000)});if(r.ok)break;if(r.status!==429&&r.status!==503)throw Error(p.title+' '+r.status);const delay=Math.max(30,+r.headers.get('retry-after')||0)*1000;console.log('Download retry '+p.id+' '+r.status);await new Promise(resolve=>setTimeout(resolve,delay));}if(!r.ok)throw Error(p.title+' '+r.status);fs.writeFileSync(source,Buffer.from(await r.arrayBuffer()));}
 const code=`from PIL import Image,ImageOps\nimport sys,json\nim=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert('RGB')\nw,h=im.size\nratio=9/16\nif w/h>ratio:\n cw=round(h*ratio);left=round((w-cw)*float(sys.argv[3]));im=im.crop((left,0,left+cw,h))\nelse:\n ch=round(w/ratio);top=(h-ch)//2;im=im.crop((0,top,w,top+ch))\nlimit=int(sys.argv[4])\nif im.width>limit:im=im.resize((limit,round(limit*16/9)),Image.Resampling.LANCZOS)\nim.save(sys.argv[2],format='WEBP',quality=92,method=6)\nprint(json.dumps(dict(width=im.width,height=im.height)))`;
 // No invented detail: keep the original crop size when the source is smaller than 2K.
 const sizeOnly=`from PIL import Image\nimport sys,json\nim=Image.open(sys.argv[1]);print(json.dumps(dict(width=im.width,height=im.height)))`;
 const reuse=fs.existsSync(target)&&!process.argv.includes('--force')&&previous[p.id]?.focus===(p.focus??.5)&&previous[p.id]?.download===(fs.existsSync(original)?p.url:renditions[p.title]);
 const r=spawnSync('C:/ProgramData/spyder-6/python.exe',reuse?['-c',sizeOnly,target]:['-c',code,source,target,String(p.focus??.5),String(Math.min(1440,Math.round(p.height*9/16),p.width))],{encoding:'utf8',maxBuffer:1024*1024});if(r.status!==0)throw Error(r.stderr);
 records.push({id:p.id,slug:p.slug,city:p.name,lat:p.lat,lon:p.lon,scenes:p.scenes,night:p.night,focus:p.focus??.5,minTemperature:p.minTemperature??null,poster:'assets/weather-romania/v1/'+p.id+'.webp',title:p.title,author:plain(m.Artist?.value||m.Credit?.value||'Unknown / see source'),source:p.descriptionurl,original:p.url,download:fs.existsSync(original)?p.url:renditions[p.title],sourceWidth:p.width,sourceHeight:p.height,license,licenseUrl:m.LicenseUrl?.value||'',changes:'Portrait crop, resize if needed, WebP conversion; subtle CSS pan and zoom in the app.',...JSON.parse(r.stdout),bytes:fs.statSync(target).size});
 console.log('Prepared '+p.id);
}}
prepareRenditions().then(()=>Promise.all([worker(),worker(),worker()])).then(()=>{records.sort((a,b)=>selections.findIndex(p=>p.id===a.id)-selections.findIndex(p=>p.id===b.id));fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(records,null,2));console.log('COMPLETE '+records.length+' photographs');}).catch(e=>{console.error(e);process.exitCode=1});
