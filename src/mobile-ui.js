/* POCKET ATELIER — touch controller. Uses the original guarded actions and
 * rules engine. Inspecting, scrolling and orientation changes never spend mana.
 */
(() => {
  'use strict';
  const E=window.Emberfall,D=EmberData,A=EmberArt,V=EmberViewport,F=EmberFX;
  const $=id=>document.getElementById(id),app=$('app');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kw={taunt:'敌人必须先攻击此随从。',shield:'抵挡下一次伤害。',rush:'召唤当回合可攻击随从。',charge:'召唤当回合即可攻击。',windfury:'每回合最多攻击两次。',lifesteal:'造成伤害时治疗己方英雄。',poison:'伤害随从后将其消灭。',stealth:'攻击前不能成为敌方指定目标。',reborn:'死亡后以 1 生命复活一次。',spellpower:'伤害法术额外造成 1 点伤害。'};
  let longPress=null,suppressUntil=0,lastGesture=null,inlineClose=null;
  const sheetInfo = (c,opts={},tags=c.tags||[]) => {
    const type=c.type==='minion'?'随从':c.type==='weapon'?'武器':'法术';
    const stats = c.type==='spell' ? `${opts.cost??c.cost} 法力 · ${c.rarity==='legendary'?'传说':c.rarity==='epic'?'史诗':c.rarity==='rare'?'稀有':'普通'}法术`
      : `${opts.atk??c.atk} 攻击 / ${opts.hp??c.hp} ${c.type==='weapon'?'耐久':'生命'} · ${opts.cost??c.cost} 法力`;
    return `<div class="touch-inspect-main"><div class="touch-inspect-art">${E.cardHTML(c,opts)}</div><div class="touch-inspect-detail"><small>${type} / ${c.rarity.toUpperCase()}</small><div class="touch-live-stat">${stats}</div><p class="touch-rule">${E.formatText(c.text||'一位等待你指挥的随从。')}</p>${opts.note?`<p class="touch-reason">${esc(opts.note)}</p>`:''}</div></div>${tags.length?`<div class="touch-keywords">${tags.map(k=>`<div><strong>${esc(D.kw[k]||k)}</strong> · ${esc(kw[k]||'')}</div>`).join('')}</div>`:''}`;
  };
  function blocked(){return !E.inBattle||F.busy;}
  function handClick(uid,fromGrid=false){
    if(blocked()||E.modal&&E.modal!=='touch-hand')return;
    const card=E.game.s.p.hand.find(x=>x.uid===uid);if(!card)return;
    const c=D.byId[card.cid],err=E.game.legalCard('p',uid),cost=E.game.cost(card);
    const needs=c.target&&E.game.targets(c.target,'p').length;
    E.showModal(`<section class="modal-box touch-card-sheet"><div class="modal-heading"><div class="eyebrow">YOUR HAND · 点选确认</div><h2>${esc(c.name)}</h2></div>${sheetInfo(c,{cost,note:err||'查看不会消耗法力。'})}<div class="modal-footer"><button id="touch-card-cancel" class="ghost-btn">${fromGrid?'返回手牌':'收起'}</button><button id="touch-card-play" class="gold-btn" ${err?'disabled':''}>${needs?'选择目标':'打出卡牌'} · ${cost} 法力</button></div></section>`,'touch-card');
    $('touch-card-cancel').onclick=()=>{if(fromGrid){E.closeModal(false);showHand();}else E.closeModal();};
    $('touch-card-play').onclick=()=>{E.closeModal(false);E.selectCard(uid);};
  }
  function showHand(){
    if(blocked())return;
    const s=E.game.s;
    E.showModal(`<section class="modal-box"><div class="modal-heading"><div class="eyebrow">YOUR HAND / ${s.p.hand.length}</div><h2>手中有牌，心中有数</h2><p>点选卡牌查看大图，再确认出牌。这里不会自动使用任何卡牌。</p></div><div class="touch-hand-grid">${s.p.hand.map(v=>`<button data-touch-hand="${v.uid}" aria-label="查看 ${D.byId[v.cid].name}">${E.cardHTML(D.byId[v.cid],{cost:E.game.cost(v)})}</button>`).join('')||'<p>手牌暂时为空，下回合会再抽一张。</p>'}</div></section>`,'touch-hand');
    document.querySelectorAll('[data-touch-hand]').forEach(b=>b.onclick=()=>handClick(b.dataset.touchHand,true));
  }
  function inspectMinion(side,uid){
    if(blocked())return;
    const m=E.game.s[side].board.find(x=>x.uid===uid);if(!m)return;const c=D.byId[m.cid];
    let note=m.frozen?'被冻结，暂时无法攻击。':m.sick?'刚被召唤，通常需要等待下一回合。':side==='p'?(E.game.canAttack('p',uid)?'已经准备好攻击。':'本回合无法再次攻击。'):'敌方随从';
    const ready=side==='p'&&E.game.canAttack('p',uid);
    E.showModal(`<section class="modal-box touch-card-sheet"><div class="modal-heading"><div class="eyebrow">${side==='p'?'YOUR MINION':'ENEMY MINION'} · 战场详情</div><h2>${esc(c.name)}</h2></div>${sheetInfo(c,{atk:m.atk,hp:m.hp,note},m.tags)}<div class="modal-footer"><button id="touch-unit-close" class="ghost-btn">回到战场</button>${ready?'<button id="touch-unit-attack" class="gold-btn">选择攻击目标</button>':''}</div></section>`,'touch-card');
    $('touch-unit-close').onclick=()=>E.closeModal();
    if(ready)$('touch-unit-attack').onclick=()=>{E.closeModal(false);E.clickUnit(side,uid);};
  }
  function inspectHero(side='p',power=false){
    if(blocked())return;
    const s=E.game.s,p=s[side],d=side==='p'?D.heroes.find(h=>h.id===s.heroId):D.bosses[s.bossIndex];
    const usable=side==='p'&&!$('power-btn').disabled,canAttack=side==='p'&&E.game.canAttack('p','hero');
    E.showModal(`<section class="modal-box"><div class="modal-heading"><div class="eyebrow">${side==='p'?'YOUR HERO':'BOSS ENCOUNTER'}</div><h2>${esc(power?d.power:d.name)}</h2></div><div class="touch-hero-info"><img src="${A.url(d.art,d.palette,d.id)}" alt="${esc(d.name)}"><div><div class="touch-live-stat">${p.hp} / ${p.maxHp} 生命${p.armor?' · '+p.armor+' 护甲':''}</div><p><b>${esc(d.power)}</b><br>${esc(d.powerText)}</p>${side==='e'?`<p>${s.phase2?'已进入第二阶段':'半血时觉醒'}<br>${esc(d.phaseText)}</p>`:p.weapon?`<p>${D.byId[p.weapon.cid].name} · ${p.weapon.atk} 攻 / ${p.weapon.durability} 耐久</p>`:''}</div></div><div class="modal-footer"><button id="touch-hero-close" class="ghost-btn">回到战场</button>${usable?'<button id="touch-hero-power" class="gold-btn">英雄技能 · 2 法力</button>':canAttack?'<button id="touch-hero-attack" class="gold-btn">武器攻击</button>':''}</div></section>`,'touch-hero');
    $('touch-hero-close').onclick=()=>E.closeModal();
    if($('touch-hero-power'))$('touch-hero-power').onclick=()=>{E.closeModal(false);E.usePower();};
    if($('touch-hero-attack'))$('touch-hero-attack').onclick=()=>{E.closeModal(false);E.clickUnit('p','hero');};
  }
  function tapUnit(side,uid){
    if(blocked()||E.modal)return;
    if(E.selection){
      if(E.selection.type==='attack'&&side==='p'&&E.selection.uid===uid){E.clearSelection();return;}
      const el=uid==='hero'?$(side==='p'?'player-hero':'enemy-hero'):document.querySelector(`#battle [data-uid="${uid}"]`);
      if(!(E.selection.type==='attack'&&side==='p')&&!el?.classList.contains('valid-target')){E.toast('请点击高亮目标，或按“取消”重新选择');return;}
      E.clickUnit(side,uid);return;
    }
    if(side==='p'&&E.game.canAttack('p',uid))E.clickUnit(side,uid);
    else if(uid==='hero')inspectHero(side);else inspectMinion(side,uid);
  }
  function selectionChanged(){
    if(!V.mobile||!E.selection)return;const sel=E.selection;
    $('touch-target-text').textContent=sel.type==='attack'?'点选高亮敌人攻击':sel.type==='card'?`${D.byId[sel.cid].name} · 选择目标`:'英雄技能 · 选择目标';
  }
  function showLog(){
    if(blocked())return;
    E.showModal(`<section class="modal-box"><div class="modal-heading"><div class="eyebrow">THE BATTLE JOURNAL</div><h2>战斗记录</h2></div><div class="touch-log">${E.game.s.log.slice(-24).reverse().map(l=>`<p>${esc(l)}</p>`).join('')}</div></section>`,'touch-log');
  }
  function showMenu(){
    if(F.busy)return;
    const opts=[['map','map','冒险地图'],['cards','book','卡牌收藏'],['guide','book','玩法手册'],['gallery','gem','工匠画廊'],['lab','fire','演武场'],['settings','settings','设置']];
    if(E.inBattle)opts.push(['hand','book','手牌总览'],['journal','book','战斗记录'],['boss','skull','首领情报'],['home','arrow','返回酒馆']);
    opts.push(['full','full','全屏']);
    E.showModal(`<section class="modal-box"><div class="modal-heading"><div class="eyebrow">EMBERFALL / POCKET ATELIER</div><h2>旅人行囊</h2><p>把世界装进口袋，把好牌留在手中。</p></div><div class="touch-menu-grid">${opts.map(([id,icon,label])=>`<button data-touch-menu="${id}">${A.icon(icon)}<span>${label}</span></button>`).join('')}</div><p class="touch-menu-note">点手牌查看 → 确认出牌 → 选择高亮目标。<br>手牌可以左右滑动；长按随从或英雄查看详情。横屏、竖屏都能继续当前对局。</p></section>`,'touch-menu');
    const fn={hand:showHand,map:()=>E.showMap(),cards:()=>E.showLibrary(),guide:()=>E.showHelp(),gallery:()=>E.showAtelier(),lab:()=>E.showFXLab(),settings:()=>E.showSettings(),journal:showLog,boss:()=>inspectHero('e'),home:()=>E.home(),full:()=>{$('fullscreen-btn').click();}};
    document.querySelectorAll('[data-touch-menu]').forEach(b=>b.onclick=()=>{const k=b.dataset.touchMenu;E.closeModal(false);fn[k]?.();if(k==='full')E.closeModal();});
  }
  function syncDeck(n){if(!V.mobile)return;const b=$('touch-deck-tab');if(b)b.textContent=`我的牌组 · ${n}/30`;}
  function closeInline(){inlineClose?.();}
  function inspectLibrary(el){
    const c=D.byId[el.dataset.add];if(!c||E.modal!=='library')return;
    closeInline();const box=$('modal').firstElementChild,scroll=box.scrollTop,children=[...box.children];
    const layer=document.createElement('section');layer.className='touch-inline-detail';layer.setAttribute('role','dialog');layer.setAttribute('aria-label',c.name+' 卡牌详情');
    layer.innerHTML=`<button id="touch-inline-close">返回收藏</button><div class="modal-heading"><h2>${esc(c.name)}</h2><p>仅查看 · 不会加入或移出牌组</p></div>${sheetInfo(c)}`;
    children.forEach(c=>c.inert=true);box.appendChild(layer);box.scrollTop=0;
    const oldOverflow=box.style.overflow;box.style.overflow='hidden';
    inlineClose=()=>{layer.remove();children.forEach(c=>c.inert=false);box.style.overflow=oldOverflow;box.scrollTop=scroll;el.focus({preventScroll:true});inlineClose=null;};
    $('touch-inline-close').onclick=closeInline;$('touch-inline-close').focus({preventScroll:true});
  }
  function afterModal(type){
    if(!V.mobile||!type||!$('modal').firstElementChild)return;
    const box=$('modal').firstElementChild,head=box.querySelector('h2');
    if(head){head.id='touch-dialog-title';$('modal').setAttribute('aria-labelledby','touch-dialog-title');}
    if(type==='library'&&!$('touch-card-tab')){
      const tabs=document.createElement('div');tabs.className='touch-library-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','卡牌收藏与牌组');
      tabs.innerHTML='<button id="touch-card-tab" role="tab" aria-selected="true">全部卡牌</button><button id="touch-deck-tab" role="tab" aria-selected="false">我的牌组 · 30/30</button>';
      box.querySelector('.library-heading').after(tabs);
      for(const [id,deck]of [['touch-card-tab',false],['touch-deck-tab',true]])$(id).onclick=()=>{box.classList.toggle('touch-show-deck',deck);$('touch-card-tab').setAttribute('aria-selected',String(!deck));$('touch-deck-tab').setAttribute('aria-selected',String(deck));box.scrollTop=0;};
      const total=$('deck-total')?.textContent?.split('/')[0];if(total)syncDeck(total);
      const foot=$('library-foot');if(foot)foot.textContent='点按加入牌组 · 长按查看大图 · “我的牌组”中移除';
    }
    if(type==='inspect')box.classList.add('touch-card-sheet');
  }
  function afterRender(s){
    if(!V.mobile||!s)return;
    const b=D.bosses[s.bossIndex];
    $('touch-match-chip').innerHTML=`<small>ENCOUNTER 0${s.bossIndex+1}</small><strong>${esc(b.name)}</strong><span>${s.phase2?'第二阶段 · 已觉醒':'第一阶段'} · ${s.e.hand.length} 手牌</span>`;
    $('turn-number').textContent=(s.active==='p'?'你的回合':'敌方回合')+' · '+s.turn;
    $('hand').setAttribute('aria-label',`你的 ${s.p.hand.length} 张手牌，左右滑动，点按查看和出牌`);
    $('touch-hand-all').setAttribute('aria-label',`展开全部 ${s.p.hand.length} 张手牌`);
    const p=V.layout.player,wslot=$('weapon-slot'),beside=V.portrait&&V.layout.power.x-(p.x+p.w)>36;V.box(wslot,{x:beside?p.x+p.w+6:p.x-8,y:p.y+(beside?36:18),w:30,h:34});
    const arrow=$('target-arrow');arrow?.setAttribute('aria-hidden','true');
    selectionChanged();
  }
  // Touch discovery lives in the compact header; secondary controls open a menu.
  const collection=document.createElement('button');collection.className='icon-btn touch-only';collection.id='touch-collection';collection.setAttribute('aria-label','卡牌收藏');collection.innerHTML=A.icon('book');collection.onclick=()=>{if(!F.busy)E.showLibrary();};
  document.querySelector('.top-actions').prepend(collection);
  const menu=document.createElement('button');menu.className='icon-btn touch-only';menu.id='touch-menu';menu.setAttribute('aria-label','打开旅人行囊菜单');menu.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="8" cy="6" r="1" fill="currentColor"/></svg>';menu.onclick=showMenu;document.querySelector('.top-actions').append(menu);
  $('touch-cancel').onclick=()=>E.clearSelection();$('touch-hand-all').onclick=showHand;
  // No pointer capture on the hand: pan-x belongs to the browser. Track motion
  // to suppress a compatibility click even on devices with permissive click slop.
  function stopLong(){if(longPress){clearTimeout(longPress.timer);longPress=null;}}
  document.addEventListener('pointerdown',ev=>{
    if(!V.mobile||ev.isPrimary===false)return;
    suppressUntil=0;lastGesture={x:ev.clientX,y:ev.clientY,moved:false,id:ev.pointerId,target:ev.target};
    stopLong();const el=ev.target.closest?.('#battle .minion,#battle .hero,#power-btn,.library-item');
    if(!el||F.busy||(E.modal&&E.modal!=='library'))return;
    longPress={el,id:ev.pointerId,x:ev.clientX,y:ev.clientY,timer:setTimeout(()=>{
      longPress=null;suppressUntil=performance.now()+850;
      if(el.matches('.library-item'))inspectLibrary(el);
      else if(el.id==='power-btn')inspectHero('p',true);
      else if(el.dataset.uid==='hero')inspectHero(el.dataset.side);
      else inspectMinion(el.dataset.side,el.dataset.uid);
    },440)};
  },{capture:true,passive:true});
  document.addEventListener('pointermove',ev=>{
    if(lastGesture&&ev.pointerId===lastGesture.id&&Math.hypot(ev.clientX-lastGesture.x,ev.clientY-lastGesture.y)>9){lastGesture.moved=true;stopLong();}
  },{capture:true,passive:true});
  document.addEventListener('pointerup',stopLong,{capture:true,passive:true});
  document.addEventListener('pointercancel',()=>{stopLong();if(lastGesture)lastGesture.moved=true;},{capture:true,passive:true});
  document.addEventListener('click',ev=>{
    if(!V.mobile)return;
    const moved=lastGesture?.moved&&lastGesture.target?.closest?.('#hand,.library-grid,.deck-list,.touch-hand-grid');
    if(performance.now()<suppressUntil||moved){ev.preventDefault();ev.stopImmediatePropagation();lastGesture=null;suppressUntil=0;return;}
    lastGesture=null;
  },true);
  document.addEventListener('contextmenu',ev=>{if(V.mobile&&ev.target.closest?.('#battle,.library-item,.touch-card-sheet'))ev.preventDefault();},true);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&inlineClose){ev.preventDefault();ev.stopImmediatePropagation();closeInline();}},true);
  window.addEventListener('ember:viewport',()=>{stopLong();lastGesture=null;closeInline();if(!V.mobile&&E.modal?.startsWith('touch'))E.closeModal();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopLong();lastGesture=null;}});
  window.EmberMobile={handClick,tapUnit,showHand,inspectMinion,inspectHero,afterRender,afterModal,selectionChanged,syncDeck,showMenu};
  document.title='烬域 · 掌中酒馆 — POCKET ATELIER';
  document.querySelector('.lobby-copy>.eyebrow').textContent='EMBERFALL · POCKET ATELIER';
  document.querySelector('.lobby-bottom small').textContent='VOL. V / POCKET ATELIER';
  const prev=V.mobile;V.resize();if(prev&&E.game.s)afterRender(E.game.s);
  window.PocketDiagnostics={version:'0.5.0',get mode(){return V.mobile?(V.portrait?'mobile-portrait':'mobile-landscape'):'desktop';},get viewport(){return {width:V.width,height:V.height};},get coordinatePlane(){return V.mobile?'CSS pixels':'1600×940';},input:'tap-inspect-confirm / native hand scroll / long-press details'};
})();
