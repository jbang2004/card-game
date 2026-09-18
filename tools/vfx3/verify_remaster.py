"""R9 real-game integration and visual capture. Origin: in-memory HTML.
Uses actual rules through VFXLab; does not claim device/GPU/e2e certification.
"""
from pathlib import Path
import json, traceback, hashlib, time, os
from verify_benchmarks import load,launch
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/remaster-r9';OUT.mkdir(parents=True,exist_ok=True)
CASES=[('archer','arrow',58,30),('huntress','spear',55,45),('wolf','claw',58,38),('berserker','slam',57,55),('golem','slam',58,120),
 ('fireball','fireball',54,140),('frostbolt','frost',57,80),('nova','frost-field',60,180),('lifedrain','siphon',57,270),('silence','void',6,45),
 ('renew','heal',60,210),('shield','ward',60,100),('blessing','buff',60,160),('wisdom','arcane',60,170),('wolves','summon',60,160),
 ('rally','buff',60,190),('absolution','ward',60,160),('muster','summon',60,200),('execute','bladeCross',None,30),('polymorph','arcane',1,150),('tracking','arcane',60,170),('demise','demise',None,250)]
CHECKS=[];ERRORS=[];DESC={};METRICS={};started=time.time()
def ck(name,ok):
 CHECKS.append({'name':name,'passed':bool(ok)});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name)
def state(p):return p.evaluate('JSON.stringify(EmberDebug.game.s)')
def run_case(p,role,kind,hp,at,label='desktop',capture=True):
 pre=p.evaluate('EmberFx2.mesh3d.trace.length');ah=p.evaluate('EmberAudio.diagnostics.history.length')
 p.evaluate("""()=>{const g=EmberDebug.game,original=g.dispatch;window.__ruleOracle=null;
 g.dispatch=function(action){const oracle=new EmberEngine.Game();oracle.s=structuredClone(this.s);oracle.eventSeq=this.eventSeq;
 oracle.dispatch(action);window.__ruleOracle=JSON.stringify(oracle.s);return original.call(this,action);};window.__restoreRuleOracle=()=>g.dispatch=original;}""")
 try:ck(f'{label} {role}: actual rule dispatch',p.evaluate('r=>VFXLab.cast(r)',role))
 finally:p.evaluate('()=>{window.__restoreRuleOracle();}')
 ck(f'{label} {role}: identical result to isolated pure rules',state(p)==p.evaluate('window.__ruleOracle'))
 d=p.evaluate('EmberFx2.mesh3d.lastUtility' if role=='demise' else 'EmberFx2.mesh3d.last');group=p.evaluate('EmberFx2.mesh3d.lastGroup')
 ck(f'{label} {role}: expected remastered identity',d['kind']==kind)
 board=p.evaluate('EmberDebug.game.s.e.board')
 ck(f'{label} {role}: correct rule result',len(board)==2 if hp is None else len(board)==3 and board[2]['hp']==hp)
 if role=='renew':ck(label+' heal applies to hero only',p.evaluate('EmberDebug.game.s.p.hp===26 && EmberDebug.game.s.p.board[0].hp===20'))
 if role=='shield':
  ck(label+' shield preserves shield rule',p.evaluate("EmberDebug.game.s.p.board[1].shield===true || EmberDebug.game.s.p.board[1].tags.includes('shield')"))
  ck(label+' shield visual follows actual allied target',d.get('targetRef')==p.evaluate("({side:'p',uid:EmberDebug.game.s.p.board[1].uid})"))
 if role=='execute':ck(label+' destroy visual retains enemy rather than self target',d.get('targetRef',{}).get('side')=='e' and d.get('targetRef',{}).get('uid')!='hero')
 if role in ('wolves','muster'):ck(label+' '+role+' real summons present',p.evaluate('EmberDebug.game.s.p.board.length')== (5 if role=='wolves' else 6))
 if role=='nova':ck(label+' AoE keeps separate target instances',len({x['targetRef']['uid'] for x in group if x['kind']=='frost-field' and x.get('targetRef')})==3)
 ck(f'{label} {role}: no duplicated primary per target',len({str(x.get('targetRef'))+x['kind'] for x in group if not x['visualOnly']})==len([x for x in group if not x['visualOnly']]))
 timeline_origin=0 if role=='demise' else group[0]['start'];lead=0 if role=='demise' else d['impact']-timeline_origin
 before=state(p);history=p.evaluate('EmberAudio.diagnostics.history.length')
 p.evaluate('ms=>VFXLab.seek(ms)',max(0,lead+at))
 diag=p.evaluate('EmberFx2.mesh3d.diagnostics()')
 ck(f'{label} {role}: valid rendered draw calls',diag['error']==0 and diag['drawCalls']>0)
 if capture:
  p.evaluate('VFXLab.hide(true)');p.screenshot(path=str(OUT/f'{label}-{role}.png'));p.evaluate('VFXLab.hide(false)')
 ck(f'{label} {role}: seek changes no rule data',state(p)==before)
 ck(f'{label} {role}: seek schedules no audio',p.evaluate('EmberAudio.diagnostics.history.length')==history)
 pixels=p.evaluate("ms=>{VFXLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",lead+at)
 p.evaluate('VFXLab.seek(0)');p.evaluate('ms=>VFXLab.seek(ms)',lead+at)
 ck(f'{label} {role}: repeated render deterministic',pixels==p.evaluate("ms=>{VFXLab.seek(ms);return document.getElementById('fx-3d').toDataURL()}",lead+at))
 if label=='desktop':
  DESC[role]={'descriptor':d,'group':group,'lead':lead,'duration':p.evaluate('VFXLab.duration'),'capture_ms':lead+at,'damage_remaining':hp}
 p.evaluate('VFXLab.seek(VFXLab.duration)')
 ck(f'{label} {role}: all instances and owned poses clean up',p.evaluate('EmberFx2.mesh3d.stats.active===0 && EmberFx2.remasterFeedback.active===0 && EmberFx2.benchmarkFeedback.active===0'))
 p.evaluate('EmberAudio.stop()')
 return d

def main():
 env={'origin':'in-memory HTML injection','browser':'Chromium headed Xvfb ANGLE/Mesa software','hardware_gpu':False,'physical_mobile':False,'full_e2e':False,'website_deployment':False}
 with sync_playwright() as pw:
  b=launch(pw)
  try:
   p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:ERRORS.append(str(e)));load(p)
   p.click('#lab-audio');p.wait_for_function("EmberAudio.state==='running'")
   env['webgl']=p.evaluate('EmberFx2.mesh3d.diagnostics().webgl')
   for case in CASES:run_case(p,*case)
   # Background/replay does not reschedule damage; user pause stops scheduled PCM voices.
   p.evaluate("VFXLab.cast('archer')");p.evaluate('VFXLab.seek(0);VFXLab.play()');p.wait_for_function('VFXLab.snapshot().t>30');p.click('#lab-play')
   frozen=p.evaluate('VFXLab.snapshot().t');p.wait_for_timeout(180)
   ck('pause freezes preview time',p.evaluate('VFXLab.snapshot().t')==frozen);ck('pause stops mixer voices',p.evaluate('EmberAudio.diagnostics.activeVoices')==0)
   p.select_option('#lab-speed','.5');p.evaluate('VFXLab.play()');p.wait_for_timeout(120);p.click('#lab-play')
   ck('slow replay is silent',p.evaluate('EmberAudio.diagnostics.activeVoices')==0);p.select_option('#lab-speed','1')
   p.evaluate("VFXLab.cast('fireball')");d=p.evaluate('EmberFx2.mesh3d.last')
   p.evaluate('EmberFx2.setQuality({low:true,reduced:false})');p.evaluate('ms=>VFXLab.seek(ms)',d['impact']-d['start']+100)
   ck('low quality retains valid geometry',p.evaluate('EmberFx2.mesh3d.stats.drawCalls>0 && EmberFx2.mesh3d.diagnostics().error===0'))
   p.evaluate('EmberFx2.setQuality({low:false,reduced:true})')
   ck('reduced motion releases all presentation resources',p.evaluate('EmberFx2.mesh3d.stats.active===0 && EmberFx2.remasterFeedback.active===0'))
   p.evaluate('EmberFx2.setQuality({low:false,reduced:false});EmberFX.cancel(true)')
   ck('audio runtime has no exceptions',p.evaluate('EmberAudio.diagnostics.runtimeErrors')==0)
   ck('desktop no JS exceptions',not ERRORS)
   p.close()
   for w,h in [(390,844),(844,390)]:
    p=b.new_page(viewport={'width':w,'height':h});p.on('pageerror',lambda e:ERRORS.append(str(e)));load(p)
    for i in [0,2,3,5,7,10,11,14]:run_case(p,*CASES[i],label=f'{w}x{h}')
    ck(f'{w}x{h}: no horizontal document overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
    # Same live game, actual responsive switch, rule state must remain untouched.
    before=state(p);p.set_viewport_size({'width':h,'height':w});p.wait_for_timeout(250)
    ck(f'{w}x{h}: resize preserves current rule state',state(p)==before)
    ck(f'{w}x{h}: resize emits no graphics error',p.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
    p.close()
   ck('all layouts no uncaught JavaScript errors',not ERRORS)
  except Exception:
   ERRORS.append(traceback.format_exc());raise
  finally:
   b.close();report={'checks':CHECKS,'passed':sum(c['passed'] for c in CHECKS),'failed':sum(not c['passed'] for c in CHECKS),'errors':ERRORS,'descriptors':DESC,'environment':env,'elapsed_seconds':round(time.time()-started,2)}
   (OUT/'browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
