"""Create labelled contact sheets from actual R8 screenshots, never generative art.
Requires Pillow. The optional R7 baseline screenshots enable a same-time comparison.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,os
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/benchmark-r8';SRC=ROOT/'output/benchmark-r7'
FONT=os.getenv('BENCHMARK_FONT') or subprocess.check_output(['fc-match','Noto Sans CJK SC','-f','%{file}'],text=True).strip()
f=lambda n:ImageFont.truetype(FONT,n)
roles=[('paladin','圣裁 · 天剑','主锋面 / 圣印 / 贯入崩散'),('assassin','夜幕 · 无声刺','暗刃锐边 / 定向刺入 / 黑色切口'),('frostking','白霜 · 王敕','晶体断面 / 冠形晶簇 / 局部霜裂')]
# Each crop is a uniform zoom of the browser image, no local retouching.
im=Image.new('RGB',(1680,775),(12,19,27));d=ImageDraw.Draw(im)
d.text((34,24),'R8  /  三式视觉精修',font=f(34),fill=(239,231,209))
d.text((35,72),'实际运行截帧 · 保留原卡面与规则 · 非概念图',font=f(19),fill=(153,176,191))
for i,(r,name,sub) in enumerate(roles):
 x=30+i*550
 d.text((x,117),name,font=f(27),fill=(231,229,216))
 shot=Image.open(SRC/f'{r}-impact.png').convert('RGB').crop((490,30,1030,560)).resize((530,520),Image.Resampling.LANCZOS)
 im.paste(shot,(x,160));d.text((x,697),sub,font=f(19),fill=(181,196,205))
 d.text((x,734),'接触后 14 ms · 完整程序的同一采样时刻',font=f(15),fill=(123,148,165))
im.save(OUT/'R8_Overview.jpg',quality=94)
phases=[('charge','凝聚'),('entry','入场'),('impact','命中'),('fracture','痕迹'),('residue','收尾')]
im=Image.new('RGB',(2170,1740),(12,19,27));d=ImageDraw.Draw(im)
d.text((30,22),'R8  /  实际游戏内五阶段',font=f(32),fill=(237,228,209))
d.text((31,67),'原速采样时刻不同于概念分镜的时长；主角和数值均来自现有对局。',font=f(20),fill=(154,176,191))
for row,(r,name,sub) in enumerate(roles):
 top=113+row*535;d.text((30,top),name+'  —  '+sub,font=f(26),fill=(228,232,235))
 for col,(phase,label) in enumerate(phases):
  x=30+col*426
  shot=Image.open(SRC/f'{r}-{phase}.png').convert('RGB').crop((520,22,944,506)).resize((406,463),Image.Resampling.LANCZOS)
  im.paste(shot,(x,top+43));d.text((x+7,top+470),label,font=f(22),fill=(244,231,211))
im.save(OUT/'R8_Keyframes.jpg',quality=92)
# Original browser screenshots are distributed as well as the review sheets.
Image.open(SRC/'frostking-fracture.png').save(OUT/'R8_InGame.png')
Image.open(SRC/'390-frostking.png').save(OUT/'R8_Mobile.png')
print(OUT,flush=True)
