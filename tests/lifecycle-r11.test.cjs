const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const A=require('../src/vfx3/lifecycle-arts.js'),V=require('../src/vfx3/runtime.js');
const box={x:760,y:300,w:116,h:146},from={x:430,y:650,w:116,h:146};
const d=(kind,scale=1)=>V.descriptor(kind,{from,to:box,startedAt:1000,contactAt:1320,timeScale:scale,visualOnly:true,seed:719});
function valid(v){if(typeof v==='number')assert.ok(Number.isFinite(v));else if(Array.isArray(v))v.forEach(valid);else if(v&&typeof v==='object')Object.values(v).forEach(valid);}
function count(f){return ['meshes','ribbons','lines','sprites','glows','particles'].reduce((n,k)=>n+f[k].length,0);}
for(const name of Object.keys(A.DEFINITIONS)){
 test(name+': real runtime registration and finite lifetime',()=>{const x=d(name);assert.equal(x.kind,name);assert.equal(x.lifecycle,true);assert.equal(x.tail,A.DEFINITIONS[name].tail);});
 test(name+': nothing before event and clean exact final frame',()=>{const x=d(name);assert.equal(count(A.sample(x,.319)),0);assert.equal(count(A.sample(x,.32+x.tail/1000)),0);assert.equal(count(A.sample(x,2)),0);});
 test(name+': nonempty normal and reduced-density geometry',()=>{for(const low of [false,true])assert.ok(count(A.sample(d(name),.52,1600,940,low))>0);});
 test(name+': deterministic independent seeking',()=>{const x=d(name),before=JSON.stringify(x),a=A.sample(x,.53);A.sample(x,.81);A.sample(x,.1);assert.deepEqual(A.sample(x,.53),a);assert.equal(JSON.stringify(x),before);});
 test(name+': finite for portrait, landscape, both sides and time compression',()=>{for(const w of [38,116,250])for(const sc of [.1,.5,1])for(const sg of [-1,1]){const x=d(name,sc);x.to={...box,w,h:w*1.25};x.from={...from,x:box.x+sg*220};for(const q of [0,.05,.2,.49,.7])valid(A.sample(x,.32+q*sc,844,390));}});
}
test('explicit events are not confused with gained states',()=>{assert.equal(A.kindFor({type:'shield'}),'shield-break');assert.equal(A.kindFor({type:'status',kind:'grant',tag:'shield'}),null);assert.equal(A.kindFor({type:'status',kind:'freeze'}),null);assert.equal(A.kindFor({type:'status',kind:'thaw'}),'thaw');assert.equal(A.kindFor({type:'summon',rebornFrom:'old'}),'rebirth');assert.equal(A.kindFor({type:'weaponWear',broken:false}),null);});
test('sampler does not mutate gameplay or start independent clocks',()=>{const s=fs.readFileSync('src/vfx3/lifecycle-arts.js','utf8');for(const word of ['setTimeout(','requestAnimationFrame(','.dispatch(','.hp=','Math.random(','document.'])assert.ok(!s.includes(word),word);});
test('new states remain additions, approved baseline is unchanged',()=>{const h=JSON.parse(fs.readFileSync('docs/qa/remaster-r9-baseline.json'));for(const [p,sha]of Object.entries(h))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sha,p);});
test('host integration routes explicit shield loss rather than playing ward gain',()=>{const s=fs.readFileSync('src/effects.js','utf8');assert.ok(s.includes('lifeCue(ctx,event,"shield-break",box)'));assert.ok(s.includes('lifeCue(ctx,landed,"rebirth",box)'));assert.ok(s.includes('ctx.lifecycleSeen.has(key)'));});
test('new modules precede runtime and are registered exactly once',()=>{const r=JSON.parse(fs.readFileSync('config/build.json')),s=fs.readFileSync('src/template.html','utf8');for(const k of ['LIFECYCLE_ARTS','LIFECYCLE_FEEDBACK','LIFECYCLE_STYLE']){assert.ok(r[k]);assert.equal(s.split('/*'+k+'*/').length,2);}assert.ok(s.indexOf('/*LIFECYCLE_ARTS*/')<s.indexOf('/*MESH_RUNTIME*/'));});
function fakeRuntime(){
 const vm=require('node:vm'),c={console,Math,Float32Array,performance:{now:()=>0}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync('src/vfx3/renderer.js','utf8').split('(function(X)')[0],c);
 c.Ember3D.Renderer=class{constructor(){this.geo={plane:{}};this.dynamic={};}mesh(data){return{data,n:data.length/8};}resize(){}camera(){}};
 for(const file of ['skyfall','benchmark-arts','sword-arts','remaster-arts','lifecycle-arts','runtime'])vm.runInContext(fs.readFileSync('src/vfx3/'+file+'.js','utf8'),c);
 return c.EmberVFX3.create({});
}
test('independent lifecycle cues never pollute primary attack trace',()=>{
 const r=fakeRuntime(),o={from,to:box,startedAt:100,contactAt:250,sequenceId:3};r.emit('frost',o);r.emit('thaw',{...o,visualOnly:true,groupId:'life-3'});
 assert.equal(r.trace.length,1);assert.equal(r.last.kind,'frost');assert.equal(r.lastGroup.length,1);assert.equal(r.lifecycleTrace.length,1);assert.equal(r.replayGroup.length,2);
});
test('late unrelated turn or draw cue is not replayed with an earlier attack',()=>{
 const r=fakeRuntime(),o={from,to:box,startedAt:100,contactAt:250,sequenceId:3};r.emit('frost',o);r.emit('draw-arrive',{...o,sequenceId:4,visualOnly:true,groupId:'life-4'});
 assert.equal(r.lastGroup.length,1);assert.equal(r.replayGroup.length,1);assert.equal(r.lastLifecycleGroup.length,1);
});
test('normal group replay includes only cues from the same presentation sequence',()=>{
 const r=fakeRuntime(),o={from,to:box,startedAt:100,contactAt:250,sequenceId:3};r.emit('frost',o);r.emit('thaw',{...o,visualOnly:true,groupId:'life-3'});r.emit('draw-arrive',{...o,sequenceId:4,visualOnly:true,groupId:'life-4'});
 assert.deepEqual(Array.from(r.replayGroup,x=>x.kind),['frost','thaw']);
});
test('artwork position and old card identity are immutable descriptor inputs',()=>{
 const o={from,to:box,previousCid:'treant',artPosition:'50% 23%',sequenceId:9},x=V.descriptor('morph',o);o.previousCid='sheep';assert.equal(x.previousCid,'treant');assert.equal(x.artPosition,'50% 23%');assert.equal(x.sequenceId,9);
});
test('overdraw source uses deck anchor, not the hero damage area',()=>assert.ok(fs.readFileSync('src/effects.js','utf8').includes('const anchor=EmberViewport.deckAnchor(e.side)||p')));
test('private enemy burned cards cannot gain a revealed-art overlay',()=>assert.ok(fs.readFileSync('src/presentation/lifecycle-feedback.js','utf8').includes("d.targetRef?.side==='p'?d.sourceCid:null")));
