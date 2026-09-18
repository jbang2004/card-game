"""Create actual-render comparisons and a runtime-PCM video from capture_impact.py.
No generative images, color corrections or edits to the battle region are used.
"""
from pathlib import Path
import json, subprocess, wave, math, os
from PIL import Image,ImageDraw,ImageFont
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/impact-r10';VIDEO=OUT/'video';VIDEO.mkdir(exist_ok=True)
FONT=os.environ.get('BENCHMARK_FONT') or subprocess.check_output(['fc-match','Noto Sans CJK SC','-f','%{file}'],text=True).strip()
font=lambda n:ImageFont.truetype(FONT,n)
NAMES={'archer':'弓矢 · 穿心','wolf':'裂爪 · 撕袭','berserker':'重刃 · 崩击','fireball':'陨火 · 爆燃','frostbolt':'冰枪 · 贯刺','nova':'群体 · 霜原','shield':'光壁 · 凝盾','lifedrain':'血契 · 回流','renew':'生息 · 回复','silence':'虚空 · 蚀灭','blessing':'战意 · 赋能','wisdom':'星构 · 解印','wolves':'灵门 · 显现'}
def text(d,xy,s,n=24,fill=(226,231,230)):
 d.text(xy,s,font=font(n),fill=fill)
def crop(c,phase='peak',side=300):
 d=c['descriptor']['to'];im=Image.open(Path(c['folder'])/(phase+'.png')).convert('RGB')
 # Center on the actual recipient, not a fixed enemy card; equal crop for both versions.
 sz=300;cx=d['x'];cy=d['y'];x=max(0,min(im.width-sz,cx-sz/2));y=max(0,min(im.height-sz,cy-sz/2))
 return im.crop((round(x),round(y),round(x)+sz,round(y)+sz)).resize((side,side),Image.Resampling.LANCZOS)
def main():
 m=json.loads((OUT/'capture.json').read_text());clips={(c['version'],c['role']):c for c in m['clips']};fps=m['fps'];rate=44100
 roles=['archer','wolf','berserker','fireball','nova','shield']
 im=Image.new('RGB',(1280,974),(12,21,28));d=ImageDraw.Draw(im)
 text(d,(28,17),'R10 / 清晰轮廓 · 集中命中 · 刚体受击',32)
 text(d,(29,66),'实际游戏截帧 · 正常画面裁切 · 未调色或增强曝光',18,(147,173,181))
 for i,r in enumerate(roles):
  x=26+(i%3)*422;y=108+(i//3)*425
  im.paste(crop(clips['R10',r],side=398),(x,y));text(d,(x+8,y+401),NAMES[r],20)
 im.save(OUT/'Impact_R10_Overview.jpg',quality=94)
 im=Image.new('RGB',(1280,1285),(12,21,28));d=ImageDraw.Draw(im)
 text(d,(27,15),'R9 → R10 / 同一出招、同一接触后时刻',30)
 text(d,(29,57),'左：R9  ·  右：R10     相同裁切与曝光；画面取自运行程序',18,(147,173,181))
 for i,r in enumerate(roles):
  x=20+(i%2)*634;y=105+(i//2)*390
  text(d,(x+5,y),NAMES[r],22)
  for j,v in enumerate(['R9','R10']):
   im.paste(crop(clips[v,r],side=298),(x+j*310,y+36));text(d,(x+j*310+6,y+338),v,18,(146,184,190))
 im.save(OUT/'Impact_R9_R10_Comparison.jpg',quality=94)
 # General gallery: all 13 inspected families, also shows friendly/hero recipients correctly.
 im=Image.new('RGB',(1280,1540),(12,21,28));d=ImageDraw.Draw(im);text(d,(26,18),'R10 / 实际演出效果一览',31)
 for i,r in enumerate(NAMES):
  x=24+(i%4)*314;y=80+(i//4)*358
  im.paste(crop(clips['R10',r],side=296),(x,y));text(d,(x+4,y+302),NAMES[r],20)
 im.save(OUT/'Impact_R10_Gallery.jpg',quality=94)
 js=r'''const fs=require('fs'),Q=require('./src/vfx3/remaster-cues.js');let m=JSON.parse(fs.readFileSync(process.argv[1]));for(let c of m.clips){if(!c.frames)continue;let a=new Float32Array(Math.ceil((c.frames/m.fps+.5)*44100));for(let d of c.group){for(let e of Q.events(d)){let s=Q.pcm(d.kind,e.id,44100),off=Math.round((e.at-c.descriptor.start)/1000*44100);for(let i=0;i<s.length&&off+i<a.length;i++)if(off+i>=0)a[off+i]+=s[i]*.65;}}fs.writeFileSync(c.folder+'/audio.f32',Buffer.from(a.buffer));}'''
 subprocess.run(['node','-e',js,str(OUT/'capture.json')],cwd=ROOT,check=True)
 segments=[];idx=0
 for r in ['archer','wolf','berserker','fireball','frostbolt','nova','shield','lifedrain','renew']:
  c=clips['R10',r];start=idx
  for i in range(c['frames']):
   im=Image.open(Path(c['folder'])/f'{i:04d}.jpg').convert('RGB');d=ImageDraw.Draw(im)
   d.rounded_rectangle((23,702,845,782),9,fill=(10,21,29))
   text(d,(39,711),NAMES[r]+'  /  R10',27);text(d,(40,749),'1× 原速演出回看 · 同步运行时音效 · 帧采样不是实测帧率',17,(161,185,194))
   im.save(VIDEO/f'{idx:05d}.jpg',quality=90);idx+=1
  segments.append({'role':r,'start':start,'frames':idx-start,'audio':True})
 for r in ['archer','fireball','shield']:
  a=clips['R9',r];b=clips['R10',r];start=idx
  for i in range(min(a['frames'],b['frames'])):
   im=Image.new('RGB',(1280,800),(12,21,28));d=ImageDraw.Draw(im);text(d,(30,21),NAMES[r]+' / ½× 同步对照',30)
   for col,c in enumerate([a,b]):
    src=Image.open(Path(c['folder'])/f'{i:04d}.jpg').convert('RGB');to=c['descriptor']['to'];sz=390
    x=max(0,min(src.width-sz,to['x']-sz/2));y=max(0,min(src.height-sz,to['y']-sz/2))
    src=src.crop((round(x),round(y),round(x)+sz,round(y)+sz)).resize((600,600),Image.Resampling.LANCZOS)
    im.paste(src,(26+col*629,100));text(d,(40+col*629,64),'R9' if col==0 else 'R10',23)
   text(d,(31,725),'同一攻击相位、相同裁切 · 慢放静音 · 不重复伤害结算',21,(170,192,202))
   for repeat in range(2):im.save(VIDEO/f'{idx:05d}.jpg',quality=90);idx+=1
  segments.append({'role':r,'start':start,'frames':idx-start,'audio':False})
 audio=np.zeros(math.ceil(idx/fps*rate),dtype=np.float32)
 for s in segments:
  if not s['audio']:continue
  a=np.fromfile(Path(clips['R10',s['role']]['folder'])/'audio.f32',dtype='<f4');offset=round(s['start']/fps*rate);n=min(len(a),round(s['frames']/fps*rate),len(audio)-offset);audio[offset:offset+n]+=a[:n]
 with wave.open(str(OUT/'audio.wav'),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(audio,-.92,.92)*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','warning','-framerate',str(fps),'-i',str(VIDEO/'%05d.jpg'),'-i',str(OUT/'audio.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(OUT/'Card_Game_Impact_R10.mp4')],check=True)
 (OUT/'video.json').write_text(json.dumps({'fps':fps,'frames':idx,'seconds':idx/fps,'segments':segments,'audio':'Same runtime PCM, offline mixed at exact cue timestamps. Not live speaker recording.','visual':'Actual game deterministic replay, not performance measurement.'},ensure_ascii=False,indent=2))
 print('Assembled',idx,'frames;',idx/fps,'seconds.')
if __name__=='__main__':main()
