"""Verify real-action freeze order and read-only replay state. Run via xvfb-run."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from verify_benchmarks import launch, load
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'output/freeze-order';OUT.mkdir(parents=True,exist_ok=True)
def run():
 checks=[];errors=[];live=[]
 def check(name,ok):
  checks.append({'name':name,'passed':bool(ok)});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
  if not ok: raise AssertionError(name)
 with sync_playwright() as pw:
  b=launch(pw)
  try:
   for width,height in [(1440,900),(390,844)]:
    p=b.new_page(viewport={'width':width,'height':height});p.set_default_timeout(15000);p.on('pageerror',lambda e:errors.append(str(e)));load(p);p.mouse.move(width-2,2)
    p.evaluate('''()=>{window.freezeObserved=[];new MutationObserver(()=>{for(const d of EmberFx2.mesh3d.lastGroup){if(!['frost','frost-field'].includes(d.kind))continue;const r=d.targetRef,el=document.querySelector(`#battle .minion[data-uid="${r?.uid}"][data-side="${r?.side}"]`);if(el?.classList.contains('frozen')&&!freezeObserved.some(x=>x.id===d.id))freezeObserved.push({id:d.id,kind:d.kind,delta:performance.now()-d.impact});}}).observe(document.querySelector('#battle'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});}''')
    for role in ['frostbolt','nova']:
     label=f'{width} {role}'
     check(label+' real action succeeds',p.evaluate('r=>VFXLab.cast(r)',role))
     group=p.evaluate('EmberFx2.mesh3d.lastGroup');origin=group[0]['start'];d=group[-1];lead=d['impact']-origin
     # Read real-action observations before any manual seeking.
     obs=p.evaluate('freezeObserved');ids={x['id'] for x in group};samples=[x for x in obs if x['id'] in ids];live.extend(samples)
     check(label+' live freezes only at/after contact',len(samples)==len(group) and all(x['delta']>=-1 for x in samples))
     final_hp=p.evaluate('Object.fromEntries(EmberDebug.game.s.e.board.map(u=>[u.uid,String(u.hp)]))')
     state=p.evaluate('JSON.stringify(EmberDebug.game.s)');audio=p.evaluate('EmberAudio.diagnostics.history.length')
     p.evaluate('VFXLab.hide(true);document.getAnimations().forEach(a=>a.pause())')
     for phase,t in [('windup',0),('flight',max(0,group[0]['impact']-origin-60)),('contact',lead+14),('frozen',lead+200)]:
      p.evaluate('t=>VFXLab.seek(t)',t)
      visible=p.evaluate('''()=>Object.fromEntries([...document.querySelectorAll('#battle .minion')].map(e=>[e.dataset.side+':'+e.dataset.uid,{frozen:e.classList.contains('frozen'),icon:e.querySelector('.minion-status').textContent,hp:e.querySelector('.stat.hp .stat-value').textContent,label:e.getAttribute('aria-label')}]))''')
      for target in group:
       ref=target['targetRef'];k=ref['side']+':'+ref['uid'];hit=t>=target['impact']-origin;v=visible[k]
       check(label+f' {phase} {k} frost follows own contact',v['frozen']==hit and ('❄' in v['icon'])==hit and ('冻结' in v['label'])==hit)
       expected=final_hp[ref['uid']] if hit else '60';check(label+f' {phase} {k} visible HP aligned',v['hp']==expected)
      check(label+f' {phase} clean WebGL frame',p.evaluate('EmberFx2.mesh3d.diagnostics().error')==0)
      if width==1440:p.screenshot(path=str(OUT/f'{role}-{phase}.png'))
     if len(group)>1:
      t=(group[0]['impact']+group[1]['impact'])/2-origin;p.evaluate('t=>VFXLab.seek(t)',t)
      frozen=p.evaluate("[...document.querySelectorAll('#battle .minion.frozen')].map(e=>e.dataset.uid)")
      check(label+' staggered targets do not all freeze on first hit',frozen==[group[0]['targetRef']['uid']])
     p.evaluate('VFXLab.seek(0)')
     check(label+' backwards seek clears new ice',p.evaluate("document.querySelectorAll('#battle .minion.frozen').length")==0)
     check(label+' all seeking preserves authoritative rule state',p.evaluate('JSON.stringify(EmberDebug.game.s)')==state)
     check(label+' seeking emits no audio',p.evaluate('EmberAudio.diagnostics.history.length')==audio)
     p.evaluate('VFXLab.seek(VFXLab.duration)')
     check(label+' end clears particles',p.evaluate('EmberFx2.mesh3d.stats.active')==0)
     p.evaluate('VFXLab.seek(0);VFXLab.stop()')
     check(label+' stop restores resolved freeze display',p.evaluate("document.querySelectorAll('#battle .minion.frozen').length")==len(group))
     p.evaluate('VFXLab.hide(false)')
    # Playback must seek status on the very first frame, not one rAF later.
    first_frame=p.evaluate("()=>{VFXLab.seek(VFXLab.duration);VFXLab.play();return document.querySelectorAll('#battle .minion.frozen').length;}")
    check(f'{width} replay start clears ice immediately',first_frame==0)
    p.evaluate('VFXLab.seek(0)');t=p.evaluate('VFXLab.snapshot().t');p.wait_for_timeout(100)
    check(f'{width} paused time remains fixed',p.evaluate('VFXLab.snapshot().t')==t)
    p.evaluate('VFXLab.fixture("archer")')
    check(f'{width} changing fixture restores/clears preview track',p.evaluate('VFXLab.snapshot().replayState.checkpoints.length')==0)
    p.close()
   check('no uncaught JavaScript errors',not errors)
  finally:
   report={'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'liveFreezeObservations':live,'errors':errors,'environment':'Xvfb Chromium ANGLE/OpenGL software renderer; in-memory HTML; not hardware or HTTP/file-origin validation'}
   (OUT/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close();print(report['passed'],'passed,',report['failed'],'failed',flush=True)
if __name__=='__main__':run()
