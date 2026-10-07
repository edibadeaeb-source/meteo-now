/* Reuse licensed originals; preserve a broader city view beneath the weather sky. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/weather-romania/v2');
const archive=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261007/fotografii-romania');
const photos=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v1/sources.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
const code=`from PIL import Image,ImageOps\nimport sys,json\nim=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert('RGB')\nim.thumbnail((1440,1440),Image.Resampling.LANCZOS)\nim.save(sys.argv[2],format='WEBP',quality=90,method=6)\nprint(json.dumps(dict(width=im.width,height=im.height)))`;
for(const p of photos){
 const candidates=[p.id+path.extname(new URL(p.original).pathname),p.id+'.large.source',p.id+'.source'];
 const source=candidates.map(n=>path.join(archive,n)).find(n=>fs.existsSync(n));if(!source)throw Error('Missing licensed original '+p.id);
 const target=path.join(out,p.id+'.webp');
 const r=spawnSync('C:/ProgramData/spyder-6/python.exe',['-c',code,source,target],{encoding:'utf8'});if(r.status)throw Error(r.stderr);
 Object.assign(p,JSON.parse(r.stdout),{poster:'assets/weather-romania/v2/'+p.id+'.webp',bytes:fs.statSync(target).size,
  changes:'Resize without upscaling, WebP conversion; lower city layer blended beneath a separate weather-matching illustrative sky; subtle CSS pan.'});
}
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(photos,null,2));console.log('Prepared '+photos.length+' wider city photographs');
