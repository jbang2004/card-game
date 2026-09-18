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
 o=o||{};
 if(!KIND[kind]||!valid(o.from)||!valid(o.to))return null;
 const start=Number.isFinite(o.startedAt)?o.startedAt:now;
 const lead=Math.max(0,Number(o.leadMs)||0);
 const impact=Number.isFinite(o.contactAt)?o.contactAt:start+lead;
 const scale=clamp(Number(o.timeScale)||1,.1,1);
 return {kind:KIND[kind],sourceKind:kind,from:{...o.from},to:{...o.to},start,impact:Math.max(start,impact),
   hold:Math.max(0,Number(o.hitStopMs)||0),tail:TAIL[KIND[kind]]*scale,seed:Number(o.seed)||7,
   tier:clamp(o.tier||2,1,3),scale,tint:Array.isArray(o.tint)?o.tint.slice():null,
   targetRef:o.targetRef?{side:o.targetRef.side,uid:o.targetRef.uid}:null};
}
function sample(d,now){
 const t=(now-d.start)/1000,hit=(d.impact-d.start)/1000,after=t-hit;
 return {t,hit,after,alive:now>=d.start&&now<d.impact+d.tail,phase:t<0?'待机':after<0?'释放':after<.075?'命中':'余韵'};
}

// R5: a straight, screen-top strike. The deadline is supplied by the rules
// director; a short visible descent uses its last 160ms, not the whole windup.
const SWORDFALL = Object.freeze({fallMs:160, holdMs:65, dissolveAt:.34,
  dissolveEnd:.68, crackEnd:.94, offscreenMargin:38});
function cleaveMotion(d,t){
 const hit=(d.impact-d.start)/1000,post=(t-hit)/d.scale;
 const flight=Math.min(hit,SWORDFALL.fallMs/1000*d.scale);
 const enter=hit-flight,u=flight>0?clamp((t-enter)/flight):1;
 // Nonzero entry velocity, increasing throughout; no slow elevator arrival.
 const drop=.32*u+.68*u*u;
 const visibility=t<enter?0:1-ease((post-SWORDFALL.dissolveAt)/(SWORDFALL.dissolveEnd-SWORDFALL.dissolveAt));
 return {u,wind:0,drop,sign:1,angle:Math.PI,yaw:.22,post,
  hold:Math.max(SWORDFALL.holdMs/1000,Math.min(.09,(d.hold||0)/1000/d.scale)),
  recover:0,flight,enter,visibility:t<0?0:visibility};
}
// Deterministic cracks in card-local coordinates. Leave title/stat margins.
function cardFracturePaths(seed=7){
 const rays=[[-.43,.30],[-.44,-.16],[-.25,-.40],[.13,-.41],[.43,-.25],[.44,.18],[.22,.43],[-.12,.43]];
 const paths=[];
 for(let i=0;i<rays.length;i++){
  const end=rays[i],len=Math.hypot(...end),per=[-end[1]/len,end[0]/len],pts=[[0,0]];
  for(let j=1;j<=5;j++){
   const f=j/5,jitter=j===5?0:(rnd(seed+i*29+j*7)-.5)*.055;
   pts.push([end[0]*f+per[0]*jitter,end[1]*f+per[1]*jitter]);
  }
  paths.push({points:pts,width:i%3===0?1.30:.88,delay:i*.003,branch:false});
  for(let j of [2,4]){
   const a=pts[j],side=(i+j)%2?1:-1,q=.060+rnd(seed+i*43+j)*.035;
   const b=[clamp(a[0]+end[0]*.11+per[0]*q*side,-.445,.445),clamp(a[1]+end[1]*.11+per[1]*q*side,-.42,.43)];
   const c=[clamp(b[0]+end[0]*.10-per[0]*q*.25*side,-.445,.445),clamp(b[1]+end[1]*.10-per[1]*q*.25*side,-.42,.43)];
   paths.push({points:[a,b,c],width:.42,delay:.018+j*.010,branch:true});
  }
 }
 return paths;
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

function create(canvas,options={}){
 const X=G.Ember3D,{M,V,Geo}=X,R=new X.Renderer(canvas);
 let W=1600,H=940,quality={low:false,reduced:false},instances=[],last=null,manual=null,uid=0,lastNow=0,dirty=true;
 let stats={active:0,drawCalls:0,particles:0,renderer:'mesh3d',frames:0};
 const trace=[];
 let swordFrame=null;
 const blade=R.mesh(makeBlade());
 const tmp=R.dynamic;
 const bladeParts=makeSwordParts();
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
  const m=cleaveMotion(d,t),L=clamp(d.to.w*1.26,67,172);
  // Entry targets the portrait, not the floor or the numeric badges below it.
  const T=xyz({...d.to,y:d.to.y-d.to.h*.055},36);
  const startY=H/2+SWORDFALL.offscreenMargin;
  const tip=[T[0],mix(startY,T[1],m.drop),T[2]];
  const rot=M.mul(M.Rz(Math.PI),M.Ry(m.yaw));
  const mat=M.mul(M.T(...tip),M.mul(rot,M.mul(M.S(L),M.T(0,-.98,0))));
  return {mat,L,root:M.point(mat,[0,.14,0]),tip:M.point(mat,[0,.98,0]),
   contact:M.point(mat,[0,.98,0]),target:T,motion:m};
 }
 function flatStrip(verts,a,b,width){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.0001)return;
  const x=-dy/len*width*.5,y=dx/len*width*.5;
  const p=[a[0]+x,a[1]+y,a[2]],q=[a[0]-x,a[1]-y,a[2]],r=[b[0]-x,b[1]-y,b[2]],v=[b[0]+x,b[1]+y,b[2]];
  Geo.tri(verts,p,q,r,[0,0,1]);Geo.tri(verts,p,r,v,[0,0,1]);
 }
 function cardCracks(d,s,T){
  const q=s.after/d.scale;if(q<0||q>=SWORDFALL.crackEnd)return;
  const f=fractureAt(q),g=clamp(d.to.w/116,.43,1.5);
  const dark=[],rim=[],light=[],tips=[];
  const paths=d.cracks||(d.cracks=cardFracturePaths(d.seed));
  for(const path of paths){
   const growth=clamp((q-path.delay)/.145),pts=path.points;
   for(let j=0;j<pts.length-1;j++){
    const p=pts[j],v=pts[j+1],r0=Math.hypot(...p)/.60,r1=Math.hypot(...v)/.60;
    const progress=clamp((growth-r0)/Math.max(.025,r1-r0));if(progress<=0)continue;
    const end=[mix(p[0],v[0],progress),mix(p[1],v[1],progress)];
    const a=[T[0]+p[0]*d.to.w,T[1]+p[1]*d.to.h,18],b=[T[0]+end[0]*d.to.w,T[1]+end[1]*d.to.h,18];
    const w=(1.6+2.1*(1-r0))*g*path.width*f.open;
    flatStrip(dark,a,b,w);
    flatStrip(rim,[a[0]+.75*g,a[1]-.8*g,18.1],[b[0]+.75*g,b[1]-.8*g,18.1],Math.max(.45,w*.28));
    flatStrip(light,[a[0],a[1],18.2],[b[0],b[1],18.2],Math.max(.36,.64*g*path.width));
    if(progress<1&&!path.branch)tips.push(b);
   }
  }
  // Dark recess + one lit broken edge, not glowing spokes pasted over the card.
  mesh(dark,'#02050a',{mode:6,alpha:f.fade*.98,add:false,transparent:true});
  mesh(rim,'#bfd3dd',{mode:6,alpha:f.fade*.60,add:false,transparent:true});
  mesh(light,[.30,.84,1.35],{mode:6,alpha:Math.exp(-q*5)*.86});
  for(const p of tips)R.glow(p,7*g,'#c9eaff',Math.exp(-q*8)*.46);
  // The puncture itself sits on the card. Its lower lip occludes the last
  // pixels of the point, making insertion read without bending the blade.
  const hole=[],lip=[],spread=clamp(q/.028),hw=(2.5+spread*4)*g,hh=(2+spread*3.2)*g;
  for(let i=0;i<12;i++){
   const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2,ra=.80+rnd(i+d.seed)*.20,rb=.80+rnd(i+1+d.seed)*.20;
   const p=[T[0]+Math.cos(a)*hw*ra,T[1]+Math.sin(a)*hh*ra,37],v=[T[0]+Math.cos(b)*hw*rb,T[1]+Math.sin(b)*hh*rb,37];
   Geo.tri(hole,[T[0],T[1],37],p,v,[0,0,1]);
   if(Math.sin(a)<0)flatStrip(lip,p,v,1.25*g);
  }
  mesh(hole,'#03080e',{mode:6,alpha:f.fade,add:false,transparent:true});
  mesh(lip,'#e4dbc5',{mode:6,alpha:f.fade*.8,add:false,transparent:true});
  // Tiny rigid chips, not oversized blocks or tearing the original artwork.
  for(let i=0;i<(quality.low?8:19);i++){
   const seed=d.seed+i*37,delay=rnd(seed)*.028,age=q-delay,life=.28+rnd(seed+1)*.28;
   if(age<0||age>life)continue;
   const angle=rnd(seed+2)*Math.PI*2,speed=(48+rnd(seed+3)*100)*g;
   const p=[T[0]+Math.cos(angle)*speed*age,T[1]+Math.sin(angle)*speed*age-130*age*age*g,T[2]+age*(70+rnd(seed+4)*90)-190*age*age];
   const sz=(1.6+rnd(seed+5)*2.5)*g,a=(1-ease((age-life*.4)/(life*.6)))*.92;
   R.fx('rock',p,[sz,sz*.50,sz*.7],i%4?'#829bac':'#d1b889',[age*12+seed,age*7,age*5],
    {mode:0,alpha:a,roughness:.54,metal:.38,transparent:true,add:false});
  }
  // Fine neutral dust. It dissipates before the last fissures, never a fog wall.
  for(let i=0;i<(quality.low?3:7);i++){
   const age=q-.025-rnd(i+d.seed)*.04;if(age<0||age>.47)continue;
   const a=i/7*Math.PI*2,rad=(6+age*50)*g;
   sprite([T[0]+Math.cos(a)*rad,T[1]+Math.sin(a)*rad*.58+age*24*g,20],
    (12+age*35)*g,'#8ea3b0',env(age,0,.47,.045,.26)*.15,9,d.seed+i,a);
  }
 }
 function slash(d,s){
  const pose=swordPose(d,s.t),{mat,L,target:T,motion:m}=pose,g=clamp(d.to.w/116,.43,1.5);
  swordFrame={id:d.id,tip:pose.tip.slice(),target:T.slice(),length:L,time:s.t,visible:m.visibility,box:{...d.to}};
  // One straight path; steel stays opaque and invariant, trail is independent.
  if(m.visibility>.002){
   const opt={roughness:.25,metal:.82,dissolve:1-m.visibility,emission:.09};
   R.draw(blade,mat,'#adbdcc',opt);
   for(const part of bladeParts)R.draw(part.geo,M.mul(mat,part.mat),part.color,{...opt,...part.opt});
   const lineA=M.point(mat,[0,.18,.052]),lineB=M.point(mat,[0,.78,.019]);
   R.line(lineA,lineB,.45*g,[.26,.68,1.05],{mode:6,alpha:.63*m.visibility});
   if(s.after<.02){
    const shine=Math.max(0,1-Math.abs((m.u-.82)/.18));
    R.glow(M.point(mat,[0,.22,.075]),18*g,'#ecfaff',shine*.30);
   }
  }
  // Two tapering edge wakes sampled from past blade positions. The sword is
  // never scaled to make a streak; straight motion requires no curved ribbon.
  if(s.t>=m.enter&&s.after<.065*d.scale){
   const fade=s.after<0?1:1-s.after/(.065*d.scale);
   const top=swordPose(d,Math.max(m.enter,Math.min(s.t,s.hit)-.055*d.scale));
   const cur=swordPose(d,Math.min(s.t,s.hit));
   for(const side of [-1,1]){
    const a=M.point(top.mat,[side*.070,.06,.020]),b=M.point(cur.mat,[side*.048,.82,.020]);
    const ps=[];for(let i=0;i<9;i++){
     const u=i/8,base=V.mix(a,b,u),w=(.3+1.8*u)*g;
     ps.push([base[0]-w,base[1],27],[base[0]+w,base[1],27]);
    }
    const v=[];for(let i=0;i<8;i++){
     const u=i/8,z=(i+1)/8;Geo.tri(v,ps[i*2],ps[i*2+1],ps[i*2+2],null,[u,0],[u,1],[z,0]);
     Geo.tri(v,ps[i*2+1],ps[i*2+3],ps[i*2+2],null,[u,1],[z,1],[z,0]);
    }
    mesh(v,[.25,.61,1.0],{mode:5,alpha:.42*fade,time:s.t/d.scale});
   }
   // Detached short air streaks remain parallel to screen Y.
   for(let i=0;i<4;i++){
    const x=T[0]+(i%2?-1:1)*(15+i*4)*g,y=pose.tip[1]+L*(.45+i*.17);
    R.line([x,y+33*g,22],[x,y,22],.65*g,'#b1d8f4',{mode:6,alpha:.35*fade*Math.sin(m.u*Math.PI)});
   }
  }
  if(s.after>=0){
   const q=s.after/d.scale,flash=Math.exp(-q*38);
   cardCracks(d,s,T);
   R.glow([T[0],T[1],40],40*g,'#deefff',flash*.85);
   R.glow([T[0],T[1],40],16*g,[1.7,2.1,2.8],flash*.66);
   // One asymmetric impact star; long sparks point away from the puncture.
   if(q<.085){
    const a=(1-q/.085)**1.6;
    for(let i=0;i<7;i++){
     const ang=i/7*Math.PI*2+.19,r=(13+rnd(d.seed+i)*22)*g*(.7+q*7);
     R.line([T[0]+Math.cos(ang)*4*g,T[1]+Math.sin(ang)*4*g,41],
      [T[0]+Math.cos(ang)*r,T[1]+Math.sin(ang)*r*.75,41],(i%2?1:1.55)*g,'#e8f2ef',{mode:6,alpha:a});
    }
   }
   sparks([T[0],T[1],42],q,38,'#e9f4ff',d.seed,g*.82);
   sparks([T[0],T[1],42],q,19,'#f6c780',d.seed+91,g*.90);
   if(q<.20){
    const k=clamp(q/.20),r=(4+Math.sin(k*Math.PI/2)*35)*g;
    R.fx('ring',[T[0],T[1],19],[r,r*.48,r],'#97bace',[Math.PI/2,0,0],{mode:6,alpha:(1-k)**2*.30});
   }
  }
 }
 // Hand-authored faceted silver blade, champagne bevels, dark fuller and a
 // gemstone hilt. These are static meshes, not generated anew each frame.
 function makeSwordParts(){
  const parts=[];
  const add=(geo,mat,color,opt={})=>parts.push({geo,mat,color,opt});
  const facet=(poly,depth=.020)=>{
   const out=[],cx=poly.reduce((n,p)=>n+p[0],0)/poly.length,cy=poly.reduce((n,p)=>n+p[1],0)/poly.length;
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    Geo.tri(out,[cx,cy,depth],[a[0],a[1],0],[b[0],b[1],0]);
    Geo.tri(out,[cx,cy,-depth],[b[0],b[1],0],[a[0],a[1],0]);
   }return R.mesh(out);
  };
  for(let sg of [-1,1]){
   const edge=facet([[sg*.052,.02],[sg*.075,.02],[sg*.057,.75],[0,.98],[sg*.033,.73]],.007);
   add(edge,M.T(0,0,.022),sg<0?'#e8f1f2':'#c5d4df',{roughness:.19,emission:.15});
  }
  const fuller=facet([[-.022,.065],[-.017,.60],[0,.80],[.017,.60],[.022,.065]],.006);
  add(fuller,M.T(0,0,.042),'#263c58',{roughness:.36,metal:.52,emission:.05});
  const guard=facet([[-.22,-.075],[-.20,-.004],[-.095,.055],[0,.027],[.095,.055],[.20,-.004],[.22,-.075],[.16,-.045],[.065,-.012],[0,-.05],[-.065,-.012],[-.16,-.045]],.030);
  add(guard,M.T(0,0,.005),'#d4bc87',{roughness:.22,metal:.85,emission:.06});
  add(R.geo.cyl,M.trs([0,-.18,0],[0,0,0],[.054,.25,.054]),'#162437',{metal:.15,roughness:.70});
  for(let i=0;i<6;i++)add(R.geo.cyl,M.trs([0,-.084-i*.037,0],[0,0,0],[.059,.012,.059]),'#a99369',{metal:.76,roughness:.32});
  const gem=facet([[0,.048],[-.043,0],[0,-.055],[.043,0]],.045);
  add(gem,M.T(0,-.017,.040),'#9eddf0',{metal:.4,roughness:.15,emission:.22});
  add(gem,M.mul(M.T(0,-.326,0),M.S(.65)),'#c7dce8',{metal:.7,roughness:.25});
  for(let i=0;i<5;i++){
   const mark=facet([[0,.012],[-.009,0],[0,-.012],[.009,0]],.001);
   add(mark,M.T(0,.16+i*.083,.052),'#9fd4ed',{mode:6,emission:0});
  }
  return parts;
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
   if(d.kind==='breath')fire(d,state);else if(d.kind==='lightning')electricity(d,state);else {
    let visual=d;
    if(!manual&&state.after>=0&&d.targetRef&&options.resolveTarget){
     const target=options.resolveTarget(d.targetRef);
     if(!valid(target))continue; // Removed/dead card: no cracks left on its old slot.
     visual={...d,to:{...target},cracks:d.cracks};
    }
    slash(visual,state);
   }
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
  diagnostics(){return{...stats,sword:swordFrame?{...swordFrame}:null,webgl:R.info(),error:R.gl.getError()};},
  destroy(){clear();const owned=new Set([blade,...bladeParts.map(p=>p.geo)]);for(const geo of owned)if(!Object.values(R.geo).includes(geo))R.gl.deleteBuffer(geo.b);R.destroy();},_sample:sample,_swordPose:swordPose};
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
const api={create,supports:kind=>!!KIND[kind],descriptor,sample,TAIL,cleaveMotion,breathClock,flameMapping,fractureAt,SWORDFALL,cardFracturePaths};
G.EmberVFX3=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
