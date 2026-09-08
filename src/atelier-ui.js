/* UI integration. The workshop is display-only: it cannot spend resources,
 * change deck order, advance a boss or overwrite a save. */
(()=>{
 'use strict';const E=window.Emberfall,A=EmberArt,$=id=>document.getElementById(id);
 const props={
  chimney:['叩叩酒馆的铜灯，让炉火更暖一些','炉火与麦香'],
  crystals:['轻拨黄铜星盘，点亮一条星轨','星辉观测台'],
  tree:['敲击矿车中的蓝晶，聆听矿脉回响','蓝晶矿脉'],
  forge:['轻击铁砧，看火星划过夜色','余烬锻炉']
 };
 for(const el of document.querySelectorAll('[data-prop]')){
  const id=el.dataset.prop;el.setAttribute('aria-label',props[id][0]);el.title=props[id][1];
  el.addEventListener('pointerenter',()=>AtelierWorld.setHover(id));el.addEventListener('pointerleave',()=>AtelierWorld.setHover(null));
  el.addEventListener('click',()=>{if(E.inBattle&&!E.modal&&!EmberFX.busy&&!E.selection)AtelierWorld.ping(id);});
 }
 const b=document.createElement('button');b.className='atelier-open';b.id='atelier-open';b.innerHTML='工匠画廊<small>THE ARTISAN’S ATELIER</small>';$('lobby').appendChild(b);
 function showAtelier(){if(EmberFX.busy)return;
  const names=[['brewery','旅人的酒馆','屋檐小猫 · 铜灯 · 木窗'],['observatory','星辉观测台','观星旅人 · 黄铜星环'],['mine','蓝晶矿脉','蓝晶矿洞 · 山谷矿工'],['forge','余烬锻炉','暖色炉火 · 铁匠的故事']];
  E.showModal(`<section class="modal-box atelier-box"><div class="modal-heading"><div class="eyebrow">EMBERFALL · THE ARTISAN’S ATELIER</div><h2>旅人的原画档案</h2><p>早期山谷场景的四幅建筑原画。当前对战采用全新完整酒馆桌面，旧画作在此留档。</p></div><div class="atelier-architecture">${names.map(([k,n,t])=>`<article class="atelier-vignette"><img src="${WindborneAssets['building-'+k]}" alt="${n}" draggable="false"><h3>${n}</h3><p>${t}</p></article>`).join('')}</div><div class="atelier-specimens">${['paladin','fireball','huntress','ashdragon','sunblade'].map(id=>`<div>${E.cardHTML(EmberData.byId[id])}</div>`).join('')}</div><div class="atelier-foot"><p>卡牌文字、费用与属性均来自当前卡牌数据。<br>画廊仅供欣赏，不会改变牌组或冒险进度。</p><button class="gold-btn small-btn" id="atelier-done">回到酒馆 ${A.icon('arrow')}</button></div></section>`,'atelier');
  $('atelier-done').onclick=()=>E.closeModal();
 }
 b.onclick=showAtelier;E.showAtelier=showAtelier;
 // The opening cabinet uses two illustrations actually adapted in this edition.
 // Expose diagnostics without adding a permanent debug panel to the game.
 window.AtelierDiagnostics={version:'0.14.0',assets:Object.keys(WindborneAssets).length,paintedCards:AtelierArt.paintedCards.length,buildings:4,frames:0,layout:'1600x940',input:'live DOM',renderer:'Canvas 2D'};
})();
