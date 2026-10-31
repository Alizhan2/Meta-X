"""Render an English system voice and timed captions from the reviewed scene text."""
import json,subprocess,re,math,os
from pathlib import Path
import imageio_ffmpeg
root=Path('output/playwright/demo-3min').resolve()
scenes=json.loads(Path('docs/demo-3min/scenes.json').read_text())
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
assert sum(s['duration'] for s in scenes)==180
captions=[];audit=[];start=0;transcript=['# TabProof — three-minute narration','', 'English system voice in the rendered MP4. Recorded Meta results; edited for time. No new model calls were made for this presentation.','']
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
for i,s in enumerate(scenes):
 text=s['narration'];aiff=root/f'voice-{i}.aiff';wav=root/f'voice-{i}.wav'
 rate=max(155,min(195,math.ceil(len(text.split())/(s['duration']-1.5)*60*1.08)))
 subprocess.run(['say','-v','Samantha','-r',str(rate),'-o',str(aiff),text],check=True)
 probe=subprocess.run([ffmpeg,'-i',str(aiff)],capture_output=True,text=True).stderr
 m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe);assert m,probe
 duration=int(m[1])*3600+int(m[2])*60+float(m[3]);speed=max(1,duration/(s['duration']-.65))
 assert speed<1.4,'Narration too long'
 subprocess.run([ffmpeg,'-y','-loglevel','error','-i',str(aiff),'-af',f'atempo={speed},apad','-t',str(s['duration']),'-ar','48000','-ac','1',str(wav)],check=True)
 words=text.split();groups=[words[j:j+13] for j in range(0,len(words),13)];spoken=duration/speed;elapsed=0
 for group in groups:
  end=elapsed+spoken*len(group)/len(words);captions.append(f'{len(captions)+1}\n{stamp(start+elapsed)} --> {stamp(start+end)}\n'+ ' '.join(group)+'\n');elapsed=end
 transcript += [f"## {stamp(start)[:8]}–{stamp(start+s['duration'])[:8]} · {s['title']}",'',text,'']
 audit.append({'scene':i,'seconds':s['duration'],'voiceSeconds':duration,'tempo':speed,'rate':rate});start+=s['duration']
(root/'audio.txt').write_text('\n'.join(f"file 'voice-{i}.wav'" for i in range(len(scenes)))+'\n')
(root/'narration-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
Path('docs/demo-3min/subtitles.srt').write_text('\n'.join(captions))
Path('docs/demo-3min/narration-en.md').write_text('\n'.join(transcript)+'\n')
subprocess.run([ffmpeg,'-y','-loglevel','error','-f','concat','-safe','0','-i',str(root/'audio.txt'),'-c:a','pcm_s16le',str(root/'narration.wav')],check=True)
print('Rendered 12 voice segments and subtitles: 180 seconds.')
