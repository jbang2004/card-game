"""Compose unretouched runtime screenshots and silent event-replay video.
The captions are outside/corner overlays, never painted over target art.
"""
from pathlib import Path
import json,subprocess,os,math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/lifecycle-r11';REC=OUT/'recording';DEST=OUT/'delivery';DEST.mkdir(exist_ok=True)
FONT=os.environ.get('VFX_FONT')or subprocess.check_output(['fc-match','Noto Sans CJK SC','-f','%{file}'],text=True).strip()
font=lambda s:ImageFont.truetype(FONT,s)
NAMES={'shield-break':'圣盾 · 破碎','thaw':'冰壳 · 解冻','stealth-in':'潜行 · 入影','stealth-out':'潜行 · 显形','silence':'沉默 · 封印','morph':'化形 · 易相','rebirth':'复生 · 归魂','expire':'增益 · 到期','armor-break':'护甲 · 承击','secret-reveal':'奥秘 · 揭示','counterspell':'反制 · 截断','weapon-equip':'武器 · 装备','weapon-break':'武器 · 断裂','overdraw':'爆牌 · 焚毁','fatigue':'疲劳 · 空竭','trigger':'能力 · 回响','turn-ready':'回合 · 蓄能','hero-fall':'英雄 · 陨落','victory':'胜利 · 加冕','defeat':'败北 · 余烬','awaken':'首领 · 觉醒','draw-arrive':'抽牌 · 收束'}
NOTES={'shield-break':'盾面脱离，碎光散开','thaw':'冰壳下落，冷雾退去','stealth-out':'影迹展开，显露出手','silence':'符印闭合，能力清除','morph':'旧形消退，新形显现','rebirth':'魂光回聚，复生落位'}
def label(d,x,y,s,size=22,fill='#e3eced'):d.text((x,y),s,font=font(size),fill=fill)
def crop(im,box,side=320,area=250):
 # Desktop stage is 1600x940 fitted to 1440x900, leaving 27px top/bottom bars.
 scale=min(im.width/1600,im.height/940);ox=(im.width-1600*scale)/2;oy=(im.height-940*scale)/2
 x=box['x']*scale+ox;y=box['y']*scale+oy
 x=max(0,min(im.width-area,x-area/2));y=max(0,min(im.height-area,y-area/2))
 return im.crop((round(x),round(y),round(x)+area,round(y)+area)).resize((side,side),Image.Resampling.LANCZOS)
def stills():
 m=json.loads((OUT/'browser-tests.json').read_text());cases=m['cases']
 roles=['shield-break','thaw','stealth-out','silence','morph','rebirth']
 im=Image.new('RGB',(1280,1054),'#0e1822');d=ImageDraw.Draw(im)
 label(d,25,17,'R11 / 不只是攻击，还要看懂状态的变化',31)
 label(d,27,62,'六项重点补齐 · 真实游戏截帧 · 局部等比放大，无调色和曝光增强',18,'#9db3c2')
 for i,r in enumerate(roles):
  x=25+i%3*420;y=106+i//3*470;src=Image.open(OUT/(r+'-break.png')).convert('RGB')
  im.paste(crop(src,cases[r]['descriptor']['to'],390,248),(x,y));label(d,x+4,y+394,NAMES[r],22);label(d,x+4,y+423,NOTES[r],15,'#9db3c2')
 im.save(DEST/'Lifecycle_R11_Overview.jpg',quality=94)
 im=Image.new('RGB',(1280,2310),'#0e1822');d=ImageDraw.Draw(im)
 label(d,25,17,'R11 / 22 类状态与规则事件演出',31)
 label(d,27,62,'独立命名的事件配方，复用几何与材质；不是 22 套新角色模型。',17,'#9db3c2')
 for i,r in enumerate(NAMES):
  x=24+i%4*314;y=105+i//4*362;src=Image.open(OUT/(r+'-break.png')).convert('RGB')
  im.paste(crop(src,cases[r]['descriptor']['to'],295,275),(x,y));label(d,x+3,y+302,NAMES[r],20)
 im.save(DEST/'Lifecycle_R11_Gallery.jpg',quality=93)
 im=Image.new('RGB',(1250,1790),'#0e1822');d=ImageDraw.Draw(im);label(d,25,16,'R11 / 起始 → 变化 → 消散',31)
 for i,r in enumerate(roles):
  y=75+i*280;label(d,22,y+5,NAMES[r],22)
  for j,(name,ms)in enumerate([('start',25),('break',150),('residue',430)]):
   src=Image.open(OUT/(r+'-'+name+'.png')).convert('RGB');im.paste(crop(src,cases[r]['descriptor']['to'],226,260),(258+j*326,y));label(d,264+j*326,y+231,f'事件后 {ms}ms',17,'#9db3c2')
 im.save(DEST/'Lifecycle_R11_Keyframes.jpg',quality=93)
def movie():
 m=json.loads((REC/'manifest.json').read_text());folder=DEST/'frames';folder.mkdir(exist_ok=True);idx=0
 for c in m['clips']:
  for i in range(c['frames']):
   im=Image.open(Path(c['folder'])/f'{i:04d}.jpg').convert('RGB');d=ImageDraw.Draw(im)
   d.rounded_rectangle((392,785,1112,862),10,fill='#0c1822');label(d,412,790,NAMES[c['kind']]+'  /  R11',27)
   label(d,413,831,'1× 事件演出回看 · 无声 · 规则只在实际出招时结算一次',17,'#a6bdc8')
   im.save(folder/f'{idx:05d}.jpg',quality=90);idx+=1
 subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(m['fps']),'-i',str(folder/'%05d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(DEST/'Card_Game_Lifecycle_R11.mp4')],check=True)
 (DEST/'video.json').write_text(json.dumps({'frames':idx,'fps':m['fps'],'seconds':idx/m['fps'],'audio':'silent','kind':'actual rule-event deterministic replay; not hardware FPS'},indent=2))
if __name__=='__main__':stills();movie()
