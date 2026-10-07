const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dir=path.join(__dirname,'../assets/weather-video/v6'),ff='C:/ProgramData/spyder-6/Library/bin/';
const manifest=[];
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.mp4'))){
 const info=spawnSync(ff+'ffprobe.exe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration','-of','json',path.join(dir,name)],{encoding:'utf8'});assert.equal(info.status,0,info.stderr);
 const data=JSON.parse(info.stdout),v=data.streams[0];assert.equal(data.streams.length,1,'silent footage only');assert.equal(v.codec_name,'h264');assert.equal(v.r_frame_rate,'30/1');
 const width=name.includes('-2k')?1440:name.includes('-hd')?1080:720;assert.equal(v.width,width);assert.equal(v.height,width===1440?2560:width===1080?1920:1280);assert.ok(+data.format.duration>7&&+data.format.duration<9);
 // Analyse every frame plus the wrap-around, rather than a few sampled thumbnails.
 const r=spawnSync(ff+'ffmpeg.exe',['-hide_banner','-loglevel','info','-i',path.join(dir,name),'-vf','scale=96:170,signalstats,metadata=print','-an','-f','null','NUL'],{encoding:'utf8',maxBuffer:10*1024*1024});assert.equal(r.status,0,r.stderr);
 const means=Array.from(r.stderr.matchAll(/lavfi.signalstats.YAVG=([\d.]+)/g),m=>+m[1]);assert.ok(means.length>220);
 const jumps=means.slice(1).map((v,i)=>Math.abs(v-means[i]));jumps.push(Math.abs(means[0]-means.at(-1)));const jump=Math.max(...jumps);
 assert.ok(jump<5,'unexpected flash or bright loop seam in '+name+': '+jump);
 manifest.push({name,width:v.width,height:v.height,seconds:+data.format.duration,frames:means.length,luminanceJump:jump,bytes:fs.statSync(path.join(dir,name)).size});
 console.log(name+': maximum luminance jump '+jump.toFixed(3));
}
assert.equal(manifest.length,4,'replacement in two qualities');assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.webp')).length,2,'matching replacement poster');
const out=path.resolve(__dirname,'../../../03-Testare-si-capturi/tests/artifacts-weather-video');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'rain-replacement-manifest.json'),JSON.stringify(manifest,null,2));
console.log('PASS: replacement encodes, portrait HD/2K/lite, silent H.264 30 fps; all frames and loop boundaries checked for flashes');
