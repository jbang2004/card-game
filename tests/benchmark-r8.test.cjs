/* Additional design/invariant gates for R8, not a subjective quality score. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const B=require('../src/vfx3/benchmark-arts.js'),RT=require('../src/vfx3/runtime.js');
const from={x:668,y:459,w:116,h:146},to={x:932,y:295,w:116,h:146};
const desc=(style,opts={})=>RT.descriptor('slash',{from,to,swordStyle:style,startedAt:1000,contactAt:1340,timeScale:1,seed:388,...opts});
const frame=(style,q,low=false)=>B.sample(desc(style),.34+q,1600,940,low);
for(const style of ['judgment','night','frost']){
 test(`R8 ${style}: additional polygon layers have finite coordinates and clean lifecycle`,()=>{
  for(let t=-.1;t<2.3;t+=.014){const f=B.sample(desc(style),t);for(const p of f.polygons)for(const v of p.points.flat())assert.ok(Number.isFinite(v));}
  const f=B.sample(desc(style),3);assert.equal(f.polygons.length,0);
 });
 test(`R8 ${style}: contact peak stays legible for a bounded time then fully decays`,()=>{
  const short=style==='night';assert.equal(B.contactEnvelope(-.001,short),0);
  assert.equal(B.contactEnvelope(.01,short),1);
  assert.ok(B.contactEnvelope(.035,short)>(short?.5:.99));
  assert.ok(B.contactEnvelope(.32,short)<.005);
 });
 test(`R8 ${style}: rigid target feedback now includes a bounded rotation`,()=>{
  const p=B.reaction(desc(style),.39);assert.ok(Math.abs(p.target[2])>.4);assert.ok(Math.abs(p.target[2])<1.6);
  const before=B.reaction(desc(style),.33);assert.ok(before.target.every(v=>Math.abs(v)<1e-12));
 });
}
test('R8 holy: wide authored face and broad solid sigil, not only hairline circles',()=>{
 const f=frame('judgment',.02),b=f.ribbons.find(x=>x.material===13);
 assert.ok(Math.max(...b.widths)>to.w*.19);assert.ok(f.polygons.length>=8);
 assert.ok(f.lines.some(x=>x.width>=1));
});
test('R8 ice: folded silhouette differs from the smooth holy blade',()=>{
 const h=frame('judgment',0).ribbons.find(x=>x.material===13),i=frame('frost',0).ribbons.find(x=>x.material===14);
 assert.notDeepEqual(h.widths,i.widths);let changes=0;for(let n=1;n<i.widths.length-1;n++)if((i.widths[n]-i.widths[n-1])*(i.widths[n+1]-i.widths[n])<0)changes++;
 assert.ok(changes>=2);
});
test('R8 ice: at least one legible large crystal, plus local irregular frost plate',()=>{
 const f=frame('frost',.19);assert.ok(f.shards.some(s=>s.size>=6));
 const p=f.plates.find(p=>p.material===16);assert.ok(p&&p.w<=to.w*.9&&p.h<=to.h*.7);
});
test('R8 shadow: opaque dark incision remains after projectile, no radial fracture substitution',()=>{
 const f=frame('night',.23);assert.equal(f.cracks.length,0);
 assert.ok(f.ribbons.some(b=>b.material===15&&!b.add&&Math.max(...b.widths)>4));
 assert.ok(!f.polygons.length);assert.ok(!f.plates.length);
});
test('R8 spectral blade dissolves by material, not solely global opacity',()=>{
 for(const s of ['judgment','frost']){
  const mode=s==='frost'?14:13;
  const a=frame(s,.025).ribbons.find(b=>b.material===mode),b=frame(s,.23).ribbons.find(b=>b.material===mode);
  assert.equal(a.dissolve,0);assert.ok(b.dissolve>.3&&b.dissolve<1);
 }
});
test('R8 same immutable input is repeatable including polygons and material erosion',()=>{
 const d=desc('frost'),before=JSON.stringify(d),f=JSON.stringify(B.sample(d,.55));
 for(let t=0;t<1.5;t+=.019)B.sample(desc('night'),t);
 assert.equal(JSON.stringify(B.sample(d,.55)),f);assert.equal(JSON.stringify(d),before);
});
test('R8 low mode retains front shape and sigil, only reduces secondary elements',()=>{
 for(const s of ['judgment','frost','night']){const a=frame(s,.09),b=frame(s,.09,true);
  assert.equal(a.polygons.length,b.polygons.length);assert.ok(b.shards.length<=a.shards.length);assert.ok(b.particles.length<=a.particles.length);
 }
});
