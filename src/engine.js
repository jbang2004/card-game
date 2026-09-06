/* Pure, serializable rules engine. Rendering never changes the rules. */
const EmberEngine = (() => {
 const D=typeof EmberData!=='undefined'?EmberData:require('./data.js');
 class Game {
  constructor(opts={}) {this.onChange=opts.onChange||(()=>{});this.s=null;this.events=[];}
  rand(){let x=this.s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.s.rng=x>>>0;return this.s.rng/4294967296;}
  shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this.rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  uid(){return 'u'+(++this.s.seq);}
  card(cid){if(!D.byId[cid])throw Error('Unknown card '+cid);return {uid:this.uid(),cid};}
  other(side){return side==='p'?'e':'p';}
  log(text){this.s.log.push(text);if(this.s.log.length>70)this.s.log.shift();}
  event(type,data={}){this.events.push({type,...data});}
  emit(){const ev=this.events.splice(0);this.onChange(this.s,ev);return {ok:true,events:ev};}
  reject(error){return {ok:false,error};}
  start(heroId='mage',bossIndex=0,relics=[],deck=null,seed=Date.now()) {
   const hero=D.heroes.find(h=>h.id===heroId)||D.heroes[0],boss=D.bosses[bossIndex]||D.bosses[0];
   this.s={version:1,seq:0,rng:(seed>>>0)||12345,turn:0,active:'p',phase:'mulligan',heroId:hero.id,bossIndex,phase2:false,relics:[...relics],log:[],choice:null,winner:null,stats:{played:0,damage:0,turns:0},customDeck:deck?[...deck]:null};
   const unit=(hp)=>({hp,maxHp:hp,armor:0,mana:0,maxMana:0,hand:[],deck:[],board:[],fatigue:0,powerUsed:false,attacks:0,frozen:false,weapon:null,secrets:[]});
   this.s.p=unit(30+(relics.includes('heart')?8:0));this.s.e=unit(boss.hp);
   const valid=this.validateDeck(deck);
   this.s.p.deck=this.shuffle((valid?deck:hero.deck).map(x=>this.card(x)));
   this.s.e.deck=this.shuffle([...boss.deck,...boss.deck].map(x=>this.card(x)));
   this.draw('p',3);this.draw('e',4);this.s.e.hand.push(this.card('coin'));
   if(relics.includes('crown'))this.s.p.armor=7;
   if(relics.includes('ember'))this.s.p.maxMana=1;
   if(relics.includes('banner'))this.summon('p','squire');
   this.log('你抵达了'+boss.title+'。');this.log('选择需要替换的起始卡牌。');return this.emit();
  }
  validateDeck(deck){if(!Array.isArray(deck)||deck.length!==30)return false;const counts={};for(const id of deck){const c=D.byId[id];if(!c||c.token)return false;counts[id]=(counts[id]||0)+1;if(counts[id]>(c.rarity==='legendary'?1:2))return false;}return true;}
  restore(s){
   // Reject malformed or stale browser saves before allowing them into the UI.
   try {
    if(!s||s.version!==1||!D.heroes.some(h=>h.id===s.heroId)||!D.bosses[s.bossIndex])return false;
    if(!['p','e'].includes(s.active)||!['mulligan','battle','over'].includes(s.phase)||!Number.isInteger(s.turn)||s.turn<0||s.turn>51)return false;
    if(!Number.isInteger(s.seq)||!Number.isInteger(s.rng)||!Array.isArray(s.log)||!s.log.every(x=>typeof x==='string'))return false;
    if(!Array.isArray(s.relics)||!s.relics.every(id=>D.relics.some(r=>r.id===id))||new Set(s.relics).size!==s.relics.length)return false;
    if(!s.stats||!['played','damage','turns'].every(k=>Number.isFinite(s.stats[k])&&s.stats[k]>=0))return false;
    const seen=new Set();
    for(const side of ['p','e']){
     const p=s[side];if(!p||!Array.isArray(p.board)||!Array.isArray(p.hand)||!Array.isArray(p.deck)||p.board.length>7||p.hand.length>10||p.deck.length>100)return false;
     if(!['hp','maxHp','mana','maxMana','armor','attacks','fatigue'].every(k=>Number.isFinite(p[k])))return false;
     if(p.mana<0||p.mana>10||p.maxMana<0||p.maxMana>10||p.armor<0||p.hp>p.maxHp||p.maxHp<=0)return false;
     if(!Array.isArray(p.secrets)||!p.secrets.every(x=>x==='ambush'))return false;
     for(const c of [...p.board,...p.hand,...p.deck]){if(!D.byId[c.cid]||!/^u[0-9]+$/.test(c.uid)||seen.has(c.uid)||Number(c.uid.slice(1))>s.seq)return false;seen.add(c.uid);}
     for(const m of p.board)if(![m.hp,m.maxHp,m.atk,m.attacks,m.tempAtk].every(Number.isFinite)||m.hp<=0||m.hp>m.maxHp||m.atk<0||!Array.isArray(m.tags)||!m.tags.every(x=>D.kw[x]))return false;
     if(p.weapon&&(!D.byId[p.weapon.cid]||D.byId[p.weapon.cid].type!=='weapon'||!Number.isFinite(p.weapon.atk)||!Number.isFinite(p.weapon.durability)||p.weapon.durability<1||!Array.isArray(p.weapon.tags)))return false;
    }
    if(s.choice&&(!['p','e'].includes(s.choice.side)||!Array.isArray(s.choice.cards)||s.choice.cards.length!==3||!s.choice.cards.every(id=>D.byId[id]?.type==='spell')))return false;
    this.s=JSON.parse(JSON.stringify(s));this.events=[];this.emit();return true;
   } catch {return false;}
  }
  mulligan(ids=[]){if(this.s.phase!=='mulligan')return this.reject('当前不在换牌阶段');const p=this.s.p,returned=p.hand.filter(c=>ids.includes(c.uid));p.hand=p.hand.filter(c=>!ids.includes(c.uid));this.draw('p',returned.length);p.deck.push(...returned);this.shuffle(p.deck);this.s.phase='battle';this.beginTurn('p');return this.emit();}
  draw(side,n=1){const p=this.s[side];for(let i=0;i<n;i++){if(!p.deck.length){p.fatigue++;this.damage(side,'hero',p.fatigue);this.log((side==='p'?'你':'敌人')+'受到 '+p.fatigue+' 点疲劳伤害。');continue;}const c=p.deck.shift();if(p.hand.length<10){p.hand.push(c);this.event('draw',{side,cid:c.cid});}else{this.log('手牌已满，'+D.byId[c.cid].name+'被焚毁。');this.event('burn',{side});}}}
  summon(side,cid,extra={}){const p=this.s[side];if(p.board.length>=7)return null;const c=D.byId[cid],m={uid:this.uid(),cid,atk:c.atk||0,hp:c.hp||1,maxHp:c.hp||1,tags:[...(c.tags||[])],sick:true,attacks:0,frozen:false,silenced:false,tempAtk:0,...extra};p.board.push(m);this.event('summon',{side,uid:m.uid,cid});return m;}
  getTarget(t){if(!t||!['p','e'].includes(t.side))return null;if(t.uid==='hero')return this.s[t.side];return this.s[t.side].board.find(m=>m.uid===t.uid)||null;}
  targets(kind,side){const opp=this.other(side),list=[];const add=(s,hero)=>{if(hero)list.push({side:s,uid:'hero'});this.s[s].board.forEach(m=>{if(s===side||!m.tags.includes('stealth'))list.push({side:s,uid:m.uid});});};
   if(kind==='enemy')add(opp,true);if(kind==='enemyMinion')add(opp,false);if(kind==='friendlyMinion')add(side,false);if(kind==='minion'){add(side,false);add(opp,false);}return list;}
  hasTarget(kind,side,t){return this.targets(kind,side).some(x=>x.side===t?.side&&x.uid===t?.uid);}
  spellBonus(side){return this.s[side].board.filter(m=>m.tags.includes('spellpower')).length+(side==='p'&&this.s.relics.includes('lens')?1:0);}
  cost(card){return Math.max(0,D.byId[card.cid].cost+(card.costMod||0));}
  legalCard(side,uid){if(this.s.phase!=='battle'||this.s.active!==side)return '还没有轮到你';if(this.s.choice)return '请先完成发现';const p=this.s[side],c=p.hand.find(x=>x.uid===uid);if(!c)return '找不到这张牌';const d=D.byId[c.cid];if(this.cost(c)>p.mana)return '法力不足';if(d.type==='minion'&&p.board.length>=7)return '战场已满（最多 7 个随从）';if(['wolves'].includes(d.effect)&&p.board.length>=7)return '战场已满';if(d.effect==='secret'&&p.secrets.includes('ambush'))return '相同的奥秘已存在';if(d.target&&this.targets(d.target,side).length===0){if(d.type==='minion')return null;return '没有合法目标';}return null;}
  play(side,uid,target=null){const err=this.legalCard(side,uid);if(err)return this.reject(err);const p=this.s[side],card=p.hand.find(x=>x.uid===uid),c=D.byId[card.cid];
   if(c.target&&!(c.type==='minion'&&this.targets(c.target,side).length===0)&&!this.hasTarget(c.target,side,target))return this.reject('请选择有效的目标');
   p.mana-=this.cost(card);p.hand=p.hand.filter(x=>x.uid!==uid);if(side==='p')this.s.stats.played++;
   this.log((side==='p'?'你':'敌人')+'打出「'+c.name+'」。');this.event('play',{side,cid:c.id,target});
   if(c.type==='minion'){const m=this.summon(side,c.id);this.battlecry(side,m,c.battle,target);}
   else if(c.type==='weapon'){p.weapon={cid:c.id,atk:c.atk,durability:c.hp,tags:[...c.tags]};this.event('equip',{side});}
   else this.spell(side,c,target);
   this.cleanup();return this.emit();
  }
  battlecry(side,m,effect,target){const opp=this.other(side);switch(effect){
   case 'pingFace':this.damage(opp,'hero',1);break;
   case 'pingMinion':if(target)this.damage(target.side,target.uid,1);break;
   case 'draw':this.draw(side);break;case 'draw2':this.draw(side,2);break;
   case 'heal4':this.heal(side,4);break;
   case 'skeletons':this.summon(side,'skeleton');this.summon(side,'skeleton');break;
   case 'sweep2':this.s[opp].board.forEach(x=>this.damage(opp,x.uid,2));break;
   case 'rally':this.s[side].board.filter(x=>x!==m).forEach(x=>this.buff(x,1,1));break;
   case 'freezeAll':this.s[opp].board.forEach(x=>x.frozen=true);break;
   case 'inferno':for(const s of ['p','e']){this.damage(s,'hero',3);this.s[s].board.filter(x=>x!==m).forEach(x=>this.damage(s,x.uid,3));}break;
  }}
  spell(side,c,t){const opp=this.other(side),bonus=this.spellBonus(side),n=(c.value||0)+bonus;switch(c.effect){
   case 'damage':this.damage(t.side,t.uid,n);break;
   case 'frost':this.damage(t.side,t.uid,n);if(this.getTarget(t))this.getTarget(t).frozen=true;break;
   case 'aoe':this.s[opp].board.forEach(x=>this.damage(opp,x.uid,n));break;
   case 'nova':this.s[opp].board.forEach(x=>x.frozen=true);this.draw(side);break;
   case 'draw':this.draw(side,c.value);break;
   case 'heal':this.heal(side,c.value);this.draw(side);break;
   case 'buff':this.buff(this.getTarget(t),c.value,c.value);break;
   case 'tempBuff':{const m=this.getTarget(t);m.atk+=c.value;m.tempAtk+=c.value;break;}
   case 'rally':this.s[side].board.forEach(m=>this.buff(m,c.value,c.value));break;
   case 'destroy':this.getTarget(t).hp=0;this.event('destroy',{...t});break;
   case 'silence':{const m=this.getTarget(t),base=D.byId[m.cid];m.atk=base.atk;m.maxHp=base.hp;m.hp=Math.min(m.hp,m.maxHp);m.tags=[];m.tempAtk=0;m.silenced=true;break;}
   case 'wolves':this.summon(side,'spiritwolf');this.summon(side,'spiritwolf');break;
   case 'shield':{const m=this.getTarget(t);if(!m.tags.includes('shield'))m.tags.push('shield');break;}
   case 'drain':this.damage(t.side,t.uid,n);this.heal(side,c.value);break;
   case 'coin':this.s[side].mana=Math.min(10,this.s[side].mana+1);break;
   case 'transform':{const i=this.s[t.side].board.findIndex(m=>m.uid===t.uid),m=this.s[t.side].board[i];this.s[t.side].board[i]={...m,cid:'sheep',atk:1,hp:1,maxHp:1,tags:[],tempAtk:0,silenced:false};break;}
   case 'discover':{const choices=this.shuffle(D.cards.filter(x=>x.type==='spell'&&!x.token).map(x=>x.id)).slice(0,3);this.s.choice={side,cards:choices};break;}
   case 'secret':this.s[side].secrets.push('ambush');break;
  }}
  choose(cid){const choice=this.s.choice;if(!choice||!choice.cards.includes(cid))return this.reject('无效的发现选项');if(this.s[choice.side].hand.length<10)this.s[choice.side].hand.push(this.card(cid));else this.log('手牌已满，发现的卡牌被焚毁。');this.s.choice=null;this.event('discover');return this.emit();}
  buff(m,a,h){if(!m)return;m.atk+=a;m.hp+=h;m.maxHp+=h;}
  heal(side,n){const p=this.s[side],actual=Math.min(n,p.maxHp-p.hp);p.hp+=actual;if(actual>0)this.event('heal',{side,uid:'hero',amount:actual});}
  damage(side,uid,n){const target=this.getTarget({side,uid});if(!target||n<=0)return 0;if(uid!=='hero'&&target.tags.includes('shield')){target.tags=target.tags.filter(x=>x!=='shield');this.event('shield',{side,uid});return 0;}
   const dmg=n;if(uid==='hero'&&target.armor>0){const absorbed=Math.min(n,target.armor);target.armor-=absorbed;n-=absorbed;}target.hp-=n;this.event('damage',{side,uid,amount:dmg});if(side==='e')this.s.stats.damage+=dmg;return dmg;}
  canAttack(side,uid){if(this.s.phase!=='battle'||this.s.active!==side||this.s.choice)return false;const m=this.getTarget({side,uid});if(!m||m.frozen)return false;if(uid==='hero')return !!m.weapon&&m.attacks<1&&m.weapon.atk>0;if(m.hp<=0||m.atk<=0||m.attacks>=(m.tags.includes('windfury')?2:1))return false;return !m.sick||m.tags.includes('charge')||m.tags.includes('rush');}
  attackTargets(side,uid){if(!this.canAttack(side,uid))return [];const opp=this.other(side),m=this.getTarget({side,uid});const visible=this.s[opp].board.filter(x=>!x.tags.includes('stealth')&&x.hp>0),taunts=visible.filter(x=>x.tags.includes('taunt'));if(taunts.length)return taunts.map(x=>({side:opp,uid:x.uid}));const list=visible.map(x=>({side:opp,uid:x.uid}));if(uid==='hero'||!m.sick||m.tags.includes('charge'))list.push({side:opp,uid:'hero'});return list;}
  attack(side,uid,target){if(!this.attackTargets(side,uid).some(t=>t.side===target?.side&&t.uid===target?.uid))return this.reject('无法攻击该目标：请检查嘲讽、冻结或召唤失调');const m=this.getTarget({side,uid});let t={...target};
   if(t.uid==='hero'&&this.s[t.side].secrets.includes('ambush')){this.s[t.side].secrets=this.s[t.side].secrets.filter(x=>x!=='ambush');const mirror=this.summon(t.side,'stone');if(mirror)t.uid=mirror.uid;this.log('奥秘「镜像伏击」触发！');this.event('secret',{side:t.side});}
   const d=this.getTarget(t);if(!d)return this.reject('目标已消失');const atk=uid==='hero'?m.weapon.atk:m.atk,retaliate=t.uid==='hero'?0:d.atk,tags=uid==='hero'?m.weapon.tags:[...m.tags],dtags=t.uid==='hero'?[]:[...d.tags];
   m.attacks++;if(uid!=='hero')m.tags=m.tags.filter(x=>x!=='stealth');this.event('attack',{from:{side,uid},to:t});
   const dealt=this.damage(t.side,t.uid,atk),back=this.damage(side,uid,retaliate);
   if(dealt>0&&tags.includes('poison')&&t.uid!=='hero')d.hp=0;if(back>0&&dtags.includes('poison')&&uid!=='hero')m.hp=0;
   if(tags.includes('lifesteal'))this.heal(side,dealt);if(dtags.includes('lifesteal'))this.heal(t.side,back);
   if(uid==='hero'){m.weapon.durability--;if(m.weapon.durability<=0){m.weapon=null;this.log('武器已损坏。');}}
   this.cleanup();return this.emit();
  }
  power(side,target=null){if(this.s.phase!=='battle'||this.s.active!==side||this.s.choice)return this.reject('现在无法使用技能');const p=this.s[side],cost=side==='e'&&this.s.bossIndex===4?3:2;if(p.powerUsed)return this.reject('本回合已使用英雄技能');if(p.mana<cost)return this.reject('法力不足');
   if(side==='p'&&this.s.heroId==='mage'&&!this.hasTarget('enemy',side,target))return this.reject('请选择一个敌人');
   if(((side==='p'&&this.s.heroId==='paladin')||(side==='e'&&this.s.bossIndex===1))&&p.board.length>=7)return this.reject('战场已满');
   p.mana-=cost;p.powerUsed=true;this.event('power',{side,target});
   if(side==='p'){if(this.s.heroId==='mage')this.damage('e',target.uid,1);if(this.s.heroId==='paladin')this.summon('p','recruit');if(this.s.heroId==='ranger')this.damage('e','hero',2);this.log('你使用了英雄技能。');}
   else {switch(this.s.bossIndex){case 0:this.damage('p','hero',2);break;case 1:this.summon('e','thorn');break;case 2:this.damage('p','hero',1);this.heal('e',2);break;case 3:{const a=this.s.p.board;if(a.length){const m=a[Math.floor(this.rand()*a.length)];this.damage('p',m.uid,1);m.frozen=true;}break;}case 4:this.damage('p','hero',1);this.s.p.board.forEach(m=>this.damage('p',m.uid,1));break;}this.log('敌人发动「'+D.bosses[this.s.bossIndex].power+'」。');}
   this.cleanup();return this.emit();
  }
  cleanup(){for(let loop=0;loop<30;loop++){const dead=[];for(const side of ['p','e']){const p=this.s[side];for(const m of p.board)if(m.hp<=0)dead.push({side,m});p.board=p.board.filter(m=>m.hp>0);}if(!dead.length)break;dead.sort((a,b)=>Number(a.m.uid.slice(1))-Number(b.m.uid.slice(1)));for(const {side,m} of dead){this.event('death',{side,uid:m.uid,cid:m.cid});if(!m.silenced){const death=D.byId[m.cid].death;if(death==='armor')this.s[side].armor+=3;else if(death)this.summon(side,death);}if(m.tags.includes('reborn')){const c=D.byId[m.cid];this.summon(side,m.cid,{hp:1,tags:c.tags.filter(x=>x!=='reborn')});}}}
   if(this.s.p.hp<=0||this.s.e.hp<=0){this.s.phase='over';this.s.winner=this.s.p.hp<=0?(this.s.e.hp<=0?'draw':'e'):'p';this.s.choice=null;this.event('over',{winner:this.s.winner});this.log(this.s.winner==='p'?'胜利！余火仍在燃烧。':this.s.winner==='draw'?'同归于尽。':'你的火焰暂时熄灭了。');return;}
   if(!this.s.phase2&&this.s.e.hp<=this.s.e.maxHp/2&&this.s.phase==='battle'){this.s.phase2=true;this.log('阶段 II · '+D.bosses[this.s.bossIndex].name+'觉醒！');this.event('phase');switch(this.s.bossIndex){case 0:this.s.e.armor+=5;this.summon('e','guard');break;case 1:this.s.e.board.forEach(m=>this.buff(m,1,2));break;case 2:this.summon('e','leech');this.summon('e','leech');break;case 3:this.s.e.armor+=8;this.s.p.board.forEach(m=>m.frozen=true);break;case 4:this.damage('p','hero',2);this.s.p.board.forEach(m=>this.damage('p',m.uid,2));this.summon('e','dragon');break;}this.cleanup();}
  }
  beginTurn(side){this.s.active=side;const p=this.s[side];if(side==='p'){this.s.turn++;this.s.stats.turns++;if(this.s.relics.includes('feather'))this.heal('p',2);}if(this.s.turn>50){this.s.phase='over';this.s.winner='draw';this.event('over',{winner:'draw'});return;}
   p.maxMana=Math.min(10,p.maxMana+1);p.mana=p.maxMana;p.powerUsed=false;p.attacks=0;for(const m of p.board){m.sick=false;m.attacks=0;}this.draw(side);this.log('第 '+this.s.turn+' 回合 · '+(side==='p'?'你的回合':'敌方回合'));this.event('turn',{side});this.cleanup();}
  endTurn(side){if(this.s.phase!=='battle'||this.s.active!==side||this.s.choice)return this.reject('现在不能结束回合');const p=this.s[side];p.frozen=false;for(const m of p.board){m.frozen=false;if(m.tempAtk){m.atk-=m.tempAtk;m.tempAtk=0;}}this.beginTurn(this.other(side));return this.emit();}
  scoreTarget(c,t,side){const m=this.getTarget(t),enemy=t.side!==side;const dmg=(c.value||1)+this.spellBonus(side);if(c.effect==='silence')return enemy?(m.tags.length*3+(m.atk-D.byId[m.cid].atk)): -20;if(['buff','shield','tempBuff'].includes(c.effect))return m.atk+m.hp/3+(m.tags.includes('shield')&&c.effect==='shield'?-30:0);if(t.uid==='hero')return this.s[t.side].hp+this.s[t.side].armor<=dmg?1000:1.2;if(c.effect==='destroy'||c.effect==='transform')return m.atk+m.hp/2-(c.cost>m.atk+m.hp?4:0);return (m.hp<=dmg?6+m.atk:Math.min(dmg,m.hp)*0.8)-(m.tags.includes('shield')?2:0);}
  aiAction(){if(this.s.phase!=='battle'||this.s.active!=='e')return {type:'none'};if(this.s.choice){return {type:'choose',cid:this.s.choice.cards.slice().sort((a,b)=>D.byId[b].cost-D.byId[a].cost)[0]};}
   const actions=[],side='e';
   for(const m of [...this.s.e.board,{uid:'hero'}])for(const t of this.attackTargets(side,m.uid)){const attacker=this.getTarget({side,uid:m.uid}),atk=m.uid==='hero'?attacker.weapon.atk:attacker.atk,d=this.getTarget(t);let score;if(t.uid==='hero')score=d.hp+d.armor<=atk?2000:3+atk*.2;else score=(d.hp<=atk?5+d.atk:1)-(m.uid!=='hero'&&attacker.hp<=d.atk?attacker.atk*.65:0)+(d.tags.includes('taunt')?2:0);actions.push({type:'attack',uid:m.uid,target:t,score});}
   for(const card of this.s.e.hand){if(this.legalCard(side,card.uid))continue;const c=D.byId[card.cid];const targets=c.target?this.targets(c.target,side):[null];if(c.type==='minion'&&targets.length===0)targets.push(null);for(const t of targets){let score=0;if(c.type==='minion')score=5+c.cost*.8;else if(c.type==='weapon')score=this.s.e.weapon?-4:5;else if(t)score=this.scoreTarget(c,t,side);else switch(c.effect){case 'coin':score=this.s.e.hand.some(h=>D.byId[h.cid].cost===this.s.e.mana+1)?6:-8;break;case 'heal':score=this.s.e.maxHp-this.s.e.hp>=4?5:0.5;break;case 'draw':case 'discover':score=this.s.e.hand.length<6?4:0.1;break;case 'aoe':score=this.s.p.board.reduce((n,m)=>n+(m.hp<=c.value+this.spellBonus(side)?4+m.atk*.5:1),0);break;case 'rally':score=this.s.e.board.length*3;break;case 'wolves':score=this.s.e.board.length<=5?6:1;break;case 'nova':score=this.s.p.board.filter(x=>!x.frozen).length*1.8+1;break;case 'secret':score=2.5;break;default:score=1;}
    actions.push({type:'play',uid:card.uid,target:t,score});}}
   if(!this.s.e.powerUsed&&this.s.e.mana>=(this.s.bossIndex===4?3:2)&&!(this.s.bossIndex===1&&this.s.e.board.length>=7))actions.push({type:'power',score:2});
   actions.sort((a,b)=>b.score-a.score);return actions.length&&actions[0].score>0?actions[0]:{type:'end'};
  }
  aiStep(){const a=this.aiAction();switch(a.type){case 'play':return this.play('e',a.uid,a.target);case 'attack':return this.attack('e',a.uid,a.target);case 'power':return this.power('e');case 'choose':return this.choose(a.cid);case 'end':return this.endTurn('e');default:return this.reject('AI 无需行动');}}
 }
 return {Game};
})();
if(typeof module!=='undefined')module.exports=EmberEngine;
