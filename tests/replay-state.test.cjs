'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../tools/vfx3/replay-state.js');
const value=(frozen,hp)=>({frozen,hp:String(hp),hurt:hp<60,label:`目标，生命 ${hp}${frozen?'，被冻结':''}`,status:frozen?'❄':'<span class="sleep">z z</span>'});
const make=(uid,impact,extra={})=>({start:1000,impact,targetRef:{side:'e',uid},...extra});
const before={'e:a':value(false,60),'e:b':value(false,60)},after={'e:a':value(true,57),'e:b':value(true,59)};
const tracks=()=>R.plan(before,after,[make('a',1610),make('b',1660)]);
test('projectile windup and flight keep pre-impact frost and HP',()=>{for(const t of [0,200,400,509,609.999])assert.deepEqual(R.stateAt(tracks(),t)['e:a'],before['e:a']);});
test('frost and health switch exactly at contact, not at launch',()=>assert.deepEqual(R.stateAt(tracks(),610)['e:a'],after['e:a']));
test('group contacts reveal only targets already hit',()=>{const s=R.stateAt(tracks(),625);assert.deepEqual(s['e:a'],after['e:a']);assert.deepEqual(s['e:b'],before['e:b']);});
test('all targets have final status at the final group deadline',()=>assert.deepEqual(R.stateAt(tracks(),660),after));
test('reverse seek before impact removes newly acquired frozen state',()=>{const t=tracks();R.stateAt(t,900);assert.deepEqual(R.stateAt(t,500),before);});
test('previously frozen card is not incorrectly thawed',()=>{const b={'e:a':value(true,60)},a={'e:a':value(true,57)};assert.equal(R.stateAt(R.plan(b,a,[make('a',1610)]),0)['e:a'].frozen,true);});
test('non-freezing hit remains non-freezing',()=>{const a={'e:a':value(false,55)};assert.equal(R.stateAt(R.plan(before,a,[make('a',1610)]),800)['e:a'].frozen,false);});
test('pure sampling does not mutate captured state or descriptors',()=>{const group=[make('a',1610)],b=structuredClone(before),a=structuredClone(after),g=structuredClone(group);const t=R.plan(b,a,group);R.stateAt(t,0)['e:a'].frozen=true;R.stateAt(t,800);assert.deepEqual(b,before);assert.deepEqual(a,after);assert.deepEqual(group,g);assert.equal(t[0].before.frozen,false);});
test('missing or removed targets do not reappear',()=>assert.equal(R.plan(before,{},[make('a',1610)]).length,0));
test('utility effects cannot change target status',()=>assert.equal(R.plan(before,after,[make('a',1610,{visualOnly:true})]).length,0));
test('malformed or empty group is harmless',()=>{assert.deepEqual(R.plan(before,after,null),[]);assert.deepEqual(R.plan(before,after,[make('a',NaN)]),[]);assert.deepEqual(R.stateAt([],100),{});});
test('same target duplicate descriptors use first contact without duplicates',()=>{const t=R.plan(before,after,[make('a',1640),make('a',1610)]);assert.equal(t.length,1);assert.equal(t[0].at,610);});
test('enemy and friendly units with the same ID are separate',()=>{const b={'e:a':value(false,60),'p:a':value(false,60)},a={'e:a':value(true,57),'p:a':value(false,56)};const t=R.plan(b,a,[make('a',1610),make('a',1800,{targetRef:{side:'p',uid:'a'}})]);assert.equal(R.stateAt(t,650)['p:a'].hp,'60');});
test('hero target follows its own deadline',()=>{const b={'p:hero':value(false,30)},a={'p:hero':value(true,27)},t=R.plan(b,a,[make('hero',1610,{targetRef:{side:'p',uid:'hero'}})]);assert.equal(R.stateAt(t,609)['p:hero'].frozen,false);assert.equal(R.stateAt(t,610)['p:hero'].frozen,true);});
function mockNode(uid,initial){
 const flags=new Set(initial.frozen?['frozen']:[]),hpFlags=new Set(initial.hurt?['hurt']:[]),number={textContent:initial.hp},status={innerHTML:initial.status};
 const cl=set=>({contains:k=>set.has(k),toggle(k,on){on?set.add(k):set.delete(k);}});
 const hp={classList:cl(hpFlags),querySelector:()=>number},attrs={'aria-label':initial.label};
 return{dataset:{side:'e',uid},classList:cl(flags),querySelector:s=>s==='.minion-status'?status:s==='.stat.hp'?hp:null,getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v;},removeAttribute:k=>{delete attrs[k];}};
}
function mocked(){const nodes=[mockNode('a',after['e:a'])],doc={querySelectorAll:()=>nodes,getElementById:()=>null},p=R.create(doc);p.set(before,after,[make('a',1610)]);return{nodes,p};}
test('DOM freeze shell, icon, label and HP switch together',()=>{const {p,nodes}=mocked();p.seek(0);assert.equal(nodes[0].classList.contains('frozen'),false);assert.equal(nodes[0].querySelector('.stat.hp').querySelector().textContent,'60');assert.ok(!nodes[0].getAttribute('aria-label').includes('冻结'));p.seek(610);assert.equal(nodes[0].querySelector('.minion-status').innerHTML,'❄');});
test('restore and clear return actual final display without touching rules',()=>{const {p,nodes}=mocked();p.seek(0);p.restore();assert.equal(nodes[0].classList.contains('frozen'),true);assert.equal(p.active,false);p.seek(0);p.clear();assert.equal(nodes[0].classList.contains('frozen'),true);assert.deepEqual(p.checkpoints,[]);});
test('DOM node replacement is reprojected without stale references',()=>{const {p,nodes}=mocked();p.seek(0);nodes[0]=mockNode('a',after['e:a']);p.seek(0);assert.equal(nodes[0].classList.contains('frozen'),false);});
test('removed DOM target is not recreated',()=>{const {p,nodes}=mocked();p.seek(0);nodes.length=0;p.seek(700);p.restore();assert.equal(nodes.length,0);});
test('helper is export-only, not registered into production',()=>{const fs=require('node:fs');assert.ok(!fs.readFileSync('config/build.json','utf8').includes('replay-state'));assert.ok(fs.readFileSync('tools/vfx3/export_demo.py','utf8').includes("['replay-state.js', 'lab.js']"));});
