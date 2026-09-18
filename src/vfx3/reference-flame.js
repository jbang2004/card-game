/* Flame-only direct port from this conversation's Ember_Steel_VFX.
 * No dragon geometry, rig, card state, GPU context, or loop is created here.
 * dragon() and spark() below are verbatim source methods. Quantities stay in
 * the original authored world units/seconds; the host is a separate adapter.
 * Source SHA-256 and fixture provenance: docs/design/REFERENCE_FLAME_PORT.md.
 */
(function(G){'use strict';
const C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),L=(a,b,t)=>a+(b-a)*t;
const E=v=>{v=C(v);return C(v*v*v*(v*(v*6-15)+10));};
const env=(t,a,b,fi=.1,fo=.25)=>E((t-a)/fi)*(1-E((t-b+fo)/fo));
const r=n=>{let v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
const TAU=Math.PI*2;
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,s)=>a.map(v=>v*s),norm:a=>a.map(v=>v/(Math.hypot(...a)||1))};
const M={};
M.I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
M.mul=(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;};
M.T=(x=0,y=0,z=0)=>{let a=M.I();a[12]=x;a[13]=y;a[14]=z;return a;};
M.Rz=(r)=>{let c=Math.cos(r),s=Math.sin(r);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
M.point=(m,p)=>{let [x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w];};
function poseAt(kind,t){return {t,breath:env(t,.92,3.62,.18,.28),
 neckPitch:-.015+.10*env(t,.10,1.04,.55,.2)-.045*env(t,1.0,3.95,.22,.5),
 jaw:.055+.38*env(t,.45,3.9,.42,.6)};}
function dragonFrames(p){const neck=M.mul(M.T(-2.45,1.54,0),M.Rz(p.neckPitch));const jaw=M.mul(neck,M.mul(M.T(.78,.25,0),M.Rz(-p.jaw)));
 let mouth=M.point(neck,[1.66,.29,0]),dir=V.norm([1,-.115,0]);return {neck,jaw,mouth,dir};}
const X={poseAt};
// The reference camera's rotation, without its unrelated stage framing.
function view(p){const y=-.42,t=.43;return [Math.cos(y)*p[0]-Math.sin(y)*p[2],
 -Math.sin(y)*Math.sin(t)*p[0]+Math.cos(t)*p[1]-Math.cos(y)*Math.sin(t)*p[2],
 Math.sin(y)*Math.cos(t)*p[0]+Math.sin(t)*p[1]+Math.cos(y)*Math.cos(t)*p[2]];}
class Flame{
 constructor(){this.S={dragonFrames};this.density=1;this.frame=null;this.R={
  project:p=>{const q=view(p);return[q[0],-q[1],q[2]];},
  glow:(pos,size,color,alpha=1,ground=false)=>this.frame.glows.push({pos,size,color,alpha,ground}),
  particle:(pos,size,color,alpha=1,type=0)=>{if(alpha>.003)this.frame.particles.push({pos,size,color,alpha,type});},
  line:(a,b,width,color,opt={})=>this.frame.lines.push({a,b,width,color,opt}),
  fx:(kind,pos,scale,color,rot=[0,0,0],opt={})=>this.frame.ground.push({kind,pos,scale,color,rot,opt})};
 }
 sprite(pos,w,h,color,alpha,mode=8,seed=0,angle=0,add=false){if(alpha<.003)return;this.frame.sprites.push({pos,w,h,color,alpha,mode,seed,angle,add});}
 spark(pos,age,seed,count,color,speed=2.8){if(age<0||age>.85)return;const R=this.R;
 for(let i=0;i<count*this.density;i++){let k=seed+i*9,life=.23+r(k)*.49;if(age>life)continue;let a=r(k+1)*TAU,v=speed*(.25+r(k+2)*.85),vy=1.05+r(k+3)*2.0,vel=[Math.cos(a)*v,vy,Math.sin(a)*v],f=t=>[pos[0]+vel[0]*t,Math.max(.08,pos[1]+vel[1]*t-4.9*t*t),pos[2]+vel[2]*t],q=f(age),al=(1-age/life)**1.3;R.particle(q,.018+r(k+4)*.047,color,al*1.9,i%4===0?1:2);if(i%3===0)R.line(f(Math.max(0,age-.035)),q,.012,color,{mode:6,alpha:al*.8});}
 }
 dragon(p){const R=this.R,t=p.t,k=this.S.dragonFrames(p),a=R.project(k.mouth),b=R.project(V.add(k.mouth,[1,0,0])),ang=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);
 let charge=env(t,.22,1.1,.52,.12);R.glow(k.mouth,.70,'#ff8c34',charge*.8);R.glow(V.add(k.mouth,[-.38,-.06,0]),.65,'#ed681e',charge*.5);
 for(let i=0;i<26*this.density;i++){let age=(r(i*9)+t*.65)%1,aa=r(i*7)*TAU,rad=(1-age)*.52;R.particle([k.mouth[0]-.05,k.mouth[1]+Math.sin(aa)*rad,k.mouth[2]+Math.cos(aa)*rad],.023,'#ffcc8d',charge*age*.65);}
 // Advected flame parcels. Birth point is evaluated at birth-time, not frame-time.
 for(let i=0;i<210;i++){let birth=.96+i*.0124,age=t-birth,life=.70+r(i+99)*.12;if(age<0||age>life||birth>3.36)continue;if(this.density<1&&i%2)continue;
  let bp=X.poseAt('dragon',birth),bk=this.S.dragonFrames(bp),speed=5.8+r(i*8)*1.9,travel=speed*age;
  let rr=(.035+age*.55),th=r(i*8+1)*TAU+age*2.0;
  let pos=V.add(bk.mouth,[travel,-travel*.115+Math.sin(th)*rr*.57+age*age*.30,Math.cos(th)*rr*.66]);
  if(pos[0]>2.68){let over=pos[0]-2.68;pos[0]=2.68+Math.min(.35,over*.26);pos[1]+=over*.44;pos[2]+=Math.sin(th)*over*.55;}
  let fade=E(age/.045)*(1-E((age-life*.60)/(life*.40)))*env(birth,.94,3.40,.14,.20);
  this.sprite(pos,.42+age*1.9,.28+age*1.28,'#ff8e31',fade*.67,8,r(i*7)*30,ang+(r(i+41)-.5)*.9);
 }
 const burn=env(t,1.28,4.34,.16,.88);R.glow([2.7,1.70,0],2.2,'#ff8b2e',burn*.38);R.glow([2.75,.018,0],2.55,'#e25b20',burn*.34,true);R.glow(k.mouth,.72,'#ffc172',p.breath*.5);
 // Rising smoke is lower-energy, normally blended, and depth-sorted with fire.
 for(let i=0;i<30;i++){let birth=1.38+i*.10,age=t-birth;if(birth>3.70)continue;if(age<0||age>1.5)continue;let th=r(i)*TAU,life=1.4,alpha=env(age,0,life,.22,.65)*.20;
  this.sprite([2.95+Math.cos(th)*(.22+age*.34),1.7+age*1.16,Math.sin(th)*(.22+age*.4)],.62+age*1.05,.7+age*1.0,'#6c5a4c',alpha,9,r(i+88)*13,age*.1);}
 for(let i=0;i<55;i++){let birth=1.28+i*.038,d=t-birth;if(birth>3.53)break;if(d>=0&&d<.65)this.spark([2.66,1.40,0],d,310+i*19,3,'#ffc67b',1.9);}
 const scorch=env(t,1.38,5.05,.60,1.05);this.sprite([2.93,.07,0],1.2,.30,'#4b2b20',0); // Intentionally no camera-facing scorch decal.
 R.fx('plane',[2.94,.012,0],[1.88,1,1.68],'#241713',[0,.15,0],{mode:1,add:false,transparent:true,alpha:scorch*.64});
 for(let j=0;j<28*this.density;j++){let born=2.05+j*.062,age=t-born,life=.65+r(j+44)*.65;if(age<0||age>life)continue;let aa=r(j+42)*TAU,v=.7+r(j)*1.9;R.particle([2.95+Math.cos(aa)*v*age,.08+Math.max(0,(.7+r(j+1))*age-1.2*age*age),Math.sin(aa)*v*age],.025,'#ed7b32',(1-age/life)*scorch*.8,2);}
 }

 sample(time,density=1){if(!Number.isFinite(time))throw new TypeError('Finite reference time required');
  this.frame={time,sprites:[],particles:[],glows:[],lines:[],ground:[]};this.density=density;
  if(time>=0&&time<=5.4)this.dragon(poseAt('dragon',time));return this.frame;
 }
}
const sampler=new Flame();
const api={sample:(t,density=1)=>sampler.sample(t,density),view,mouth:t=>dragonFrames(poseAt('dragon',t)).mouth,
 poseAt,env,random:r,Flame,shader:"if(uMode>7.5&&uMode<8.5){\n vec2 q=(vUV-.5)*2.;float ang=atan(q.y,q.x);\n vec2 flow=vUV*4.6+vec2(uSurface*3.1,-uTime*1.3);\n float n=fbm(flow+fbm(flow*1.1+uTime*.45)*1.3);\n float d=length(q);float edge=1.-smoothstep(.32+n*.32,.74+n*.28,d);\n float hot=clamp((1.-d)*.70+n*.68-.25,0.,1.);\n vec3 red=vec3(.85,.035,.003),gold=vec3(2.7,.56,.018),white=vec3(3.7,1.7,.31);\n c=mix(red,gold,smoothstep(.12,.70,hot));c=mix(c,white,smoothstep(.68,1.,hot)*.52);\n a*=edge*(.32+n*.58);c*=.83+uEmission*.28;\n}\n",smokeShader:"if(uMode>8.5&&uMode<9.5){\n vec2 q=(vUV-.5)*2.;float n=fbm(vUV*5.4+vec2(uSurface,-uTime*.14));\n a*=(1.-smoothstep(.15+n*.32,.96,length(q)))*(.25+n*.55);\n c*=.65+n*.8;\n}\n"};
G.EmberReferenceFlame=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
