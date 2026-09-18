"""Capture effect-only replay over a real disposable battle.
Run after build with Xvfb on Linux, or a desktop display. No audio is captured.
"""
from pathlib import Path
import json,sys,math,os,shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from check import load,ROOT
OUT=ROOT/'output/vfx3-r2';FR=OUT/'frames';FR.mkdir(parents=True,exist_ok=True)
# Rendering is deterministic effect-only review over the actual dispatched match.
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 load(page);page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab',timeout=30000)
 index=0;segments=[]
 for kind in ['breath','slash']:
  assert page.evaluate('k=>VFXLab.cast(k)',kind)
  d=page.evaluate('EmberFx2.mesh3d.last');duration=d['impact']-d['start']+d['tail']
  for speed in [1,.5]:
   count=math.ceil(duration/1000/speed*24)+10
   for i in range(count):
    t=min(duration,i/24*1000*speed)
    page.evaluate('t=>VFXLab.seek(t)',t)
    page.evaluate('(v)=>{document.getElementById("lab-mode").textContent=v+" · 特效回看 / 不重复扣血"}', '1× 原速' if speed==1 else '½× 慢放')
    page.screenshot(path=str(FR/f'{index:05d}.jpg'),type='jpeg',quality=91);index+=1
   segments.append({'skill':kind,'speed':speed,'frames':count,'duration':duration});print(kind,speed,count,flush=True)
  page.evaluate('t=>VFXLab.seek(t)',d['impact']-d['start']+(170 if kind=='breath' else 130))
  page.screenshot(path=str(OUT/f'hero-{kind}.png'))
 assert not errs,errs
 (OUT/'video.json').write_text(json.dumps({'frames':index,'fps':24,'segments':segments,'errors':errs,'capture':'Chromium Xvfb Mesa llvmpipe, exact runtime, effect-only replay after real game action'},indent=2))
 b.close();print('done',index,flush=True)
