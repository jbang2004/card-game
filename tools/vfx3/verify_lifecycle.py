"""R11 real rule actions, state cues and cleanup. No screenshot substitution.
Run via xvfb-run; writes JSON and unretouched real game screenshots.
"""
from pathlib import Path
import json,time,traceback
from playwright.sync_api import sync_playwright
from verify_benchmarks import launch,load
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/lifecycle-r11';OUT.mkdir(parents=True,exist_ok=True)
CASES=['shield-break','thaw','stealth-in','stealth-out','silence','morph','rebirth','expire','armor-break','secret-reveal','counterspell','weapon-equip','weapon-break','overdraw','fatigue','trigger','turn-ready','hero-fall','victory','defeat','awaken','draw-arrive']
checks=[];errors=[];cases={};env={'browser':'Chromium Xvfb ANGLE software','origin':'in-memory HTML','physical_mobile':False,'safari':False,'full_e2e':False}
def ck(name,ok):
 checks.append({'name':name,'passed':bool(ok)});print(('PASS 'if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name)
def state(p):return p.evaluate('JSON.stringify(EmberDebug.game.s)')
def run():
 with sync_playwright()as pw:
  b=launch(pw)
  try:
   for width,height,roles in [(1440,900,CASES),(390,844,['shield-break','thaw','morph','rebirth','counterspell','overdraw']),(844,390,['shield-break','thaw','stealth-out','silence','weapon-break','fatigue'])]:
    p=b.new_page(viewport={'width':width,'height':height});p.set_default_timeout(20000);p.on('pageerror',lambda e:errors.append(str(e)));load(p);p.wait_for_function('window.LifecycleLab');p.mouse.move(width-2,2)
    env['webgl']=p.evaluate('EmberFx2.mesh3d.diagnostics().webgl')
    for role in roles:
     label=f'{width} {role}'
     ck(label+' actual dispatch triggers requested event',p.evaluate('r=>LifecycleLab.cast(r)',role))
     ck(label+' identical full state to independent rules',p.evaluate('__lastLifecycleRuleMatch'))
     group=p.evaluate('LifecycleLab.group');d=next(x for x in group if x['kind']==role);at=d['start']-group[0]['start']
     # no primary attack is replaced or damage caused by lifecycle utilities
     ck(label+' all additional cues marked visual only',all(x['visualOnly'] and x['lifecycle'] for x in group))
     ck(label+' no repeated event-kind-target within a cue batch',len({(x['kind'],str(x['targetRef']),x['seed'])for x in group})==len(group))
     before=state(p);voices=p.evaluate('EmberAudio.diagnostics.history.length')
     for q in [10,140,390]:
      p.evaluate('ms=>LifecycleLab.seek(ms)',at+q)
      ck(label+f' {q}ms clean GL and visible primitives',p.evaluate('EmberFx2.mesh3d.diagnostics().error===0 && EmberFx2.mesh3d.stats.drawCalls>0'))
     if width==1440:
      cases[role]={'descriptor':d,'group':group,'at':at,'duration':p.evaluate('LifecycleLab.duration')}
      for phase,q in [('start',25),('break',150),('residue',430)]:
       p.evaluate('ms=>LifecycleLab.seek(ms)',at+q);p.evaluate('VFXLab.hide(true)')
       # No hover tooltips in captures; screenshot only runtime output.
       p.screenshot(path=str(OUT/f'{role}-{phase}.png'),timeout=20000)
      p.evaluate('VFXLab.hide(false)')
     elif role=='thaw':
      p.evaluate('VFXLab.hide(true)');p.screenshot(path=str(OUT/f'mobile-{width}.png'));p.evaluate('VFXLab.hide(false)')
     pixels=p.evaluate("ms=>{LifecycleLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",at+140)
     p.evaluate('LifecycleLab.seek(0)');p.evaluate('ms=>LifecycleLab.seek(ms)',at+480)
     ck(label+' repeat seek identical mesh pixels',pixels==p.evaluate("ms=>{LifecycleLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",at+140))
     ck(label+' reverse seeking never mutates rules',state(p)==before)
     ck(label+' scrubbing adds no audio events',voices==p.evaluate('EmberAudio.diagnostics.history.length'))
     p.evaluate('LifecycleLab.seek(LifecycleLab.duration)')
     ck(label+' end clears geometry and old-art ghosts',p.evaluate('EmberFx2.mesh3d.stats.active===0 && EmberFx2.lifecycleFeedback.active===0'))
     if role=='rebirth':ck(label+' actual rebirth has exactly one life and new ID',p.evaluate('EmberDebug.game.s.e.board.some(x=>x.hp===1&&!x.tags.includes("reborn"))'))
     if role=='counterspell':ck(label+' countered spell did not damage target',p.evaluate('EmberDebug.game.s.e.board[2].hp===60'))
     if role=='fatigue':ck(label+' fatigue counts and cumulative damage correct',p.evaluate('EmberDebug.game.s.p.fatigue===2 && EmberDebug.game.s.p.hp===27'))
    ck(str(width)+' no document horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
    p.evaluate("LifecycleLab.cast('thaw')");p.evaluate('LifecycleLab.seek(100);EmberFx2.setQuality({low:true,reduced:false})');p.evaluate('LifecycleLab.seek(150)')
    ck(str(width)+' low quality preserves geometry',p.evaluate('EmberFx2.mesh3d.stats.drawCalls>0 && EmberFx2.mesh3d.diagnostics().error===0'))
    p.evaluate('EmberFx2.setQuality({reduced:true})')
    ck(str(width)+' accessibility clears all additions',p.evaluate('EmberFx2.mesh3d.stats.active===0 && EmberFx2.lifecycleFeedback.active===0'))
    p.evaluate('EmberFx2.setQuality({low:false,reduced:false})');before=state(p);p.set_viewport_size({'width':height,'height':width});p.wait_for_timeout(240)
    ck(str(width)+' orientation preserves complete rule state',state(p)==before)
    ck(str(width)+' orientation no GL error',p.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
    p.close()
   ck('no uncaught JavaScript errors',not errors)
  except Exception:
   errors.append(traceback.format_exc());raise
  finally:
   b.close();report={'checks':checks,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'errors':errors,'environment':env,'cases':cases};(OUT/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':run()
