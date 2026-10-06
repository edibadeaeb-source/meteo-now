const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets/weather-video/v2'),ff='C:/ProgramData/spyder-6/Library/bin/';
const manifest=[];
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.mp4'))){
 const result=spawnSync(ff+'ffprobe.exe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration','-of','json',path.join(dir,name)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const info=JSON.parse(result.stdout);assert.equal(info.streams.length,1,'silent films only');const video=info.streams[0];assert.equal(video.codec_name,'h264');assert.equal(video.r_frame_rate,'30/1');
 assert.ok(+info.format.duration>3&&+info.format.duration<=10);
 assert.equal(video.width,name.includes('-2k')?1440:name.includes('-hd')?1080:720);assert.equal(video.height,name.includes('-2k')?2560:name.includes('-hd')?1920:1280);
 manifest.push({name,width:video.width,height:video.height,seconds:+info.format.duration,bytes:fs.statSync(path.join(dir,name)).size});
 if(name.startsWith('clear-night')){
  const r=spawnSync(ff+'ffmpeg.exe',['-hide_banner','-loglevel','info','-i',path.join(dir,name),'-vf','scale=96:170,signalstats,metadata=print','-an','-f','null','NUL'],{encoding:'utf8',maxBuffer:10*1024*1024});assert.equal(r.status,0,r.stderr);
  const means=Array.from(r.stderr.matchAll(/lavfi.signalstats.YAVG=([\d.]+)/g),m=>+m[1]);assert.ok(means.length>100);
  const jumps=means.slice(1).map((v,i)=>Math.abs(v-means[i]));jumps.push(Math.abs(means[0]-means.at(-1)));
  assert.ok(Math.max(...jumps)<5,'no flash anywhere in the night movie or at its loop seam: '+Math.max(...jumps));
  console.log(name+': '+means.length+' frames including loop boundary, maximum luminance jump '+Math.max(...jumps).toFixed(3));
 }
}
assert.equal(manifest.length,24,'all twelve movies have large and small versions');
const out=path.resolve(root,'../../03-Testare-si-capturi/tests/artifacts-weather-video');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'context-video-manifest.json'),JSON.stringify(manifest,null,2));
console.log('PASS: all video dimensions, 30fps, silent H.264, full night sequences and seamless no-flash boundaries');
