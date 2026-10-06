/* Local build helper. Original licensed footage stays outside the deployment. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),original=path.resolve(root,'../../04-Backupuri-si-versiuni-vechi/design-fundaluri-20261006/filmari-originale');
const output=path.join(root,'assets/weather-video/v1');fs.mkdirSync(output,{recursive:true});
const ffmpeg='C:/ProgramData/spyder-6/Library/bin/ffmpeg.exe';
const jobs=[
 ['clear-day','clear','',2,12],
 ['partly-cloudy','daylight','crop=iw:ih*0.76:0:0,',2,12],
 ['overcast','overcast','crop=iw:ih*0.70:0:0,',1.5,12],
 ['twilight','twilight','crop=iw:ih*0.85:0:0,',2,12],
 ['snow','snow','',1,8],
 ['clear-night','night','crop=iw*0.70:ih*0.75:iw*0.05:0,',1.5,12]
];
for(const [name,source,crop,speed,duration]of jobs){
 const graph=`[0:v]${crop}scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,setpts=${speed}*(PTS-STARTPTS),minterpolate=fps=30:mi_mode=blend,trim=duration=${duration},split=2[tail][head];[tail]trim=start=1:end=${duration},setpts=PTS-STARTPTS,fps=30,settb=AVTB[a];[head]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=30,settb=AVTB[b];[a][b]xfade=transition=fade:duration=1:offset=${duration-2},format=yuv420p[out]`;
 const args=['-hide_banner','-loglevel','error','-filter_complex_threads','2','-t',String(duration/speed+1),'-i',path.join(original,source+'.mp4'),'-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','26','-maxrate','1100k','-bufsize','2200k','-profile:v','main','-level','3.1','-g','60','-threads','2','-movflags','+faststart','-y',path.join(output,name+'.mp4')];
 const r=spawnSync(ffmpeg,args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
 console.log(name+': '+fs.statSync(path.join(output,name+'.mp4')).size+' bytes');
}
