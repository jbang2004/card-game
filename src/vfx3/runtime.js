/* Three-dimensional attack runtime. Presentation-only: it never reads/writes rules.
 * Uses the geometry/shader Renderer derived from Ember_Steel_VFX, not EmberFx2 sprites.
 * Inputs are immutable CSS-stage boxes and absolute host-clock deadlines in ms.
 */
(function (G) {
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const rnd=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const env=(t,a,b,i=.04,o=.1)=>ease((t-a)/i)*(1-ease((t-(b-o))/o));
const Arts=G.EmberSwordArts||(typeof require==='function'?require('./sword-arts.js'):null);
const Rem=G.EmberRemasterArts||(typeof require==='function'?require('./remaster-arts.js'):null);
const KIND={...Object.fromEntries(Object.keys(Rem.DEFINITIONS).map(k=>[k,k])),breath:'breath',lightning:'lightning',bolt:'lightning',slash:'slash'};
const TAIL={...Object.fromEntries(Object.entries(Rem.DEFINITIONS).map(([k,v])=>[k,v.tail])),breath:4100,lightning:320,slash:1120};
const valid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
function descriptor(kind,o,now=0){
 if(!KIND[kind]||!valid(o.from)||!valid(o.to))return null;
 const resolved=Rem.supports(kind)?Rem.resolve(kind,o.sourceCid,o.visualKind):KIND[kind];
 const start=Number.isFinite(o.startedAt)?o.startedAt:now;
 const lead=Math.max(0,Number(o.leadMs)||0);
 const impact=Number.isFinite(o.contactAt)?o.contactAt:start+lead;
 const scale=clamp(Number(o.timeScale)||1,.1,1);
 return {visualOnly:!!o.visualOnly,silent:!!o.silent,groupId:o.groupId||null,aoe:!!o.aoe,swordStyle:kind==='slash'?Arts.resolve(o.swordStyle):null, sourceCid:o.sourceCid||null, sourceRef:o.sourceRef?{...o.sourceRef}:null, targetRef:o.targetRef?{...o.targetRef}:null,
   kind:resolved,sourceKind:kind,from:{...o.from},to:{...o.to},start,impact:Math.max(start,impact),
   hold:Math.max(0,Number(o.hitStopMs)||0),tail:(kind==="slash"&&G.EmberBenchmarkArts?.supports(o.swordStyle)?G.EmberBenchmarkArts.STYLES[o.swordStyle].tail:TAIL[resolved])*scale,seed:Number(o.seed)||7,
   tier:clamp(o.tier||2,1,3),scale,tint:Array.isArray(o.tint)?o.tint.slice():null};
}
function sample(d,now){
 const t=(now-d.start)/1000,hit=(d.impact-d.start)/1000,after=t-hit;
 return {t,hit,after,alive:now>=d.start&&now<d.impact+d.tail-1e-6,phase:t<0?'待机':after<0?'释放':after<.075?'命中':'余韵'};
}

// R5: screen-top strike; model, trail and tests share one rigid pose.
const Sky=G.EmberSkyfall||(typeof require==='function'?require('./skyfall.js'):null);
const cleaveMotion=(d,t)=>Sky.motion(d,t);
// Original flame time/coordinates remain isolated from the game clock.
const Ref=G.EmberReferenceFlame||(typeof require==='function'?require('./reference-flame.js'):null);
function breathClock(d,t){
 const hit=(d.impact-d.start)/1000,refHit=1.46,begin=.72;
 const time=t<0?-1:t<hit?begin+(refHit-begin)*t/Math.max(.000001,hit):refHit+(t-hit)/d.scale;
 return {time,hit,refHit,begin,launch:hit*(.96-begin)/(refHit-begin),
 travel:Math.max(.000001,hit*(refHit-.96)/(refHit-begin)),
 stop:hit+(3.36-refHit)*d.scale,interval:.0124*d.scale};
}
function flameMapping(d,W,H){
 const source=Ref.view(Ref.mouth(.96)),target=Ref.view([2.68,1.70,0]);
 const F=[d.from.x+d.from.w*.10-W/2,H/2-(d.from.y-d.from.h*.10),28],
 T=[d.to.x-W/2,H/2-d.to.y,28];
 const A=[target[0]-source[0],target[1]-source[1]],B=[T[0]-F[0],T[1]-F[1]];
 const angle=Math.atan2(B[1],B[0])-Math.atan2(A[1],A[0]);
 const scale=Math.max(.001,Math.hypot(...B)/Math.hypot(...A)),c=Math.cos(angle),q=Math.sin(angle);
 return {F,T,source,target,scale,angle,
  point(p){const v=Ref.view(p),x=(v[0]-source[0])*scale,y=(v[1]-source[1])*scale;
   return [F[0]+c*x-q*y,F[1]+q*x+c*y,F[2]+(v[2]-source[2])*scale];}};
}
const fractureAt=t=>Sky.fractureAt(t);

function create(canvas,options={}){
 const X=G.Ember3D,{M,V,Geo}=X,R=new X.Renderer(canvas);
 let W=1600,H=940,quality={low:false,reduced:false},instances=[],last=null,lastUtility=null,lastGroup=[],manual=null,uid=0,lastNow=0,dirty=true;
 let stats={active:0,drawCalls:0,particles:0,renderer:'mesh3d',frames:0};
 const trace=[];
 const arts=Arts.create(R,X),remaster=Rem.create(R,X);
 const tmp=R.dynamic;
 function emit(kind,o,now=performance.now()){
  const d=descriptor(kind,o,now);if(!d||quality.reduced)return false;
  d.id=++uid;options.onEmit?.(d);instances.push(d);if(instances.length>24)instances.shift();
  const copy={...d,from:{...d.from},to:{...d.to}};
  if(d.visualOnly){lastUtility=copy;if(lastGroup.length&&d.start>=lastGroup[0].start&&d.start-lastGroup[0].start<1600)lastGroup.push(copy);}
  else{
   if(d.groupId&&lastGroup[0]?.groupId===d.groupId)lastGroup.push(copy);else lastGroup=[copy];
   last=copy;
   trace.push({id:d.id,kind:d.kind,start:d.start,impact:d.impact,backend:'mesh3d',swordStyle:d.swordStyle});if(trace.length>100)trace.shift();
  }dirty=true;return d;
 }
 function stage(w,h){W=Math.max(1,w);H=Math.max(1,h);const dpr=Math.min(G.devicePixelRatio||1,quality.low?1:1.5);R.resize(W,H,dpr);R.camera();}
 function xyz(b,z=16){return[b.x-W/2,H/2-b.y,z];}
 function sprite(pos,size,col,alpha,mode=8,seed=0,angle=0,add=false){
  if(alpha<.005)return;
  const ca=Math.cos(angle),sa=Math.sin(angle),right=[ca*size,sa*size,0],up=[-sa*size,ca*size,0];
  R.fxList.push({geo:R.geo.plane,model:new Float32Array([...right,0,0,0,1,0,...up,0,...pos,1]),color:col,
    opt:{mode,alpha,add,transparent:!add,surface:seed,emission:.25}});
 }
 function ring(p,r,col,a,rx=.55,ry=0,rz=0){if(a<.002)return;R.fx('ring',p,[r,r,r],col,[Math.PI/2+rx,ry,rz],{mode:6,alpha:a});}
 function mesh(data,color,opt={}){if(data.length)R.dynamicFX(data,color,{mode:6,...opt});}
 function beam(ps,r,col,a){if(a>.003)mesh(tube(ps,r,6),col,{alpha:a});}
 function sparks(p,t,n,col,seed,power=1){
  if(t<0||t>.55)return;
  n=Math.ceil(n*(quality.low?.4:1));
  for(let i=0;i<n;i++){
   const k=seed+i*13,life=.18+rnd(k)*.28;if(t>life)continue;
   const th=rnd(k+1)*Math.PI*2,sp=(45+rnd(k+2)*190)*power;
   const v=[Math.cos(th)*sp,Math.sin(th)*sp,18+rnd(k+3)*75];
   const q=[p[0]+v[0]*t,p[1]+v[1]*t-130*t*t,p[2]+v[2]*t-170*t*t];
   const a=(1-t/life)**1.6;R.particle(q,(1+rnd(k+4)*2.4)*power,col,a*1.4,i%5?2:1);
  }
 }

 function swordPose(d,t){return Sky.pose(d,t,W,H,M);}
 function slash(d,s){
  let visual=d;
  if(!manual && s.after>=0 && d.targetRef && typeof options.resolveTarget==='function'){
   const live=options.resolveTarget(d.targetRef);
   if(live) d.attachment={...d.to,x:live.x,y:live.y};
   else if(d.attachment) return; // removed target: no persistent status on an empty slot
   if(d.attachment) visual={...d,to:d.attachment};
  }
  if(manual && G.EmberBenchmarkArts?.supports(d.swordStyle)){
   const r=G.EmberBenchmarkArts.reaction(d,s.t).target;
   visual={...d,to:{...d.to,x:d.to.x+r[0],y:d.to.y+r[1]}};
  }
  arts.render(visual,s,W,H,quality.low);
 }
 function remastered(d,s){
  let visual=d;
  const r=Rem.reaction(d,s.t).target;
  if(!manual && s.after>=0 && d.targetRef && options.resolveTarget){
   const live=options.resolveTarget(d.targetRef);
   if(live)d.attachment={...d.to,x:live.x,y:live.y};
   else if(d.attachment&&!d.visualOnly)return;
   if(d.attachment)visual={...d,to:d.attachment,visualAngle:r[2]};
  }else if(manual)visual={...d,to:{...d.to,x:d.to.x+r[0],y:d.to.y+r[1]},visualAngle:r[2]};
  remaster.render(visual,s,W,H,quality.low);
 }
 function electricity(d,s){
  const F=xyz(d.from,22),T=xyz(d.to,23),delta=V.sub(T,F),dist=V.len(delta)||1,dir=V.scale(delta,1/dist),per=[-dir[1],dir[0],0];
  const hit=Math.max(.015,s.hit),charge=env(s.t,0,hit+.025,.025,.05);
  R.glow(F,Math.min(70,d.from.w*.7),'#74b9ff',charge*.5);
  ring(F,clamp(d.from.w*.15,8,22),'#7aa9ff',charge*.62,.3,s.t*2,s.t*3);
  const arrive=clamp(s.t/hit),head=ease(clamp((arrive-.46)/.54));
  const strength=s.after<0?ease((arrive-.38)/.3):env(s.after,-.01,.235,.012,.09)*(.77+.23*Math.cos(s.after*45));
  if(strength>.005){
   const key=s.t/.047,frame=Math.floor(key),blend=ease(clamp((key-frame-.65)/.35));
   const points=[];for(let i=0;i<=27;i++){
    const u=i/27*head,base=V.mix(F,T,u),factor=Math.sin(u*Math.PI);
    const noise=mix(rnd(d.seed+i*31+frame*41),rnd(d.seed+i*31+(frame+1)*41),blend)-.5;
    const zig=noise*Math.min(70,dist*.18)*factor;
    points.push([base[0]+per[0]*zig,base[1]+per[1]*zig,base[2]+factor*(16+noise*18)]);
   }
   beam(points,5.4,[.025,.18,1.7],strength*.34);beam(points,2.1,[.16,.92,2.8],strength*.70);beam(points,.80,[1.4,2.6,4.1],strength);
   for(let j=0;j<5;j++){
    const ix=5+j*4,beg=points[ix],length=(35+rnd(j+d.seed)*65)*head,sg=j%2?-1:1;
    const ps=[beg];for(let k=1;k<6;k++){const u=k/5;
     ps.push([beg[0]+dir[0]*length*u+per[0]*sg*length*u*.55,beg[1]+dir[1]*length*u+per[1]*sg*length*u*.55+(rnd(k*37+j*13+frame)-.5)*18,beg[2]+Math.sin(u*Math.PI)*16]);}
    beam(ps,.52,[.38,1.1,2.9],strength*.62);
   }
  }
  if(s.after>=0){
   const a=env(s.after,-.01,.30,.015,.13);R.glow(T,d.to.w*.7,'#82bfff',a*.58);
   ring(T,d.to.w*(.15+ease(s.after/.20)*.40),'#77bdff',a*.5,.5,0,s.t*2);
   sparks(T,s.after,30,'#cceaff',d.seed+9,clamp(d.to.w/116,.55,1.1));
   for(let j=0;j<3;j++){
    const ps=[];for(let i=0;i<15;i++){const a=i/14*Math.PI*1.5+s.t*(j+2)*2,rad=d.to.w*.3;
      ps.push([T[0]+Math.cos(a)*rad,T[1]+Math.sin(a)*rad*.64,T[2]+Math.sin(a+j)*14]);}
    beam(ps,.55,[.17,.67,1.7],a*.5);
   }
  }
 }

 function fire(d,s){
  const clock=breathClock(d,s.t),frame=Ref.sample(clock.time,quality.low?.45:1),map=flameMapping(d,W,H);
  const k=map.scale,plumes=frame.sprites.map(p=>({...p,pos:map.point(p.pos)}));
  // Same flames, fade, speed, sizes and random seeds as the original. Only a
  // rigid rotation + uniform scale maps reference space onto the card stage.
  // No hot duplicate, target clamp, shortened parcel lifetime, or cone shell.
  for(const p of frame.glows){
   if(p.ground)continue; // Original practice-floor decoration is not a card status.
   if(s.after<0&&p.pos[0]>2)continue; // Contact light cannot precede the rule hit.
   const pt=map.point(p.pos);R.glow(pt,p.size*k,p.color,p.alpha);
  }
  // Painter depth, not generation order. Material time stays per instance.
  plumes.sort((a,b)=>a.pos[2]-b.pos[2]);
  for(const p of plumes)spriteOval(p.pos,p.w*k,p.h*k,p.color,p.alpha,p.mode,p.seed,p.angle+map.angle,clock.time);
  for(const p of frame.particles)R.particle(map.point(p.pos),p.size*k,p.color,p.alpha,p.type);
  for(const p of frame.lines)R.line(map.point(p.a),map.point(p.b),p.width*k,p.color,{...p.opt,time:clock.time});
 }
 function spriteOval(pos,w,h,col,alpha,mode=8,seed=0,angle=0,time){
  if(alpha<.004)return;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  R.fxList.push({geo:R.geo.plane,model:new Float32Array([ca*w,sa*w,0,0,0,0,1,0,-sa*h,ca*h,0,0,...pos,1]),
   color:col,opt:{mode,alpha,transparent:true,add:false,surface:seed,emission:mode===8?.4:0,time}});
 }
 function draw(now){
  lastNow=now;if(quality.reduced){if(dirty)R.clear();dirty=false;return;}
  if(!manual)instances=instances.filter(d=>now<d.impact+d.tail-1e-6);
  const active=instances.filter(d=>sample(d,now).alive);
  options.onFrame?.(active,now,!!manual);
  if(!active.length){if(dirty)R.clear();dirty=false;stats.active=0;stats.particles=0;stats.drawCalls=0;return;}
  R.camera();R.lamp=[0,0,120];R.lampColor=[.15,.21,.27];R.begin((now-active[0].start)/1000);
  for(const d of active){const state=sample(d,now);if(!state.alive)continue;
   if(d.kind==='breath')fire(d,state);else if(d.kind==='lightning')electricity(d,state);else if(d.kind==='slash')slash(d,state);else remastered(d,state);
  }
  const hasFire=active.some(d=>d.kind==='breath');
  R.flush();R.end({bloom:hasFire?.28:(quality.low?.34:.46),bloomThreshold:hasFire?.78:.28,referenceFlame:hasFire});dirty=true;
  stats={...stats,active:active.length,drawCalls:R.count,particles:R.particles.length/9,frames:stats.frames+1,hdr:R.hdr};
 }
 function clear(){options.onClear?.();instances=[];manual=null;R.clear();dirty=false;stats.active=0;stats.particles=0;stats.drawCalls=0;}
 function replay(ms){if(!last)return false;manual=true;const origin=lastGroup[0]?.start??last.start;instances=lastGroup.map(d=>({...d,start:d.start-origin,impact:d.impact-origin}));draw(ms);return true;}
 function replayUtility(ms){if(!lastUtility)return false;manual=true;instances=[{...lastUtility,start:0,impact:0}];draw(ms);return true;}
 function advance(now){if(!manual)draw(now);}
 function setQuality(q){quality={...quality,...q};if(quality.reduced)clear();else{stage(W,H);dirty=true;}}
 return {emit,draw:advance,stage,clear,setQuality,replay,replayUtility,get lastUtility(){return lastUtility?{...lastUtility}:null;},get lastGroup(){return lastGroup.map(d=>({...d}));},resume(){options.onClear?.();manual=null;instances=[];dirty=true;},
  get available(){return !quality.reduced;},get stats(){return {...stats};},get last(){return last?{...last,from:{...last.from},to:{...last.to}}:null;},get trace(){return trace.slice();},
  diagnostics(){return{...stats,webgl:R.info(),error:R.gl.getError()};},
  destroy(){clear();arts.destroy();remaster.destroy();R.destroy();},_remasterFrame:(d,t)=>Rem.sample(d,t,W,H,quality.low),_sample:sample,_swordPose:swordPose,_swordArtFrame:(d,t)=>Arts.sample(d,t,W,H,quality.low)};
 function tube(points,radius,sides=6){
  const out=[];for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],D=V.sub(b,a);if(V.len(D)<.001)continue;
   const dir=V.norm(D),side=V.norm(V.cross(dir,Math.abs(dir[2])>.9?[0,1,0]:[0,0,1])),up=V.norm(V.cross(dir,side));
   const ra=radius*(.4+.6*Math.sin((.12+.78*i/(points.length-1))*Math.PI)),rb=radius*(.4+.6*Math.sin((.12+.78*(i+1)/(points.length-1))*Math.PI));
   for(let j=0;j<sides;j++){
    const n=V.add(V.scale(side,Math.cos(j/sides*Math.PI*2)),V.scale(up,Math.sin(j/sides*Math.PI*2))),m=V.add(V.scale(side,Math.cos((j+1)/sides*Math.PI*2)),V.scale(up,Math.sin((j+1)/sides*Math.PI*2)));
    const v0=V.add(a,V.scale(n,ra)),v1=V.add(a,V.scale(m,ra)),v2=V.add(b,V.scale(m,rb)),v3=V.add(b,V.scale(n,rb));
    Geo.tri(out,v0,v1,v2,n);Geo.tri(out,v0,v2,v3,n);
   }
  }return out;
 }
}
const api={create,supports:kind=>!!KIND[kind],descriptor,sample,TAIL,cleaveMotion,breathClock,flameMapping,fractureAt};
G.EmberVFX3=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
