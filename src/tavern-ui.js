/* Tavern Edition: physical-world affordances and an honest campaign map.
 * Decorations never call the rules engine or write saves. Bosses remain sequential. */
(() => {
 'use strict';
 const E=window.Emberfall,D=EmberData,A=EmberArt,F=EmberFX,$=id=>document.getElementById(id);
 $('app').classList.toggle('lobby-view',!E.inBattle);
 $('prop-tooltip').className='prop-tooltip';
 function campaignState(){if(E.inBattle&&E.game.s)return E.game.s;try{const s=JSON.parse(localStorage.getItem('emberfall.v1'));if(s?.version===1&&D.bosses[s.bossIndex])return s;}catch{}return null;}
 function showMap(){
  if(F.busy||$('modal').dataset.locked==='1'&&E.modal)return;
  const s=campaignState(),index=s?.bossIndex??0,complete=s?.phase==='over'&&s?.winner==='p'&&index===4;
  E.showModal(`<section class="modal-box map-box"><div class="modal-heading"><div class="eyebrow">THE ADVENTURE AWAITS</div><h2>下一场好戏，在哪里？</h2><p>从余火之门出发，穿过密林与霜原。击败首领，赢取遗物，让你的牌组越战越强。</p></div><div class="map-route">${D.bosses.map((b,i)=>`<article class="map-stop ${i<index||complete?'done':i===index?'current':'locked'}"><img src="${A.character(b)}" alt="${b.name}" draggable="false"><span class="map-index">0${i+1}</span><h3>${b.title}</h3><p>${b.name} · ${b.hp} 生命</p><p>${i<index||complete?'已战胜':i===index?s?'当前挑战':'冒险起点':'击败前一位首领后到达'}</p></article>`).join('')}</div><div class="map-relics">${s?.relics?.length?s.relics.map(id=>{const r=D.relics.find(x=>x.id===id);return r?`<span title="${r.text}">${r.name}</span>`:'';}).join(''):'<span>已收集遗物将在这里展示</span>'}</div><div class="modal-footer"><p class="map-foot">首领按顺序挑战 · 地图不跳关，也不会重置当前对局<br>${E.inBattle?'关闭地图后继续当前战斗。':'点击出发，选择英雄或继续当前冒险。'}</p><button class="gold-btn" id="map-continue">${E.inBattle?'回到战场':'准备出发'} ${A.icon('arrow')}</button></div></section>`,'map');
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
