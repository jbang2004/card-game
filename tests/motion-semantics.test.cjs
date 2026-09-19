const test=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine.js'),{compile,outcomeOf}=require('../src/presentation/combat.js');
const R=require('../src/vfx3/runtime.js'),A=require('../src/vfx3/remaster-arts.js'),B=require('../src/vfx3/benchmark-arts.js');
const Q=require('../src/vfx3/remaster-cues.js'),BQ=require('../src/vfx3/benchmark-cues.js');
const descriptor=(kind,extra={})=>R.descriptor(kind,{from:{x:430,y:620,w:116,h:146},to:{x:920,y:290,w:116,h:146},startedAt:1000,contactAt:1300,tier:2,...extra});
function cast(cid,{shield=false,armor=0,hero=false}={}){const g=new Game();g.demo();g.s.p.board=[];g.s.e.board=[];g.s.p.mana=10;g.s.e.armor=armor;g.s.e.hp=30;const u=g.summon('e','treant');u.hp=u.maxHp=30;if(shield)u.tags.push('shield');const c=g.card(cid);g.s.p.hand=[c];g.events=[];const before=g.snapshot(),r=g.dispatch({type:'play',side:'p',uid:c.uid,target:{side:'e',uid:hero?'hero':u.uid}});assert.ok(r.ok);return compile(r.events,before,g.snapshot()).beats.find(b=>b.cast)?.cast;}
test('real spell events distinguish damage, full armor, shield and freeze',()=>{
 assert.deepEqual(cast('moonlance').outcomes,[{kind:'damage',freezes:false}]);
 assert.deepEqual(cast('frostbolt').outcomes,[{kind:'damage',freezes:true}]);
 assert.equal(cast('fireball',{shield:true}).outcomes[0].kind,'shield');
 assert.equal(cast('fireball',{armor:20,hero:true}).outcomes[0].kind,'armor');
 assert.equal(cast('fireball',{armor:2,hero:true}).outcomes[0].kind,'damage');
});
test('ice film requires an actual freeze; element and attack identity alone cannot imply status',()=>{
 for(const kind of ['frost','frost-field']){
  assert.ok(!A.sample(descriptor(kind),.5).sprites.some(x=>x.mode===16));
  assert.ok(A.sample(descriptor(kind,{outcome:{kind:'damage',freezes:true}}),.5).sprites.some(x=>x.mode===16));
 }
 assert.ok(!B.sample(descriptor('slash',{swordStyle:'frost'}),.5).plates.some(x=>x.material===16));
});
test('soul tether is a support binding with no target knockback or blood return',()=>{
 const d=descriptor('arcane',{sourceCid:'soultether'});assert.equal(d.kind,'soulbind');
 for(const t of [.2,.35,.55]){assert.deepEqual(A.reaction(d,t).target,[0,0,0]);assert.ok(A.sample(d,t).ribbons.length>0);}
});
test('AOE launches once while each actual damage target retains its own weighted contact',()=>{
 const ds=[1,2,3].map((tier,i)=>descriptor('fireball',{tier,contactAt:1300+i*45,audioPrimary:i===0,audioGain:1/Math.sqrt(3),outcome:{kind:'damage'}}));
 const cues=ds.flatMap(Q.events);assert.equal(cues.filter(e=>e.id==='charge').length,1);assert.equal(cues.filter(e=>e.id==='launch').length,1);assert.equal(cues.filter(e=>e.id==='tail').length,1);
 const hits=cues.filter(e=>e.id==='impact');assert.deepEqual(hits.map(e=>e.at),[1300,1345,1390]);assert.ok(hits[0].gain<hits[1].gain&&hits[1].gain<hits[2].gain);
});
test('shield and full armor do not schedule flesh impacts or move the target as damaged',()=>{
 for(const kind of ['shield','armor'])for(const [d,arts,cues] of [[descriptor('slash',{swordStyle:'frost',outcome:{kind}}),B,BQ],[descriptor('fireball',{outcome:{kind}}),A,Q]]){
  assert.deepEqual(cues.events(d).map(e=>e.id),['charge','launch']);assert.ok(arts.reaction(d,.35).target.every(v=>Math.abs(v)<1e-8));
 }
});
test('breath remains a finite single attack and outcome/tint descriptors are immutable inputs',()=>{
 const input={kind:'damage',freezes:false},tint=[1,.4,.1],d=descriptor('breath',{outcome:input,tint});input.freezes=true;tint[0]=0;
 assert.equal(d.outcome.freezes,false);assert.equal(d.tint[0],1);assert.ok(d.tail<=1500);assert.ok(R.breathClock(d,.3).time===1.46);
});
test('overlapping effect families compose one pose and restore the original style exactly',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const el={style:{transform:'scale(.95)',filter:'contrast(1.1)'},isConnected:true};
 const ctx={module:{exports:{}},document:{hidden:false,querySelector:()=>el},CSS:{escape:x=>x},performance:{now:()=>0}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/presentation/motion-feedback.js','utf8'),ctx);
 const bank=(name,x)=>({name,supports:d=>d.kind===name,reaction:()=>({source:[0,0,0],target:[x,0,1],sourceLight:0,targetLight:.1}),events:()=>[]});
 const f=ctx.module.exports.create([bank('first',3),bank('second',4)]),first={id:1,kind:'first',start:0,targetRef:{side:'e',uid:1}},second={id:2,kind:'second',start:0,targetRef:{side:'e',uid:1}};
 f.frame([first],50,true);f.frame([first,second],100,true);assert.match(el.style.transform,/translate\(7.000px,0.000px\)/);
 f.frame([second],150,true);assert.match(el.style.transform,/translate\(4.000px,0.000px\)/);
 f.frame([],200,true);assert.equal(el.style.transform,'scale(.95)');assert.equal(el.style.filter,'contrast(1.1)');assert.equal(f.active,0);
 f.frame([first,second],300,true);f.clear();assert.equal(el.style.transform,'scale(.95)');assert.equal(f.active,0);
});
test('blocked arrows deflect without punctures; shadow strikes leave no incision',()=>{
 const hit=descriptor('arrow'),blocked=descriptor('arrow',{outcome:{kind:'shield'}});
 assert.deepEqual(A.sample(blocked,.3).tip,A.sample(hit,.3).tip);
 assert.notDeepEqual(A.sample(blocked,.38).tip,A.sample(hit,.38).tip);
 assert.ok(!A.sample(blocked,.38).meshes.some(x=>JSON.stringify(x.color)==='[0.02,0.014,0.009]'));
 const d=descriptor('slash',{swordStyle:'night',outcome:{kind:'shield'}});
 assert.ok(!B.sample(d,.53).ribbons.some(x=>x.material===15&&!x.add));
});
test('all sword identities suppress card-surface scars on blocked contacts',()=>{
 const S=require('../src/vfx3/sword-arts.js');
 for(const swordStyle of Object.keys(S.definitions))for(const kind of ['shield','armor']){
  const d=descriptor('slash',{swordStyle,outcome:{kind}});
  for(const t of [.32,.41,.57])assert.equal(S.sample(d,t).cracks.length,0,`${swordStyle}/${kind}`);
 }
});
