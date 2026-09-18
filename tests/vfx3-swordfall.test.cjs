/* R5 specification: offscreen vertical insertion, unchanged rules, card-local
 * fissures, stable material/geometry, no regressions to the approved R4 flame. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const E=require('../src/vfx3/runtime.js');
const from={x:668,y:459,w:116,h:146},to={x:932,y:295,w:116,h:146};
const d=(options={})=>E.descriptor('slash',{from,to,startedAt:0,contactAt:260,timeScale:1,hitStopMs:0,seed:679,...options});
function geom(){const c={console,Math,Float32Array,performance:{now:()=>0}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync('src/vfx3/renderer.js','utf8').split('(function(X)')[0],c);
 c.Ember3D.Renderer=class{constructor(){this.geo={plane:{}};this.dynamic={}}mesh(data){return{data,n:data.length/8}}resize(){}camera(){}};
 vm.runInContext(fs.readFileSync('src/vfx3/runtime.js','utf8'),c);return c.EmberVFX3.create({});}
const near=(a,b,e=.001)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('R5 full blade starts outside the top of the stage at every aspect ratio',()=>{
 const r=geom();for(const [w,h] of [[1600,940],[390,844],[844,390],[1920,1080]]){
  r.stage(w,h);const a=d({to:{x:w*.65,y:h*.40,w:Math.min(w*.14,116),h:146}}),p=r._swordPose(a,0);
  assert.ok(p.tip[1]>h/2+30);assert.ok(p.root[1]>p.tip[1]);assert.equal(p.motion.visibility,0);
 }
});
test('R5 X coordinate and blade angle remain constant throughout flight',()=>{
 const r=geom();for(const a of [d(),d({from:{...from,x:1300}})]){
  const x=r._swordPose(a,0).tip[0];for(let t=0;t<.26;t+=.002){const p=r._swordPose(a,t);near(p.tip[0],x);near(p.motion.angle,Math.PI);}
 }
});
test('R5 visible descent consumes only last 160ms of a longer attack windup',()=>{
 const a=d({contactAt:640}),q=E.cleaveMotion(a,.4);assert.equal(q.visibility,0);near(q.enter,.48);near(q.flight,.16);
 assert.ok(E.cleaveMotion(a,.50).visibility>0);assert.equal(E.cleaveMotion(a,.64).drop,1);
});
test('R5 descent gains speed rather than easing to a soft landing',()=>{
 const a=d(),q=t=>E.cleaveMotion(a,t).drop;
 assert.ok(q(.25)-q(.23)>q(.14)-q(.12));
});
test('R5 target is inside card portrait, not the reference floor',()=>{
 const r=geom(),a=d(),p=r._swordPose(a,.26);near(p.tip[1],940/2-(to.y-to.h*.055));
 assert.ok(Math.abs(p.tip[1]-(940/2-to.y))<to.h*.2);
});
test('R5 exact absolute deadline survives nonzero start and time compression',()=>{
 const r=geom();for(const scale of [.1,.25,.5,1]){
  const a=d({startedAt:600,contactAt:600+260*scale,timeScale:scale}),p=r._swordPose(a,.260*scale);
  near(p.tip[0],p.target[0]);near(p.tip[1],p.target[1]);near(p.tip[2],p.target[2]);
 }
});
test('R5 no lateral yaw or withdrawal during embedded dissolve',()=>{
 const r=geom(),a=d(),first=r._swordPose(a,.26);
 for(let t=.26;t<1;t+=.007){const p=r._swordPose(a,t);p.tip.forEach((x,i)=>near(x,first.tip[i]));assert.equal(p.motion.yaw,first.motion.yaw);}
});
test('R5 degenerate immediate deadline and tiny cards are finite',()=>{
 const r=geom();for(const a of [d({contactAt:0}),d({to:{...to,w:1,h:1}})]){
  for(const t of [0,.05,.3,.9]){const p=r._swordPose(a,t);[...p.mat,...p.tip].forEach(x=>assert.ok(Number.isFinite(x)));}
 }
});
test('R5 rigid root-to-tip distance is unchanged across all phases',()=>{
 const r=geom();for(const w of [52,116,230]){
  const a=d({to:{...to,w}}),length=[];for(let t=0;t<1.1;t+=.003){const p=r._swordPose(a,t);length.push(Math.hypot(...p.tip.map((x,i)=>x-p.root[i])));}
  assert.ok(Math.max(...length)-Math.min(...length)<.001);
 }
});
test('R5 fracture paths stay within a protected portrait rectangle',()=>{
 for(let seed=0;seed<100;seed++)for(const path of E.cardFracturePaths(seed))for(const [x,y] of path.points){
  assert.ok(Math.abs(x)<=.44501);assert.ok(y>=-.42001&&y<=.43001);
 }
});
test('R5 main fractures originate at puncture and branch from existing fissures',()=>{
 const p=E.cardFracturePaths(19),main=p.filter(p=>!p.branch);assert.equal(main.length,8);
 for(const line of main)assert.deepEqual(line.points[0],[0,0]);
 for(const line of p.filter(p=>p.branch))assert.ok(main.some(m=>m.points.some(q=>q[0]===line.points[0][0]&&q[1]===line.points[0][1])));
});
test('R5 cracks are absent before contact, grow monotonically and clear',()=>{
 assert.equal(E.fractureAt(-.1).growth,0);assert.equal(E.fractureAt(-.1).open,0);
 let prev=0;for(let t=0;t<=.18;t+=.001){let v=E.fractureAt(t).growth;assert.ok(v>=prev);prev=v;}
 assert.equal(E.fractureAt(E.SWORDFALL.crackEnd).fade,0);
});
test('R5 deterministic seed affects geometry, not contact target or timing',()=>{
 const a=E.cardFracturePaths(12),b=E.cardFracturePaths(44);assert.notDeepEqual(a,b);assert.deepEqual(a,E.cardFracturePaths(12));
 const r=geom();assert.deepEqual(r._swordPose(d({seed:12}),.26).tip,r._swordPose(d({seed:44}),.26).tip);
});
test('R5 target reference is copied and presentation remains rule-independent',()=>{
 const ref={side:'e',uid:'u1'},a=d({targetRef:ref});ref.uid='u2';assert.equal(a.targetRef.uid,'u1');
 const s=fs.readFileSync('src/vfx3/runtime.js','utf8');for(const word of ['game.dispatch','.hp=','game.s','requestAnimationFrame(','setTimeout('])assert.ok(!s.includes(word));
});
test('R5 live attachment is disabled in replay and null targets do not leave ghost cracks',()=>{
 const s=fs.readFileSync('src/vfx3/runtime.js','utf8');assert.ok(s.includes('!manual&&state.after>=0&&d.targetRef'));
 assert.ok(s.includes('if(!valid(target))continue;'));
});
test('R5 preserves exact approved R4 fire and renderer source hashes',()=>{
 const expected={'src/vfx3/reference-flame.js':'13760d9670d88ec107a0e5830411f8f4c467ad1a9897853d6e576a27e32597e8','src/vfx3/renderer.js':'196671e5e066e0555cab5317564ff39ce84bccbaff5ef81a343c94ea77b6bfcf'};
 for(const [p,sha] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sha);
});
test('R5 source card summons instead of duplicating sword impact with a lunge',()=>{
 const s=fs.readFileSync('src/effects.js','utf8');assert.ok(s.includes('preSpec?.fx === "slash" && rec.meshPrelude'));
 assert.ok(s.includes('targetRef: e.to'));assert.ok(s.includes('else lunge(ctx, beat, i, e.from, actorBox, targetBox, old)'));
});
test('R5 target tracking compensates for shared canvas camera transform',()=>{
 const s=fs.readFileSync('src/presentation/fx-stage.js','utf8');assert.ok(s.includes('resolveTarget: resolveMeshTarget'));
 assert.ok(s.includes('app.left+box.x*sx-c.left'));assert.ok(s.includes('targetRef: o.targetRefs?.[i] || null'));
});
