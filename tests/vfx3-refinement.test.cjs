const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../src/vfx3/runtime.js');
const A={x:668,y:459,w:116,h:146},B={x:932,y:295,w:116,h:146};
const desc=(kind,scale=1)=>E.descriptor(kind,{from:A,to:B,startedAt:0,contactAt:180,hitStopMs:50,timeScale:scale,seed:67});
function geometryRuntime(){
 const ctx={console,Math,Float32Array,performance:{now:()=>0}};ctx.window=ctx;vm.createContext(ctx);
 const core=fs.readFileSync('src/vfx3/renderer.js','utf8').split('(function(X)')[0];vm.runInContext(core,ctx);
 ctx.Ember3D.Renderer=class{constructor(){this.geo={plane:{}};this.dynamic={};}mesh(data){return{data,n:data.length/8}}resize(){}camera(){}};
 vm.runInContext(fs.readFileSync('src/vfx3/skyfall.js','utf8'),ctx);vm.runInContext(fs.readFileSync('src/vfx3/benchmark-arts.js','utf8'),ctx);vm.runInContext(fs.readFileSync('src/vfx3/sword-arts.js','utf8'),ctx);vm.runInContext(fs.readFileSync('src/vfx3/runtime.js','utf8'),ctx);return ctx.EmberVFX3.create({});
}
test('sky strike accelerates down, holds contact, then fades in place',()=>{
 const d=desc('slash'),a=E.cleaveMotion(d,.07),b=E.cleaveMotion(d,.13),c=E.cleaveMotion(d,.18);
 assert.ok(a.drop<b.drop&&b.drop<c.drop);assert.equal(c.drop,1);assert.equal(c.angle,Math.PI);
 for(const t of [.18,.20,.225]){const s=E.cleaveMotion(d,t);assert.equal(s.drop,1);assert.equal(s.angle,Math.PI);}
 for(const t of [.24,.35,.55])assert.ok(Math.abs(E.cleaveMotion(d,t).angle-Math.PI)<.10);
});
test('rigid blade length remains invariant throughout descent and recovery',()=>{
 const rt=geometryRuntime(),d=desc('slash'),lengths=[];
 for(let t=0;t<.9;t+=.004){const p=rt._swordPose(d,t);lengths.push(Math.hypot(...p.tip.map((v,i)=>v-p.root[i])));}
 assert.ok(Math.max(...lengths)-Math.min(...lengths)<.001);
});
test('blade tip strikes the reference plane at the exact authoritative contact time',()=>{
 const rt=geometryRuntime(),d=desc('slash'),p=rt._swordPose(d,.18);
 assert.ok(Math.hypot(...p.tip.map((v,i)=>v-p.target[i]))<.001);
 const first=rt._swordPose(d,0);assert.ok(first.tip[1]>p.tip[1]);
});
test('sky blade keeps its dimensions at 0.5x time compression',()=>{
 const rt=geometryRuntime(),d=desc('slash',.5),base=rt._swordPose(d,.18);
 for(const t of [.08,.14,.18,.22]){const p=rt._swordPose(d,t);assert.equal(p.L,base.L);}
});
test('planted tip cannot drift during the heavy-contact hold',()=>{
 const rt=geometryRuntime(),d=desc('slash'),tip=rt._swordPose(d,.18).tip;
 for(const t of [.19,.205,.23])assert.deepEqual(rt._swordPose(d,t).tip,tip);
});
test('fracture grows from centre and opens monotonically, not before contact',()=>{
 let growth=0,open=0;
 for(let t=0;t<=.18;t+=.003){const p=E.fractureAt(t);assert.ok(p.growth>=growth&&p.open>=open);growth=p.growth;open=p.open;}
 assert.equal(E.fractureAt(0).open,0);assert.equal(E.fractureAt(0).growth,0);assert.equal(E.fractureAt(1).fade,0);
});
test('new flame has launch, propagation, sustain and distinct nonblocking cleanup',()=>{
 const d=desc('breath'),c=E.breathClock(d,.4);assert.ok(c.launch<c.hit);assert.ok(c.travel>0);
 assert.ok(Math.abs(c.launch+c.travel-c.hit)<1e-10);assert.ok(c.stop>c.hit+.4);
 assert.ok(d.tail>=(c.stop-c.hit+.5)*1000);
});
test('zero flight duration is well-defined and does not divide by zero',()=>{
 const d=E.descriptor('breath',{from:A,to:A,startedAt:0,contactAt:0}),c=E.breathClock(d,0);
 assert.ok(c.travel>0);assert.ok(Number.isFinite(c.stop));
});
test('natural tail is scaled without moving the supplied rule deadline',()=>{
 for(const kind of ['breath','slash'])for(const scale of [.25,.5,1]){const d=desc(kind,scale);assert.equal(d.impact,180);assert.equal(d.tail,E.TAIL[kind]*scale);}
});
test('sky cleave and fracture queries are order independent',()=>{
 const d=desc('slash'),before=JSON.stringify(d),a=E.cleaveMotion(d,.12);E.cleaveMotion(d,.80);E.fractureAt(.7);
 assert.deepEqual(E.cleaveMotion(d,.12),a);assert.equal(JSON.stringify(d),before);
});
test('flame source has no continuous closed cone shell',()=>{
 const src=fs.readFileSync('src/vfx3/runtime.js','utf8'),section=src.slice(src.indexOf(' function fire('),src.indexOf(' function draw(now)'));
 assert.ok(!section.includes('mesh(shell'));assert.ok(section.includes('plumes.sort'));assert.ok(section.includes('Ref.sample')); 
});
