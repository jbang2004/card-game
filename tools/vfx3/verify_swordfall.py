"""R5 browser checks and genuine screenshots. Chromium/Xvfb, in-memory origin.
Run a separate process per viewport so GPU/framebuffer state is not conflated
with cross-orientation support.
"""
from pathlib import Path
import sys,json,argparse,time,hashlib
from playwright.sync_api import sync_playwright
from check import load,ROOT
ap=argparse.ArgumentParser();ap.add_argument('--width',type=int,default=1440);ap.add_argument('--height',type=int,default=900);args=ap.parse_args()
OUT=ROOT/'output/swordfall';OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
def check(n,v):
 checks.append({'name':n,'passed':bool(v)});print(n,bool(v),flush=True)
 if not v:raise AssertionError(n)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':args.width,'height':args.height},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(page);page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab',timeout=15000)
  print('lab ready',flush=True)
  check('3D ready',page.evaluate('EmberFx2.renderer3dAvailable'))
  page.evaluate("VFXLab.cast('slash')");d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start'];total=hit+d['tail']
  check('slash goes to mesh path',d['kind']=='slash');check('actual rule damage is once',page.evaluate('EmberDebug.game.s.e.board[2].hp')==29)
  check('stable target identity supplied',bool(d.get('targetRef')))
  check('one mesh instance per real attack',page.evaluate('EmberFx2.mesh3d.trace.filter(q=>q.id===EmberFx2.mesh3d.last.id).length')==1)
  state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
  page.evaluate('VFXLab.hide(true)')
  for name,dt in [('offscreen',-161),('entry',-95),('approach',-20),('impact',8),('cracks',150),('late',550)]:
   page.evaluate('ms=>VFXLab.seek(ms)',max(0,hit+dt))
   check(name+' no GL error',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
   if args.width>900:page.screenshot(path=str(OUT/(name+'.png')),timeout=8000)
  check('replay cannot mutate rules',state==page.evaluate('JSON.stringify(EmberDebug.game.s)'))
  page.evaluate('ms=>VFXLab.seek(ms)',hit+150)
  page.screenshot(path=str(OUT/f'viewport-{args.width}x{args.height}.png'),timeout=8000)
  check('target portrait and crack centre agree',page.evaluate('''()=>{const d=EmberFx2.mesh3d.last,p=EmberFx2.mesh3d._swordPose(d,(d.impact-d.start)/1000);return Math.hypot(...p.tip.map((x,i)=>x-p.target[i]))<.001}'''))
  check('rigid vertical sword pose',page.evaluate('''()=>{const r=EmberFx2.mesh3d,d=r.last,hit=(d.impact-d.start)/1000;let x=null,len=null;for(let t=0;t<hit+.5;t+=.005){let p=r._swordPose(d,t),l=Math.hypot(...p.tip.map((x,i)=>x-p.root[i]));if(x!==null&&(Math.abs(p.tip[0]-x)>.001||Math.abs(l-len)>.001))return false;x=p.tip[0];len=l;}return true}'''))
  # Test actual adapter tracking, including a shared shake on cards and canvas.
  tracking=page.evaluate('''()=>{const rt=EmberFx2.mesh3d,d=rt.last,ref=d.targetRef;
   EmberFX.cancel(true);rt.resume();const el=document.querySelector(`#battle .minion[data-uid="${ref.uid}"]`),canvas=document.getElementById('fx-3d');
   const row=document.getElementById('minions');el.style.translate='9px -6px';row.style.transform='translate(3px,2px)';canvas.style.transform='translate(3px,2px)';
   const now=performance.now();rt.emit('slash',{...d,startedAt:now-420,contactAt:now-160},now);rt.draw(now);
   const a=rt.diagnostics().sword,p=EmberViewport.pos(el),c=canvas.getBoundingClientRect(),app=document.getElementById('app').getBoundingClientRect(),w=EmberViewport.width,h=EmberViewport.height;
   const x=(app.left+p.x*app.width/w-c.left)*w/c.width,y=(app.top+(p.y-p.h*.055)*app.height/h-c.top)*h/c.height;
   const error=Math.hypot(a.tip[0]+w/2-x,h/2-a.tip[1]-y);
   el.style.translate='';row.style.transform='';canvas.style.transform='';rt.clear();return {error};}''')
  check('embedded sword and cracks follow actual target without double shake',tracking['error']<.1)
  page.evaluate('EmberFx2.setQuality({low:true,reduced:false});EmberFx2.mesh3d.replay(270)')
  check('low quality retains 3D',page.evaluate('EmberFx2.renderer3dAvailable'))
  check('low quality no GL error',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  page.evaluate('EmberFx2.setQuality({low:false,reduced:true})')
  check('reduced motion clears all instances',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
  page.evaluate('EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)')
  check('cancel releases instances',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
  if args.width>900:
   for i in range(3):
    page.evaluate("VFXLab.cast('slash')")
    check(f'repeat {i+1} remains single damage',page.evaluate('EmberDebug.game.s.e.board[2].hp')==29)
   d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start'];total=hit+d['tail']
   check('source actor has no duplicate collision clone',page.evaluate('document.querySelectorAll(".attack-actor").length')==0)
   page.evaluate('ms=>VFXLab.seek(ms)',hit+150)
   page.screenshot(path=str(OUT/'hero.png'),timeout=8000)
   (OUT/'descriptor.json').write_text(json.dumps(d,indent=2))
   # Exactly the approved source data and shader fixture checks run in Node.
  page.evaluate('ms=>VFXLab.seek(ms)',total+500)
  check('finished frame has zero particles',page.evaluate('EmberFx2.mesh3d.stats.particles')==0)
  check('no uncaught JavaScript errors',not errors)
 finally:
  report={'viewport':[args.width,args.height],'checks':checks,'errors':errors,'environment':'Chromium / Xvfb / ANGLE OpenGL Mesa llvmpipe, in-memory built game. No HTTP, real file-origin, Safari or physical device validation.'}
  (OUT/f'checks-{args.width}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
