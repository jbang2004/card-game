/* Perceptual readability invariants, not claims of commercial art certification. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const A=require('../src/vfx3/remaster-arts.js'),Engine=require('../src/vfx3/runtime.js');
const make=(kind,extra={})=>Engine.descriptor(kind,{from:{x:545,y:570,w:116,h:146},to:{x:950,y:300,w:116,h:146},startedAt:1000,contactAt:1320,timeScale:1,seed:17,...extra});
const count=f=>['meshes','ribbons','lines','sprites','glows','particles'].reduce((n,k)=>n+f[k].length,0);
test('R10 contact peak is single, nonflashing and absent before contact',()=>{
 assert.equal(A.contactEnvelope(-.001),0);assert.equal(A.contactEnvelope(0),1);assert.equal(A.contactEnvelope(.06),1);
 let last=1;for(let q=.062;q<1;q+=.003){const v=A.contactEnvelope(q);assert.ok(v<=last+1e-10);last=v;}
 assert.ok(A.contactEnvelope(.12)>.4);assert.ok(A.contactEnvelope(.5)<.01);
});
test('R10 crowd budget attenuates decorative glows but retains primary geometry',()=>{
 const d=make('fireball'),single=A.sample({...d,crowd:1},.42),many=A.sample({...d,crowd:7},.42);
 assert.deepEqual(many.meshes,single.meshes);assert.deepEqual(many.ribbons,single.ribbons);assert.deepEqual(many.sprites,single.sprites);
 assert.equal(many.glows.length,single.glows.length);assert.ok(many.glows.every((g,i)=>g.alpha<=single.glows[i].alpha));
 assert.ok(A.crowdBudget(100)>=.42);assert.equal(A.crowdBudget(1),1);
});
for(const kind of Object.keys(A.DEFINITIONS)){
 test('R10 '+kind+' clear low-quality silhouette and bounded draw primitives',()=>{
  const d=make(kind);for(const q of [.02,.07,.16,.31]){const hi=A.sample(d,.32+q),low=A.sample(d,.32+q,1600,940,true);
   assert.ok(count(hi)>0&&count(low)>0);assert.ok(count(hi)<600);assert.ok(count(low)<=count(hi));}
 });
}
test('R10 physical projectiles stay rigid with larger readable shaft',()=>{
 for(const kind of ['arrow','spear']){const d=make(kind),frames=[.17,.22,.29,.32,.42,.55].map(t=>A.sample(d,t));
  assert.ok(frames.every(f=>f.projectile.shaft===frames[0].projectile.shaft));
  assert.ok(frames[0].projectile.shaft>=(kind==='arrow'?90:130));
 }
});
test('R10 fire lobes have distinct parcel phases and shaped rather than identical square sprites',()=>{
 const f=A.sample(make('fireball'),.45),fire=f.sprites.filter(s=>s.mode===8);
 assert.ok(fire.length>=6&&fire.length<=12);assert.equal(new Set(fire.map(s=>s.seed)).size,fire.length);
 assert.ok(fire.every(s=>s.aspect>0&&s.aspect<1));
});
test('R10 frost uses actual optical facet material and uneven growing shards',()=>{
 const f=A.sample(make('frost-field'),.47);
 assert.ok(f.meshes.some(m=>m.mode===14));
 assert.ok(new Set(f.meshes.filter(m=>m.mode===14).map(m=>JSON.stringify(m.points))).size>5);
});
test('R10 ward has opaque tinted faces as well as a luminous border',()=>{
 const f=A.sample(make('ward'),.51);
 assert.ok(f.meshes.filter(m=>!m.add&&m.alpha>.10).length>=6);assert.ok(f.lines.some(m=>m.width>=2.4));
});
test('R10 amplification never moves contact timestamps or rule state fields',()=>{
 for(const kind of Object.keys(A.DEFINITIONS)){const d=make(kind),saved=JSON.stringify(d);for(const t of [0,.1,.32,.6,2])A.sample(d,t);
  assert.equal(JSON.stringify(d),saved);assert.equal(d.impact,1320);}
});
test('R10 response is rigid, bounded and has no recovery oscillation',()=>{
 for(const k of ['arrow','spear','claw','slam','fireball','frost','void','siphon']){
  const d=make(k);for(let t=0;t<1.4;t+=.005){const r=A.reaction(d,t);assert.ok(Math.hypot(...r.target.slice(0,2))<15);
   assert.ok(Math.abs(r.target[2])<=3.4);assert.ok(r.targetLight<=.18);}
 }
});
test('R10 intensity work leaves approved flame, three benchmarks, renderer and rules exact',()=>{
 const baseline=JSON.parse(fs.readFileSync('docs/qa/remaster-r9-baseline.json'));
 for(const [path,hash] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,path);
});
