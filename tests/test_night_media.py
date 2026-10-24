import json,re,subprocess,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BIN=Path('C:/ProgramData/spyder-6/Library/bin')

class NightMediaTests(unittest.TestCase):
    def test_actual_video_profiles_and_all_frames(self):
        result=[]
        for quality,w,h,fps in [('hd',1080,1920,30),('lite',720,1280,24)]:
            path=ROOT/f'assets/weather-video/v8/partly-cloudy-night-b-{quality}.mp4'
            probe=subprocess.run([str(BIN/'ffprobe.exe'),'-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration','-of','json',str(path)],capture_output=True,text=True,check=True)
            info=json.loads(probe.stdout);self.assertEqual(len(info['streams']),1)
            video=info['streams'][0];self.assertEqual(video['codec_name'],'h264');self.assertEqual((video['width'],video['height']),(w,h));self.assertEqual(video['r_frame_rate'],f'{fps}/1')
            self.assertAlmostEqual(float(info['format']['duration']),11,places=1)
            frames=subprocess.run([str(BIN/'ffmpeg.exe'),'-hide_banner','-loglevel','info','-i',str(path),'-vf','scale=96:170,signalstats,metadata=print','-an','-f','null','NUL'],capture_output=True,text=True,check=True)
            means=[float(v) for v in re.findall(r'lavfi.signalstats.YAVG=([\d.]+)',frames.stderr)]
            self.assertGreater(len(means),250)
            maxjump=max(abs(a-b) for a,b in zip(means,means[1:]+means[:1]))
            self.assertLess(maxjump,5,'No abrupt bright frame or loop seam')
            result.append({'profile':quality,'width':w,'height':h,'fps':fps,'frames':len(means),'maxLuminanceJump':maxjump,'bytes':path.stat().st_size})
        out=ROOT.parents[1]/'03-Testare-si-capturi/tests/artifacts-night-clouds-20261024'
        (out/'media-validation.json').write_text(json.dumps(result,indent=2),encoding='utf8')

if __name__=='__main__': unittest.main()
