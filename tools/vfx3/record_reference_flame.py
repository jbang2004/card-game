"""Record actual game VFX replay beside the original demo, at matching flame ages.
Usage: xvfb-run -a python tools/vfx3/record_reference_flame.py --reference-html /path/Ember_Steel_VFX_Play.html
No damage is replayed; no soundtrack is captured. Encoded FPS is not live GPU FPS.
"""
from pathlib import Path
import argparse,json,math,os,sys,shutil
from PIL import Image,ImageDraw,ImageFont,ImageOps
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from check import load,ROOT

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--reference-html',type=Path,required=True);ap.add_argument('--fps',type=int,default=24);args=ap.parse_args()
 if not args.reference_html.is_file() or not 1<=args.fps<=60:ap.error('Supply a valid original HTML and FPS 1–60.')
 out=ROOT/'output/reference-flame';out.mkdir(parents=True,exist_ok=True)
 for name in ['game','compare']:(out/name).mkdir(exist_ok=True)
 font_path='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
 try:font=ImageFont.truetype(font_path,23);small=ImageFont.truetype(font_path,16)
 except OSError:font=ImageFont.load_default();small=font
 errors=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)));load(page)
  page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab',timeout=30000)
  page.evaluate("VFXLab.cast('breath')");d=page.evaluate('EmberFx2.mesh3d.last');state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
  ref=b.new_page(viewport={'width':1280,'height':720},device_scale_factor=1);ref.on('pageerror',lambda e:errors.append(str(e)))
  ref.set_content(args.reference_html.read_text(),wait_until='domcontentloaded');ref.wait_for_function('window.demo&&demo.ready',timeout=20000)
  ref.evaluate('demo.clean(true);demo.setCamera(-.42,.43,1.08)')
  hit=(d['impact']-d['start'])/1000;duration=hit+d['tail']/1000+.12;total=math.ceil(duration*args.fps)
  print('Rendering',total,'matched frames',flush=True)
  import io
  for i in range(total):
   t=min(duration,i/args.fps)
   source_t=.72+(1.46-.72)*t/hit if t<hit else 1.46+(t-hit)/d['scale']
   page.evaluate('t=>VFXLab.seek(t)',t*1000);ref.evaluate('t=>demo.seek(t)',min(5.4,source_t))
   game=Image.open(io.BytesIO(page.screenshot(type='jpeg',quality=93))).convert('RGB');original=Image.open(io.BytesIO(ref.screenshot(type='jpeg',quality=93))).convert('RGB')
   full=Image.new('RGB',(1280,800),'#101d23');body=ImageOps.contain(game,(1280,740),Image.Resampling.LANCZOS);full.paste(body,((1280-body.width)//2,55))
   dr=ImageDraw.Draw(full);dr.text((30,14),'R4 · 原版火焰移植到卡牌游戏',font=font,fill='#e5e8e0');dr.text((792,22),'真实攻击后的特效回看 · 不重复扣血',font=small,fill='#aebcc1');full.save(out/'game'/f'{i:05d}.jpg',quality=94)
   comp=Image.new('RGB',(1280,720),'#101d23');dr=ImageDraw.Draw(comp)
   dr.text((32,25),'原版《焰·弦·刃》',font=font,fill='#e5e8e0');dr.text((671,25),'移植后 · 保留二维龙卡',font=font,fill='#e5e8e0')
   for image,crop,x in [(original,(395,155,1055,620),20),(game,(470,180,982,585),660)]:
    cut=ImageOps.contain(image.crop(crop),(600,490),Image.Resampling.LANCZOS);comp.paste(cut,(x+(600-cut.width)//2,95+(490-cut.height)//2))
   dr.line((640,85,640,600),fill='#45545a',width=1)
   dr.text((32,622),'同一套火舌运动与噪声材质，仅适配坐标、透明合成和命中前时序。',font=small,fill='#b9c5c8')
   dr.text((32,656),f'原版火焰时间 {source_t:.2f}s  /  无声 · 确定性回看，非实时帧率测试',font=small,fill='#8da1aa')
   comp.save(out/'compare'/f'{i:05d}.jpg',quality=94)
   if i%24==0:print(i,'/',total,flush=True)
  assert not errors,errors
  assert page.evaluate('JSON.stringify(EmberDebug.game.s)')==state
  assert page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0
  (out/'recording.json').write_text(json.dumps({'frames':total,'fps':args.fps,'durationPerSegment':total/args.fps,'descriptor':d,'unchangedRules':True,'errors':errors,'method':'real game dispatch followed by VFX-only replay; reference demo evaluated at matching source time; no audio','renderer':page.evaluate('EmberFx2.mesh3d.diagnostics().webgl')},ensure_ascii=False,indent=2))
  b.close()
 print('FINISHED',out,flush=True)
if __name__=='__main__':main()
