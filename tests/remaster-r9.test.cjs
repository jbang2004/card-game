const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const A=require('../src/vfx3/remaster-arts.js'),E=require('../src/vfx3/runtime.js'),Q=require('../src/vfx3/remaster-cues.js');
const box={x:510,y:458,w:116,h:146},target={x:928,y:286,w:116,h:146};
const desc=(kind,scale=1)=>E.descriptor(kind,{from:box,to:target,startedAt:1000,contactAt:1000+300*scale,timeScale:scale,seed:19});
function finite(v){if(typeof v==='number')assert.ok(Number.isFinite(v));else if(Array.isArray(v))v.forEach(finite);else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
function primitives(f){return f.meshes.length+f.ribbons.length+f.lines.length+f.particles.length+f.sprites.length+f.glows.length;}
for(const k of Object.keys(A.DEFINITIONS)){
 test(k+': registered actual runtime route and family lifetime',()=>{const d=desc(k);assert.ok(E.supports(k));assert.equal(d.kind,k);assert.equal(d.tail,A.DEFINITIONS[k].tail);});
 test(k+': finite geometry for 3 card sizes, both attack directions and 3 time scales',()=>{for(const w of [48,116,210])for(const sg of [-1,1])for(const sc of [.1,.5,1]){const d=desc(k,sc);d.from={...box,x:target.x+sg*200};d.to={...target,w,h:w*1.25};for(const q of [-.24,-.06,0,.035,.20,.55])finite(A.sample(d,.30*sc+q*sc,1600,940,false));}});
 test(k+': arbitrary seek deterministic without input mutation',()=>{const d=desc(k),before=JSON.stringify(d),a=A.sample(d,.345);A.sample(d,.75);A.sample(d,.015);assert.deepEqual(A.sample(d,.345),a);assert.equal(JSON.stringify(d),before);});
 test(k+': ends empty and does not emit before activation',()=>{const d=desc(k);assert.equal(primitives(A.sample(d,-1)),0);const f=A.sample(d,.3+d.tail/1000+1);assert.equal(primitives(f),0);assert.equal(f.alive,false);});
 test(k+': full and low modes contain real draw primitives',()=>{const d=desc(k);assert.ok(primitives(A.sample(d,.40))>0);assert.ok(primitives(A.sample(d,.40,1600,940,true))>0);});
 test(k+': deterministic audio, bounded sample output, authoritative impact',()=>{const d=desc(k),events=Q.events(d);assert.equal(events.length,4);assert.equal(events.find(e=>e.id==='impact').at,d.impact);for(const c of ['charge','launch','impact','tail']){const x=Q.pcm(k,c,16000);assert.deepEqual(Q.pcm(k,c,16000),x);assert.ok(x.length>0&&x.some(v=>Math.abs(v)>.001));assert.ok(x.every(v=>Number.isFinite(v)&&Math.abs(v)<=.82));}});
}
test('arrow and spear shafts invariant over the entire flight and attachment',()=>{for(const k of ['arrow','spear']){const d=desc(k);let lengths=new Set();for(let t=.11;t<.70;t+=.003){const f=A.sample(d,t);lengths.add(f.projectile.shaft);}assert.equal(lengths.size,1);}});
test('arrow tip meets target hit surface at exact authority contact',()=>{for(const k of ['arrow','spear']){const d=desc(k),f=A.sample(d,.30);assert.ok(Math.abs(f.tip[0]-(d.to.x-800))<.001);assert.ok(Math.abs(f.tip[1]-(470-d.to.y-d.to.h*.035))<.001);}});
test('no damaged surface before a projectile reaches contact',()=>{const d=desc('arrow');const f=A.sample(d,.299);assert.ok(!f.meshes.some(o=>o.color[0]===.02&&o.color[1]===.014));});
test('semantic routing separates healing, ward, buff and summon from damage',()=>{assert.equal(A.resolve('nature','renew'),'heal');assert.equal(A.resolve('holy','shield'),'ward');assert.equal(A.resolve('holy','blessing'),'buff');assert.equal(A.resolve('nature','wolves'),'summon');assert.equal(A.resolve('fireball','fireball'),'fireball');});
test('visual-only and secondary AoE instances schedule no extra sounds',()=>{for(const k of Object.keys(A.DEFINITIONS)){assert.deepEqual(Q.events({...desc(k),silent:true}),[]);assert.deepEqual(Q.events({...desc(k),visualOnly:true}),[]);}});
test('new samplers cannot access rules, DOM or timers',()=>{const s=fs.readFileSync('src/vfx3/remaster-arts.js','utf8');for(const x of ['.dispatch(','.hp=','game.s','setTimeout(','document.','Math.random('])assert.ok(!s.includes(x),x);});
test('user-approved R8 and original flame files kept byte-identical',()=>{const j=JSON.parse(fs.readFileSync('docs/qa/remaster-r9-baseline.json'));for(const [p,h] of Object.entries(j))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,p);});
test('build registers remaster modules before runtime without duplicated placeholders',()=>{const r=JSON.parse(fs.readFileSync('config/build.json')),html=fs.readFileSync('src/template.html','utf8');for(const key of ['REMASTER_ARTS','REMASTER_CUES','REMASTER_FEEDBACK']){assert.ok(r[key]);assert.ok(html.indexOf('/*'+key+'*/')<html.indexOf('/*MESH_RUNTIME*/'));assert.equal(html.split('/*'+key+'*/').length,2);}});
test('terminal frame clears after normalizing large fractional absolute host clocks',()=>{
 for(const k of ['arrow','spear','slam','summon'])for(const n of [10599.663234,526153.17264851,9461376.666833]){
  const d=E.descriptor(k,{from:box,to:target,startedAt:n,contactAt:n+262.662524801177,timeScale:.7});
  const origin=n-140.21231465,end=(d.impact+d.tail)-origin;
  const normalized={...d,start:d.start-origin,impact:d.impact-origin};
  assert.equal(E.sample(normalized,end).alive,false,k);
 }
});
test('support identities follow real rules rather than misleading card names',()=>{
 assert.equal(A.resolve('holy','absolution'),'ward');assert.equal(A.resolve('holy','rally'),'buff');
 assert.equal(A.resolve('nature','huntinghorn'),'buff');assert.equal(A.resolve('nature','battlecry'),'buff');
});

test('explicit-target casts without damage contacts retain their actual target',()=>{
 const s=fs.readFileSync('src/effects.js','utf8');
 assert.ok(s.includes('EmberData.byId[sourceCid]?.target && sourceEvent?.target'));
 assert.ok(s.includes('targetRefs = [ref]'));assert.ok(s.includes('contactAt = [cast.startAt + cast.duration]'));
 assert.ok(s.includes('targetRefs: resolved.map(x => x.ref)'));
});
