"""R5 real-game checks + genuine rendered stills. No generated/painted VFX.
Memory-load fallback is explicit: this runner cannot navigate local HTTP URLs.
Uses the already exported inspection build, never changes production gates.
"""
from pathlib import Path
import json,re,hashlib,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/vfx3-r5';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name)
def load(page):
 html=(ROOT/'Card_Game_3D_VFX_Demo.html').read_text()
 scripts=re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)
 page.set_content(re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S),wait_until='domcontentloaded')
 for s in scripts:page.add_script_tag(content=s)
 page.wait_for_function('window.VFXLab && EmberFx2.renderer3dAvailable',timeout=30000)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 load(page)
 for kind in ['breath','lightning','slash']:
  before=page.evaluate('EmberFx2.mesh3d.trace.length')
  page.evaluate('k=>VFXLab.cast(k)',kind)
  d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start']
  check(kind+' real rules emit exactly one 3D instance',page.evaluate('EmberFx2.mesh3d.trace.length')==before+1)
  check(kind+' single authoritative damage',page.evaluate('EmberDebug.game.s.e.board[2].hp')=={'breath':24,'lightning':28,'slash':29}[kind])
  state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
  for dt in [-90,0,45,160,500]:
   page.evaluate('t=>VFXLab.seek(t)',max(0,hit+dt))
   check(f'{kind} frame {dt:+} GL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  check(kind+' seek does not replay rules',page.evaluate('JSON.stringify(EmberDebug.game.s)')==state)
  page.evaluate('VFXLab.seek(VFXLab.duration)')
  check(kind+' particles cleaned at end',page.evaluate('EmberFx2.mesh3d.stats.particles')==0)
 # Inspect exact bounds and silhouettes of all phases on the real battle.
 page.evaluate("VFXLab.cast('slash')")
 d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start']
 info=page.evaluate('''()=>{const d=EmberFx2.mesh3d.last,hit=(d.impact-d.start)/1000,a=[];
 for(let t=0;t<hit+.8;t+=.003){const p=EmberFx2.mesh3d._swordPose(d,t);a.push({t,tip:p.tip,root:p.root,target:p.target,angle:p.motion.angle,visible:p.motion.visibility});}return {a,H:EmberViewport.height,W:EmberViewport.width};}''')
 a=info['a'];x=a[0]['tip'][0];lens=[sum((v-q)**2 for v,q in zip(p['root'],p['tip']))**.5 for p in a]
 check('screen-top entry: tip initially above viewport',a[0]['tip'][1]>info['H']/2)
 check('no horizontal drift through flight and hold',max(abs(p['tip'][0]-x) for p in a)<.001)
 check('rigid dimensions across all frames',max(lens)-min(lens)<.001)
 check('strictly downward orientation',max(abs(p['angle']-3.141592653589793) for p in a)<1e-8)
 check('no in-screen anticipation sword',all(p['visible']==0 for p in a if p['t']<(hit/1000-.12)-.001))
 contact=page.evaluate('''()=>{let d=EmberFx2.mesh3d.last;return EmberFx2.mesh3d._swordPose(d,(d.impact-d.start)/1000)}''')
 check('sword lands in card artwork, not at feet',abs((info['H']/2-contact['tip'][1])-(d['to']['y']+.1*d['to']['h']))<.001)
 state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
 page.evaluate('VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+160)')
 # Compare the actual transparent GPU layer, not unrelated independently animated DOM/ambient UI.
 first=page.evaluate('''()=>{VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+160);return document.getElementById('fx-3d').toDataURL();}''').encode()
 page.evaluate('VFXLab.seek(0);VFXLab.seek(900);VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+160)')
 second=page.evaluate('''()=>{VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+160);return document.getElementById('fx-3d').toDataURL();}''').encode()
 check('3D layer replay PNG is byte-identical (ambient UI excluded)',hashlib.sha256(first).digest()==hashlib.sha256(second).digest())
 check('replay keeps battle state identical',state==page.evaluate('JSON.stringify(EmberDebug.game.s)'))
 page.evaluate('VFXLab.hide(true)')
 shots=[('00-before',hit-130),('01-entry',hit-45),('02-contact',hit+20),('03-fracture',hit+145),('04-settled',hit+330),('05-dissipate',hit+530),('06-clear',hit+1120)]
 for name,t in shots:
  page.evaluate('t=>VFXLab.seek(t)',max(0,t))
  page.screenshot(path=str(OUT/(name+'.png')))
 # Catch actual live attack frames to verify no former collision proxy was created.
 page.evaluate("VFXLab.fixture('slash');EmberFx2.mesh3d.resume();")
 page.evaluate("(()=>{const g=EmberDebug.game;Emberfall.act(()=>g.dispatch({type:'attack',side:'p',uid:g.s.p.board[0].uid,target:{side:'e',uid:g.s.e.board[2].uid}}));})()")
 page.wait_for_timeout(80)
 check('no old attacking-card lunge proxy on sky strike',page.locator('.attack-actor').count()==0)
 page.wait_for_function('!EmberFX.busy',timeout=10000)
 check('live strike ends without leaving input lock',not page.evaluate('EmberFX.busy'))
 # Mobile and hero-like target boundary cases, no changes to card data.
 for w,h in [(390,844),(844,390)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(500)
  page.evaluate("VFXLab.cast('slash');")
  page.evaluate('VFXLab.seek(EmberFx2.mesh3d.last.impact-EmberFx2.mesh3d.last.start+130)')
  check(f'{w}x{h}: WebGL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  check(f'{w}x{h}: sword inside target x bounds',page.evaluate('''()=>{const m=EmberFx2.mesh3d,d=m.last,p=m._swordPose(d,(d.impact-d.start)/1000);return Math.abs(p.tip[0]+EmberViewport.width/2-d.to.x)<.001;}'''))
  page.screenshot(path=str(OUT/f'mobile-{w}.png'))
 page.evaluate('EmberFx2.setQuality({low:true,reduced:false});EmberFx2.mesh3d.replay(330)')
 check('low quality retains 3D sword',page.evaluate('EmberFx2.renderer3dAvailable'))
 check('low quality GL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
 page.evaluate('EmberFx2.setQuality({low:false,reduced:true})')
 check('reduced motion disables effect',not page.evaluate('EmberFx2.renderer3dAvailable'))
 check('reduced motion clears live instances',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
 page.evaluate('EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)')
 check('cancel cleans 3D runtime',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
 check('no uncaught browser errors',not errors)
 # Export a deterministically sampled real-render sequence, not a simulated video.
 page.set_viewport_size({'width':1600,'height':1000});page.wait_for_timeout(500)
 page.evaluate("VFXLab.cast('slash');VFXLab.hide(true)")
 d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start']
 (OUT/'descriptor.json').write_text(json.dumps({'d':d,'hit':hit,'stage':{'width':1600,'height':940}},indent=2))
 frames=OUT/'frames';frames.mkdir(exist_ok=True)
 # 1.5s original then 3s half speed, 24 encoded fps; fps is not a benchmark.
 samples=[i/24 for i in range(36)]+[i/48 for i in range(72)]
 for i,t in enumerate(samples):
  page.evaluate('t=>VFXLab.seek(t)',t*1000)
  page.screenshot(path=str(frames/f'{i:04d}.jpg'),type='jpeg',quality=92)
  if i%24==0:print('captured',i,flush=True)
 report={'checks':checks,'errors':errors,'passed':sum(c['passed'] for c in checks),'frames':len(samples),'renderer':page.evaluate('EmberFx2.mesh3d.diagnostics().webgl'),'environment':'Chromium/Xvfb/Mesa software GPU, in-memory inspection build. Local HTTP navigation blocked by administrator; not an HTTP/file-origin, Safari or physical-device test.'}
 (OUT/'verification.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
 print('COMPLETE',report['passed'],flush=True);browser.close()
