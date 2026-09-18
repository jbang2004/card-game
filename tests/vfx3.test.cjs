const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../src/vfx3/runtime.js');
const A={x:360,y:450,w:116,h:146},B={x:750,y:280,w:116,h:146};
for(const kind of ['breath','lightning','slash','bolt'])test(`mesh3d ${kind}: immutable deterministic clock`,()=>{
 const opts={from:A,to:B,startedAt:100,contactAt:350,seed:12};let copy=JSON.stringify(opts),d=E.descriptor(kind,opts,99);
 assert.deepEqual(E.descriptor(kind,opts,600),d);assert.equal(JSON.stringify(opts),copy);
 assert.equal(E.sample(d,349).phase,'释放');assert.equal(E.sample(d,350).phase,'命中');assert.equal(E.sample(d,350+d.tail).alive,false);
 assert.deepEqual(E.sample(d,380),E.sample(d,380));assert.equal(E.sample(d,99).alive,false);
});
test('invalid and non-supported input cannot start a scene',()=>{
 assert.equal(E.descriptor('other',{from:A,to:B}),null);
 for(const n of [NaN,Infinity])assert.equal(E.descriptor('slash',{from:{...A,x:n},to:B}),null);
 assert.equal(E.descriptor('slash',{from:{...A,w:0},to:B}),null);
});
test('descriptor copies input boxes and tint',()=>{let tint=[1,.5,.2],o={from:{...A},to:{...B},tint};let d=E.descriptor('breath',o);o.from.x=-7;tint[0]=0;assert.equal(d.from.x,A.x);assert.equal(d.tint[0],1);});
test('a supplied absolute contact deadline wins over an estimated lead',()=>{let d=E.descriptor('slash',{from:A,to:B,startedAt:100,contactAt:240,leadMs:400});assert.equal(d.impact,240);});
test('quality scale shortens tails without changing explicit contact events',()=>{let d=E.descriptor('breath',{from:A,to:B,contactAt:300,timeScale:.5});assert.equal(d.tail,E.TAIL.breath*.5);assert.equal(d.impact,300);});
test('renderer really uses 3D vertices, normals, camera matrices and depth',()=>{let s=fs.readFileSync('src/vfx3/renderer.js','utf8');for(let text of ['attribute vec3 aPos','attribute vec3 aNormal','gl.DEPTH_TEST','uVP','uModel'])assert.ok(s.includes(text));});
test('clear frame is transparent and alpha accumulation is separate from RGB',()=>{let s=fs.readFileSync('src/vfx3/renderer.js','utf8');assert.ok(s.includes('gl.clearColor(0,0,0,0)'));assert.ok(s.includes('blendFuncSeparate'));assert.ok(s.includes('premultipliedAlpha:false'));});
test('new renderers do not own an animation loop or change rule state',()=>{for(const path of ['src/vfx3/renderer.js','src/vfx3/runtime.js']){let s=fs.readFileSync(path,'utf8');assert.ok(!s.includes('requestAnimationFrame('));assert.ok(!s.includes('EmberDebug'));assert.ok(!s.includes('game.dispatch'));}});
test('integration routes selected kinds exclusively and cleans both renderers',()=>{let s=fs.readFileSync('src/presentation/fx-stage.js','utf8');assert.ok(s.includes('EmberVFX3.supports(kind)'));assert.ok(s.includes('EmberVFX3.supports(family)'));assert.ok(s.includes('meshEngine?.clear()'));assert.ok(s.includes('meshEngine?.setQuality(quality)'));});
test('renderer is registered ahead of the stage adapter',()=>{let t=fs.readFileSync('src/template.html','utf8');assert.ok(t.indexOf('/*MESH_RENDERER*/')<t.indexOf('/*MESH_RUNTIME*/'));assert.ok(t.indexOf('/*MESH_RUNTIME*/')<t.indexOf('/*SPELL_STAGE*/'));});
