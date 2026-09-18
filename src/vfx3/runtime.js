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
const TAIL={breath:470,lightning:320,slash:420};
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
  const F=xyz(d.from,30),T=xyz(d.to,32),L=clamp(d.to.w*1.22,54,150);
  const aim=Math.atan2(T[1]-F[1],T[0]-F[0]),hit=(d.impact-d.start)/1000;
  const h=d.hold/1000,t2=t>hit?Math.max(hit,t-h):t;
  const approach=hit>0?ease(t2/hit):1,follow=ease((t2-hit)/.2);
  const a=aim-1.36*(1-approach)+.95*follow;
  const pivot0=V.mix(F,T,.6),pivot1=[T[0]-Math.cos(aim)*L*.80,T[1]-Math.sin(aim)*L*.80,32];
  const p=V.mix(pivot0,pivot1,approach);p[2]+=Math.sin(approach*Math.PI)*24;
  const mat=M.mul(M.T(...p),M.mul(M.Rz(a-Math.PI/2),M.mul(M.Ry(-.7+approach*.45+follow*.9),M.S(L))));
  return {mat,L,root:M.point(mat,[0,.14,0]),tip:M.point(mat,[0,.97,0]),contact:M.point(mat,[0,.80,0]),target:T};
 }
 function slash(d,s){
  const pose=swordPose(d,s.t),{mat,L,target:T}=pose;
  const alpha=env(s.t,0,s.hit+d.hold/1000+.36,.028,.13);
  if(alpha>.005){
   R.draw(blade,mat,'#889eb4',{roughness:.22,metal:.92,dissolve:1-alpha});
   R.draw(R.geo.box,M.mul(mat,M.trs([0,.40,.027],[0,0,0],[.008,.58,.006])),'#245674',{roughness:.3,metal:.85,dissolve:1-alpha});
   R.draw(R.geo.box,M.mul(mat,M.trs([0,-.025,0],[0,0,0],[.28,.043,.067])),'#b49962',{roughness:.28,metal:.8,dissolve:1-alpha});
   R.draw(R.geo.cyl,M.mul(mat,M.trs([0,-.17,0],[0,0,0],[.057,.26,.057])),'#27394b',{roughness:.62,metal:.1,dissolve:1-alpha});
   R.draw(R.geo.sphere,M.mul(mat,M.trs([0,-.315,0],[0,0,0],[.075,.075,.075])),'#9fd6fc',{roughness:.2,metal:.7,emission:.3,dissolve:1-alpha});
  }
  // Sample the SAME rigid blade transforms. Never enlarge the weapon for a smear.
  const rows=[];for(let i=0;i<15;i++){const tt=s.t-.105+i*.105/14;if(tt<0)continue;const p=swordPose(d,tt);rows.push([p.root,p.tip]);}
  const verts=[];for(let i=0;i<rows.length-1;i++){
   const [a,b]=rows[i],[c,e]=rows[i+1];if(V.len(V.sub(b,e))<.01)continue;
   const u=i/(rows.length-1),v=(i+1)/(rows.length-1);
   Geo.tri(verts,a,b,c,null,[u,0],[u,1],[v,0]);Geo.tri(verts,b,e,c,null,[u,1],[v,1],[v,0]);
  }
  if(alpha>.003){mesh(verts,[.15,.65,1.75],{mode:5,alpha:alpha*.54});if(rows.length>2)beam(rows.map(r=>r[1]),.85,[1.15,1.8,2.6],alpha*.72);}
  if(s.after>=0){
   const a=Math.exp(-s.after*19),dir=Math.atan2(T[1]-xyz(d.from)[1],T[0]-xyz(d.from)[0]);
   R.glow(T,d.to.w*.8,'#a9deff',a*.56);sparks(T,s.after,32,'#d6efff',d.seed,Math.min(1.1,d.to.w/116));
   const a0=[T[0]-Math.cos(dir+.9)*L*.4,T[1]-Math.sin(dir+.9)*L*.4,35],b0=[T[0]+Math.cos(dir+.9)*L*.4,T[1]+Math.sin(dir+.9)*L*.4,35];
   R.line(a0,b0,2.2,'#e2f6ff',{mode:6,alpha:a*.95});
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
  const origin={...d.from,x:d.from.x+d.from.w*.10,y:d.from.y-d.from.h*.10};
  const F=xyz(origin,28),T=xyz(d.to,28),D=V.sub(T,F),dist=V.len(D)||1,dir=V.scale(D,1/dist),side=[-dir[1],dir[0],0];
  const hit=Math.max(.06,s.hit),charge=Math.min(.08,hit*.28),travel=Math.max(.02,hit-charge);
  const gain=clamp(d.to.w/116,.48,1.2),end=s.hit+.135;
  const neck=env(s.t,0,end+.06,.035,.10);
  R.glow(F,48*gain,'#ff731d',neck*.62);ring(F,17*gain,'#ffbb63',neck*.65,.5,s.t*1.1,0);
  // Birth-relative positions: released fire never stretches with the moving source.
  const step=quality.low?.016:.007;
  const smoke=[],flames=[];
  for(let birth=charge,j=0;birth<=end;birth+=step,j++){
   const age=s.t-birth;if(age<0||age>travel+.30)continue;
   const progress=Math.min(1,age/travel),beyond=Math.max(0,age-travel),u=progress;
   for(let k=0;k<(quality.low?2:3);k++){
    const seed=d.seed+j*19+k*3,phase=rnd(seed)*6.283+age*6,spread=(3+u*18)*gain;
    const curl=beyond*(28+rnd(seed+4)*44),offset=Math.sin(phase)*spread;
    const p=[F[0]+D[0]*u+side[0]*(offset+Math.sin(phase)*curl),F[1]+D[1]*u+side[1]*(offset+Math.sin(phase)*curl)+beyond*20,F[2]+Math.cos(phase)*spread+u*7+beyond*18];
    const alpha=ease(age/.020)*(1-ease(beyond/.27))*.87;
    const size=(22+u*39+beyond*35)*gain;
    if(alpha>.005){flames.push({p,size,alpha,seed});if(k===1&&beyond>.02)smoke.push({p:[p[0],p[1]+beyond*36,p[2]-9],size:size*1.40,alpha:alpha*.20,seed});}
   }
  }
  // A real tapered 3D flow shell supplies a continuous silhouette between puffs.
  // Rigid ring cross-sections move forward; this never deforms the source card.
  const frontU=clamp((s.t-charge)/travel),backU=clamp((s.t-end)/travel);
  if(frontU>backU+.005){
   const shell=[];const slices=quality.low?19:35,sides=quality.low?7:10;
   function at(i,j){const u=mix(backU,frontU,i/slices),angle=j/sides*Math.PI*2;
    const radius=(3+23*u)*gain*(.85+.15*Math.sin(u*27-s.t*18+angle*3));
    const off=Math.sin(u*Math.PI)*Math.sin(u*14-s.t*6)*4*gain;
    return [F[0]+D[0]*u+side[0]*(Math.cos(angle)*radius+off),F[1]+D[1]*u+side[1]*(Math.cos(angle)*radius+off),F[2]+Math.sin(angle)*radius+u*7];}
   for(let i=0;i<slices;i++)for(let j=0;j<sides;j++){
    const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),e=at(i,j+1),u=mix(backU,frontU,i/slices),v=mix(backU,frontU,(i+1)/slices);
    Geo.tri(shell,a,b,c,null,[u,j/sides],[v,j/sides],[v,(j+1)/sides]);Geo.tri(shell,a,c,e,null,[u,j/sides],[v,(j+1)/sides],[u,(j+1)/sides]);
   }
   mesh(shell,'#ff721b',{mode:10,alpha:.84*(1-ease(Math.max(0,s.t-end)/travel)),add:false,transparent:true,surface:d.seed});
  }
  smoke.sort((a,b)=>a.p[2]-b.p[2]);flames.sort((a,b)=>a.p[2]-b.p[2]);
  for(const q of smoke)sprite(q.p,q.size,'#483025',q.alpha,9,q.seed);
  for(const q of flames)sprite(q.p,q.size,'#ff8125',q.alpha,8,q.seed,q.seed*.41);
  const front=clamp((s.t-charge)/travel);if(s.t>=charge&&s.t<hit+.20){
   const p=V.mix(F,T,front);R.glow(p,36*gain,'#ffb758',.30*neck);
  }
  for(let i=0;i<(quality.low?22:66);i++){
   const birth=charge+rnd(d.seed+i*7)*(end-charge),age=s.t-birth;if(age<0||age>.45)continue;
   const u=clamp(age/travel),spread=Math.sin(i*2.4+age*9)*(4+u*25)*gain;
   const p=[F[0]+D[0]*u+side[0]*spread+dir[0]*Math.max(0,age-travel)*40,F[1]+D[1]*u+side[1]*spread+age*25,F[2]+rnd(i+70)*22];
   R.particle(p,(1+rnd(i+2)*1.5)*gain,i%4?'#ffb556':'#ffe5af',(1-age/.45)*.8,i%5?2:1);
  }
  if(s.after>=0){const a=Math.exp(-s.after*8);R.glow(T,d.to.w*.95,'#ff7319',a*.24);sparks(T,s.after,26,'#ffbd66',d.seed, gain);}
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
  R.flush();R.end({bloom:quality.low?.34:.46});dirty=true;
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
  const out=[],outline=[[-.062,0],[-.064,.72],[0,.98],[.064,.72],[.062,0]];
  for(let side of [-1,1])for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length];const av=[a[0],a[1],0],bv=[b[0],b[1],0];Geo.tri(out,[0,.46,.025*side],side>0?bv:av,side>0?av:bv);
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
const api={create,supports:kind=>!!KIND[kind],descriptor,sample,TAIL};
G.EmberVFX3=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
