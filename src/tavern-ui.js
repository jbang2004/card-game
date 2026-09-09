/* Tavern Edition: physical-world affordances and an honest campaign map.
 * Decorations never call the rules engine or write saves. Bosses remain sequential. */
(() => {
 'use strict';
 const E=window.Emberfall,D=EmberData,A=EmberArt,F=EmberFX,$=id=>document.getElementById(id);
 $('app').classList.toggle('lobby-view',!E.inBattle);
 $('prop-tooltip').className='prop-tooltip';
 const props={
  chimney:{x:390,y:184,school:'fire',label:'炉火正旺，旅人。',strength:.36},
  crystals:{x:1480,y:156,school:'arcane',label:'星轨转动，远方又亮起一颗星。',strength:.40},
  tree:{x:135,y:674,school:'frost',label:'蓝晶矿脉发出清澈的回响。',strength:.44},
  forge:{x:1467,y:721,school:'steel',label:'叮！又是一柄好剑。',strength:.45}
 };
 let tooltipTimer=0,lastTap=0;
 for(const button of document.querySelectorAll('[data-prop]'))button.addEventListener('click',()=>{
  if(!E.inBattle||E.modal||F.busy||E.selection||performance.now()-lastTap<350)return;
  lastTap=performance.now();const p=props[button.dataset.prop];if(!p)return;
  EmberAudio.unlock();EmberAudio.fx('impact-'+p.school);
  if(!E.settings.reduced)F.impact(p.x,p.y,p.school,p.strength);
  const tip=$('prop-tooltip');tip.textContent=p.label;tip.style.left=Math.max(35,Math.min(1370,p.x-70))+'px';tip.style.top=(p.y+58)+'px';tip.style.display='block';
  clearTimeout(tooltipTimer);tooltipTimer=setTimeout(()=>{tip.style.display='none';},1400);
 });
 const observe=new MutationObserver(()=>{if(!E.inBattle){clearTimeout(tooltipTimer);$('prop-tooltip').style.display='none';}});
 observe.observe($('app'),{attributes:true,attributeFilter:['class']});
})();
