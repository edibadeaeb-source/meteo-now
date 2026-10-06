/* Build app backgrounds from licensed originals archived outside the repository. */
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),archive=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261006/filmari-suplimentare');
const output=path.join(root,'assets/weather-video/v3');fs.mkdirSync(output,{recursive:true});
const ff='C:/ProgramData/spyder-6/Library/bin/ffmpeg.exe';
const jobs=[
 ['clear-day-a',4464663,'',2,0,'hd'],
 ['clear-day-b',20525236,'',2,0,'2k'],
 ['partly-cloudy-a',10616832,'',2,0,'2k'],
 ['partly-cloudy-b',36687056,'',2,0,'2k'],
 ['overcast-a',11565218,'hue=s=0.18,',3,0,'2k'],
 ['overcast-b',11564923,'hue=s=0.18,',3,6,'2k'],
 ['rain-a',14213657,'',1.5,3,'hd'],
 ['rain-b',14213653,'',1.5,6,'hd'],
 ['storm-a',17499303,'',2,0,'hd'],
 ['storm-b',5490604,'crop=iw*0.76:ih*0.90:0:0,',2,0,'hd'],
 ['snow-a',19493781,'',1.5,1,'hd'],
 ['snow-b',6620897,'',3,0,'hd'],
 ['fog-a',30577804,'',2,0,'2k'],
 ['fog-b',13908043,'crop=iw:ih*0.65:0:ih*0.35,',2,1,'hd'],
 ['twilight-a',5533652,'crop=iw:ih*0.93:0:0,deflicker=size=9:mode=am,',2,0,'hd'],
 ['twilight-b',5509042,'crop=iw:ih*0.93:0:0,deflicker=size=9:mode=am,',2,18,'hd'],
 ['clear-night-a',30550598,'crop=iw:ih*0.78:0:0,',3,1,'hd'],
 ['clear-night-b',34911278,'crop=iw:ih*0.88:0:0,',2,.2,'hd'],
 ['new-york-a',14306160,'',1.5,0,'2k'],
 ['new-york-b',16560848,'',2,0,'2k'],
 ['miami-a',15999290,'',1.5,0,'2k'],
 ['miami-b',15425136,'',1.5,0,'hd']
];
function run(args,input,program=ff){return new Promise((resolve,reject)=>{const p=spawn(program,args);let err='';const chunks=[];p.stdout.on('data',b=>chunks.push(b));p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve(Buffer.concat(chunks)));if(input)p.stdin.end(input);else p.stdin.end();});}
async function build(job){
 const [name,source,crop,speed,start,quality]=job,duration=9;
 for(const [tier,width,height,crf,maxrate]of [['lite',720,1280,25,'1500k'],[quality,quality==='2k'?1440:1080,quality==='2k'?2560:1920,23,quality==='2k'?'4000k':'2600k']]){
  const target=path.join(output,name+'-'+tier+'.mp4');
  if(fs.existsSync(target)&&fs.statSync(target).size>10000&&!process.env.METEO_REBUILD)continue;
  const graph=`[0:v]${crop}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,setpts=${speed}*(PTS-STARTPTS),minterpolate=fps=30:mi_mode=blend,trim=duration=${duration},split=2[tail][head];[tail]trim=start=1:end=${duration},setpts=PTS-STARTPTS,fps=30,settb=AVTB[a];[head]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=30,settb=AVTB[b];[a][b]xfade=transition=fade:duration=1:offset=${duration-2},format=yuv420p[out]`;
  await run(['-hide_banner','-loglevel','error','-filter_complex_threads','2','-ss',String(start),'-t',String(duration/speed+.2),'-i',path.join(archive,source+'.mp4'),'-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf',String(crf),'-maxrate',maxrate,'-bufsize',quality==='2k'?'8000k':'5200k','-profile:v','main','-level',tier==='lite'?'3.1':quality==='2k'?'5.0':'4.1','-g','60','-threads','2','-movflags','+faststart','-y',target]);
  console.log('Prepared '+name+'-'+tier+' ('+(fs.statSync(target).size/1048576).toFixed(2)+' MiB)');
 }
 const poster=await run(['-hide_banner','-loglevel','error','-ss','1','-i',path.join(output,name+'-'+quality+'.mp4'),'-vf','scale=720:1280','-frames:v','1','-f','image2pipe','-c:v','png','pipe:1']);
 await run(['-c','from PIL import Image; import sys,io; Image.open(io.BytesIO(sys.stdin.buffer.read())).save(sys.argv[1],format="WEBP",quality=86,method=6)',path.join(output,name+'.webp')],poster,'C:/ProgramData/spyder-6/python.exe');
 console.log('COMPLETE '+name);
}
let next=0;const filter=process.env.METEO_BUILD_MOVIE;const selected=jobs.filter(j=>!filter||j[0]===filter);
async function worker(){while(next<selected.length)await build(selected[next++]);}
Promise.all([worker(),worker()]).then(()=>console.log('ALL COMPLETE: '+selected.length+' new films, two qualities and matching posters')).catch(e=>{console.error(e);process.exitCode=1;});
