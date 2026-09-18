/* Derived from Ember_Steel_VFX/src/core.js. 3D geometry and shader renderer.
 * Integration adaptation: transparent premultiplied intermediate buffers,
 * fixed stage-aligned camera, explicit lifecycle and no background refraction. */
/* Original minimal math & geometry library. No external dependencies. */
(function(G){
'use strict';
const X=G.Ember3D=G.Ember3D||{};
const M=X.M={};
M.I=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
M.mul=(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;};
M.T=(x=0,y=0,z=0)=>{let a=M.I();a[12]=x;a[13]=y;a[14]=z;return a;};
M.S=(x=1,y=x,z=x)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]);
M.Rx=(r)=>{let c=Math.cos(r),s=Math.sin(r);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);};
M.Ry=(r)=>{let c=Math.cos(r),s=Math.sin(r);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
M.Rz=(r)=>{let c=Math.cos(r),s=Math.sin(r);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);};
M.trs=(p=[0,0,0],r=[0,0,0],s=[1,1,1])=>M.mul(M.T(...p),M.mul(M.Ry(r[1]),M.mul(M.Rx(r[0]),M.mul(M.Rz(r[2]),M.S(...s)))));
const V=X.V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(...a)};
V.norm=a=>V.scale(a,1/(V.len(a)||1));V.mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
M.look=(eye,tar,up=[0,1,0])=>{let z=V.norm(V.sub(eye,tar)),x=V.norm(V.cross(up,z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);};
M.persp=(fov,aspect,near,far)=>{let f=1/Math.tan(fov/2),n=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*n,-1,0,0,2*far*near*n,0]);};
M.ortho=(l,r,b,t,n,f)=>new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);
M.point=(m,p)=>{let [x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w];};
X.clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));X.mix=(a,b,t)=>a+(b-a)*t;X.ease=x=>{x=X.clamp(x);return x*x*(3-2*x);};X.out=x=>1-(1-X.clamp(x))**3;
X.rand=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
X.hex=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>{const x=parseInt(h.slice(i,i+2),16)/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);});};
const B=X.Geo={};
function tri(o,a,b,c,n,ua=[0,0],ub=[1,0],uc=[1,1]){if(!n)n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));o.push(...a,...n,...ua,...b,...n,...ub,...c,...n,...uc);}
B.tri=tri;
B.box=()=>{let o=[],p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];for(let f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(o,p[f[0]],p[f[1]],p[f[2]],null,[0,0],[1,0],[1,1]);tri(o,p[f[0]],p[f[2]],p[f[3]],null,[0,0],[1,1],[0,1]);}return o;};
B.plane=()=>{let o=[];tri(o,[-.5,0,-.5],[.5,0,.5],[.5,0,-.5],[0,1,0],[0,0],[1,1],[1,0]);tri(o,[-.5,0,-.5],[-.5,0,.5],[.5,0,.5],[0,1,0],[0,0],[0,1],[1,1]);return o;};
B.cylinder=(top=.5,bottom=.5,n=16)=>{let o=[];for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,pa=[Math.cos(a)*bottom,-.5,Math.sin(a)*bottom],pb=[Math.cos(b)*bottom,-.5,Math.sin(b)*bottom],pc=[Math.cos(b)*top,.5,Math.sin(b)*top],pd=[Math.cos(a)*top,.5,Math.sin(a)*top];tri(o,pa,pc,pb);tri(o,pa,pd,pc);tri(o,[0,.5,0],pc,pd,[0,1,0]);tri(o,[0,-.5,0],pa,pb,[0,-1,0]);}return o;};
B.sphere=(n=16,m=10)=>{let o=[];const v=(a,b)=>[Math.sin(b)*Math.cos(a)*.5,Math.cos(b)*.5,Math.sin(b)*Math.sin(a)*.5];for(let i=0;i<m;i++)for(let j=0;j<n;j++){let a=j/n*2*Math.PI,c=(j+1)/n*2*Math.PI,b=i/m*Math.PI,d=(i+1)/m*Math.PI,vs=[v(a,b),v(a,d),v(c,d),v(a,b),v(c,d),v(c,b)];vs.forEach(p=>o.push(...p,...V.norm(p),0,0));}return o;};
B.ring=(inner=.94,outer=1,n=96,arc=Math.PI*2,taper=false)=>{let o=[];for(let i=0;i<n;i++){let a=i/n*arc,b=(i+1)/n*arc;let ia=taper?outer-(outer-inner)*Math.sin(Math.PI*i/n)**.6:inner,ib=taper?outer-(outer-inner)*Math.sin(Math.PI*(i+1)/n)**.6:inner;let ps=[[Math.cos(a)*ia,0,Math.sin(a)*ia],[Math.cos(b)*ib,0,Math.sin(b)*ib],[Math.cos(b)*outer,0,Math.sin(b)*outer],[Math.cos(a)*outer,0,Math.sin(a)*outer]];tri(o,ps[0],ps[2],ps[1],[0,1,0],[i/n,0],[(i+1)/n,1],[(i+1)/n,0]);tri(o,ps[0],ps[3],ps[2],[0,1,0],[i/n,0],[i/n,1],[(i+1)/n,1]);}return o;};
B.prism=(points,top=0,bottom=-.5)=>{let o=[];let xx=points.map(p=>p[0]),zz=points.map(p=>p[1]),mx=Math.max(...xx.map(Math.abs)),mz=Math.max(...zz.map(Math.abs));for(let i=0;i<points.length;i++){let [x,z]=points[i],[x1,z1]=points[(i+1)%points.length];let a=[x,top,z],b=[x1,top,z1],c=[x,bottom,z],d=[x1,bottom,z1];tri(o,[0,top,0],a,b,[0,1,0],[.5,.5],[(x/mx+1)/2,(z/mz+1)/2],[(x1/mx+1)/2,(z1/mz+1)/2]);tri(o,a,c,d);tri(o,a,d,b);}return o;};
B.ribbon=(points,width)=>{let o=[];for(let i=0;i<points.length-1;i++){let p=points[i],q=points[i+1],dir=V.norm(V.sub(q,p)),s=V.scale(V.norm(V.cross(dir,[0,1,0])),width*.5),a=V.add(p,s),b=V.sub(p,s),c=V.add(q,s),d=V.sub(q,s);tri(o,a,b,c,[0,1,0],[i/(points.length-1),0],[i/(points.length-1),1],[(i+1)/(points.length-1),0]);tri(o,b,d,c,[0,1,0],[i/(points.length-1),1],[(i+1)/(points.length-1),1],[(i+1)/(points.length-1),0]);}return o;};
if(typeof module!=='undefined')module.exports=X;
})(typeof window!=='undefined'?window:globalThis);

(function(X){'use strict';
const {M,V,Geo}=X;
const vs=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uModel,uVP,uLightVP;varying vec4 vShadow;varying vec3 vN,vW,vLocal;varying vec2 vUV;void main(){vec4 w=uModel*vec4(aPos,1.);vW=w.xyz;vLocal=aPos;vShadow=uLightVP*w;vec3 ss=vec3(dot(uModel[0].xyz,uModel[0].xyz),dot(uModel[1].xyz,uModel[1].xyz),dot(uModel[2].xyz,uModel[2].xyz));vN=normalize(mat3(uModel)*(aNormal/max(ss,vec3(.00001))));vUV=aUV;gl_Position=uVP*w;}`;
 const fs=`precision highp float;
varying vec3 vN,vW,vLocal;varying vec2 vUV;
varying vec4 vShadow;uniform sampler2D uShadowMap;uniform vec4 uColor;uniform vec3 uEye,uLamp,uLampColor;
uniform float uMode,uTime,uEmission,uTex,uFlash,uRoughness,uMetal,uDissolve,uSurface;uniform sampler2D uMap;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.05)*.27+noise(p*4.1)*.13;}
float shadow(vec3 norm){vec3 q=vShadow.xyz/vShadow.w*.5+.5;if(q.x<.002||q.x>.998||q.y<.002||q.y>.998||q.z>1.)return 1.;float bias=max(.00045*(1.-max(dot(norm,normalize(vec3(-.55,1.,.6))),0.)),.00025),sum=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec4 z=texture2D(uShadowMap,q.xy+vec2(float(x),float(y))/1024.);float dep=dot(z,vec4(1.,1./255.,1./65025.,1./16581375.));sum+=q.z-bias<=dep?1.:.0;}return sum/9.;}
void main(){vec3 c=uColor.rgb;float a=uColor.a;
if(uTex>.5){vec4 t=texture2D(uMap,vUV);c*=pow(t.rgb,vec3(2.2));a*=t.a;}
if(uMode<.5){
 if(uDissolve>.0001){float n=noise(vW.xy*36.+vW.z*17.);if(n<uDissolve)discard;c+=uColor.rgb*(1.-smoothstep(uDissolve+.015,uDissolve+.07,n))*.8;}
 if(uSurface>.5){float grain=fbm(vLocal.xy*36.+vLocal.z*12.);float veins=fbm(vLocal.xy*7.+vLocal.z*3.);c*=.90+grain*.16;c+=uColor.rgb*smoothstep(.65,.72,veins)*.22;}
 vec3 n=normalize(vN),l=normalize(vec3(-.55,1.,.6)),view=normalize(uEye-vW),h=normalize(l+view);
 float sh=shadow(n);float dif=max(dot(n,l),0.)*(.25+.75*sh);float hemi=.16+.24*(n.y*.5+.5);
 float fres=pow(1.-max(dot(n,view),0.),4.);
 float spec=pow(max(dot(n,h),0.),mix(110.,13.,uRoughness))*(.35+uMetal*.9)*(.15+.85*sh);
 vec3 fill=vec3(.33,.51,.68)*max(dot(n,normalize(vec3(.6,.25,-.8))),0.)*.45;
 vec3 lit=vec3(1.,.88,.71)*dif*1.45+vec3(.56,.71,.79)*hemi+fill;
 vec3 ld=uLamp-vW;float lamp=max(dot(n,normalize(ld)),0.)/(1.+dot(ld,ld)*.22);
 c=c*lit+mix(vec3(1.,.91,.75),uColor.rgb,.60*uMetal)*spec+fres*vec3(.1,.22,.26)*(.22+uMetal*.3)+uColor.rgb*uEmission;
 c+=uLampColor*lamp*(uColor.rgb*.8+.06); c=mix(c,vec3(1.9,2.1,1.8),uFlash*.48);
}
else if(uMode<1.5){float d=length((vUV-.5)*2.);a*=pow(max(0.,1.-d),2.5);}
else if(uMode<2.5){float y=abs(vUV.y-.5)*2.;float n=fbm(vec2(vUV.x*12.-uTime*1.6,vUV.y*6.));float edge=1.-smoothstep(.3+n*.20,.95,y);float core=exp(-y*y*46.);a*=edge*smoothstep(0.,.045,vUV.x)*(1.-smoothstep(.88,1.,vUV.x));c=mix(c,vec3(2.1,2.4,2.2),core*.6);}
else if(uMode<3.5){float n=fbm(vUV*vec2(10.,4.)-vec2(uTime*.7,0));a*=smoothstep(0.,.08,vUV.y)*(1.-smoothstep(.62,1.,vUV.y))*(.42+n*.65);}
else if(uMode<4.5){float d=length((vUV-.5)*2.);float n=fbm(vUV*5.7+uTime*.09);a*=(1.-smoothstep(.26,1.,d))*(.2+n*.8);}
else if(uMode<5.5){float side=sin(vUV.y*3.14159);a*=pow(max(side,0.),.65)*smoothstep(0.,.04,vUV.x)*(1.-smoothstep(.85,1.,vUV.x));c=mix(c,vec3(1.6,2.2,2.1),pow(max(side,0.),12.)*.4);}
if(uMode>6.5&&uMode<7.5){float q=vUV.y;float n=fbm(vec2(vUV.x*55.,q*4.-uTime*2.));a*=smoothstep(0.,.32,q)*(1.-smoothstep(.77,1.,q))*(.70+n*.32);c*=.91;}

if(uMode>7.5&&uMode<8.5){
 vec2 q=(vUV-.5)*2.;float ang=atan(q.y,q.x);
 vec2 flow=vUV*4.6+vec2(uSurface*3.1,-uTime*1.3);
 float n=fbm(flow+fbm(flow*1.1+uTime*.45)*1.3);
 float d=length(q);float edge=1.-smoothstep(.32+n*.32,.74+n*.28,d);
 float hot=clamp((1.-d)*.70+n*.68-.25,0.,1.);
 vec3 red=vec3(.85,.035,.003),gold=vec3(2.7,.56,.018),white=vec3(3.7,1.7,.31);
 c=mix(red,gold,smoothstep(.12,.70,hot));c=mix(c,white,smoothstep(.68,1.,hot)*.52);
 a*=edge*(.32+n*.58);c*=.83+uEmission*.28;
}
if(uMode>8.5&&uMode<9.5){
 vec2 q=(vUV-.5)*2.;float n=fbm(vUV*5.4+vec2(uSurface,-uTime*.14));
 a*=(1.-smoothstep(.15+n*.32,.96,length(q)))*(.25+n*.55);
 c*=.65+n*.8;
}
if(uMode>9.5&&uMode<10.5){
 float n=fbm(vec2(vUV.x*17.-uTime*5.5,vUV.y*7.+sin(vUV.x*10.-uTime*3.)));
 float weave=fbm(vec2(vUV.x*33.-uTime*9.,vUV.y*13.));
 float hot=clamp(n*.95+weave*.37-.12,0.,1.);
 c=mix(vec3(.60,.018,.002),vec3(2.1,.27,.006),smoothstep(.1,.58,hot));
 c=mix(c,vec3(4.0,1.9,.21),smoothstep(.60,.90,hot));
 a*=.52+.44*smoothstep(.19,.68,n);
}
if(uMode>10.5&&uMode<11.5){
 vec2 q=(vUV-.5)*2.;vec2 f=vUV*vec2(6.2,4.1)+vec2(uSurface*2.7-uTime*2.2,uTime*.65);
 float n=fbm(f+fbm(f*1.13)*1.4);float d=length(q);
 a*=(1.-smoothstep(.18+n*.35,.70+n*.31,d))*(.40+n*.55);
 c=mix(vec3(2.5,.38,.015),vec3(4.1,2.15,.38),smoothstep(.23,.68,n+(1.-d)*.25));
}
// R6 sword-light material: striated energy, a fine bright lip, soft exterior.
// Separate mode; original flame/smoke branches and post-processing are untouched.
if(uMode>11.5&&uMode<12.5){
 float u=vUV.x,v=vUV.y;
 float feather=pow(max(0.,sin(v*3.14159265)),.70);
 float endMask=smoothstep(0.,.025,u)*(1.-smoothstep(.955,1.,u));
 float wave=sin(u*19.-uTime*8.+uSurface)*.035;
 float striation=.5+.5*sin(v*79.+sin(u*13.+uTime*4.)*2.2);
 float grain=fbm(vec2(u*21.-uTime*2.2,v*13.+uSurface));
 float lip=exp(-pow((v-.78-wave)*31.,2.));
 float spine=exp(-pow((v-.53+wave*.5)*52.,2.));
 c=c*(.56+grain*.34+striation*.12)+vec3(1.8,1.94,2.08)*lip*.84+vec3(.42,.60,.70)*spine;
 a*=feather*endMask*(.70+grain*.30);
}

// R8 independent materials: broad holy bevels, crystalline optical planes,
// and an opaque shadow incision. Reference flame 8/9 and post remain untouched.
if(uMode>12.5&&uMode<13.5){
 float u=vUV.x,v=vUV.y,edge=abs(v-.5)*2.;
 float flow=fbm(vec2(u*12.-uTime*1.9,v*4.7+uSurface));
 float ridge=exp(-pow((v-.52)*24.,2.));
 float left=1.-smoothstep(.10,.48,v),right=smoothstep(.54,.94,v);
 c=mix(vec3(.40,.095,.008),vec3(2.15,.91,.08),.23+left*.67+right*.38);
 c*=.91+flow*.18;
 float fil=pow(.5+.5*sin(v*37.+sin(u*13.-uTime*2.)*.7),13.);
 c+=vec3(2.6,1.84,.67)*(pow(edge,24.)*.83+ridge*.50+fil*.075);
 float noiseValue=.12+fbm(vec2(u*41.,v*13.+uSurface))*.87+u*.09;
 float erode=smoothstep(uDissolve-.03,uDissolve+.035,noiseValue);
 c+=vec3(1.6,.61,.05)*(1.-smoothstep(.0,.08,abs(noiseValue-uDissolve)))*step(.01,uDissolve);
 a*=erode*(1.-smoothstep(.984,1.,edge));
}
if(uMode>13.5&&uMode<14.5){
 float u=vUV.x,v=vUV.y,edge=abs(v-.5)*2.;
 float facets=fract(u*4.8+v*.72);
 float plane=step(.49,facets),bevel=step(.76,abs(v-.49)*2.);
 float optic=.5+.5*sin(u*9.+v*5.2);
 c=mix(vec3(.035,.14,.29),vec3(.32,.73,1.0),plane*.77+bevel*.23);
 c*=.76+optic*.35;
 float crack=1.-smoothstep(.003,.012,abs(facets-.50));
 float ridge=exp(-pow((v-.53)*45.,2.));
 c+=vec3(.87,1.58,2.12)*(pow(edge,28.)*.94+crack*.53+ridge*.51);
 float cells=fbm(vec2(floor(u*24.),floor(v*9.))+uSurface);
 float erode=smoothstep(uDissolve-.035,uDissolve+.02,.14+cells*.86+u*.08);
 a*=.96*erode*(1.-smoothstep(.989,1.,edge));
}
if(uMode>14.5&&uMode<15.5){
 float u=vUV.x,v=vUV.y;
 float n=fbm(vec2(u*12.-uTime*3.,v*3.+uSurface));
 c*=.82+n*.29;
 a*=(1.-smoothstep(.90,1.,abs(v-.5)*2.))*smoothstep(0.,.014,u)*(1.-smoothstep(.992,1.,u));
}
if(uMode>15.5&&uMode<16.5){
 vec2 q=(vUV-.5)*2.,grid=vUV*vec2(8.,10.);
 vec2 cell=floor(grid),local=fract(grid);
 float first=9.,second=9.;vec2 nearest=vec2(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 off=vec2(float(x),float(y));
  vec2 seed=cell+off;
  vec2 p=off+vec2(hash(seed),hash(seed+17.31))*.78+.11-local;
  float dist=dot(p,p);
  if(dist<first){second=first;first=dist;nearest=seed;}else if(dist<second){second=dist;}
 }
 float seam=1.-smoothstep(.008,.07,second-first);
 float grain=fbm(vUV*64.),facet=hash(nearest+4.3);
 float r=length(q*vec2(1.,.94));
 float silhouette=1.-smoothstep(.78+grain*.13,.94+grain*.08,r);
 float grow=1.-smoothstep(uSurface*1.38-.13,uSurface*1.38+.07,r);
 c=mix(vec3(.055,.20,.35),vec3(.46,.78,.97),facet*.74+grain*.20);
 c+=vec3(.58,.92,1.12)*seam*.57;
 a*=silhouette*grow*(.26+seam*.31+grain*.23);
}

if(a<.004)discard;gl_FragColor=vec4(c,a);}`;
const pvs=`attribute vec3 aPos;attribute vec4 aColor;attribute vec2 aInfo;uniform mat4 uVP;uniform float uScale;varying vec4 vC;varying float vType;void main(){vec4 p=uVP*vec4(aPos,1.);gl_Position=p;gl_PointSize=clamp(aInfo.x*uScale,1.,120.);vC=aColor;vType=aInfo.y;}`;
const pfs=`precision mediump float;varying vec4 vC;varying float vType;void main(){vec2 q=gl_PointCoord*2.-1.;float d=length(q),a=0.;if(vType<.5)a=pow(max(0.,1.-d),2.);else if(vType<1.5){a=pow(max(0.,1.-abs(q.x)),6.)*pow(max(0.,1.-abs(q.y)),.5)+pow(max(0.,1.-abs(q.x)),.5)*pow(max(0.,1.-abs(q.y)),6.);}else a=step(abs(q.x)+abs(q.y),.9);gl_FragColor=vec4(vC.rgb,vC.a*a);}`;
const qvs=`attribute vec2 aP;varying vec2 uv;void main(){uv=aP*.5+.5;gl_Position=vec4(aP,0,1);}`;
 const qfs=`precision highp float;varying vec2 uv;uniform sampler2D uImage,uBloom;uniform vec2 uStep,uInvResolution;uniform float uPass,uStrength,uThreshold,uReferenceFlame;uniform vec4 uShock;
vec3 tone(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec4 s=texture2D(uImage,uv);
 if(uPass<.5){float l=max(s.r,max(s.g,s.b));gl_FragColor=vec4(s.rgb*smoothstep(uThreshold,uThreshold+(uReferenceFlame>.5?.77:.67),l),1.);}
 else if(uPass<1.5){vec3 c=s.rgb*.227027;c+=(texture2D(uImage,uv+uStep*1.384615).rgb+texture2D(uImage,uv-uStep*1.384615).rgb)*.316216;c+=(texture2D(uImage,uv+uStep*3.230769).rgb+texture2D(uImage,uv-uStep*3.230769).rgb)*.07027;gl_FragColor=vec4(c,1.);}
 else {vec3 b=texture2D(uBloom,uv).rgb*uStrength;
  // Preserve the reference tone-mapped *premultiplied energy*. Unpremultiplying
  // before the nonlinear curve turns its thin orange edges into pale yellow fog.
  // The alpha floor keeps straight RGB in gamut when composited over DOM.
  if(uReferenceFlame>.5){vec3 rgb=pow(tone((s.rgb+b)*.97),vec3(1./2.2));
   float coverage=max(s.a,max(rgb.r,max(rgb.g,rgb.b)));
   if(coverage<.001){gl_FragColor=vec4(0.);return;}
   gl_FragColor=vec4(rgb/coverage,coverage);return;}
  float glow=1.-exp(-max(b.r,max(b.g,b.b))*.8);float a=clamp(s.a+glow*(1.-s.a),0.,1.);if(a<.001){gl_FragColor=vec4(0.);return;}vec3 c=(s.rgb+b)/max(a,.001);gl_FragColor=vec4(pow(tone(c),vec3(1./2.2)),a);}}
`;
class Renderer{
 constructor(canvas){this.canvas=canvas;let gl=canvas.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw Error('当前浏览器没有可用的 WebGL。请开启浏览器硬件加速后重试。');this.gl=gl;const hf=gl.getExtension('OES_texture_half_float');const hfl=gl.getExtension('OES_texture_half_float_linear');gl.getExtension('EXT_color_buffer_half_float');this.halfType=hf&&hfl?hf.HALF_FLOAT_OES:null;this.hdr=!!this.halfType;this.program=this.makeProgram(vs,fs);this.pp=this.makeProgram(pvs,pfs);this.qp=this.makeProgram(qvs,qfs);this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);this.pb=gl.createBuffer();this.white=this.texture(new Uint8Array([255,255,255,255]),1,1);this.geo={};this.geo.box=this.mesh(Geo.box());this.geo.plane=this.mesh(Geo.plane());this.geo.sphere=this.mesh(Geo.sphere());this.geo.cyl=this.mesh(Geo.cylinder());this.geo.cone=this.mesh(Geo.cylinder(0,.5,12));this.geo.rock=this.mesh(Geo.sphere(5,3));this.geo.ring=this.mesh(Geo.ring());this.geo.slash=this.mesh(Geo.ring(.56,1,64,Math.PI*1.3,true));this.geo.pillar=this.mesh(Geo.cylinder(.3,.5,6));this.dynamic=this.mesh([],true);this.count=0;this.vertexCount=0;this.empty=M.I();this.lamp=[0,8,0];this.lampColor=[0,0,0];this.fxList=[];this.particles=[];gl.disable(gl.CULL_FACE);this.ready=true;this.initShadow();this.beginShadow();this.endShadow();}
 initShadow(){const gl=this.gl;this.shadowProgram=this.makeProgram(`attribute vec3 aPos;uniform mat4 uModel,uLightVP;varying vec3 sw;void main(){vec4 w=uModel*vec4(aPos,1.);sw=w.xyz;gl_Position=uLightVP*w;}`,`precision highp float;varying vec3 sw;uniform float uDissolve;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){if(uDissolve>0.0001 && noise(sw.xy*36.+sw.z*17.)<uDissolve)discard;float v=min(gl_FragCoord.z,.999999);vec4 enc=fract(v*vec4(1.,255.,65025.,16581375.));enc-=enc.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=enc;}`);
 const old=this.halfType;this.halfType=null;this.shadowTarget=this.target(1024,1024,true);this.halfType=old;
 this.lightVP=M.mul(M.ortho(-8,8,-8,8,1,37),M.look([-8,15,9],[0,0,0]));this.shadowMode=false;
 }
 beginShadow(){let gl=this.gl;this.shadowMode=true;gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowTarget.f);gl.viewport(0,0,1024,1024);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);}
 endShadow(){this.shadowMode=false;}
 drawShadow(geo,model,opt){if(!geo||!geo.n||opt.add||opt.transparent||opt.mode>0)return;let gl=this.gl,p=this.shadowProgram;gl.useProgram(p.p);gl.bindBuffer(gl.ARRAY_BUFFER,geo.b);let a=this.attr(p,'aPos');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,32,0);gl.uniformMatrix4fv(this.loc(p,'uModel'),false,model);gl.uniformMatrix4fv(this.loc(p,'uLightVP'),false,this.lightVP);gl.uniform1f(this.loc(p,'uDissolve'),opt.dissolve||0);gl.drawArrays(gl.TRIANGLES,0,geo.n);}
 makeProgram(v,f){let gl=this.gl;function sh(t,s){let z=gl.createShader(t);gl.shaderSource(z,s);gl.compileShader(z);if(!gl.getShaderParameter(z,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(z));return z;}let p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,loc:{},attr:{}};}
 loc(p,n){return p.loc[n]??(p.loc[n]=this.gl.getUniformLocation(p.p,n));}
 attr(p,n){return p.attr[n]??(p.attr[n]=this.gl.getAttribLocation(p.p,n));}
 texture(src,w,h){let gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);if(src instanceof Uint8Array)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,src);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 mesh(data,dynamic=false){let gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);return {b,n:data.length/8};}
 target(w,h,depth){let gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,this.halfType||gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);let d=null;if(depth){d=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,d);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,d);}if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.deleteFramebuffer(f);gl.deleteTexture(t);if(d)gl.deleteRenderbuffer(d);if(this.halfType){this.halfType=null;this.hdr=false;return this.target(w,h,depth);}throw Error('WebGL framebuffer incomplete');}return {t,f,d,w,h};}
 resize(w,h,dpr=1){let cw=Math.round(w*dpr),ch=Math.round(h*dpr);this.cssW=w;this.cssH=h;this.dpr=dpr;if(this.canvas.width===cw&&this.canvas.height===ch&&this.scene)return;this.canvas.width=cw;this.canvas.height=ch;let gl=this.gl;for(let q of [this.scene,this.b1,this.b2])if(q){gl.deleteTexture(q.t);gl.deleteFramebuffer(q.f);if(q.d)gl.deleteRenderbuffer(q.d);}this.scene=this.target(cw,ch,true);this.b1=this.target(Math.max(1,cw>>1),Math.max(1,ch>>1));this.b2=this.target(Math.max(1,cw>>1),Math.max(1,ch>>1));}
 camera(){const M=Ember3D.M;this.eye=[0,0,2200];this.view=M.look(this.eye,[0,0,0]);this.proj=M.ortho(-this.cssW/2,this.cssW/2,-this.cssH/2,this.cssH/2,1,4400);this.vp=M.mul(this.proj,this.view);this.right=[1,0,0];this.up=[0,1,0];this.worldScale=1;}
 project(p){let q=M.point(this.vp,p);return [(q[0]*.5+.5)*this.cssW,(-q[1]*.5+.5)*this.cssH,q[2]];}
 begin(time){let gl=this.gl;this.time=time;this.count=0;this.vertexCount=0;this.fxList=[];this.particles=[];gl.bindFramebuffer(gl.FRAMEBUFFER,this.scene.f);gl.viewport(0,0,this.scene.w,this.scene.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(this.program.p);gl.uniformMatrix4fv(this.loc(this.program,'uVP'),false,this.vp);gl.uniform3fv(this.loc(this.program,'uEye'),this.eye);gl.uniform3fv(this.loc(this.program,'uLamp'),this.lamp);gl.uniform3fv(this.loc(this.program,'uLampColor'),this.lampColor);gl.uniform1f(this.loc(this.program,'uTime'),time);gl.uniform1i(this.loc(this.program,'uMap'),0);gl.uniformMatrix4fv(this.loc(this.program,'uLightVP'),false,this.lightVP);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.shadowTarget.t);gl.uniform1i(this.loc(this.program,'uShadowMap'),2);gl.activeTexture(gl.TEXTURE0);}
 draw(geo,model,color,opt={}){if(this.shadowMode){this.drawShadow(geo,model,opt);return;}if(!geo||geo.n===0||((opt.alpha??1)<.004))return;let gl=this.gl,p=this.program;gl.useProgram(p.p);gl.bindBuffer(gl.ARRAY_BUFFER,geo.b);for(let [name,n,offset] of [['aPos',3,0],['aNormal',3,12],['aUV',2,24]]){let a=this.attr(p,name);if(a>=0){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,32,offset);}}gl.uniformMatrix4fv(this.loc(p,'uModel'),false,model);let c=typeof color==='string'?X.hex(color):color;gl.uniform4f(this.loc(p,'uColor'),c[0],c[1],c[2],opt.alpha??1);gl.uniform1f(this.loc(p,'uMode'),opt.mode??0);gl.uniform1f(this.loc(p,'uTime'),Number.isFinite(opt.time)?opt.time:this.time);gl.uniform1f(this.loc(p,'uEmission'),opt.emission??0);gl.uniform1f(this.loc(p,'uRoughness'),opt.roughness??.48);gl.uniform1f(this.loc(p,'uMetal'),opt.metal??.25);gl.uniform1f(this.loc(p,'uDissolve'),opt.dissolve??0);gl.uniform1f(this.loc(p,'uSurface'),opt.surface??0);gl.uniform1f(this.loc(p,'uFlash'),opt.flash??0);gl.uniform1f(this.loc(p,'uTex'),opt.texture?1:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,opt.texture||this.white);if(opt.add){gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else if(opt.transparent){gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}gl.drawArrays(gl.TRIANGLES,0,geo.n);this.count++;this.vertexCount+=geo.n;}
 item(kind,pos,scale,color,rot=[0,0,0],opt={}){this.draw(this.geo[kind],M.trs(pos,rot,typeof scale==='number'?[scale,scale,scale]:scale),color,opt);}
 fx(kind,pos,scale,color,rot=[0,0,0],opt={}){this.fxList.push({kind,pos,scale,color,rot,opt:{mode:6,add:true,...opt}});}
 glow(pos,size,color,alpha=1,ground=false){if(this.shadowMode)return;let model;if(ground)model=M.trs(pos,[0,0,0],[size,1,size]);else{let r=V.scale(this.right,size),u=V.scale(this.up,size);model=new Float32Array([r[0],r[1],r[2],0,0,1,0,0,u[0],u[1],u[2],0,...pos,1]);}this.fxList.push({geo:this.geo.plane,model,color,opt:{mode:1,alpha,add:true}});}
 line(a,b,width,color,opt={}){let d=V.sub(b,a),len=V.len(d);if(len<.001)return;let dir=V.norm(d),side=V.scale(V.norm(V.cross(dir,V.norm(V.sub(this.eye,V.mix(a,b,.5))))),width);if(V.len(side)<.01)side=V.scale(this.right,width);let model=new Float32Array([d[0],d[1],d[2],0,0,1,0,0,side[0],side[1],side[2],0,...V.mix(a,b,.5),1]);this.fxList.push({geo:this.geo.plane,model,color,opt:{mode:2,add:true,...opt}});}
 particle(p,size,c,a=1,type=0){if(a>.003)this.particles.push(...p,...(typeof c==='string'?X.hex(c):c),a,size,type);}
 dynamicFX(data,color,opt={}){this.fxList.push({data,color,opt:{mode:5,add:true,...opt}});}
 flush(){let gl=this.gl;for(let f of this.fxList){if(f.data){gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(f.data),gl.DYNAMIC_DRAW);this.dynamic.n=f.data.length/8;this.draw(this.dynamic,this.empty,f.color,f.opt);}else if(f.model)this.draw(f.geo,f.model,f.color,f.opt);else this.item(f.kind,f.pos,f.scale,f.color,f.rot,f.opt);}if(this.particles.length){let p=this.pp;gl.useProgram(p.p);gl.bindBuffer(gl.ARRAY_BUFFER, this.pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.particles),gl.DYNAMIC_DRAW);for(let [name,n,off] of [['aPos',3,0],['aColor',4,12],['aInfo',2,28]]){let a=this.attr(p,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,36,off);}gl.uniformMatrix4fv(this.loc(p,'uVP'),false,this.vp);gl.uniform1f(this.loc(p,'uScale'),this.worldScale*this.dpr);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,this.particles.length/9);this.count++;}gl.depthMask(true);}
 quadPass(target,input,pass,step=[0,0],bloom,opts={}){let gl=this.gl,p=this.qp;gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.f:null);gl.viewport(0,0,target?target.w:this.canvas.width,target?target.h:this.canvas.height);gl.useProgram(p.p);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);let a=this.attr(p,'aP');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.uniform1i(this.loc(p,'uImage'),0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,bloom||this.white);gl.uniform1i(this.loc(p,'uBloom'),1);gl.uniform1f(this.loc(p,'uPass'),pass);gl.uniform2fv(this.loc(p,'uStep'),step);gl.uniform2f(this.loc(p,'uInvResolution'),1/this.scene.w,1/this.scene.h);gl.uniform1f(this.loc(p,'uStrength'),opts.bloom??.55);gl.uniform1f(this.loc(p,'uThreshold'),opts.bloomThreshold??.28);gl.uniform1f(this.loc(p,'uReferenceFlame'),opts.referenceFlame?1:0);gl.uniform4fv(this.loc(p,'uShock'),opts.shock||[0,0,0,0]);gl.drawArrays(gl.TRIANGLES,0,6);}
 end(opts={}){let gl=this.gl;gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);if(opts.bloom!==0){this.quadPass(this.b1,this.scene.t,0,[0,0],null,opts);this.quadPass(this.b2,this.b1.t,1,[2.6/this.b1.w,0]);this.quadPass(this.b1,this.b2.t,1,[0,2.6/this.b1.h]);}this.quadPass(null,this.scene.t,2,[0,0],this.b1.t,opts);gl.activeTexture(gl.TEXTURE0);}
 clear(){let g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);}
 destroy(){const g=this.gl;for(const x of Object.values(this.geo))g.deleteBuffer(x.b);g.deleteBuffer(this.dynamic.b);g.deleteBuffer(this.quad);g.deleteBuffer(this.pb);for(const p of [this.program,this.pp,this.qp,this.shadowProgram]){for(const sh of g.getAttachedShaders(p.p)||[])g.deleteShader(sh);g.deleteProgram(p.p);}for(const t of [this.scene,this.b1,this.b2,this.shadowTarget])if(t){g.deleteTexture(t.t);g.deleteFramebuffer(t.f);if(t.d)g.deleteRenderbuffer(t.d);}g.deleteTexture(this.white);this.clear();}
 info(){let gl=this.gl,d=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),drawCalls:this.count,vertices:this.vertexCount,particles:this.particles.length/9,hdr:this.hdr};}
}
X.Renderer=Renderer;
})(window.Ember3D);

