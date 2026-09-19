"""Actual Chromium integration tests for R6. Browser scope is explicitly reported.
Uses the disposable inspection export in an in-memory origin. Does not touch saves.
"""
from pathlib import Path
import re,json,hashlib,os,argparse,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/sword-arts-r6';OUT.mkdir(parents=True,exist_ok=True)
ROLES=['squire','guard','assassin','leech','paladin','reaper','solaris','frostking','skeleton','recruit','dagger','sunblade']
STYLES=['dawn','bastion','night','blood','judgment','crescent','sunfall','frost','bone','thrust','twins','daybreak']
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 print(('PASS ' if value else 'FAIL ')+name,flush=True)
 if not value:raise AssertionError(name)
def load(page):
 html=(ROOT/'Card_Game_3D_VFX_Demo.html').read_text();scripts=re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)
 page.set_content(re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S),wait_until='domcontentloaded')
 for s in scripts:page.add_script_tag(content=s)
 page.wait_for_function('window.VFXLab && EmberFx2.renderer3dAvailable',timeout=45000)
def launch(p):return p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
def main():
 with sync_playwright() as p:
  b=launch(p);page=b.new_page(viewport={'width':1600,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));load(page)
  descriptors={}
  for role,style in zip(ROLES,STYLES):
   count=page.evaluate('EmberFx2.mesh3d.trace.length');ok=page.evaluate('id=>VFXLab.cast(id)',role)
   d=page.evaluate('EmberFx2.mesh3d.last');descriptors[role]=d;hit=d['impact']-d['start']
   expected=page.evaluate('id=>EmberData.byId[id].atk',role)
   check(role+': real game dispatch successful',ok)
   check(role+': own style propagated to runtime',d['swordStyle']==style)
   check(role+': one 3D instance only',page.evaluate('EmberFx2.mesh3d.trace.length')==count+1)
   check(role+': one authoritative damage amount',page.evaluate('EmberDebug.game.s.e.board[2].hp')==60-expected)
   state=page.evaluate('JSON.stringify(EmberDebug.game.s)')
   for dt in [-80,0,50,190,650]:
    page.evaluate('ms=>VFXLab.seek(ms)',max(0,hit+dt))
    check(f'{role}: GL clean {dt:+}ms',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
   check(role+': seeking did not alter rules',page.evaluate('JSON.stringify(EmberDebug.game.s)')==state)
   page.evaluate('VFXLab.seek(VFXLab.duration)')
   check(role+': completely empty at end',page.evaluate('EmberFx2.mesh3d.stats.active')==0 and page.evaluate('EmberFx2.mesh3d.stats.particles')==0)
  # Compare exact repeated GPU rendering, excluding unrelated DOM/ambient animations.
  page.evaluate("VFXLab.cast('paladin')");d=page.evaluate('EmberFx2.mesh3d.last');hit=d['impact']-d['start']
  page.evaluate('ms=>VFXLab.seek(ms)',hit+70)
  a=page.evaluate("document.getElementById('fx-3d').toDataURL()")
  page.evaluate('VFXLab.seek(0);VFXLab.seek(1000)');page.evaluate('ms=>VFXLab.seek(ms)',hit+70)
  check('GPU replay deterministic',a==page.evaluate("document.getElementById('fx-3d').toDataURL()"))
  # Frozen target reference: only the target's current motion is applied, never double camera motion.
  page.evaluate("VFXLab.fixture('paladin');EmberFx2.mesh3d.resume()")
  page.evaluate("(()=>{let g=EmberDebug.game;Emberfall.act(()=>g.dispatch(VFXLab.actionFor('paladin')));})()")
  page.wait_for_timeout(380)
  check('live target-reference supplied',page.evaluate('!!EmberFx2.mesh3d.last.targetRef'))
  page.wait_for_function('!EmberFX.busy',timeout=15000)
  for kind,expected in [('breath',6),('lightning',2)]:
   check(kind+': real retained effect dispatch',page.evaluate('k=>VFXLab.cast(k)',kind))
   check(kind+': original damage unchanged',page.evaluate('EmberDebug.game.s.e.board[2].hp')==60-expected)
   d=page.evaluate('EmberFx2.mesh3d.last');page.evaluate('ms=>VFXLab.seek(ms)',d['impact']-d['start']+100)
   check(kind+': retained effect GL clean',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  # Do not confuse independent layouts with orientation-switch validation.
  layouts=[]
  for width,height in [(390,844),(844,390)]:
   m=b.new_page(viewport={'width':width,'height':height});me=[];m.on('pageerror',lambda e:me.append(str(e)));load(m)
   for role in ['paladin','reaper','frostking','solaris','assassin']:
    check(f'{width} {role}: real dispatch',m.evaluate('id=>VFXLab.cast(id)',role))
    d=m.evaluate('EmberFx2.mesh3d.last');m.evaluate('ms=>VFXLab.seek(ms)',d['impact']-d['start']+50)
    check(f'{width} {role}: GL clean',m.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
   m.screenshot(path=str(OUT/f'mobile-{width}.png'));check(f'{width}: no JS errors',not me);m.close();layouts.append([width,height])
  page.evaluate("VFXLab.cast('paladin');EmberFx2.setQuality({low:true,reduced:false})")
  d=page.evaluate('EmberFx2.mesh3d.last');page.evaluate('ms=>VFXLab.seek(ms)',d['impact']-d['start']+60)
  check('low quality retains sword-light identity',page.evaluate('EmberFx2.mesh3d.last.swordStyle')=='judgment')
  check('low quality renders without GL error',page.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
  page.evaluate('EmberFx2.setQuality({low:false,reduced:true})')
  check('reduced motion disables/clears 3D',not page.evaluate('EmberFx2.renderer3dAvailable') and page.evaluate('EmberFx2.mesh3d.stats.active')==0)
  page.evaluate('EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)')
  check('cancel clears runtime',page.evaluate('EmberFx2.mesh3d.stats.active')==0)
  check('no uncaught JavaScript errors',not errors)
  report={'checks':checks,'passed':sum(x['passed'] for x in checks),'descriptors':descriptors,'errors':errors,'environment':{'browser':'Chromium ANGLE/OpenGL','origin':'in-memory inspection export','rendering':'software Mesa; not hardware performance certification','independent_mobile_layouts':layouts,'full_e2e':False}}
  (OUT/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
if __name__=='__main__':main()
