/* Tavern Edition: physical-world affordances and an honest campaign map.
 * Decorations never call the rules engine or write saves. Bosses remain sequential. */
(() => {
 'use strict';
 const E=window.Emberfall,D=EmberData,A=EmberArt,F=EmberFX,$=id=>document.getElementById(id);
 $('app').classList.toggle('lobby-view',!E.inBattle);
 $('prop-tooltip').className='prop-tooltip';
 function campaignState(){if(E.inBattle&&E.game.s)return E.game.s;try{const s=JSON.parse(localStorage.getItem('emberfall.v1'));if(EmberState.valid(s,D))return s;}catch{}return null;}
 function showMap(){
  if(F.busy||$('modal').dataset.locked==='1'&&E.modal)return;
  const s=campaignState(),index=s?.bossIndex??0,complete=s?.phase==='over'&&s?.winner==='p'&&index===D.bosses.length-1;
  // Coordinates belong to the approved 1536×1024 artboard, never game state.
  const locations=[
   [333,400,160,479,268,448],[721,280,150,365,669,337],
   [1090,270,154,350,1035,321],[1298,481,156,552,1245,527],
   [961,650,160,724,908,696],[480,627,160,709,422,680]
  ];
  const paths=['M448 427 C520 422 540 352 624 331','M804 343 C874 323 900 268 992 305','M1169 332 Q1235 360 1250 415','M1211 558 Q1150 633 1072 645','M856 688 Q710 604 597 647'];
  const status=i=>i<index||complete?'已战胜':i===index?(s?'当前挑战':'冒险起点'):'尚未抵达';
  const lock='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  E.showModal(`<section class="modal-box adventure-atlas">
   <div class="modal-heading atlas-heading"><h2>冒险地图</h2><p>穿越六境 · 缔结你的传说</p></div>
   <div class="atlas-stage" aria-label="战役路线">
    <svg class="atlas-paths" viewBox="0 0 1536 1024" aria-hidden="true">${paths.map((p,i)=>`<path class="${i<index||complete?'traversed':''}" d="${p}"/>`).join('')}</svg>
    ${D.bosses.map((b,i)=>{const [x,y,w,label,bx,by]=locations[i];return `<article class="atlas-location ${i<index||complete?'done':i===index?'current':'locked'}" style="--x:${x/15.36}%;--y:${y/10.24}%;--w:${w/15.36}%;--label:${(label-y)/w*100+50}%;--badge-x:${(bx-x)/w*100+50}%;--badge-y:${(by-y)/w*100+50}%;--crop-x:${(x-w/2)/(1536-w)*100}%;--crop-y:${(y-w/2)/(1024-w)*100}%;--crop-w:${1536/w*100}%;--crop-h:${1024/w*100}%">
      <button class="atlas-node" data-map-node="${i}" aria-label="${String(i+1).padStart(2,'0')} ${b.title}，${b.name}，${b.hp} 生命，${status(i)}" aria-expanded="false"><span class="atlas-node-art"></span><span class="atlas-badge">${i>index&&!complete?lock:String(i+1).padStart(2,'0')}</span><h3>${b.title}</h3></button>
      <div class="atlas-location-info"><strong>${b.name} · ${b.hp} 生命</strong><span>${status(i)}</span></div>
     </article>`;}).join('')}
   </div>
   <div class="modal-footer atlas-footer"><div class="atlas-journey"><div class="atlas-progress" aria-label="战役进度">${D.bosses.map((b,i)=>`<span class="${i<index||complete?'done':i===index?'current':''}" title="${b.title} · ${status(i)}">${i+1}</span>`).join('')}</div><div class="atlas-relics">${s?.relics?.length?s.relics.map(id=>{const r=D.relics.find(x=>x.id===id);return r?`<span title="${r.text}">${r.name}</span>`:'';}).join(''):'<span>击败首领，收集旅途遗物</span>'}</div></div><button class="gold-btn" id="map-continue">${E.inBattle?'回到战场':'准备出发'} ${A.icon('arrow')}</button></div>
  </section>`,'map');
  document.querySelectorAll('[data-map-node]').forEach(button=>button.onclick=()=>{
   const expanded=button.getAttribute('aria-expanded')==='true';
   document.querySelectorAll('[data-map-node]').forEach(node=>node.setAttribute('aria-expanded','false'));
   button.setAttribute('aria-expanded',String(!expanded));
  });
  $('map-continue').onclick=()=>{const b=E.inBattle;E.closeModal();if(!b)$('start-btn').click();};
 }
 $('adventure-nav').onclick=showMap;E.showMap=showMap;
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
