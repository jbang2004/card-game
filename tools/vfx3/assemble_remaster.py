"""Assemble runtime frames and original procedural cue samples; no source retouching."""
from pathlib import Path
import subprocess,json,math,wave,os
from PIL import Image,ImageFont,ImageDraw
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/remaster-r9';REC=OUT/'recording';V=OUT/'video';V.mkdir(exist_ok=True)
F=os.getenv('BENCHMARK_FONT') or subprocess.check_output(['fc-match','Noto Sans CJK SC','-f','%{file}'],text=True).strip()
font=lambda n:ImageFont.truetype(F,n)
def main():
 m=json.loads((REC/'manifest.json').read_text());rate=44100;fps=30
 js=r'''const fs=require('fs'),Q=require('./src/vfx3/remaster-cues.js');let m=JSON.parse(fs.readFileSync(process.argv[1]));for(let c of m.clips){let a=new Float32Array(Math.ceil((c.duration+.5)*44100));if(c.role!=='demise')for(let d of c.group){let origin=c.group[0].start;for(let e of Q.events(d)){let s=Q.pcm(d.kind,e.id,44100),off=Math.round((e.at-origin)/1000*44100);for(let i=0;i<s.length&&off+i<a.length;i++)if(off+i>=0)a[off+i]+=s[i]*.65;}}fs.writeFileSync(c.folder+'/audio.f32',Buffer.from(a.buffer));}'''
 subprocess.run(['node','-e',js,str(REC/'manifest.json')],cwd=ROOT,check=True)
 segments=[];num=0
 # Original-speed full game first. Physical-family closer reviews only afterwards.
 for slow in [False,True]:
  for c in m['clips']:
   if slow and c['role'] not in ['archer','wolf','berserker']:continue
   first=num
   for i in range(c['frames']):
    im=Image.open(Path(c['folder'])/f'{i:05d}.jpg').convert('RGB')
    if slow:im=im.crop((425,70,1205,558)).resize((1440,900),Image.Resampling.LANCZOS)
    d=ImageDraw.Draw(im);d.rounded_rectangle((32,765,842,880),12,fill=(9,18,25))
    d.text((51,775),c['label'],font=font(30),fill=(239,228,210))
    d.text((53,821),'½× 局部回看 · 静音' if slow else '1× 实际游戏演出回看 · 运行时音效',font=font(18),fill=(167,192,202))
    d.text((53,849),'R9 / 帧采样不代表实时帧率 · 保留原规则结算',font=font(14),fill=(128,153,167))
    for repeat in range(2 if slow else 1):im.save(V/f'{num:05d}.jpg',quality=88);num+=1
   segments.append({'role':c['role'],'start':first,'frames':num-first,'slow':slow})
 audio=np.zeros(math.ceil(num/fps*rate),dtype=np.float32)
 for seg in segments:
  if seg['slow']:continue
  c=next(c for c in m['clips'] if c['role']==seg['role']);s=np.fromfile(Path(c['folder'])/'audio.f32',dtype='<f4');off=round(seg['start']/fps*rate);n=min(len(s),round(seg['frames']/fps*rate),len(audio)-off);audio[off:off+n]+=s[:n]
 with wave.open(str(OUT/'runtime-audio.wav'),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(audio,-.92,.92)*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','warning','-framerate',str(fps),'-i',str(V/'%05d.jpg'),'-i',str(OUT/'runtime-audio.wav'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(OUT/'Remaster_R9_Demo.mp4')],check=True)
 (OUT/'video-manifest.json').write_text(json.dumps({'fps':fps,'frames':num,'duration':num/fps,'segments':segments,'origin':m['origin'],'audio':m['audio'],'visual':m['visual'],'actual_device_fps_claim':False},ensure_ascii=False,indent=2))
 print('Encoded',num,'frames,',round(num/fps,2),'seconds',flush=True)
if __name__=='__main__':main()
