"""Capture real dispatched attacks plus clearly labelled slow effect-only inspection."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from check import ROOT,OUT,load
CAP=OUT/'capture';CAP.mkdir(parents=True,exist_ok=True)
FR=OUT/'frames';FR.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 ctx=b.new_context(viewport={'width':1280,'height':800},device_scale_factor=1,record_video_dir=str(CAP),record_video_size={'width':1280,'height':800})
 page=ctx.new_page();load(page);page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab',timeout=20000)
 for k in ['breath','lightning','slash']:
  page.evaluate('k=>VFXLab.cast(k)',k);page.wait_for_timeout(400);page.evaluate('VFXLab.seek(150)');print('warm',k,flush=True)
 page.evaluate('''()=>{const s=document.createElement('div');s.id='capture-marker';s.style.cssText='position:fixed;left:0;top:0;width:24px;height:24px;background:black;z-index:99999';document.body.append(s);}''')
 for kind,color in [('breath','rgb(249,25,25)'),('lightning','rgb(25,249,25)'),('slash','rgb(25,25,249)')]:
  page.evaluate('c=>document.getElementById("capture-marker").style.background=c',color);page.evaluate('k=>VFXLab.cast(k)',kind);page.wait_for_timeout(450)
  page.evaluate('document.getElementById("capture-marker").style.background="black"');page.wait_for_timeout(150);print('live',kind,flush=True)
 page.evaluate('document.getElementById("capture-marker").remove()')
 idx=0;seq=[]
 for kind in ['breath','lightning','slash']:
  page.evaluate('k=>VFXLab.cast(k)',kind);page.wait_for_timeout(200)
  duration=page.evaluate('VFXLab.duration');N=round(duration/1000/.25*20)
  for i in range(N):
   page.evaluate('t=>VFXLab.seek(t)',i/20*.25*1000)
   page.evaluate('document.getElementById("lab-mode").textContent="¼× 慢放 · 三维特效回看"')
   page.screenshot(path=str(FR/f'{idx:05d}.jpg'),type='jpeg',quality=87);idx+=1
  seq.append({'kind':kind,'frames':N,'duration':duration});print('frames',kind,N,flush=True)
 page.evaluate('VFXLab.cast("breath")');page.evaluate('VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+18)')
 page.screenshot(path=str(OUT/'hero.png'))
 video=page.video;path=video.path();ctx.close();b.close()
 (OUT/'record.json').write_text(json.dumps({'video':str(path),'inspection_frames':idx,'segments':seq,'fps':20},indent=2))
 print('record done',path,idx,flush=True)
