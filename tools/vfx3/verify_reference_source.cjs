const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const path=require('node:path');
const P=path.resolve(__dirname,'../..'),R=process.argv[2];
if(!R||!fs.existsSync(path.join(R,'effects.js'))){console.error('Usage: node tools/vfx3/verify_reference_source.cjs /path/to/Ember_Steel_VFX/src');process.exit(2);}
const Ref=require(P+'/src/vfx3/reference-flame.js');
const ctx={console,Math,Float32Array};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['core.js','timeline.js','geometry.js','effects.js'])vm.runInContext(fs.readFileSync(R+'/'+f,'utf8'),ctx);
const scene=fs.readFileSync(R+'/scene.js','utf8');
const fn=scene.slice(scene.indexOf(' dragonFrames('),scene.indexOf(' drawDragon(')).trim().replace('dragonFrames(p)','function dragonFrames(p)');
vm.runInContext(`const {M,V}=AVX; ${fn}; window.refFrames=dragonFrames;`,ctx);
let frame;
const renderer={mesh:()=>({}),project:p=>{const q=Ref.view(p);return [q[0],-q[1],q[2]];},
 glow:(pos,size,color,alpha=1,ground=false)=>frame.glows.push({pos,size,color,alpha,ground}),
 particle:(pos,size,color,alpha=1,type=0)=>{if(alpha>.003)frame.particles.push({pos,size,color,alpha,type});},
 line:(a,b,width,color,opt={})=>frame.lines.push({a,b,width,color,opt}),
 fx:(kind,pos,scale,color,rot=[0,0,0],opt={})=>frame.ground.push({kind,pos,scale,color,rot,opt})};
const e=new ctx.AVX.Effects(renderer,{dragonFrames:ctx.refFrames});
e.sprite=function(pos,w,h,color,alpha,mode=8,seed=0,angle=0,add=false){if(alpha<.003)return;frame.sprites.push({pos,w,h,color,alpha,mode,seed,angle,add});};
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v)])):typeof x==='number'?Math.round(x*1e6)/1e6:x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(normalize(x))).digest('hex');
const samples=[];
for(const density of [1,.45])for(const t of [0,.75,.96,1.12,1.28,1.46,1.65,2,2.33,2.75,3.1,3.36,3.7,4.12,4.75,5.25]){
 frame={time:t,sprites:[],particles:[],glows:[],lines:[],ground:[]};e.density=density;e.dragon(ctx.AVX.poseAt('dragon',t));
 const result=Ref.sample(t,density);const a=digest(frame),b=digest(result);
 if(a!==b){console.error('DIFFERENT',t,density,a,b);process.exit(1);}
 samples.push({time:t,density,sha256:a,counts:Object.fromEntries(['sprites','particles','glows','lines','ground'].map(k=>[k,frame[k].length]))});
}
if(process.argv.includes('--write-fixture'))fs.writeFileSync(P+'/tests/fixtures/reference-flame.json',JSON.stringify({source:'Actual Ember_Steel_VFX/src/effects.js executed in Node VM; positions quantized to 1e-6 for numeric tolerance.',samples},null,2));
console.log('Parity with original: '+samples.length+' complete output frames identical.');
