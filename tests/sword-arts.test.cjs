'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const A=require('../src/vfx3/sword-arts.js'),P=require('../src/presentation/fx-profiles.js'),E=require('../src/vfx3/runtime.js');
const from={x:668,y:459,w:116,h:146},to={x:932,y:295,w:116,h:146};
const desc=(style,scale=1)=>E.descriptor('slash',{from,to,startedAt:0,contactAt:260*scale,timeScale:scale,seed:388,swordStyle:style});
const visit=x=>{if(typeof x==='number')assert.ok(Number.isFinite(x));else if(x&&typeof x==='object')for(const v of Object.values(x))visit(v);};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('10 blade units have ten explicit different identities',()=>{assert.equal(Object.keys(P.swordIdentities).length,10);assert.equal(new Set(Object.values(P.swordIdentities)).size,10);for(const[id,style]of Object.entries(P.swordIdentities)){assert.equal(P.fx2Attack(id).fx,'slash');assert.equal(P.fx2Attack(id).swordStyle,style);assert.ok(A.definitions[style]);}});
test('weapon attacks distinguish moon twins and solar daybreak; equipment spell unchanged',()=>{assert.equal(P.fx2Attack(null,'dagger').swordStyle,'twins');assert.equal(P.fx2Attack(null,'sunblade').swordStyle,'daybreak');assert.equal(P.fx2('dagger').fx,'holy');assert.equal(P.fx2('sunblade').fx,'holy');});
test('ranger piercing arrow is no longer routed to a sword',()=>assert.equal(P.fx2Power('steel').fx,'arrow'));
test('sabotage and shatter casts preserve separate rupture identity',()=>{assert.equal(P.fx2('sabotage').swordStyle,'shatter');assert.equal(P.fx2Cast('shatter').swordStyle,'shatter');});
test('original flames, lightning, claw and slam routes do not change',()=>{for(const[id,fx]of Object.entries({dragon:'breath',ashdragon:'breath',phoenix:'breath',wolf:'claw',treant:'slam',spark:'bolt',archer:'arrow'}))assert.equal(P.fx2Attack(id).fx,fx);assert.equal(P.fx2('bolt').fx,'lightning');});
test('shader extension adds only one isolated material branch; never overwrites flame mode',()=>{const r=fs.readFileSync('src/vfx3/renderer.js','utf8');assert.ok(r.includes('uMode>11.5&&uMode<12.5'));assert.equal((r.match(/if\(uMode>7\.5&&uMode<8\.5\)/g)||[]).length,1);});
test('original reference generator has unchanged git-blob checksum',()=>{const b=fs.readFileSync('src/vfx3/reference-flame.js');assert.equal(crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),'8aa26d97bbe4244a48c2a178926ba65baff96310');});
for(const style of Object.keys(A.definitions)){
 test(`${style}: finite deterministic pure frames, no early contact and exact contact point`,()=>{
  const d=desc(style),before=JSON.stringify(d);
  for(let ms=0;ms<1400;ms+=17){const f=A.sample(d,ms/1000);visit(f);if(ms<260){assert.equal(f.contact,false);assert.equal(f.cracks.length,0);assert.ok(f.particles.every(p=>p.role==='charge'),'only tagged anticipation particles may precede contact');} }
  const f=A.sample(d,.26);assert.equal(f.style,style);assert.equal(f.contact,true);
  if(f.tip){assert.ok(Math.abs(f.tip[0]-(to.x-800))<.001);assert.ok(Math.abs(f.tip[1]-(470-to.y-to.h*.03))<.001);}
  assert.equal(JSON.stringify(d),before);const h=digest(A.sample(d,.34));A.sample(desc(style),.90);assert.equal(digest(A.sample(d,.34)),h);
 });
 test(`${style}: coherent timing at 0.25x/0.5x duration, tails really end`,()=>{
  for(const scale of [.25,.5,1]){const d=desc(style,scale);const f=A.sample(d,(.26+.07)*scale);assert.equal(f.contact,true);assert.equal(f.style,style);visit(f);const end=A.sample(d,(d.impact-d.start+d.tail+.01)/1000);assert.equal(end.alive,false);assert.equal(end.ribbons.length,0);assert.equal(end.cracks.length,0);}
 });
 test(`${style}: low quality preserves impact and curve endpoints`,()=>{
  const d=desc(style),hi=A.sample(d,.29,1600,940,false),lo=A.sample(d,.29,1600,940,true);assert.deepEqual(hi.tip,lo.tip);assert.equal(hi.ribbons.length>=lo.ribbons.length,true);assert.ok(lo.particles.length<=hi.particles.length);
 });
}
test('plain units cannot accidentally produce offscreen celestial lanes',()=>{for(const id of ['squire','guard','skeleton','recruit','assassin'])assert.ok(!['sky','frost','sunfall'].includes(A.get(P.swordIdentities[id]).form));});
test('all thirteen identities have different geometry signatures without comparing colors',()=>{const sigs=Object.keys(A.definitions).map(id=>digest(A.sample(desc(id),.32).ribbons.map(b=>({p:b.points,w:b.widths}))));assert.equal(new Set(sigs).size,sigs.length);});
test('no physics or extra rule event is driven by any sword recipe',()=>{const code=fs.readFileSync('src/vfx3/sword-arts.js','utf8');for(const bad of ['.dispatch(','.hp=','game.s','setTimeout(','requestAnimationFrame('])assert.ok(!code.includes(bad));});
test('runtime uses the energy renderer, never creates the retired steel model',()=>{const code=fs.readFileSync('src/vfx3/runtime.js','utf8');assert.ok(code.includes('Arts.create(R,X)'));assert.ok(!code.includes('Sky.create(R,X)'));assert.ok(code.includes('options.resolveTarget'));});
test('sword recipe is registered before runtime and is not a second canvas or frame loop',()=>{const cfg=require('../config/build.json'),t=fs.readFileSync('src/template.html','utf8');assert.equal(cfg.MESH_SWORD_ARTS,'vfx3/sword-arts.js');assert.ok(t.indexOf('/*MESH_SWORD_ARTS*/')<t.indexOf('/*MESH_RUNTIME*/'));assert.equal((t.match(/\/\*MESH_SWORD_ARTS\*\//g)||[]).length,1);});
test('style travels from the profile through cast compilation and the director',()=>{for(const file of ['src/presentation/combat.js','src/effects.js','src/vfx3/runtime.js'])assert.ok(fs.readFileSync(file,'utf8').includes('swordStyle'));});
