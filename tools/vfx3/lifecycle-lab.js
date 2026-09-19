/* Export-only state/event fixtures. Real dispatch; inspection never re-runs rules. */
(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 for(let i=0;i<500&&!window.VFXLab;i++)await wait(30);if(!window.VFXLab)return;
 const original={cast:VFXLab.cast,seek:VFXLab.seek,play:VFXLab.play,stop:VFXLab.stop};
 const state=EmberReplayState.create(document);let active=false,group=[],duration=0,t=0,running=false,last=0,kind=null,generation=0;
 const sel=document.getElementById('lab-role'),heading=document.createElement('optgroup');heading.label='R11 · 状态与规则演出';
 for(const [id,name]of Object.entries(EmberLifecycleFixtures.CASES)){const o=document.createElement('option');o.value='life/'+id;o.textContent=name;heading.append(o);}sel.prepend(heading);
 document.querySelector('#vfxlab strong').textContent='EMBERFALL / R11 · STATE & CONSEQUENCE';
 document.querySelector('#vfxlab .note').textContent='状态演出执行真实规则；回看只恢复外观与特效，不重新结算。原攻击与冰冻顺序保持不变。';
 let resultDisplay=null;
 const restoreModal=()=>{const m=document.getElementById('modal');if(resultDisplay!==null&&m)m.style.display=resultDisplay;resultDisplay=null;};
 const read=()=>{document.getElementById('lab-time').max=duration;document.getElementById('lab-time').value=t;document.getElementById('lab-readout').textContent=(t/1000).toFixed(2)+'s';document.getElementById('lab-play').textContent=running?'Ⅱ':'▶';};
 function paint(ms){
  if(['hero-fall','victory','defeat'].includes(kind)){
   const m=document.getElementById('modal');if(m&&m.children.length){if(resultDisplay===null)resultDisplay=m.style.display;m.style.display=ms>=duration-70?resultDisplay:'none';}
  }
  state.seek(ms);EmberFx2.mesh3d.replayLifecycle(ms);}
 function seek(ms){running=false;EmberFX.cancel(true);t=Math.max(0,Math.min(duration,ms));paint(t);read();}
 function stop(){running=false;active=false;restoreModal();state.clear();EmberAudio.stop();}
 async function cast(id){
  running=false;generation++;const token=generation;restoreModal();state.clear();original.stop();active=true;kind=id;sel.value='life/'+id;
  Emberfall.closeModal();VFXLab.fixture('squire');const g=EmberDebug.game,action=EmberLifecycleFixtures.setup(id,g),before=state.capture();
  const n=EmberFx2.mesh3d.lifecycleTrace.length,oracle=new EmberEngine.Game();oracle.s=structuredClone(g.s);oracle.eventSeq=g.eventSeq;
  oracle.dispatch(action);const expected=JSON.stringify(oracle.s);
  const out=Emberfall.act(()=>g.dispatch(action));
  window.__lastLifecycleRuleMatch=JSON.stringify(g.s)===expected;window.__lastLifecycleAction=action;
  if(!out?.ok){document.getElementById('lab-mode').textContent=out?.error||'出招失败';return false;}
  for(let i=0;i<900&&EmberFX.busy;i++){await wait(20);if(token!==generation)return false;}
  group=EmberFx2.mesh3d.lastLifecycleGroup;
  if(EmberFx2.mesh3d.lifecycleTrace.length<=n||!group.some(d=>d.kind===id)){document.getElementById('lab-mode').textContent='本次未触发指定演出';return false;}
  // Replay only the requested event and same-clock companions, not every turn's cue.
  const selected=group.find(d=>d.kind===id);window.__selectedLifecycle=selected;
  duration=Math.max(...group.map(d=>d.impact-group[0].start+d.tail));t=duration;
  state.set(before,state.capture(),group);read();
  document.getElementById('lab-mode').textContent='真实规则事件 · '+EmberLifecycleFixtures.CASES[id];
  document.getElementById('lab-title').innerHTML=EmberLifecycleArts.DEFINITIONS[id].name+'<small>R11 / LIVE STATE TRANSITION</small>';
  return true;
 }
 function play(){if(!group.length)return;if(running){running=false;EmberAudio.stop();read();return;}if(t>=duration)t=0;EmberFX.cancel(true);paint(t);running=true;last=performance.now();read();}
 function tick(now){if(active&&running){t=Math.min(duration,t+Math.min(70,now-last)*Number(document.getElementById('lab-speed').value));paint(t);if(t>=duration)running=false;read();}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
 const route=id=>id.startsWith('life/')?cast(id.slice(5)):(stop(),original.cast(id));
 document.getElementById('lab-cast').onclick=()=>route(sel.value);sel.onchange=()=>route(sel.value);
 document.getElementById('lab-play').onclick=()=>active?play():original.play();document.getElementById('lab-step').onclick=()=>active?seek(t+1000/60):original.seek(VFXLab.snapshot().t+1000/60);
 document.getElementById('lab-time').oninput=e=>active?seek(+e.target.value):original.seek(+e.target.value);
 const close=document.getElementById('lab-close').onclick;document.getElementById('lab-close').onclick=()=>{stop();close();};
 document.getElementById('lab-cycle').onclick=async()=>{for(const id of ['shield-break','thaw','stealth-out','silence','morph','rebirth','counterspell','weapon-break','overdraw']){if(!await cast(id))break;await wait(250);}};
 document.querySelector('[data-fx="breath"]').onclick=()=>route('breath');
 VFXLab.cast=route;VFXLab.seek=ms=>active?seek(ms):original.seek(ms);VFXLab.play=()=>active?play():original.play();
 document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;EmberAudio.stop();}});
 window.LifecycleLab={cast,seek,play,stop,get duration(){return duration;},get selected(){return kind;},get group(){return group;},get active(){return active;},snapshot:()=>({t,duration,running,kind,active})};
})();
