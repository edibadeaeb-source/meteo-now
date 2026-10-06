/* Licensed originals stay in the local archive. Versioned mobile encodes + posters. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),original=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261006/filmari-originale');
const output=path.join(root,'assets/weather-video/v2');fs.mkdirSync(output,{recursive:true});
const ffmpeg='C:/ProgramData/spyder-6/Library/bin/ffmpeg.exe';
// HD sources are kept at HD. 2K versions are derived only from UHD originals.
const jobs=[
 ['clear-day','clear','',2,10,0,'hd'],
 ['partly-cloudy','blue-uhd','',2,10,0,'2k'],
 ['overcast','overcast-uhd','crop=iw:ih*0.86:0:0,',2,10,0,'2k'],
 ['twilight','twilight','crop=iw:ih*0.85:0:0,',2,10,0,'hd'],
 ['snow','snow','',1,5,0,'2k'],
 // The original flash begins after three seconds: never include that part.
 ['clear-night','night-uhd','crop=iw*0.70:ih*0.75:iw*0.05:0,',4,9,.1,'2k'],
 ['new-york','new-york-vertical-uhd','',1.5,10,0,'2k'],
 ['miami','miami-uhd','',1.5,10,0,'2k'],
 ['tropical-coast','tropical','',1.5,10,0,'hd'],
 ['coast','miami-uhd','crop=iw*0.55:ih:iw*0.4:0,',1.5,10,0,'2k'],
 ['coast-cloudy','coast-uhd','',1.5,10,0,'2k'],
 ['highland','mountain-uhd','',2,10,0,'2k']
];
const filter=process.env.METEO_BUILD_MOVIE;
for(const [name,source,crop,speed,duration,start,quality]of jobs){
 if(filter&&name!==filter)continue;
 for(const [tier,width,height,crf,maxrate]of [['lite',720,1280,24,'1600k'],[quality,quality==='2k'?1440:1080,quality==='2k'?2560:1920,22,quality==='2k'?'5000k':'2600k']]){
  const target=path.join(output,name+'-'+tier+'.mp4');
  if(!process.env.METEO_REBUILD&&fs.existsSync(target)&&fs.statSync(target).size>10000){console.log(name+'-'+tier+': already prepared');continue;}
  const graph=`[0:v]${crop}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,setpts=${speed}*(PTS-STARTPTS),minterpolate=fps=30:mi_mode=blend,trim=duration=${duration},split=2[tail][head];[tail]trim=start=1:end=${duration},setpts=PTS-STARTPTS,fps=30,settb=AVTB[a];[head]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=30,settb=AVTB[b];[a][b]xfade=transition=fade:duration=1:offset=${duration-2},format=yuv420p[out]`;
  const args=['-hide_banner','-loglevel','error','-filter_complex_threads','2','-ss',String(start),'-t',String(duration/speed+.1),'-i',path.join(original,source+'.mp4'),'-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf',String(crf),'-maxrate',maxrate,'-bufsize',quality==='2k'?'10000k':'5200k','-profile:v','main','-level',tier==='lite'?'3.1':quality==='2k'?'5.0':'4.1','-g','60','-threads','2','-movflags','+faststart','-y',target];
  const r=spawnSync(ffmpeg,args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
  console.log(name+'-'+tier+': '+fs.statSync(path.join(output,name+'-'+tier+'.mp4')).size+' bytes');
 }
 if(['new-york','miami','tropical-coast','coast','coast-cloudy','highland'].includes(name)){
  const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-ss','1','-i',path.join(output,name+'-'+quality+'.mp4'),'-frames:v','1','-f','image2pipe','-c:v','png','pipe:1'],{maxBuffer:30*1024*1024});if(r.status!==0)throw Error(String(r.stderr));
  const encode=spawnSync('C:/ProgramData/spyder-6/python.exe',['-c','from PIL import Image; import sys,io; Image.open(io.BytesIO(sys.stdin.buffer.read())).save(sys.argv[1],format="WEBP",quality=84,method=6)',path.join(output,name+'.webp')],{input:r.stdout,encoding:'utf8'});if(encode.status!==0)throw Error(encode.stderr);
 }
}
