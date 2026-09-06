/* Emberfall — original card database. All art and fiction are original. */
const EmberData = (() => {
 const kw = {taunt:'嘲讽',shield:'圣盾',rush:'突袭',charge:'冲锋',lifesteal:'吸血',poison:'剧毒',windfury:'风怒',stealth:'潜行',reborn:'复生',spellpower:'法术伤害 +1'};
 const cards = [
  ['spark','引火学徒',1,1,3,'mage','ember','战吼：对敌方英雄造成 1 点伤害。','common',{battle:'pingFace'}],
  ['squire','晨曦侍从',1,1,2,'knight','gold','圣盾。','common',{tags:['shield']}],
  ['wolf','月影幼狼',1,2,1,'wolf','ice','亡语：召唤一只 1/1 的幽灵狼。','common',{death:'pup'}],
  ['archer','边境游侠',1,2,1,'archer','nature','战吼：对一个敌方随从造成 1 点伤害。','common',{battle:'pingMinion',target:'enemyMinion'}],
  ['guard','铁誓卫士',2,2,3,'knight','steel','嘲讽。','common',{tags:['taunt']}],
  ['oracle','星界观测者',2,2,2,'mage','arcane','战吼：抽一张牌。','rare',{battle:'draw'}],
  ['wisp','暮光精灵',2,3,2,'spirit','arcane','法术伤害 +1。','rare',{tags:['spellpower']}],
  ['spider','幽谷蛛后',2,1,3,'spider','nature','剧毒。','rare',{tags:['poison']}],
  ['sentinel','烬翼斥候',2,2,3,'raven','ember','突袭。','common',{tags:['rush']}],
  ['assassin','夜幕刺客',3,4,2,'rogue','void','潜行。','rare',{tags:['stealth']}],
  ['cleric','曙光祭司',3,3,3,'mage','gold','战吼：为你的英雄恢复 4 点生命。','common',{battle:'heal4'}],
  ['berserker','赤岩狂战士',3,3,4,'knight','ember','风怒。','rare',{tags:['windfury']}],
  ['golem','符文石像',3,2,5,'golem','ice','嘲讽。亡语：获得 3 点护甲。','rare',{tags:['taunt'],death:'armor'}],
  ['leech','血月行者',3,3,3,'rogue','blood','吸血。','rare',{tags:['lifesteal']}],
  ['treant','古木守护者',4,3,6,'treant','nature','嘲讽。','common',{tags:['taunt']}],
  ['phoenix','不灭凤凰',4,4,3,'phoenix','ember','复生。','epic',{tags:['reborn']}],
  ['rider','霜牙狼骑',4,4,4,'wolf','ice','突袭。','rare',{tags:['rush']}],
  ['necromancer','亡者织梦师',4,3,4,'mage','void','战吼：召唤两只 1/1 的骸骨。','epic',{battle:'skeletons'}],
  ['paladin','圣光裁决者',5,4,5,'knight','gold','嘲讽。圣盾。','epic',{tags:['taunt','shield']}],
  ['titan','玄铁泰坦',5,5,6,'golem','steel','亡语：召唤一个 2/3、具有嘲讽的石卫。','rare',{death:'stone'}],
  ['huntress','荒野之矛',5,5,4,'archer','nature','冲锋。','epic',{tags:['charge']}],
  ['dragon','烬喉幼龙',6,6,6,'dragon','ember','战吼：对所有敌方随从造成 2 点伤害。','epic',{battle:'sweep2'}],
  ['reaper','黯月收割者',6,5,5,'reaper','void','吸血。突袭。','epic',{tags:['lifesteal','rush']}],
  ['colossus','远古山岳',7,7,9,'golem','nature','嘲讽。','epic',{tags:['taunt']}],
  ['solaris','逐日者·索拉',7,6,6,'knight','gold','圣盾。战吼：为友方其他随从赋予 +1/+1。','legendary',{tags:['shield'],battle:'rally'}],
  ['nyx','星陨女王·妮克丝',8,6,8,'mage','arcane','法术伤害 +1。战吼：抽两张牌。','legendary',{tags:['spellpower'],battle:'draw2'}],
  ['ashdragon','终焰·阿什拉',9,8,8,'dragon','ember','战吼：对所有其他角色造成 3 点伤害。','legendary',{battle:'inferno'}],
  ['frostking','白霜之王',8,7,8,'reaper','ice','嘲讽。战吼：冻结所有敌方随从。','legendary',{tags:['taunt'],battle:'freezeAll'}],
  ['bolt','星火箭',1,null,null,'bolt','ember','对一个敌人造成 2 点伤害。','common',{type:'spell',effect:'damage',value:2,target:'enemy'}],
  ['frostbolt','寒霜之触',2,null,null,'crystal','ice','对一个敌人造成 3 点伤害，并使其冻结。','rare',{type:'spell',effect:'frost',value:3,target:'enemy'}],
  ['fireball','陨火术',4,null,null,'meteor','ember','对一个敌人造成 6 点伤害。','rare',{type:'spell',effect:'damage',value:6,target:'enemy'}],
  ['nova','冰封领域',3,null,null,'crystal','ice','冻结所有敌方随从，抽一张牌。','rare',{type:'spell',effect:'nova'}],
  ['storm','烈焰风暴',7,null,null,'meteor','ember','对所有敌方随从造成 4 点伤害。','epic',{type:'spell',effect:'aoe',value:4}],
  ['wisdom','星界密卷',3,null,null,'book','arcane','抽两张牌。','common',{type:'spell',effect:'draw',value:2}],
  ['blessing','黎明祝福',2,null,null,'sigil','gold','使一个友方随从获得 +2/+2。','common',{type:'spell',effect:'buff',target:'friendlyMinion',value:2}],
  ['renew','生命之泉',2,null,null,'potion','nature','为你的英雄恢复 6 点生命，抽一张牌。','common',{type:'spell',effect:'heal',value:6}],
  ['execute','暗影湮灭',5,null,null,'reaper','void','消灭一个敌方随从。','epic',{type:'spell',effect:'destroy',target:'enemyMinion'}],
  ['silence','遗忘咒印',1,null,null,'sigil','void','沉默一个随从，移除其关键词和增益。','rare',{type:'spell',effect:'silence',target:'minion'}],
  ['rally','王者号令',4,null,null,'banner','gold','使所有友方随从获得 +2/+2。','epic',{type:'spell',effect:'rally',value:2}],
  ['wolves','群狼呼唤',3,null,null,'wolf','nature','召唤两只 2/2、具有突袭的灵狼。','rare',{type:'spell',effect:'wolves'}],
  ['shield','圣光庇佑',1,null,null,'sigil','gold','使一个友方随从获得圣盾。','common',{type:'spell',effect:'shield',target:'friendlyMinion'}],
  ['lifedrain','灵魂虹吸',3,null,null,'orb','blood','对一个敌人造成 3 点伤害，为你的英雄恢复 3 点生命。','rare',{type:'spell',effect:'drain',value:3,target:'enemy'}],
  ['dagger','银月双刃',2,2,2,'sword','steel','装备一把 2/2 的武器。','rare',{type:'weapon'}],
  ['sunblade','日耀圣剑',4,4,2,'sword','gold','装备一把 4/2、具有吸血的武器。','epic',{type:'weapon',tags:['lifesteal']}],
  ['polymorph','迷途化形',4,null,null,'sheep','arcane','将一个敌方随从变为 1/1 的绵羊。','rare',{type:'spell',effect:'transform',target:'enemyMinion'}],
  ['discovery','虚空洞见',2,null,null,'orb','arcane','发现一张法术牌，将其置入手牌。','epic',{type:'spell',effect:'discover'}],
  ['ambush','镜像伏击',2,null,null,'mirror','arcane','奥秘：敌人攻击你的英雄时，召唤一个 2/3 嘲讽镜卫代为承受攻击。','rare',{type:'spell',effect:'secret'}],
  ['battlecry','战意沸腾',0,null,null,'banner','ember','使一个友方随从本回合获得 +2 攻击力。','common',{type:'spell',effect:'tempBuff',target:'friendlyMinion',value:2}],
  ['coin','以太硬币',0,null,null,'orb','gold','本回合获得 1 点法力。','common',{type:'spell',effect:'coin',token:true}],
  ['pup','幽灵狼',1,1,1,'wolf','void','','common',{token:true}],
  ['spiritwolf','灵狼',2,2,2,'wolf','nature','突袭。','common',{token:true,tags:['rush']}],
  ['skeleton','骸骨',1,1,1,'reaper','steel','','common',{token:true}],
  ['stone','石卫',2,2,3,'golem','steel','嘲讽。','common',{token:true,tags:['taunt']}],
  ['sheep','绵羊',1,1,1,'sheep','nature','','common',{token:true}],
  ['recruit','曙光新兵',1,1,1,'knight','gold','','common',{token:true}],
  ['thorn','荆棘树灵',1,1,2,'treant','nature','嘲讽。','common',{token:true,tags:['taunt']}]
 ].map(([id,name,cost,atk,hp,art,palette,text,rarity,extra])=>({id,name,cost,atk,hp,art,palette,text,rarity,type:'minion',tags:[],...extra}));
 const byId=Object.fromEntries(cards.map(c=>[c.id,c]));
 const heroes=[
 {id:'mage',name:'星焰法师',title:'艾莉娅',sub:'ARCANE & EMBER',art:'mage',palette:'arcane',power:'星火',powerText:'2 法力：对一个敌人造成 1 点伤害。',target:'enemy',desc:'以烈焰与寒霜掌控战局，用法术完成致命一击。',deck:['spark','spark','squire','wolf','guard','guard','oracle','oracle','wisp','sentinel','golem','cleric','phoenix','rider','paladin','dragon','nyx','ashdragon','bolt','bolt','frostbolt','frostbolt','fireball','fireball','nova','wisdom','renew','storm','polymorph','discovery']},
 {id:'paladin',name:'黎明圣卫',title:'雷昂',sub:'LIGHT & HONOR',art:'knight',palette:'gold',power:'征召',powerText:'2 法力：召唤一个 1/1 的曙光新兵。',desc:'坚守誓约，集结圣盾军团，在号角声中反击。',deck:['squire','squire','spark','wolf','guard','guard','oracle','sentinel','cleric','cleric','golem','golem','berserker','treant','phoenix','necromancer','paladin','paladin','titan','solaris','colossus','blessing','blessing','renew','rally','rally','shield','shield','sunblade','ambush']},
 {id:'ranger',name:'暗影游侠',title:'薇丝珀',sub:'WILD & SHADOW',art:'archer',palette:'nature',power:'穿心箭',powerText:'2 法力：对敌方英雄造成 2 点伤害。',desc:'驾驭野兽与暗影，利用突袭和武器夺取先机。',deck:['wolf','wolf','archer','archer','squire','sentinel','sentinel','spider','spider','guard','oracle','assassin','assassin','leech','berserker','rider','rider','huntress','huntress','reaper','colossus','bolt','wolves','wolves','dagger','dagger','lifedrain','execute','silence','battlecry']}
 ];
 const bosses=[
 {id:'warden',name:'灰烬监守',title:'余火之门',en:'THE ASHEN WARDEN',art:'knight',palette:'ember',hp:30,power:'余烬之怒',powerText:'消耗 2 法力，对你的英雄造成 2 点伤害。',phaseText:'半血：获得 5 点护甲，召唤一名铁誓卫士。',quote:'每一簇反抗的火焰，都将在此熄灭。',deck:['squire','spark','guard','sentinel','bolt','golem','berserker','cleric','fireball','phoenix','titan','dragon','wisdom','dagger','renew'],color:'#d47742'},
 {id:'queen',name:'荆棘女王',title:'低语密林',en:'THE THORN QUEEN',art:'treant',palette:'nature',hp:34,power:'蔓生',powerText:'消耗 2 法力，召唤一个 1/2 嘲讽树灵。',phaseText:'半血：使所有友方随从获得 +1/+2。',quote:'听见了吗？树根正在呼唤你的名字。',deck:['wolf','archer','spider','guard','treant','wolves','blessing','rally','renew','golem','oracle','huntress','colossus','silence','sentinel'],color:'#8bb773'},
 {id:'oracle',name:'深渊先知',title:'无光圣所',en:'THE ABYSSAL ORACLE',art:'mage',palette:'void',hp:36,power:'灵魂汲取',powerText:'消耗 2 法力，造成 1 点伤害并恢复 2 点生命。',phaseText:'半血：召唤两个 3/3 吸血的血月行者。',quote:'你所看见的终点，不过是我的序章。',deck:['leech','assassin','oracle','wisp','necromancer','reaper','lifedrain','execute','discovery','ambush','silence','wisdom','wolf','guard','nyx'],color:'#a889d1'},
 {id:'frost',name:'霜狱君王',title:'永冻王座',en:'THE FROSTBOUND KING',art:'reaper',palette:'ice',hp:40,power:'凛冬触碰',powerText:'消耗 2 法力，对随机敌方随从造成 1 点伤害并冻结。',phaseText:'半血：获得 8 点护甲，冻结所有敌方随从。',quote:'时间在此凝结，希望也不例外。',deck:['squire','guard','golem','rider','frostbolt','nova','oracle','paladin','titan','frostking','colossus','wisdom','polymorph','renew','sentinel'],color:'#79c9d9'},
 {id:'dragon',name:'终焉巨龙',title:'世界之烬',en:'THE WORLD ENDER',art:'dragon',palette:'blood',hp:45,power:'焚界吐息',powerText:'消耗 3 法力，对所有敌人造成 1 点伤害。',phaseText:'半血：对所有敌人造成 2 点伤害，召唤一只烬喉幼龙。',quote:'在最后一颗星辰熄灭之前，燃烧吧。',deck:['spark','guard','sentinel','bolt','berserker','golem','phoenix','rider','fireball','dragon','ashdragon','titan','paladin','storm','renew'],color:'#df7059'}
 ];
 const relics=[
 {id:'heart',name:'不熄之心',icon:'heart',text:'每场战斗，英雄最大生命值 +8。'},
 {id:'lens',name:'星界透镜',icon:'orb',text:'你的伤害法术额外造成 1 点伤害。'},
 {id:'crown',name:'晨曦王冠',icon:'sigil',text:'每场战斗开始时，获得 7 点护甲。'},
 {id:'feather',name:'渡鸦之羽',icon:'raven',text:'你的每个回合开始时，为英雄恢复 2 点生命。'},
 {id:'ember',name:'初火余烬',icon:'bolt',text:'每场战斗的起始法力水晶上限 +1。'},
 {id:'banner',name:'誓约战旗',icon:'banner',text:'每场战斗开始时，召唤一个 1/2 圣盾侍从。'}
 ];
 return {cards,byId,heroes,bosses,relics,kw};
})();
if(typeof module!=='undefined')module.exports=EmberData;
