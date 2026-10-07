/* Natural blue/grey clouds replace the green overcast variants, day and night. */
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.join(__dirname,'..');
const original=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261007/nori-noapte-20261007/12460328.mp4');
const output=path.join(root,'assets/weather-video/v7');fs.mkdirSync(output,{recursive:true});
const ff='C:/ProgramData/spyder-6/Library/bin/ffmpeg.exe';
const source={sourceId:12460328,title:'Overcast on Sky',author:'Altaf Shah',
 source:'https://www.pexels.com/video/overcast-on-sky-12460328/',license:'https://www.pexels.com/license/',
 download:'https://videos.pexels.com/video-files/12460328/12460328-hd_1080_1920_60fps.mp4',sourceWidth:1080,sourceHeight:1920};
const jobs=[];
for(const night of [false,true])for(const [letter,start]of [['a',.3],['b',3.7]])jobs.push({...source,
 id:(night?'overcast-night':'overcast')+'-'+letter,quality:'hd',night,start,speed:3,
 filter:night?'hue=s=0,eq=brightness=-.12:contrast=1.06:gamma=.72,colorchannelmixer=rr=.80:gg=.90:bb=1.10,':
 'hue=s=0,colorchannelmixer=rr=.95:gg=1:bb=1.07,',
 notes:'Two separate cuts of real cloud footage; neutral/cool grading, no green cast. Night is illustrative grading, with no added stars, moon, lightning or precipitation.'});
function run(args,program=ff){return new Promise((resolve,reject)=>{const p=spawn(program,args);let err='';p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve());});}
async function build(j){
 for(const [tier,w,h,crf,rate]of [['lite',720,1280,25,'1500k'],['hd',1080,1920,22,'2800k']]){
  const target=path.join(output,j.id+'-'+tier+'.mp4');
  if(fs.existsSync(target)&&fs.statSync(target).size>10000)continue;
  const graph=`[0:v]${j.filter}scale=${w}:${h},setsar=1,setpts=${j.speed}*(PTS-STARTPTS),minterpolate=fps=30:mi_mode=blend,trim=duration=9,split=2[tail][head];[tail]trim=start=1:end=9,setpts=PTS-STARTPTS,fps=30,settb=AVTB[a];[head]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=30,settb=AVTB[b];[a][b]xfade=transition=fade:duration=1:offset=7,format=yuv420p[out]`;
  await run(['-y','-loglevel','error','-filter_complex_threads','2','-ss',String(j.start),'-t','3.2','-i',original,
   '-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf',String(crf),'-maxrate',rate,
   '-bufsize','5600k','-profile:v','main','-level',tier==='lite'?'3.1':'4.1','-g','60','-threads','2',
   '-movflags','+faststart',target]);
 }
 const png=path.join(path.dirname(original),j.id+'-poster.png');
 await run(['-y','-loglevel','error','-ss','1','-i',path.join(output,j.id+'-hd.mp4'),'-vf','scale=720:1280',
  '-frames:v','1',png]);
 await run(['-c','from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2],format="WEBP",quality=88,method=6)',png,path.join(output,j.id+'.webp')],'C:/ProgramData/spyder-6/python.exe');
 console.log('Prepared '+j.id);
}
let next=0;async function worker(){while(next<jobs.length)await build(jobs[next++]);}
Promise.all([worker(),worker()]).then(()=>{fs.writeFileSync(path.join(output,'sources.json'),JSON.stringify(jobs,null,2));console.log('PASS: four cloud variants / eight films and four matching posters');}).catch(e=>{console.error(e.message);process.exitCode=1});
