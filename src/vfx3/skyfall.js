/* Skyfall R5: screen-top strike. Rigid steel, one contact, card-surface fractures.
 * No rule writes, no timers, no independent renderer. Uses Ember3D.Renderer.
 * Coordinates: stage x/y; z is toward the camera. All sizes are CSS-stage units.
 */
(function (G) {
'use strict';
const C=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const E=x=>{x=C(x);return x*x*(3-2*x);};
const L=(a,b,u)=>a+(b-a)*u;
const random=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const SPEC=Object.freeze({flight:.12,hold:.065,bladeHold:.34,bladeFade:.28,
 crackGrow:.16,crackHold:.48,crackFade:.48,tail:1120,hitY:.10});
function motion(d,t){
 const hit=(d.impact-d.start)/1000,post=(t-hit)/d.scale;
 const flight=Math.min(SPEC.flight*d.scale,Math.max(0,hit)),launch=hit-flight;
 const u=flight>0?C((t-launch)/flight):(t>=hit?1:0);
 const drop=.28*u+.72*u*u; // high initial speed, accelerating; no ease-out at contact
 const visible=t>=launch&&t>=0;
 return {u,drop,launch,flight,post,hold:SPEC.hold,angle:Math.PI,yaw:-.22,
  visibility:visible?1-E((post-SPEC.bladeHold)/SPEC.bladeFade):0,
  phase:t<launch?'待机':post<0?'贯入':post<SPEC.hold?'命中':post<SPEC.bladeHold?'定刃':'消散'};
}
function pose(d,t,W,H,M){
 const m=motion(d,t),len=C(d.to.w*1.55,80,210);
 const T=[d.to.x-W/2,H/2-(d.to.y+d.to.h*SPEC.hitY),32];
 const startY=H/2+Math.max(40,len*.20); // even the TIP is outside the stage
 const tip=[T[0],L(startY,T[1],m.drop),T[2]];
 // The only rotation is a constant face yaw. Screen x never changes.
 const mat=M.mul(M.T(...tip),M.mul(M.Rz(Math.PI),M.mul(M.Ry(m.yaw),M.mul(M.S(len),M.T(0,-.98,0)))));
 return {mat,L:len,root:M.point(mat,[0,.14,0]),tip:M.point(mat,[0,.98,0]),
  contact:M.point(mat,[0,.98,0]),target:T,motion:m};
}
function fractureAt(t){return {growth:1-(1-C(t/SPEC.crackGrow))**3,
 open:E(t/.05),fade:1-E((t-SPEC.crackHold)/SPEC.crackFade)};}
/* Authored irregular radial cracks. Every branch inherits its parent's birth
 * distance, so it cannot appear disconnected or before the impact. */
function crackPaths(d){
 const paths=[],angles=[-.10,.62,1.34,2.04,2.78,3.49,4.20,5.08,5.72];
 for(let j=0;j<angles.length;j++){
  const a=angles[j]+(random(d.seed+j*13)-.5)*.17;
  const rad=.79+random(d.seed+j*17)*.18,pts=[[0,0,0]];
  for(let i=1;i<=5;i++){
   const u=i/5,wiggle=(random(d.seed+j*71+i*19)-.5)*.22*Math.sin(u*Math.PI);
   const x=C(Math.cos(a+wiggle)*u*rad*.46,-.46,.46)*d.to.w;
   const y=C(Math.sin(a+wiggle)*u*rad*(Math.sin(a)>0?.47:.27),-.28,.48)*d.to.h;
   pts.push([x,y,u]);
  }
  paths.push({pts,width:j%3===0?2.45:1.65,branch:false});
  if(j%2===0){
   const p=pts[3],ang=a+(j%4===0?.62:-.58);
   paths.push({pts:[p,[C(p[0]/d.to.w+Math.cos(ang)*.075,-.46,.46)*d.to.w,
    C(p[1]/d.to.h+Math.sin(ang)*.08,-.28,.48)*d.to.h,.73],
    [C(p[0]/d.to.w+Math.cos(ang+.22)*.15,-.46,.46)*d.to.w,
     C(p[1]/d.to.h+Math.sin(ang+.22)*.13,-.28,.48)*d.to.h,.93]],width:.85,branch:true});
  }
 }
 return paths;
}
function create(R,X){
 const {M,V,Geo}=X;
 const face=(points,z)=>{const out=[];for(let i=1;i<points.length-1;i++)Geo.tri(out,
  [...points[0],z],[...points[i],z],[...points[i+1],z]);return out;};
 const blade=R.mesh((()=>{const o=[],sections=[[0,.077],[.09,.087],[.68,.060],[.82,.038],[.98,0]];
  for(let s of [-1,1])for(let i=0;i<sections.length-1;i++){
   const [y,w]=sections[i],[yn,wn]=sections[i+1],ridge=.031*s;
   for(let k of [-1,1]){const a=[0,y,ridge],b=[w*k,y,0],c=[wn*k,yn,0],e=[0,yn,ridge*.85];
    Geo.tri(o,a,b,c);Geo.tri(o,a,c,e);}
  }return o;})());
 const guard=R.mesh((()=>{const o=[],pts=[[-.235,-.052],[-.16,-.070],[-.080,-.041],[0,-.018],[.080,-.041],[.16,-.070],[.235,-.052],[.17,-.012],[.074,.013],[-.074,.013],[-.17,-.012]];
  o.push(...face(pts,.042));for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];Geo.tri(o,[...a,.042],[...b,.042],[...b,-.042]);Geo.tri(o,[...a,.042],[...b,-.042],[...a,-.042]);}return o;})());
 const inset=R.mesh(face([[-.016,.09],[0,.76],[.016,.09],[0,.055]],.035));
 const jewel=R.mesh((()=>{const o=[],v=[[0,.05,0],[.041,0,0],[0,-.05,0],[-.041,0,0]];for(let i=0;i<4;i++)Geo.tri(o,[0,0,.035],v[i],v[(i+1)%4]);return o;})());
 function segment(out,a,b,w,z){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.0001)return;
  const n=[-dy/len*w,dx/len*w],a0=[a[0]+n[0],a[1]+n[1],z],a1=[a[0]-n[0],a[1]-n[1],z],b0=[b[0]+n[0],b[1]+n[1],z],b1=[b[0]-n[0],b[1]-n[1],z];
  Geo.tri(out,a0,a1,b0);Geo.tri(out,a1,b1,b0);
 }
 function ellipse(out,p,rx,ry,z,n=24){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;Geo.tri(out,[p[0],p[1],z],[p[0]+Math.cos(a)*rx,p[1]+Math.sin(a)*ry,z],[p[0]+Math.cos(b)*rx,p[1]+Math.sin(b)*ry,z]);}}
 function quad(data,c,alpha,z=0,add=false){if(data.length&&alpha>.002)R.dynamicFX(data,c,{mode:6,alpha,add,transparent:!add});}
 function weapon(p){
  const a=p.motion.visibility;if(a<.003)return;const mat=p.mat;
  const opt={metal:.84,roughness:.23,alpha:a,transparent:a<.999,emission:.10};
  R.draw(blade,mat,'#a8c2d3',opt);
  R.draw(inset,mat,'#15354f',{...opt,metal:.38,emission:.16});
  R.draw(guard,mat,'#bc9461',{...opt,roughness:.34});
  const part=(kind,pos,sc,col,rot=[0,0,0],o={})=>R.draw(R.geo[kind],M.mul(mat,M.trs(pos,rot,sc)),col,{...opt,...o});
  part('cyl',[0,-.185,0],[.056,.25,.056],'#172c3d',[0,0,0],{metal:.12,roughness:.75});
  for(let j=0;j<7;j++)part('box',[0,-.09-j*.028,.026],[.058,.006,.011],'#a18760',[0,0,.16]);
  part('sphere',[0,-.324,0],[.088,.10,.055],'#bc9461');
  R.draw(jewel,M.mul(mat,M.T(0,-.027,.043)),'#71ccf4',{...opt,emission:.8,metal:.22});
  R.draw(jewel,M.mul(mat,M.mul(M.T(0,-.327,.027),M.S(.58))),'#8ad3f3',{...opt,emission:.45});
  // A fine silver bevel on each edge, not a full-white emissive blade.
  const trim=[];
  for(const sg of [-1,1]){
   const points=[[sg*.071,.014,.009],[sg*.080,.09,.008],[sg*.055,.68,.008],[sg*.034,.82,.006],[0,.974,.002]];
   for(let i=0;i<points.length-1;i++){
    const a=M.point(mat,points[i]),b=M.point(mat,points[i+1]);segment(trim,a,b,.46,a[2]);
   }
  }
  quad(trim,'#d8e6ec',a*.7,0,true);
 }
 function cracks(d,p,age,low){
  if(age<0||age>=.96)return;
  const f=fractureAt(age),g=C(d.to.w/116,.45,1.4),T=p.target;
  const dark=[],bevel=[],light=[],halo=[];
  for(const path of crackPaths(d))for(let i=0;i<path.pts.length-1;i++){
   const a=path.pts[i],b=path.pts[i+1],v=C((f.growth-a[2])/Math.max(.001,b[2]-a[2]));if(v<=0)continue;
   const pa=[T[0]+a[0],T[1]+a[1]],pb=[T[0]+L(a[0],b[0],v),T[1]+L(a[1],b[1],v)];
   const w=path.width*g*(1-a[2]*.70)*f.open;
   segment(halo,pa,pb,w+1.2*g,34);segment(dark,pa,pb,w,35);
   const edgeA=[pa[0]+.75*g,pa[1]-.5*g],edgeB=[pb[0]+.75*g,pb[1]-.5*g];
   segment(bevel,edgeA,edgeB,Math.max(.3,w*.25),36);
   segment(light,pa,pb,Math.max(.14,w*.15),37);
  }
  // Readable dark fractures with fine illuminated interiors, inside the card.
  quad(halo,'#39526c',f.fade*.30);quad(dark,'#060e19',f.fade*.96);
  quad(bevel,'#b3c1c7',f.fade*.65);quad(light,'#65b8ec',f.fade*(.24+.62*Math.exp(-age*8)),0,true);
  const hole=[],rim=[];ellipse(hole,T,10*g*f.open,5*g*f.open,40,18);
  quad(hole,'#07111c',f.fade*.98);
  // Front lip hides the last few blade pixels: a puncture, not a floating tip.
  for(let i=0;i<12;i++){
   const a=Math.PI+i/12*Math.PI,b=Math.PI+(i+1)/12*Math.PI;
   const a0=[T[0]+Math.cos(a)*10*g,T[1]+Math.sin(a)*5*g,43],a1=[T[0]+Math.cos(a)*14*g,T[1]+Math.sin(a)*8*g,44];
   const b0=[T[0]+Math.cos(b)*10*g,T[1]+Math.sin(b)*5*g,43],b1=[T[0]+Math.cos(b)*14*g,T[1]+Math.sin(b)*8*g,44];
   Geo.tri(rim,a0,b0,b1);Geo.tri(rim,a0,b1,a1);
  }quad(rim,'#617686',f.fade*.84);
  // Fixed-size material shards; ballistic motion is evaluated from birth time.
  for(let i=0;i<(low?7:17);i++){
   const k=d.seed+i*31,delay=random(k)*.025,t=age-delay,life=.22+random(k+1)*.29;if(t<0||t>life)continue;
   const ang=random(k+2)*Math.PI*2,sp=(45+random(k+3)*135)*g;
   const pt=[T[0]+Math.cos(ang)*sp*t,T[1]+Math.sin(ang)*sp*t*.52+28*g*t-140*g*t*t,48+80*g*t-130*g*t*t];
   const sz=(2+random(k+4)*3.9)*g,alpha=(1-E((t-life*.55)/(life*.45)))*f.fade;
   R.fx('rock',pt,[sz,sz*.42,sz*.80],i%3===0?'#c0ad86':'#8096a3',[t*9+k,t*6,t*4],{mode:0,alpha,transparent:true,add:false,roughness:.65,metal:.28});
  }
 }
 function flash(d,p,q,low){
  if(q<0)return;const T=p.target,g=C(d.to.w/116,.45,1.4),a=Math.exp(-q*29);
  if(q<.18){
   R.glow([T[0],T[1],48],72*g,'#71acdf',a*.76);
   R.glow([T[0],T[1],50],28*g,'#fff3d6',a);
   const rays=[];
   for(let j=0;j<8;j++){
    const ang=j*Math.PI/4+.08,len=(j%2===0?43:20)*g*(.5+E(q/.045));
    const dir=[Math.cos(ang),Math.sin(ang)],n=[-dir[1],dir[0]];
    Geo.tri(rays,[T[0]+n[0]*2.3*g,T[1]+n[1]*2.3*g,49],[T[0]+dir[0]*len,T[1]+dir[1]*len*.64,49],[T[0]-n[0]*2.3*g,T[1]-n[1]*2.3*g,49]);
   }quad(rays,[1.6,1.55,1.3],a*.83,0,true);
  }
  for(let i=0;i<(low?20:54);i++){
   const k=d.seed+i*17,life=.15+random(k)*.33;if(q>life)continue;
   const ang=random(k+1)*Math.PI*2,sp=(80+random(k+2)*190)*g;
   const pos=[T[0]+Math.cos(ang)*sp*q,T[1]+Math.sin(ang)*sp*q*.63-180*g*q*q,52+40*q];
   const alpha=(1-q/life)**1.6;R.particle(pos,(1+random(k+3)*1.4)*g,i%4?'#c1e9ff':'#ffcf88',alpha,i%5===0?1:2);
   if(i%7===0){const prev=Math.max(0,q-.018);R.line([T[0]+Math.cos(ang)*sp*prev,T[1]+Math.sin(ang)*sp*prev*.63-180*g*prev*prev,52+40*prev],pos,.8*g,'#b3dcf5',{mode:6,alpha:alpha*.48});}
  }
  // Small wisps, deliberately lower contrast than the cracks and blade.
  if(q>.03&&q<.55)for(let i=0;i<(low?2:4);i++){
   const a=1-E((q-.13)/.40),x=(i-1.5)*(8+q*18)*g;
   const mat=M.trs([T[0]+x,T[1]+q*18*g,42],[Math.PI/2,0,i],[30*g,1,22*g]);
   R.fxList.push({geo:R.geo.plane,model:mat,color:'#91aaba',opt:{mode:9,alpha:a*.15,transparent:true,add:false,surface:i+13,time:q}});
  }
 }
 function render(d,s,W,H,low=false){
  const p=pose(d,s.t,W,H,M),m=p.motion,q=m.post;
  weapon(p);
  // A separate air streak, never a scaled/stretching copy of the sword.
  if(s.t>=m.launch&&(q<.035)&&m.visibility>0){
   const g=C(d.to.w/116,.45,1.4),end=p.tip,start=pose(d,Math.max(m.launch,s.t-.035*d.scale),W,H,M).tip;
   for(const [off,w,a]of [[0,4.5,.12],[-10,.7,.21],[10,.7,.21]]){
    R.line([end[0]+off*g,end[1]+p.L*.70,end[2]-3],[start[0]+off*g,Math.max(start[1]+p.L,H/2+20),start[2]-3],w*g,'#91d3ff',{alpha:a*(q<0?1:1-q/.035)});
   }
  }
  cracks(d,p,q,low);flash(d,p,q,low);
 }
 return {render,pose:(d,t,W,H)=>pose(d,t,W,H,M),destroy(){for(const g of [blade,guard,inset,jewel])R.gl.deleteBuffer(g.b);}};
}
const api={SPEC,motion,pose,fractureAt,crackPaths,create};
G.EmberSkyfall=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
