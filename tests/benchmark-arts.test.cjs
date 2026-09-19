/* Benchmark authored motion / materials / sound invariants, evaluated without a GPU.
 * These are correctness gates, not claims of commercial visual quality.
 */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const B=require('../src/vfx3/benchmark-arts.js'),A=require('../src/vfx3/sword-arts.js'),Cues=require('../src/vfx3/benchmark-cues.js'),Runtime=require('../src/vfx3/runtime.js');
const from={x:668,y:459,w:116,h:146},to={x:932,y:295,w:116,h:146};
function desc(style,scale=1,override={}){
 const d=Runtime.descriptor('slash',{from,to,swordStyle:style,startedAt:1000,contactAt:1000+340*scale,timeScale:scale,seed:388,...override});
 return {...d,id:1,sourceRef:{side:'p',uid:'a'},targetRef:{side:'e',uid:'b'}};
}
function finite(o){if(typeof o==='number')assert.ok(Number.isFinite(o));else if(o&&typeof o==='object')for(const v of Object.values(o))finite(v);}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
const H=940,W=1600;
for(const style of Object.keys(B.STYLES)){
 test(`${style}: independent authored material and correct registry`,()=>{
  assert.ok(B.supports(style));const d=desc(style);
  assert.equal(d.tail,B.STYLES[style].tail);assert.equal(A.get(style).tail,B.STYLES[style].tail);
  const f=B.sample(d,.34);assert.ok(f.ribbons.some(x=>x.material===({judgment:13,night:15,frost:14}[style])));
 });
 test(`${style}: pure reproducible complete frames across time and render order`,()=>{
  const d=desc(style),original=JSON.stringify(d),f=B.sample(d,.40),s=hash(f);
  for(let t=-.05;t<2.25;t+=.027){finite(B.sample(d,t));B.sample(desc('frost',.5),t);}
  assert.equal(hash(B.sample(d,.40)),s);assert.equal(JSON.stringify(d),original);
 });
 test(`${style}: no injury, frost plate or target movement before the authoritative hit`,()=>{
  const d=desc(style);for(let t=0;t<.34;t+=.011){
   const f=B.sample(d,t);assert.equal(f.contact,false);assert.equal(f.cracks.length,0);
   assert.equal(f.plates.length,0);assert.ok(f.reaction.target.every(v=>Math.abs(v)<1e-12));
   assert.ok(f.particles.every(p=>p.role==='charge'));
  }
 });
 test(`${style}: exactly-on-target impact and independent phase labels`,()=>{
  const d=desc(style),f=B.sample(d,.34);assert.ok(f.contact);
  assert.deepEqual(f.tip.slice(0,2),[to.x-W/2,H/2-to.y-to.h*.03]);
  assert.equal(B.timing(d,.05).stage,'凝聚');assert.equal(B.timing(d,.33).stage,'释放');
  assert.equal(f.phase,'命中');assert.equal(B.sample(d,.55).phase,'裂痕');
 });
 test(`${style}: low quality keeps shape, endpoints and fewer decorative particles`,()=>{
  const d=desc(style);
  for(const t of [.31,.34,.44,.65,1.0]){
   const hi=B.sample(d,t),lo=B.sample(d,t,W,H,true);
   assert.deepEqual(hi.tip,lo.tip);assert.equal(hi.ribbons.length,lo.ribbons.length);
   assert.ok(lo.particles.length<=hi.particles.length);assert.ok(lo.shards.length<=hi.shards.length);
  }
 });
 test(`${style}: time scaling preserves impact, world geometry and clean tail`,()=>{
  const full=B.sample(desc(style),.44);
  for(const sc of [.1,.25,.5,1]){
   const d=desc(style,sc),f=B.sample(d,.44*sc);
   assert.equal(f.contact,true);assert.deepEqual(f.tip,full.tip);assert.equal(f.ribbons.length,full.ribbons.length);
   const end=B.sample(d,(d.impact-d.start+d.tail+.01)/1000);
   assert.equal(end.alive,false);
   for(const k of ['ribbons','lines','cracks','particles','plates','shards'])assert.equal(end[k].length,0);
  }
 });
 test(`${style}: target reaction is bounded rigid movement and returns to rest`,()=>{
  const d=desc(style);for(let t=0;t<2.1;t+=.008){const r=B.reaction(d,t);finite(r);assert.ok(Math.hypot(...r.target.slice(0,2))<=7.001);assert.ok(Math.hypot(...r.source.slice(0,2))<=18.001);}
  const r=B.reaction(d,2.5);assert.ok(Math.abs(r.source[0])<1e-4&&Math.abs(r.target[0])<1e-4&&Math.abs(r.target[1])<1e-4);
 });
 test(`${style}: short sounds are deterministic, finite, audible and peak-limited`,()=>{
  for(const cue of ['charge','launch','impact','tail']){
   const a=Cues.pcm(style,cue,24000),b=Cues.pcm(style,cue,24000);
   assert.deepEqual(a,b);let sum=0,max=0;for(const x of a){assert.ok(Number.isFinite(x));sum+=x*x;max=Math.max(max,Math.abs(x));}
   assert.ok(max<.821);assert.ok(Math.sqrt(sum/a.length)>.0001);assert.ok(a.length<24000);
  }
 });
 test(`${style}: live/export cue events share the exact hit and do not alter inputs`,()=>{
  const d=desc(style),old=JSON.stringify(d),ev=Cues.events(d);
  assert.equal(new Set(ev.map(x=>x.id)).size,4);assert.equal(ev.find(x=>x.id==='impact').at,d.impact);
  const audio=Cues.timeline(d,24000);assert.ok(audio.length>24000);assert.equal(JSON.stringify(d),old);
  for(let i=0;i<audio.length;i++)assert.ok(Number.isFinite(audio[i])&&Math.abs(audio[i])<1);
 });
}
test('holy and frost enter above the stage and cannot veer or stretch in flight',()=>{
 for(const style of ['judgment','frost'])for(const toBox of [to,{x:200,y:430,w:62,h:78},{x:420,y:180,w:166,h:210}]){
  const d=desc(style,1,{to:toBox}),hit=.34,flight=B.STYLES[style].flight;
  let prev=Infinity;
  for(let k=0;k<=20;k++){const f=B.sample(d,hit-flight+flight*k/20),y=f.tip[1];
   assert.ok(Math.abs(f.tip[0]-(toBox.x-W/2))<1e-9);assert.ok(y<=prev+1e-9);prev=y;
   const solid=f.ribbons.find(x=>x.material===(style==='frost'?14:13));
   const height=solid.points.at(-1)[1]-solid.points[0][1];
   assert.ok(Math.abs(height-Math.min(355,Math.max(145,toBox.w*(style==='frost'?2.95:3.1))))<1e-8);
   if(k===0)assert.ok(y>H/2);
  }
 }
});
test('fractures are bounded to the illustration, not the statistics or neighboring card',()=>{
 for(const style of ['judgment','frost'])for(const box of [to,{x:300,y:190,w:56,h:73},{x:400,y:240,w:180,h:250}]){
  const d=desc(style,1,{to:box});
  for(let t=.34;t<1.2;t+=.02){const f=B.sample(d,t),c=f.bounds.center;
   for(const k of f.cracks)for(const p of [k.a,k.b]){
    assert.ok(Math.abs(p[0]-c[0])<=box.w*.44+1);assert.ok(Math.abs(p[1]-c[1])<=box.h*.34+1);
   }
  }
 }
});
test('night thrust obeys reversed/short/long target directions without NaNs',()=>{
 for(const target of [{x:200,y:280,w:100,h:140},{x:669,y:458,w:62,h:78},to]){
  const d=desc('night',1,{to:target});for(let t=0;t<1.1;t+=.01)finite(B.sample(d,t));
  const tip=B.sample(d,.34).tip;assert.ok(Math.abs(tip[0]-(target.x-800))<1e-9);assert.ok(Math.abs(tip[1]-(470-target.y-target.h*.03))<1e-9);
 }
});
test('benchmark is source/target presentation only with no rule mutation or independent loop',()=>{
 for(const file of ['src/vfx3/benchmark-arts.js','src/vfx3/benchmark-cues.js','src/presentation/benchmark-feedback.js']){
  const code=fs.readFileSync(file,'utf8');for(const bad of ['.dispatch(','.hp=','game.s','requestAnimationFrame(','setTimeout('])assert.ok(!code.includes(bad));
 }
});
test('new modules load before their users in both production exports',()=>{
 const cfg=require('../config/build.json'),t=fs.readFileSync('src/template.html','utf8');
 for(const key of ['BENCHMARK_ARTS','BENCHMARK_CUES','BENCHMARK_FEEDBACK']){
  assert.ok(fs.existsSync('src/'+cfg[key]));assert.equal(t.split('/*'+key+'*/').length,2);
  assert.ok(t.indexOf('/*'+key+'*/')<t.indexOf('/*MESH_SWORD_ARTS*/'));
 }
 assert.ok(t.indexOf('/*MESH_SWORD_ARTS*/')<t.indexOf('/*MESH_RUNTIME*/'));
});
test('the original flame sampler retains its reviewed Git blob checksum',()=>{
 const b=fs.readFileSync('src/vfx3/reference-flame.js');
 assert.equal(crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),'8aa26d97bbe4244a48c2a178926ba65baff96310');
});
function feedbackFixture(){
 const nodes={a:{isConnected:true,style:{transform:'rotate(2deg)',filter:'saturate(.9)'}},b:{isConnected:true,style:{transform:'',filter:''}}};
 const sounds=[],ctx={console,Math,Map,Set,CSS:{escape:x=>x},EmberBenchmarkArts:B,EmberBenchmarkCues:Cues,performance:{now:()=>1000},
 document:{hidden:false,querySelector:q=>nodes[q.includes('"a"')?'a':'b']},EmberAudio:{fx:(type,opt)=>{sounds.push({type,opt});return true;}},EmberViewport:{width:1600}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/presentation/motion-feedback.js','utf8')+fs.readFileSync('src/presentation/benchmark-feedback.js','utf8')+';this.Feedback=EmberMotionFeedback.create([EmberBenchmarkFeedback]);',ctx);
 return {nodes,sounds,f:ctx.Feedback,ctx};
}
test('DOM feedback composes on the existing style and restores it on cancellation',()=>{
 const {nodes,f}=feedbackFixture(),before=JSON.stringify(nodes),d=desc('judgment');
 f.frame([d],d.impact+35,true);assert.ok(nodes.b.style.transform.includes('translate'));
 assert.ok(nodes.a.style.transform.startsWith('rotate(2deg)'));assert.equal(f.active,2);
 f.clear();assert.equal(JSON.stringify(nodes),before);assert.equal(f.active,0);
});
test('audio is scheduled once by authoritative timestamps despite repeated rendering',()=>{
 const {sounds,f}=feedbackFixture(),d=desc('frost');
 f.schedule(d);for(let t=d.start;t<d.impact+800;t+=16)f.frame([d],t,false);
 assert.equal(sounds.length,4);assert.equal(sounds.find(s=>s.type.endsWith('-impact')).opt.atMs,d.impact);
 f.clear();assert.equal(f.active,0);
});
test('manual scrubbing is silent; explicitly playing it consumes each cue only once',()=>{
 const {sounds,f}=feedbackFixture(),d=desc('night');
 for(const t of [1400,1100,1340,1020,1800])f.frame([d],t,true);assert.equal(sounds.length,0);
 f.channel("benchmark").resetAudio();for(let t=1000;t<1800;t+=16)f.play(d,t===1000?999.999:t-16,t);
 assert.equal(sounds.length,4);
});
test('hidden tabs never schedule sounds and detached cards do not retain ownership',()=>{
 const {sounds,nodes,f,ctx}=feedbackFixture(),d=desc('judgment');
 ctx.document.hidden=true;f.schedule(d);assert.equal(sounds.length,0);
 f.frame([d],1350,true);nodes.a.isConnected=false;f.clear();assert.equal(f.active,0);
});

test('simultaneous visual impulses remain bounded on a shared target',()=>{
 const {nodes,f}=feedbackFixture(),d=desc('judgment');
 f.frame(Array.from({length:12},(_,i)=>({...d,id:i+1})),d.impact+35,true);
 const m=nodes.b.style.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\)/);
 assert.ok(m);assert.ok(Math.hypot(+m[1],+m[2])<=11.001);f.clear();
});
