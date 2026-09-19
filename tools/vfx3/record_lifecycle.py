"""Record actual R11 inspection frames after genuine rule dispatches.
No AI images. Deterministic event replay, silent, not a real-time FPS benchmark.
"""
from pathlib import Path
import json,math,time
from playwright.sync_api import sync_playwright
from verify_benchmarks import launch,load
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/lifecycle-r11/recording';OUT.mkdir(parents=True,exist_ok=True)
ROLES=['shield-break','thaw','stealth-out','silence','morph','rebirth','counterspell','weapon-break','overdraw','fatigue','victory']
def main():
 report={'fps':24,'clips':[],'errors':[],'origin':'in-memory Chromium','audio':'silent; real live actions reuse existing event sounds','frames':'deterministic runtime samples after real dispatch; rule values are not re-executed'}
 with sync_playwright()as pw:
  b=launch(pw)
  try:
   p=b.new_page(viewport={'width':1440,'height':900});p.set_default_timeout(30000);p.on('pageerror',lambda e:report['errors'].append(str(e)));load(p);p.wait_for_function('window.LifecycleLab');p.mouse.move(1438,2)
   for role in ROLES:
    assert p.evaluate('r=>LifecycleLab.cast(r)',role),role
    assert p.evaluate('__lastLifecycleRuleMatch'),role
    group=p.evaluate('LifecycleLab.group');d=next(x for x in group if x['kind']==role);at=d['start']-group[0]['start'];span=d['tail']+170;count=math.ceil(span/1000*24)
    folder=OUT/role;folder.mkdir(exist_ok=True)
    p.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause())')
    geo=p.evaluate('()=>({rect:{x:EmberViewport.appRect.x,y:EmberViewport.appRect.y,w:EmberViewport.appRect.width,h:EmberViewport.appRect.height},w:EmberViewport.width,h:EmberViewport.height})')
    for i in range(count):
     p.evaluate('t=>LifecycleLab.seek(t)',max(0,at-50+i/24*1000));p.screenshot(path=str(folder/f'{i:04d}.jpg'),type='jpeg',quality=88,timeout=25000)
    report['clips'].append({'kind':role,'frames':count,'descriptor':d,'at':at,'geo':geo,'folder':str(folder)})
    (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Recorded',role,count,'frames',flush=True)
   if report['errors']:raise RuntimeError(report['errors'])
  finally:b.close()
if __name__=='__main__':main()
