"""Capture R8 from the actual R7-derived game runtime, 60 Hz deterministic seek.
No screenshot synthesis, no damage repetition; encoded FPS is not GPU performance.
"""
from pathlib import Path
import json,math
from verify_benchmarks import load,launch
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/benchmark-r8/recording'
ROLES=[('paladin','圣裁 · 天剑','HEAVENLY VERDICT'),('assassin','夜幕 · 无声刺','SILENT NEEDLE'),('frostking','白霜 · 王敕','FROST EDICT')]
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 report={'fps':60,'origin':'in-memory executable inspection HTML','revision':'R8','clips':[],'errors':[]}
 with sync_playwright() as p:
  b=launch(p);pg=b.new_page(viewport={'width':1440,'height':900});pg.on('pageerror',lambda e:report['errors'].append(str(e)));load(pg)
  pg.mouse.move(1290,800)
  for role,name,en in ROLES:
   assert pg.evaluate('(r)=>VFXLab.cast(r)',role)
   d=pg.evaluate('EmberFx2.mesh3d.last');duration=(d['impact']-d['start']+d['tail'])/1000+.12
   folder=OUT/role;folder.mkdir(exist_ok=True);count=math.ceil(duration*60)
   pg.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause())');pg.mouse.move(1300,810)
   for i in range(count):
    pg.evaluate('(ms)=>VFXLab.seek(ms)',i/60*1000)
    pg.screenshot(path=str(folder/f'{i:05}.jpg'),type='jpeg',quality=91)
    if i%30==0:print(role,i,'/',count,flush=True)
   report['clips'].append({'role':role,'name':name,'en':en,'frames':count,'descriptor':d,'duration':duration,'folder':str(folder)})
   (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  b.close()
 if report['errors']:raise RuntimeError(report['errors'])
if __name__=='__main__':main()
