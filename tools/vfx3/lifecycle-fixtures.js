const EmberLifecycleFixtures=(()=>{
 const CASES={
 'shield-break':'破盾',thaw:'解冻','stealth-in':'进入潜行','stealth-out':'出手显形',silence:'沉默封印',morph:'变形过渡',rebirth:'复生归魂',expire:'临时增益到期','armor-break':'护甲受击','secret-reveal':'奥秘揭示',counterspell:'法术反制','weapon-equip':'装备武器','weapon-break':'武器损坏',overdraw:'爆牌焚毁',fatigue:'牌库疲劳',trigger:'能力触发','turn-ready':'回合蓄能','hero-fall':'英雄致命受击',victory:'胜利',defeat:'败北',awaken:'首领觉醒','draw-arrive':'抽牌落手'};
 function setup(kind,g){
  const s=g.s;s.mode='practice';s.opponentHero='mage';s.winner=null;s.phase2=true;s.choice=null;s.p.armor=0;s.e.armor=0;s.p.frozen=false;s.e.frozen=false;
  s.p.deck=Array.from({length:12},()=>g.card('guard'));s.e.deck=Array.from({length:12},()=>g.card('guard'));s.p.fatigue=s.e.fatigue=0;s.e.secrets=[];
  s.p.board[0].shield=false;s.p.board[0].tags=s.p.board[0].tags.filter(t=>t!=='shield');
  const target={side:'e',uid:s.e.board[2].uid};
  let action={type:'attack',side:'p',uid:s.p.board[0].uid,target};
  const spell=(cid,t=target)=>{s.p.hand=[g.card(cid)];action={type:'play',side:'p',uid:s.p.hand[0].uid,target:t};};
  switch(kind){
  case 'shield-break':s.e.board[2].shield=true;s.e.board[2].tags.push('shield');break;
  case 'thaw':s.p.board[0].frozen=true;action={type:'end',side:'p'};break;
  case 'stealth-in':spell('assassin');break;
  case 'stealth-out':s.p.board[0].tags.push('stealth');break;
  case 'silence':s.e.board[2].shield=true;s.e.board[2].tags.push('shield');spell('silence');break;
  case 'morph':spell('polymorph');break;
  case 'rebirth':s.e.board=[];g.summon('e','phoenix');s.e.board[0].hp=1;spell('bolt',{side:'e',uid:s.e.board[0].uid});break;
  case 'expire':s.p.board[0].atk+=3;s.p.board[0].modifiers.push({id:'fixture-turn',sourceId:null,attack:3,health:0,duration:'turn'});action={type:'end',side:'p'};break;
  case 'armor-break':s.e.armor=5;spell('bolt',{side:'e',uid:'hero'});break;
  case 'secret-reveal':s.e.secrets=['ambush'];s.e.board.forEach(x=>x.tags=x.tags.filter(t=>t!=='taunt'));action.target={side:'e',uid:'hero'};break;
  case 'counterspell':s.e.secrets=['counterspell'];spell('bolt');break;
  case 'weapon-equip':spell('dagger');break;
  case 'weapon-break':{const c=EmberData.byId.dagger;s.p.weapon={cid:'dagger',name:c.name,atk:c.atk,durability:1,tags:[...c.tags]};action.uid='hero';break;}
  case 'overdraw':spell('wisdom');for(let j=0;j<9;j++)s.p.hand.push(g.card('guard'));break;
  case 'fatigue':s.p.deck=[];spell('wisdom');break;
  case 'trigger':s.p.board=[];g.summon('p','spark',{sick:false});spell('bolt');break;
  case 'turn-ready':action={type:'end',side:'p'};break;
  case 'hero-fall':case 'victory':s.e.hp=1;spell('bolt',{side:'e',uid:'hero'});break;
  case 'defeat':{const c=EmberData.byId.dagger;s.p.hp=1;s.p.weapon={cid:'dagger',name:c.name,atk:c.atk,durability:2,tags:[...c.tags]};action.uid='hero';break;}
  case 'awaken':s.mode='campaign';s.phase2=false;s.bossIndex=0;s.e.hp=Math.floor(s.e.maxHp/2)+1;spell('bolt',{side:'e',uid:'hero'});break;
  case 'draw-arrive':spell('wisdom');break;
  }
  g.events=[];g.emit();return action;
 }
 return{CASES,setup};
})();
