"""Capture actual R10/R9 game rendering. No generated artwork, no frame retouch.
Uses the established inspection HTML loader. During screenshots only, pause the
unrelated host RAF callbacks to avoid burning CPU on redundant background redraws.
"""
from pathlib import Path
import os,sys,re,json,time,base64,math,argparse
from playwright.sync_api import sync_playwright
from verify_benchmarks import launch
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/impact-r10';OUT.mkdir(parents=True,exist_ok=True)
ROLES=[('archer',60),('wolf',60),('berserker',85),('fireball',110),('frostbolt',70),('nova',180),('shield',180),('lifedrain',300),('renew',230),('silence',-20),('blessing',210),('wisdom',190),('wolves',210)]
HOOK="""()=>{const real=requestAnimationFrame.bind(window);let frozen=false,queued=[];window.requestAnimationFrame=cb=>real(t=>{if(frozen)queued.push(cb);else cb(t)});window.__capture={pause(){frozen=true},resume(){frozen=false;const q=queued;queued=[];q.forEach(cb=>real(cb))}};}"""
def load(pg,path):
 html=path.read_text();scripts=re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)
 pg.set_content(re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S),wait_until='domcontentloaded');pg.evaluate(HOOK)
 for s in scripts:pg.add_script_tag(content=s)
 pg.wait_for_function('window.VFXLab && EmberFx2.renderer3dAvailable',timeout=45000)
 pg.mouse.move(1,1)
def main():
 a=argparse.ArgumentParser();a.add_argument('--baseline',type=Path);a.add_argument('--video',action='store_true');a.add_argument('--roles',default='');args=a.parse_args()
 report={'origin':'in-memory','width':1280,'height':800,'fps':24,'recording':'deterministic runtime replay; no hardware fps claim','clips':[],'errors':[]}
 with sync_playwright() as pw:
  b=launch(pw)
  try:
   versions=[('R10',ROOT/'Card_Game_3D_VFX_Demo.html')]+([('R9',args.baseline)] if args.baseline else [])
   for version,path in versions:
    p=b.new_page(viewport={'width':1280,'height':800});p.on('pageerror',lambda e:report['errors'].append(str(e)));load(p,path)
    for role,offset in ROLES:
     p.evaluate('__capture.resume()');assert p.evaluate('r=>VFXLab.cast(r)',role)
     if args.roles and role not in args.roles.split(','):continue
     d=p.evaluate('EmberFx2.mesh3d.last');group=p.evaluate('EmberFx2.mesh3d.lastGroup');lead=d['impact']-d['start']
     p.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause());__capture.pause()');p.wait_for_timeout(50)
     folder=OUT/version/role;folder.mkdir(parents=True,exist_ok=True)
     for name,dt in [('approach',-50),('peak',offset),('residue',280)]:
      p.evaluate('ms=>VFXLab.seek(ms)',max(0,lead+dt));p.screenshot(path=str(folder/(name+'.png')))
      png=p.evaluate("()=>document.querySelector('#fx-3d').toDataURL()").split(',')[1];(folder/(name+'-fx.png')).write_bytes(base64.b64decode(png))
     duration=min(1.70,lead/1000+d['tail']/1000+.07);n=math.ceil(duration*24)
     record=args.video and ((version=='R10' and role in ['archer','wolf','berserker','fireball','frostbolt','nova','shield','lifedrain','renew']) or (version=='R9' and role in ['archer','fireball','shield']))
     if record:
      for i in range(n):
       p.evaluate('ms=>VFXLab.seek(ms)',i/24*1000);p.screenshot(path=str(folder/f'{i:04d}.jpg'),type='jpeg',quality=87)
     report['clips'].append({'version':version,'role':role,'descriptor':d,'group':group,'duration':duration,'frames':n if record else 0,'folder':str(folder),'lead':lead})
     (OUT/'capture.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(version,role,'captured',n if record else 0,flush=True)
    p.close()
  finally:b.close()
 if report['errors']:raise RuntimeError(report['errors'])
if __name__=='__main__':main()
