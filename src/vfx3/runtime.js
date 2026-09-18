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
const KIND={breath:'breath',lightning:'lightning',bolt:'lightning',slash:'slash'};
const TAIL={breath:4100,lightning:320,slash:1120};
const valid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
function descriptor(kind,o,now=0){
 if(!KIND[kind]||!valid(o.from)||!valid(o.to))return null;
 const start=Number.isFinite(o.startedAt)?o.startedAt:now;
 const lead=Math.max(0,Number(o.leadMs)||0);
 const impact=Number.isFinite(o.contactAt)?o.contactAt:start+lead;
 const scale=clamp(Number(o.timeScale)||1,.1,1);
 return {kind:KIND[kind],sourceKind:kind,from:{...o.from},to:{...o.to},start,impact:Math.max(start,impact),
   hold:Math.max(0,Number(o.hitStopMs)||0),tail:TAIL[KIND[kind]]*scale,seed:Number(o.seed)||7,
   tier:clamp(o.tier||2,1,3),scale,tint:Array.isArray(o.tint)?o.tint.slice():null};
}
function sample(d,now){
 const t=(now-d.start)/1000,hit=(d.impact-d.start)/1000,after=t-hit;
 return {t,hit,after,alive:now>=d.start&&now<d.impact+d.tail,phase:t<0?'待机':after<0?'释放':after<.075?'命中':'余韵'};
}

// R3: one authored motion, sampled by the mesh and by its blade-history trail.
// Warm-up uses the existing actor anticipation (no new damage event or rule delay).
function cleaveMotion(d,t){
 const hit=(d.impact-d.start)/1000,post=(t-hit)/d.scale;
 const u=hit>0?clamp(t/hit):1,wind=ease(u/.29),v=clamp((u-.29)/.71);
 const drop=v*v*v,sign=d.to.x>=d.from.x?1:-1;
 const hold=clamp(d.hold/1000/d.scale,.045,.070);
 const settle=Math.max(0,post-hold),recover=ease((post-.28)/.28);
 const tilt=post<0?(.93+.25*wind)*(1-drop):.095*Math.sin(settle*26)*Math.exp(-settle*15);
 return {u,wind,drop,sign,angle:Math.PI+sign*tilt,post,hold,recover,
   yaw:post<0?mix(-.48,.14,drop):.14+.18*recover,
   visibility:t<0?0:ease(t/(.04*d.scale))*(1-ease((post-.36)/.32))};
}
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
// Partial double-slab separation, followed by monotonic settlement.
function fractureAt(seconds){
 const growth=1-Math.pow(1-clamp(seconds/.15),3),open=1-Math.pow(1-clamp(seconds/.095),3);
 return {growth,open,fade:1-ease((seconds-.49)/.45)};
}

function create(canvas){
 const X=G.Ember3D,{M,V,Geo}=X,R=new X.Renderer(canvas);
 let W=1600,H=940,quality={low:false,reduced:false},instances=[],last=null,manual=null,uid=0,lastNow=0,dirty=true;
 let stats={active:0,drawCalls:0,particles:0,renderer:'mesh3d',frames:0};
 const trace=[];
 const blade=R.mesh(makeBlade());
 const tmp=R.dynamic;
 function emit(kind,o,now=performance.now()){
  const d=descriptor(kind,o,now);if(!d||quality.reduced)return false;
  d.id=++uid;instances.push(d);if(instances.length>12)instances.shift();last={...d,from:{...d.from},to:{...d.to}};
  trace.push({id:d.id,kind:d.kind,start:d.start,impact:d.impact,backend:'mesh3d'});if(trace.length>100)trace.shift();dirty=true;return d;
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

 function swordPose(d,t){
  const m=cleaveMotion(d,t),L=clamp(d.to.w*1.46,66,168);
  const T=xyz({...d.to,y:d.to.y+d.to.h*.50},32);
  const lift=Math.max(12,Math.min(d.to.h*.78,d.to.y+d.to.h*.50-L*1.23-22));
  const back=(-.46-.19*m.wind)*m.sign*L;
  const k=m.drop;
  // The point follows a curved sweep, not a lift/elevator translation. Recover
  // releases the sword only AFTER the rigid planted-contact interval.
  const tip=[T[0]+back*(1-k)+m.sign*Math.sin(k*Math.PI)*L*.17+m.sign*m.recover*L*.06,
   T[1]+lift*(.80+.20*m.wind)*(1-k)+m.recover*L*.16,
   T[2]+(1-k)*(28+Math.sin(k*Math.PI)*20)+m.recover*10];
  const rot=M.mul(M.Rz(m.angle),M.Ry(m.yaw));
  const mat=M.mul(M.T(...tip),M.mul(rot,M.mul(M.S(L),M.T(0,-.98,0))));
  return {mat,L,root:M.point(mat,[0,.14,0]),tip:M.point(mat,[0,.98,0]),
   contact:M.point(mat,[0,.98,0]),target:T,motion:m};
 }
 function groundCleave(d,s,T){
  const q=s.after/d.scale;if(q<0||q>=.96)return;
  const f=fractureAt(q),g=clamp(d.to.w/116,.48,1.25),span=76*g;
  // A shallow 3D ground patch, not two stretched halves of a card illustration.
  // x/y are the stage plane; z is true elevation toward the fixed camera.
  const base=[T[0],T[1],9];
  const path=[];for(let i=0;i<11;i++){
   const u=(i-5)/5;path.push([base[0]+u*span,base[1]+(rnd(d.seed+i*23)-.5)*9*g+u*12*g,base[2]]);
  }
  const seam=[],lip=[],firstFx=R.fxList.length;
  for(let i=0;i<path.length-1;i++){
   const progress=clamp((f.growth-Math.abs((i+.5-5)/5))/.18);if(progress<=0)continue;
   const a=path[i],b=path[i+1],w=(1.6+3.4*(1-Math.abs((i-5)/5)))*g*f.open*ease(progress);
   const a0=[a[0],a[1]-w,a[2]],a1=[a[0],a[1]+w,a[2]],b0=[b[0],b[1]-w,b[2]],b1=[b[0],b[1]+w,b[2]];
   Geo.tri(seam,a0,b0,b1);Geo.tri(seam,a0,b1,a1);
   for(const sg of [-1,1]){
    const innerA=[a[0],a[1]+sg*w,a[2]+1],innerB=[b[0],b[1]+sg*w,b[2]+1];
    const outA=[a[0],a[1]+sg*(w+2.5*g),a[2]+1.2+f.open*g*2],outB=[b[0],b[1]+sg*(w+2.5*g),b[2]+1.2+f.open*g*2];
    Geo.tri(lip,innerA,innerB,outB);Geo.tri(lip,innerA,outB,outA);
   }
   // Fine light only inside the fissure; dark opening stays readable.
   R.line([a[0],a[1],a[2]+.2],[b[0],b[1],b[2]+.2],.75*g,'#b7dfff',{mode:6,alpha:f.fade*.72});
   if(i%2===0){
    const sg=i%4===0?1:-1,len=(14+rnd(i+23)*22)*g*f.growth;
    const mid=[b[0]+sg*len*.4,b[1]+sg*len*.52,b[2]+.4],end=[mid[0]-len*.23,mid[1]+sg*len*.40,mid[2]];
    R.line(b,mid,2.3*g,'#152531',{mode:6,alpha:f.fade,add:false,transparent:true});
    R.line(mid,end,1.2*g,'#152531',{mode:6,alpha:f.fade,add:false,transparent:true});
    R.line(b,mid,.45*g,'#a4d5fb',{mode:6,alpha:f.fade*.63});
   }
  }
  // Ground is transient illusion only; geometry/data of the board never changes.
  const fissureLines=R.fxList.splice(firstFx);
  mesh(seam,'#09131c',{mode:6,alpha:f.fade*.96,add:false,transparent:true});
  mesh(lip,'#49515a',{mode:6,alpha:f.fade*.70,add:false,transparent:true});
  R.fxList.push(...fissureLines);
  // Lifted angular fragments separate to either side, then settle. Fixed-size rocks.
  for(let i=0;i<(quality.low?8:18);i++){
   const seed=d.seed+i*43,sg=i%2?1:-1,delay=rnd(seed)*.045,age=q-delay;if(age<0)continue;
   const sz=(3+rnd(seed+1)*5)*g,vel=40+rnd(seed+2)*55;
   const h=Math.max(0,vel*age-230*age*age)*g;
   const travel=(1-Math.exp(-age*7))*(12+rnd(seed+3)*13)*g;
   const p=[T[0]+(rnd(seed+4)-.5)*span*1.65,T[1]+sg*travel,T[2]-20+h];
   R.fx('rock',p,[sz,sz*.56,sz*.9],i%3?'#506b7d':'#92a0a1',[age*3+seed,sg*age*4,age],
    {mode:0,alpha:f.fade,roughness:.85,metal:.03,transparent:true,add:false});
  }
  const expand=1-Math.pow(1-clamp(q/.32),3);
  if(q<.32)ring([T[0],T[1],12],(11+expand*74)*g,'#adc7d7',(1-expand)*.56,1.03);
  for(let i=0;i<(quality.low?4:9);i++){
   const age=q-.035;if(age<0)continue;
   const th=i/9*Math.PI*2,r=(8+Math.min(age,.35)*80)*g;
   const p=[T[0]+Math.cos(th)*r,T[1]+Math.sin(th)*r*.30+age*11*g,21+i*.03];
   const a=env(age,0,.78,.10,.39)*.26;
   sprite(p,(28+age*35)*g,'#637c89',a,9,d.seed+i,.2*i);
  }
 }
 function slash(d,s){
  const pose=swordPose(d,s.t),{mat,L,target:T,motion:m}=pose;
  // Crack pass beneath the blade, bloom and sparks. No foreground-wide shake.
  if(s.after>=0)groundCleave(d,s,T);
  if(m.visibility>.003){
   const opt={roughness:.29,metal:.78,dissolve:1-m.visibility};
   R.draw(blade,mat,'#7d94a8',opt);
   R.draw(R.geo.box,M.mul(mat,M.trs([0,.40,.027],[0,0,0],[.008,.58,.006])),'#284963',{...opt,emission:.25});
   R.draw(R.geo.box,M.mul(mat,M.trs([0,-.025,0],[0,0,.045],[.28,.043,.067])),'#c6a76b',opt);
   R.draw(R.geo.cyl,M.mul(mat,M.trs([0,-.17,0],[0,0,0],[.057,.26,.057])),'#213646',{...opt,roughness:.65,metal:.12});
   R.draw(R.geo.sphere,M.mul(mat,M.trs([0,-.315,0],[0,0,0],[.075,.075,.075])),'#a4dcff',{...opt,emission:.5});
  }
  // Only a blade-history smear, never a full-screen beam or stretched sword.
  const rows=[],stop=Math.min(s.t,s.hit),begin=Math.max(s.hit*.27,s.t-.095*d.scale);
  if(stop>begin&&m.visibility>.01){
   for(let i=0;i<16;i++){const p=swordPose(d,mix(begin,stop,i/15));rows.push([p.root,p.tip]);}
   const verts=[];for(let i=0;i<rows.length-1;i++){
    const [a,b]=rows[i],[c,e]=rows[i+1];if(V.len(V.sub(b,e))<.01)continue;
    const u=i/(rows.length-1),v=(i+1)/(rows.length-1);
    Geo.tri(verts,a,b,c,null,[u,0],[u,1],[v,0]);Geo.tri(verts,b,e,c,null,[u,1],[v,1],[v,0]);
   }
   mesh(verts,[.22,.52,.90],{mode:5,alpha:m.visibility*.34,time:s.t/d.scale});
   if(rows.length>2)beam(rows.map(r=>r[1]),.85,[.65,1.15,1.55],m.visibility*.66);
  }
  if(s.after<0){
   const a=Math.sin(m.u*Math.PI)*.36;
   R.glow([T[0],T[1],9],d.to.w*.44,'#96c5e4',a);
  }else{
   const q=s.after/d.scale,a=Math.exp(-q*27),g=clamp(d.to.w/116,.48,1.25);
   R.glow(T,68*g,'#e2eeec',a*.76);
   sparks(T,q,42,'#dfedee',d.seed,g*1.05);
   sparks(T,q,14,'#ffcf8a',d.seed+81,g*.83);
   R.line([T[0]-26*g,T[1]+4*g,36],[T[0]+26*g,T[1]-4*g,36],1.5*g,'#eaf4ff',{mode:6,alpha:a});
  }
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
  const active=manual?instances:instances.filter(d=>now<d.impact+d.tail);
  if(!manual)instances=active;
  if(!active.length){if(dirty)R.clear();dirty=false;stats.active=0;stats.particles=0;stats.drawCalls=0;return;}
  R.camera();R.lamp=[0,0,120];R.lampColor=[.15,.21,.27];R.begin((now-active[0].start)/1000);
  for(const d of active){const state=sample(d,now);if(!state.alive)continue;
   if(d.kind==='breath')fire(d,state);else if(d.kind==='lightning')electricity(d,state);else slash(d,state);
  }
  const hasFire=active.some(d=>d.kind==='breath');
  R.flush();R.end({bloom:hasFire?.28:(quality.low?.34:.46),bloomThreshold:hasFire?.78:.28,referenceFlame:hasFire});dirty=true;
  stats={...stats,active:active.length,drawCalls:R.count,particles:R.particles.length/9,frames:stats.frames+1,hdr:R.hdr};
 }
 function clear(){instances=[];manual=null;R.clear();dirty=false;stats.active=0;stats.particles=0;stats.drawCalls=0;}
 function replay(ms){if(!last)return false;manual=true;instances=[{...last,start:0,impact:last.impact-last.start}];draw(ms);return true;}
 function advance(now){if(!manual)draw(now);}
 function setQuality(q){quality={...quality,...q};if(quality.reduced)clear();else{stage(W,H);dirty=true;}}
 return {emit,draw:advance,stage,clear,setQuality,replay,resume(){manual=null;instances=[];dirty=true;},
  get available(){return !quality.reduced;},get stats(){return {...stats};},get last(){return last?{...last,from:{...last.from},to:{...last.to}}:null;},get trace(){return trace.slice();},
  diagnostics(){return{...stats,webgl:R.info(),error:R.gl.getError()};},
  destroy(){clear();R.gl.deleteBuffer(blade.b);R.destroy();},_sample:sample,_swordPose:swordPose};
 function makeBlade(){
  const out=[],outline=[[-.076,0],[-.061,.74],[0,.98],[.061,.74],[.076,0]];
  for(let side of [-1,1])for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length];const av=[a[0],a[1],0],bv=[b[0],b[1],0];Geo.tri(out,[0,.42,.040*side],side>0?bv:av,side>0?av:bv);
  }return out;
 }
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
