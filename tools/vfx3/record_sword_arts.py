"""Render the real inspection game, then compose labeled crops. No synthetic VFX.
Frames use the same deterministic effect time as gameplay. UI motion is paused
for inspection; output FPS does not represent measured hardware performance.
"""
from pathlib import Path
import json,io,sys,os
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent))
from verify_sword_arts import load,launch,ROOT,OUT,ROLES
FONT=os.getenv('VFX_FONT','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
if not Path(FONT).exists():
 import glob
 FONT=glob.glob('/usr/share/fonts/**/*CJK*',recursive=True)[0]
def font(n):return ImageFont.truetype(FONT,n)
PICKS=['paladin','guard','assassin','reaper','leech','solaris','frostking','dagger']
DESCS={
 'squire':'短促斜斩 / 一道清晰的曦光', 'guard':'交叉破阵 / 双轨同步接触',
 'assassin':'暗影突刺 / 狭长锋线快速切入', 'leech':'血月回刃 / 弧斩之后光点回旋',
 'paladin':'天降剑气 / 没有实体剑柄与金属剑身', 'reaper':'黯月弦刈 / 宽月弧掠过目标',
 'solaris':'三曜同落 / 三道光刃，仅结算一次伤害', 'frostking':'霜刃王敕 / 冰晶与分叉裂纹',
 'skeleton':'残锋短切 / 克制、破碎的轮廓', 'recruit':'直进突锋 / 从攻击者飞向目标',
 'dagger':'银月双弦 / 镜像双弧', 'sunblade':'日耀开天 / 宽幅金色剑波',
}
def panel(image,label,detail):
 o=Image.new('RGB',(1280,800),'#101a24');crop=image.crop((535,30,1125,640));crop=crop.resize((658,680),Image.Resampling.LANCZOS);o.paste(crop,(30,68))
 d=ImageDraw.Draw(o);d.text((24,17),'EMBERFALL  /  SWORD ARTS',font=font(20),fill='#d6e6ef');d.text((744,120),label.split(' · ')[0],font=font(29),fill='#e1ebf0')
 n=label.split(' · ')[1:]
 if n:d.text((744,161),' · '.join(n),font=font(24),fill='#96c6df')
 for i,part in enumerate(detail.split(' / ')):d.text((744,220+32*i),part,font=font(15),fill='#b4c4cc')
 d.text((744,643),'1× 原速 · 局部放大',font=font(16),fill='#adbdc7');d.text((744,674),'实际游戏渲染',font=font(14),fill='#839cae')
 d.text((24,760),'一次规则命中 · 多层剑气演出 · 原版火焰保留',font=font(18),fill='#94acbd')
 return o
with sync_playwright() as p:
 b=launch(p);page=b.new_page(viewport={'width':1600,'height':1000});load(page)
 frames=OUT/'video-frames';frames.mkdir(exist_ok=True);stills=OUT/'stills';stills.mkdir(exist_ok=True)
 labels={};n=0
 for role in ROLES:
  page.evaluate('id=>VFXLab.cast(id)',role)
  d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start'];style=d['swordStyle']
  label=page.evaluate('id=>EmberData.byId[id].name',role)+' · '+page.evaluate('s=>EmberSwordArts.get(s).name',style);labels[role]=label
  page.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause());')
  for dt in [-25,35,140]:
   page.evaluate('ms=>VFXLab.seek(ms)',max(0,hit+dt));page.screenshot(path=str(stills/f'{role}-{dt}.png'))
  if role in PICKS:
   for i in range(30):
    ms=max(0,hit-200+i*1000/24);page.evaluate('ms=>VFXLab.seek(ms)',ms)
    im=Image.open(io.BytesIO(page.screenshot(type='jpeg',quality=94))).convert('RGB')
    panel(im,label,DESCS[role]).save(frames/f'{n:04d}.jpg',quality=92);n+=1
  page.evaluate('document.getAnimations().forEach(a=>a.play());')
  print('captured',role,n,flush=True)
 (OUT/'recording.json').write_text(json.dumps({'frames':n,'fps':24,'labels':labels,'descriptions':DESCS,'scope':'actual game VFX replay at 1x; DOM animations paused; crop labeled'},ensure_ascii=False,indent=2));b.close()
