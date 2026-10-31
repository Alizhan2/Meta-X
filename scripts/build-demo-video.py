"""Mux the generated frames, narration and selectable English subtitles."""
import json,subprocess,re,hashlib
from pathlib import Path
import imageio_ffmpeg
root=Path('output/playwright/demo-3min').resolve();ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
video=root/'TabProof-demo-3min.mp4';subs=Path('docs/demo-3min/subtitles.srt').resolve()
subprocess.run([ffmpeg,'-y','-loglevel','error','-f','concat','-safe','0','-i',str(root/'frames.txt'),'-i',str(root/'narration.wav'),'-i',str(subs),'-map','0:v','-map','1:a','-map','2:s','-vf','fps=25,format=yuv420p','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','160k','-c:s','mov_text','-metadata:s:s:0','language=eng','-disposition:s:0','default','-t','180','-movflags','+faststart',str(video)],check=True)
probe=subprocess.run([ffmpeg,'-hide_banner','-i',str(video)],capture_output=True,text=True).stderr
assert 'Duration: 00:03:00.00' in probe and '1920x1080' in probe and '25 fps' in probe
assert 'Video: h264' in probe and 'Audio: aac' in probe and 'Subtitle: mov_text' in probe
subprocess.run([ffmpeg,'-v','error','-i',str(video),'-map','0:v','-map','0:a','-f','null','-'],check=True)
volume=subprocess.run([ffmpeg,'-hide_banner','-i',str(video),'-vn','-sn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True).stderr
mean=float(re.search(r'mean_volume: ([-\d.]+) dB',volume)[1]);assert -45<mean<-5
for second in [5,50,70,100,115,145,172]:subprocess.run([ffmpeg,'-y','-loglevel','error','-ss',str(second),'-i',str(video),'-frames:v','1',str(root/f'verify-{second}.png')],check=True)
check={'durationSeconds':180,'dimensions':[1920,1080],'fps':25,'videoCodec':'h264','audioCodec':'aac','subtitleCodec':'mov_text','meanVolumeDb':mean,'fullDecode':'passed','bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'scope':'Technical media checks and sampled visual review; system English voice; no new Meta calls.'}
(root/'verification.json').write_text(json.dumps(check,indent=2)+'\n');Path('docs/demo-3min/verification.json').write_text(json.dumps(check,indent=2)+'\n')
print(json.dumps(check))
