"""Focused real-game routing, replay and layout checks. Chromium under Xvfb."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
from check import load,SETUP,ATTACK,ROOT,OUT
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)});print(name,bool(value),flush=True)
 if not value:raise AssertionError(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));load(page)
 page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab',timeout=20000)
 for kind in ['breath','lightning','slash']:
  page.evaluate('k=>VFXLab.cast(k)',kind)
  d=page.evaluate('EmberFx2.mesh3d.last');check(kind+' real-game route',d['kind']==kind)
  tr=page.evaluate('EmberFx2.mesh3d.trace');check(kind+' exactly one mesh instance',sum(x['id']==d['id'] for x in tr)==1)
  expected={'breath':24,'lightning':28,'slash':29}[kind];check(kind+' authoritative single damage',page.evaluate('EmberDebug.game.s.e.board[2].hp')==expected)
  state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
  for name,dt in [('charge',-60),('impact',18),('tail',130)]:
   t=max(0,d['impact']-d['start']+dt);page.evaluate('t=>VFXLab.seek(t)',t)
   page.screenshot(path=str(OUT/f'final-{kind}-{name}.png'))
   check(kind+' '+name+' GL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  page.evaluate('VFXLab.seek(0);VFXLab.seek(160);VFXLab.seek(10);VFXLab.seek(200)')
  check(kind+' seeking does not mutate rules',page.evaluate('JSON.stringify(EmberDebug.game.s)')==state)
  page.evaluate('VFXLab.seek(VFXLab.duration+100)')
  check(kind+' finished no particles',page.evaluate('EmberFx2.mesh3d.stats.particles')==0)
  if kind=='slash':
   metrics=page.evaluate('''()=>{const m=EmberFx2.mesh3d,d=m.last,hit=(d.impact-d.start)/1000,ds=[];let err=0;
   for(let t=0;t<hit+.3;t+=.01){const p=m._swordPose(d,t);ds.push(Math.hypot(...p.tip.map((x,i)=>x-p.root[i])));}
   const p=m._swordPose(d,hit);err=Math.hypot(...p.contact.map((x,i)=>x-p.target[i]));return{drift:Math.max(...ds)-Math.min(...ds),err};}''')
   check('rigid sword no length warp',metrics['drift']<.001);check('blade contacts target at deadline',metrics['err']<.001)
 # Hide the lab for captures of the actual phone battle, then show it for interface checks.
 for w,h in [(390,844),(844,390)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(600)
  page.evaluate("VFXLab.cast('breath')");page.evaluate('VFXLab.seek((EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start)+18)')
  check(f'{w}x{h} GL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  check(f'{w}x{h} bounded lab',page.evaluate('(()=>{let r=document.getElementById("vfxlab").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()'))
  page.screenshot(path=str(OUT/f'mobile-{w}.png'))
 page.evaluate('EmberFx2.setQuality({low:true,reduced:false});EmberFx2.mesh3d.replay(170)')
 check('low quality keeps 3D path',page.evaluate('EmberFx2.renderer3dAvailable'))
 page.evaluate('EmberFx2.setQuality({low:false,reduced:true})')
 check('reduced motion disables 3D',not page.evaluate('EmberFx2.renderer3dAvailable'))
 check('reduced motion clears instances',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
 page.evaluate('EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)')
 check('cancel releases renderer',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
 check('no uncaught errors',not errors)
 (OUT/'verification.json').write_text(json.dumps({'checks':checks,'errors':errors,'environment':'Chromium Xvfb ANGLE OpenGL / software GPU; set_content with test-only debug gate; no persistent storage/network-origin verification'},indent=2))
 b.close()
