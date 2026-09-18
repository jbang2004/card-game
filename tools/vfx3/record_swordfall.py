"""Capture true runtime frames after a real attack; no damage replay, no audio."""
from pathlib import Path
import base64,json,time
from playwright.sync_api import sync_playwright
from check import load,ROOT
OUT=ROOT/'output/swordfall';frames=OUT/'record';frames.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));load(page)
 page.add_script_tag(content=(ROOT/'tools/vfx3/lab.js').read_text());page.wait_for_function('window.VFXLab')
 page.evaluate("VFXLab.cast('slash')");d=page.evaluate('EmberFx2.mesh3d.last')
 page.evaluate('VFXLab.hide(true);EmberFX.cancel(true)');state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
 cdp=page.context.new_cdp_session(page)
 # Pause only ambient DOM animations during deterministic capture. Runtime
 # frames below are calculated by the unmodified effect implementation.
 page.evaluate('document.getAnimations().forEach(a=>a.pause());window.requestAnimationFrame=()=>0;')
 page.wait_for_timeout(80);t0=time.time()
 for i in range(48):
  page.evaluate('ms=>EmberFx2.mesh3d.replay(ms)',i/30*1000)
  data=cdp.send('Page.captureScreenshot',{'format':'jpeg','quality':93,'fromSurface':True,'captureBeyondViewport':False})
  (frames/f'{i:04d}.jpg').write_bytes(base64.b64decode(data['data']))
  if i%10==0:print(i,'elapsed',time.time()-t0,flush=True)
 assert state==page.evaluate('JSON.stringify(EmberDebug.game.s)');assert not errors,errors
 (OUT/'recording.json').write_text(json.dumps({'fps':30,'frames':48,'descriptor':d,'unchangedRules':True,'errors':errors,'method':'real rule dispatch followed by direct deterministic mesh replay, ambient DOM animations paused for recording; no live-performance claim','webgl':page.evaluate('EmberFx2.mesh3d.diagnostics().webgl')},indent=2))
 b.close()
