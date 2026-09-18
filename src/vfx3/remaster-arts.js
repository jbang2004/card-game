/* R10 Perceptual-impact remaster. Strong silhouettes without global exposure changes. Pure, seekable, renderer-independent effect geometry.
 * Attack/utility identities are visual only. Contact timestamps remain authoritative.
 * No rules, damage, DOM mutation, timers, or frame-dependent randomness in this file.
 */
(function(G){
'use strict';
const C=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), E=x=>{x=C(x);return x*x*(3-2*x);},
 L=(a,b,t)=>a+(b-a)*t, N=k=>{let f=Math.sin(k*127.1+311.7)*43758.5453123;return f-Math.floor(f);}, TAU=Math.PI*2;
const DEFINITIONS=Object.freeze({
 arrow:{name:'风翎 · 穿心',tail:690,flight:.18,power:.55,theme:'steel'},
 spear:{name:'荒野 · 贯日',tail:790,flight:.21,power:.85,theme:'nature'},
 claw:{name:'兽痕 · 裂袭',tail:640,flight:.10,power:.8,theme:'claw'},
 slam:{name:'重岩 · 崩击',tail:880,flight:.15,power:1.3,theme:'earth'},
 fireball:{name:'陨火 · 爆燃',tail:980,flight:.24,power:1.1,theme:'fire'},
 frost:{name:'霜棱 · 贯刺',tail:920,flight:.21,power:.9,theme:'ice'},
 'frost-field':{name:'霜原 · 盛放',tail:1150,flight:.15,power:.75,theme:'ice'},
 holy:{name:'圣辉 · 赐福',tail:920,flight:.16,power:.45,theme:'holy'},
 nature:{name:'森息 · 苏生',tail:1000,flight:.18,power:.4,theme:'nature'},
 void:{name:'虚空 · 蚀灭',tail:920,flight:.17,power:.9,theme:'void'},
 siphon:{name:'血契 · 回流',tail:1000,flight:.18,power:.55,theme:'blood'},
 arcane:{name:'星构 · 解印',tail:930,flight:.16,power:.55,theme:'arcane'},
 bladeCross:{name:'终裁 · 交锋',tail:820,flight:.14,power:1.1,theme:'steel'},
 heal:{name:'生息 · 回复',tail:870,flight:0,power:0,theme:'nature'},
 ward:{name:'光壁 · 凝盾',tail:940,flight:0,power:0,theme:'holy'},
 buff:{name:'战意 · 赋能',tail:760,flight:0,power:0,theme:'holy'},
 summon:{name:'灵门 · 显现',tail:920,flight:0,power:0,theme:'arcane'},
 demise:{name:'余魂 · 离散',tail:880,flight:0,power:0,theme:'void'},
 contact:{name:'接触 · 碎响',tail:350,flight:0,power:.4,theme:'steel'}
});
const COLORS={steel:[.58,.78,1.08],nature:[.18,.95,.57],claw:[1.05,.58,.20],earth:[.84,.53,.20],
 fire:[1.6,.31,.025],ice:[.13,.66,1.25],holy:[1.5,.73,.17],void:[.53,.14,.89],blood:[1.35,.055,.14],arcane:[.53,.35,1.25]};
const SUPPORT=new Set(['heal','ward','buff','summon','demise','holy','nature','arcane']);
const semantics={renew:'heal',absolution:'ward',blessing:'buff',shield:'ward',icebarrier:'ward',dawnvow:'ward',
 dagger:'buff',sunblade:'buff',coin:'buff',rally:'buff',muster:'summon',wolves:'summon',mooncall:'summon',huntinghorn:'buff',battlecry:'buff',tracking:'arcane'};
function resolve(kind,sourceCid,semantic){return DEFINITIONS[semantic]?semantic:(semantics[sourceCid]||kind);}
const supports=k=>Object.hasOwn(DEFINITIONS,k);
function timing(d,t){const a=DEFINITIONS[d.kind],scale=C(d.scale||1,.1,1),hit=(d.impact-d.start)/1000,
 q=(t-hit)/scale,flight=Math.min(a?.flight||0,Math.max(0,hit/scale)),pre=Math.min(.34,hit/scale);
 return{a,q,hit,scale,flight,pre,alive:!!a&&t>=0&&q<a.tail/1000,phase:q<-flight?'起手':q<0?'释放':q<.08?'命中':q<.38?'反馈':'收束'};}
// A readable single peak, not high-frequency blinking. Units are authored seconds.
function contactEnvelope(q,hold=.062,decay=13){
 return q<0?0:Math.exp(-Math.max(0,q-hold)*decay);
}
function crowdBudget(n){return Math.max(.42,1/Math.sqrt(Math.max(1,n)));}
function reaction(d,t){const m=timing(d,t),{a,q,pre,flight}=m;
 if(!a||d.visualOnly)return{source:[0,0,0],target:[0,0,0],sourceLight:0,targetLight:0};
 if(SUPPORT.has(d.kind))return{source:[0,0,0],target:[0,0,0],sourceLight:0,
  targetLight:q<0?0:.14*E(q/.045)*(1-E((q-.18)/.32))};
 const dx=d.to.x-d.from.x,dy=d.to.y-d.from.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
 const pull=E((q+pre)/Math.max(.02,pre-flight))*(1-E((q+flight)/Math.max(.02,flight))),
 release=Math.sin(Math.PI*C((q+flight)/(Math.max(.04,flight)+.14))),
 weight=C(a.power*(.86+.12*(d.tier||1)),.2,1.5),p=q<0?0:(1-Math.exp(-q*190))*contactEnvelope(q,.065,11)*weight;
 let s=[-ux*7*pull,-uy*7*pull,-1.5*pull];
 if(d.kind==='claw')s=[ux*14*release,uy*14*release,-3.0*release];
 if(d.kind==='slam')s=[ux*10*release,-12*pull+uy*10*release,2.4*pull];
 if(['arrow','spear'].includes(d.kind))s=[-ux*(4*pull+3*release),-uy*(4*pull+3*release),-1.2*release];
 return{source:s,target:d.kind==='slam'?[ux*3*p,Math.min(12,9*p),-2.2*p]:[ux*8*p,uy*8*p,-2.1*p],
 sourceLight:pull*.12,targetLight:contactEnvelope(q,.038,16)*.18};}
function sample(d,t,W=1600,H=940,low=false){
 const m=timing(d,t),f={kind:d.kind,phase:m.phase,alive:m.alive,contact:m.q>=0,meshes:[],ribbons:[],lines:[],sprites:[],glows:[],particles:[],tip:null,projectile:null};
 if(!m.alive)return f;
 const {q,a,flight,pre}=m,w=d.to.w,h=d.to.h,g=C(w/116,.44,1.5),seed=(d.seed||7)+(d.kind==='frost-field'?[...String(d.targetRef?.uid||'')].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,0):0),
 col=(d.tint?.length===3&&['claw','slam'].includes(d.kind))?d.tint:COLORS[a.theme],hot=col.map(v=>L(v,2,.58));
 const F=[d.from.x-W/2,H/2-d.from.y,46],T=[d.to.x-W/2,H/2-(d.to.y+h*.035),52],
 delta=T.map((v,i)=>v-F[i]),distance=Math.hypot(delta[0],delta[1]),ux=distance?delta[0]/distance:1,uy=distance?delta[1]/distance:0;
 const angle=(d.visualAngle||0)*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
 const at=(x,y,z=0)=>[T[0]+x*ca+y*sa,T[1]-x*sa+y*ca,T[2]+z];
 const point=(s,z=0,bow=0)=>[L(F[0],T[0],s)-uy*Math.sin(s*Math.PI)*bow,L(F[1],T[1],s)+ux*Math.sin(s*Math.PI)*bow,46+z];
 const line=(a,b,width,color,alpha=1,add=true)=>{if(alpha>.003)f.lines.push({a,b,width,color,alpha,add});};
 const poly=(points,color,alpha=1,add=false,mode=6)=>{if(alpha>.003&&points.length>=3)f.meshes.push({points,color,alpha,add,mode});};
 const glow=(p,size,color,alpha)=>{if(alpha>.003)f.glows.push({p,size,color,alpha});};
 const sprite=(p,size,color,alpha,mode=9,rot=0,parcel=0,aspect=1)=>{
  if(alpha>.003)f.sprites.push({p,size,aspect,color,alpha,mode,rot,seed:seed%37+parcel*1.731});
 };
 const ring=(center,rx,ry,color,alpha,rotation=0,width=.6*g,start=0,end=TAU)=>{
  if(alpha<.003)return;const pts=[],n=low?28:48;
  for(let j=0;j<=n;j++){const a=L(start,end,j/n)+rotation;pts.push([center[0]+Math.cos(a)*rx,center[1]+Math.sin(a)*ry,center[2]]);}
  f.ribbons.push({points:pts,widths:pts.map(()=>width),color,alpha,add:true,mode:6});
 };
 const band=(fn,width,alpha,color=col,mode=12,add=true,count=low?19:35)=>{
  if(alpha<.003)return;let pts=[],ws=[];for(let i=0;i<count;i++){const u=i/(count-1);pts.push(fn(u));ws.push(Math.max(.025,typeof width==='function'?width(u):Math.sin(u*Math.PI)**.6*width));}
  f.ribbons.push({points:pts,widths:ws,color,alpha,mode,add});
 };
 const shard=(p,size,ang,color,alpha,ice=false)=>{
  const cs=Math.cos(ang),sn=Math.sin(ang),P=(x,y,z=0)=>[p[0]+cs*x-sn*y,p[1]+sn*x+cs*y,p[2]+z];
  poly([P(0,size*1.8),P(-size*.63,0),P(0,-size),P(size*.26,0,size*.5)],color,alpha,false,ice?14:6);
  poly([P(0,size*1.8),P(size*.26,0,size*.5),P(size*.59,-size*.1),P(0,-size)],color.map(v=>v*(ice?1.5:.65)),alpha,false);
  if(ice)line(P(0,size*1.8),P(size*.26,0,size*.5),.55*g,hot,alpha*.8);
 };
 const debris=(style,count=20,strength=1)=>{
  if(q<0)return;for(let j=0;j<(low?Math.ceil(count*.4):count);j++){
   const k=seed+j*37,life=.29+N(k+3)*.40;if(q>life)continue;
   const aa=N(k)*TAU,spd=(40+N(k+1)*130)*g*strength,fade=(1-q/life)**1.15;
   const p=at(Math.cos(aa)*spd*q,Math.sin(aa)*spd*q*.65+65*g*q-130*g*q*q,8+Math.sin(C(q/life)*Math.PI)*18);
   if(j%3===0)shard(p,(2.5+N(k+7)*4.4)*g,aa+q*(N(k+8)-.5)*9,style==='ice'?[.25,.71,1]:style==='earth'?[.24,.19,.14]:col,fade,style==='ice');
   else f.particles.push({p,size:(1+N(k+4)*1.6)*g,color:j%4?col:hot,alpha:fade*.94,type:style==='earth'?2:j%4?0:1});
  }
 };
 const scars=(style,count=5)=>{
  if(q<0)return;const grow=E(q/.14),fade=1-E((q-.33)/.47);
  for(let j=0;j<count;j++){
   const aa=j*TAU/count+.23+(N(seed+j)-.5)*.23,end=(.65+N(j+seed)*.25),pts=[at(0,0,2)];
   for(let i=1;i<6;i++){const u=i/5;if(u>grow+.2)break;const v=Math.min(u,grow),wig=(N(seed+j*23+i)-.5)*.12;
    pts.push(at(Math.cos(aa+wig)*w*.42*end*v,Math.sin(aa+wig)*h*.31*end*v,2));}
   if(pts.length>1){f.ribbons.push({points:pts,widths:pts.map((_,i)=>g*(3.4-i*.43)),color:[.009,.013,.023],alpha:fade*.95,add:false,mode:6});
    f.ribbons.push({points:pts.map(p=>[p[0]+.9*g,p[1]-.45*g,p[2]+.1]),widths:pts.map(()=>.82*g),color:style==='ice'?hot:[.62,.43,.23],alpha:fade*.78,add:true,mode:6});}
  }
 };
 const charge=E((q+pre)/Math.max(.03,pre-flight))*(1-E((q+.015)/.06));
 const hit=contactEnvelope(q,.066,13),fade=1-E((q-.20)/.46);
 f.scale=g;f.center=T;
 // Ballistic weapons: fixed shaft and head, independently rendered speed history.
 if(d.kind==='arrow'||d.kind==='spear'){
  const spear=d.kind==='spear',flying=q<0,u=q<0?C(1+q/Math.max(.001,flight)):1,
   path=u=>point(u,7,spear?Math.min(34*g,distance*.09):0),tip=path(u),shaft=C((spear?132:94)*g,38,spear?174:128);
  f.tip=tip;f.projectile={tip,shaft,angle:Math.atan2(uy,ux),inFlight:flying};
  if(q>=-flight&&q<(spear?.63:.63)){
   const alpha=1-E((q-.34)/.28),eps=.001,p1=path(C(u-eps)),p2=path(C(u+eps)),dx=p2[0]-p1[0]||delta[0],dy=p2[1]-p1[1]||delta[1],len=Math.hypot(dx,dy)||1,
    ax=dx/len,ay=dy/len,nx=-ay,ny=ax,
    P=(back,side=0,z=0)=>[tip[0]-ax*back+nx*side,tip[1]-ay*back+ny*side,tip[2]+z];
   line(P(shaft),P(5*g),spear?3.2*g:2.05*g,spear?[.30,.15,.052]:[.30,.19,.08],alpha,false);
   line(P(shaft-2*g, .7*g,.3),P(9*g,.7*g,.3),.45*g,[.85,.69,.37],alpha*.8);
   const head=spear?30*g:18*g,hw=spear?8.0*g:5.8*g;
   poly([P(0,0,1),P(head,hw,1),P(head*.74,0,3)],spear?[.19,.52,.39]:[.52,.66,.80],alpha,false);
   poly([P(0,0,1),P(head*.74,0,3),P(head,-hw,1)],[1.1,1.35,1.55],alpha,false);
   line(P(0,0,3),P(head,hw,2),.48*g,[1.6,1.9,2],alpha);
   for(let j=0;j<2;j++){const s=j?1:-1;
    poly([P(shaft-3*g,0,1),P(shaft-4*g,s*7*g,1),P(shaft-25*g,s*3*g,1),P(shaft-24*g,0,1)],spear?[.11,.55,.31]:[.49,.75,.91],alpha,false);
    line(P(shaft-6*g,s*4*g,2),P(shaft-19*g,s*1.8*g,2),.35*g,hot,alpha*.8);}
   if(q<.04&&u>0){const start=Math.max(0,u-Math.min(.48,90*g/Math.max(1,distance)));
    band(v=>path(L(start,u,v)),v=>Math.sin(v*Math.PI)*2.8*g,alpha*.65,spear?[.18,.78,.43]:[.41,.77,1.3],5);}
  }
  glow(F,42*g,col,charge*.36);if(q>=0){glow(T,42*g,hot,hit*.64);debris('wood',spear?20:13,.66);
   const scarAlpha=1-E((q-.25)/.34);poly([at(-3*g,1*g,2),at(1*g,5*g,2),at(3*g,-1*g,2),at(0,-7*g,2)],[.02,.014,.009],scarAlpha*.88,false);}
 }
 // Predatory tearing: three staggered crescents, each has a dark incision.
 else if(d.kind==='claw'){
  const sign=delta[0]>=0?1:-1;
  for(let j=0;j<3;j++){
   const z=q-j*.013,progress=C((z+.075)/.14),end=progress,tail=Math.max(0,end-.62+E((z-.09)/.15)*.62),alpha=1-E((z-.10)/.24),offset=(j-1)*w*.19;
   const path=u=>at(sign*((u-.5)*w*1.14+offset),(.5-u)*h*.96+Math.sin(u*Math.PI)*w*.16,8+j);
   if(z>-.075){band(v=>path(L(tail,end,v)),v=>Math.sin(v*Math.PI)**.8*w*.10,alpha*.94,[.055,.022,.035],15,false);
    band(v=>path(L(tail,end,v)),v=>Math.sin(v*Math.PI)**.75*w*.062,alpha,col,12,true);
    band(v=>{let p=path(L(tail,end,v));return[p[0]+2*g,p[1]+g,p[2]+1];},v=>Math.sin(v*Math.PI)*1.05*g,alpha,hot,6);}
   if(q>=0){const a0=path(.15),a1=path(.85),n=[-(a1[1]-a0[1]),a1[0]-a0[0]],len=Math.hypot(...n)||1;const sg=1-E((q-.27)/.38);
    band(v=>path(L(.16,.84,v)),v=>Math.sin(v*Math.PI)**.5*4.1*g,sg*.94,[.012,.008,.018],15,false);
    band(v=>{let p=path(L(.16,.84,v));return[p[0]+n[0]/len*g,p[1]+n[1]/len*g,p[2]+.5];},v=>Math.sin(v*Math.PI)*.9*g,sg*.6,col,6);}
  }
  if(q>=0){glow(T,w*.28,hot,hit*.22);debris('claw',21,.78);}
 }
 // Weight: a faceted mass strikes down; pressure ring remains a flat ellipse.
 else if(d.kind==='slam'){
  const u=C(1+q/Math.max(.001,flight)),drop=.22*u+.78*u*u*u,
   p=at(0,(1-drop)*Math.min(120*g,h*.9),18+(1-drop)*20),size=w*.57,alpha=q<0?E((q+flight)/.020):1-E((q-.12)/.18);
  f.tip=p;
  if(q>=-flight&&alpha>.003){
   const forged=['berserker','titan','aurion'].includes(d.sourceCid),wood=['treant','thorn','duskstag','moonguard'].includes(d.sourceCid);
   if(forged){
    // Rigid axe/fist impression: readable dark mass, bright bevel, short handle.
    const P=(x,y,z=0)=>[p[0]+x*size,p[1]+y*size,p[2]+z];
    line(P(0,1.38),P(0,-.25),4*g,[.19,.12,.08],alpha,false);
    for(const sg of [-1,1]){
     poly([P(sg*.16,.26),P(sg*.68,.52),P(sg*.86,-.12),P(sg*.47,-.61),P(sg*.16,-.36)],[.055,.085,.12],alpha,false);
     poly([P(sg*.68,.52,1),P(sg*.86,-.12,1),P(sg*.47,-.61,1),P(sg*.44,-.44,2),P(sg*.69,-.08,2)],[.63,.82,1.03],alpha,false);
     line(P(sg*.83,-.14,3),P(sg*.47,-.60,3),.7*g,hot,alpha*.85);
     line(P(sg*.34,.12,3),P(sg*.51,-.17,3),.6*g,[.69,.43,.18],alpha*.80);
    }
    poly([P(-.11,.35,3),P(.11,.35,3),P(.11,-.40,3),P(-.11,-.40,3)],[.38,.24,.095],alpha,false);
    line(P(-.07,.30,4),P(-.07,-.32,4),.45*g,[.90,.65,.26],alpha*.8);
   }else{
    const cube=[[-.8,.7],[-.42,1.0],[.62,.80],[.85,.30],[.55,-.6],[-.53,-.73],[-.85,-.25]].map(([x,y])=>[p[0]+x*size,p[1]+y*size,p[2]]);
    for(let j=0;j<cube.length;j++)poly([[p[0]+size*.15,p[1]+size*.12,p[2]+size*.32],cube[j],cube[(j+1)%cube.length]],wood?(j%2?[.13,.21,.10]:[.32,.24,.12]):(j%2?[.23,.25,.29]:[.40,.45,.50]),alpha,false);
    for(let j=0;j<3;j++)line([p[0]+(-.4+j*.30)*size,p[1]+size*.32,p[2]+size*.35],[p[0]+(-.2+j*.30)*size,p[1]-size*.27,p[2]+size*.35],1.0*g,col,alpha*.65);
   }
   band(v=>[p[0],p[1]+v*75*g,p[2]-1],v=>(1-v)*size*.42,alpha*.40,col,5);
  }
  if(q>=0){scars('earth',7);glow(T,w*.90,[1.3,.60,.18],hit*.65);const k=E(q/.27),a=1-E((q-.12)/.32);
   ring(at(0,-h*.10,-8),w*(.20+.82*k),w*(.08+.30*k),col,a*.84,0,2.4*g);
   debris('earth',low?18:32,1.55);
   for(let j=0;j<(low?4:9);j++){const an=TAU*j/9; sprite(at(Math.cos(an)*w*.35*k,Math.sin(an)*w*.16*k,6),w*(.32+k*.34),[.23,.19,.17],a*.34,9,an);}
  }
 }
 else if(d.kind==='fireball'){
  const u=C(1+q/Math.max(.001,flight)),p=point(u,12,Math.min(65*g,distance*.12));f.tip=p;
  if(q>=-flight&&q<.025){for(let j=0;j<(low?8:16);j++){
   const delay=j*.018,uu=C(u-delay/Math.max(.01,flight)),pp=point(uu,6,Math.min(65*g,distance*.12));
   sprite(pp,(46-j*1.1)*g,[1,.37,.06],.70*(1-j/18),8,j*.67+t*3,j,.74);}
   glow(p,78*g,[1.4,.40,.045],.48);sprite(p,68*g,[1,.68,.24],.90,8,t*2,39,.82);}
  if(q>=0){glow(T,w*1.18,[1.6,.44,.05],hit*.40);
   sprite(at(0,0,2),w*1.30,[.028,.018,.013],E(q/.026)*(1-E((q-.16)/.34))*.70,9,.2,101);
   // Broad turbulent flame fronts retain a warm dark-to-hot range on a bright card.
   const spread=1-Math.exp(-q*13),front=E(q/.018)*(1-E((q-.17)/.29));
   for(let j=0;j<(low?4:6);j++){
    const n=seed+j*37,an=Math.atan2(uy,ux)+[-1.42,-.72,-.12,.57,1.21,2.83][j]+(N(n)-.5)*.28;
    const len=w*(.24+.59*spread)*(.62+N(n+2)*.52),curl=(N(n+3)-.5)*.82;
    const life=front*(1-E((q-(.12+N(n+4)*.11))/.22));
    band(u=>at(Math.cos(an+u*curl)*len*u,Math.sin(an+u*curl)*len*u*.75,10),
     u=>Math.sin(u*Math.PI)**(.6+N(n+5)*.5)*w*(.085+N(n+6)*.055)*(1-.36*spread),life*.85,[1,.25,.025],10,false);
   }
   for(let j=0;j<(low?6:11);j++){const life=.39+N(seed+j)*.28;if(q>life)continue;const age=q/life,an=N(seed+j*31)*TAU,rad=(15+age*104)*g;
    sprite(at(Math.cos(an)*rad,Math.sin(an)*rad*.64+q*32*g,9+j*.15),(41+age*47)*g,[1,.32,.035],Math.sin(Math.PI*C(age+.08))*.78,8,an+q*1.4,j+4,.72);}
   debris('fire',30);for(let j=0;j<(low?2:5);j++)sprite(at((j-2)*13*g,q*35*g,8),w*(.5+q*.3),[.10,.09,.08],E(q/.09)*(1-E((q-.30)/.55))*.24,9,j);}
 }
 else if(d.kind==='frost'||d.kind==='frost-field'){
  const area=d.kind==='frost-field',u=C(1+q/Math.max(.001,flight)),p=area?at(0,(1-u)*h*.6,8):point(u,10,Math.min(40*g,distance*.07));f.tip=p;
  if(q>=-flight&&q<.23){const a=1-E((q-.04)/.18);shard(p,w*(area?.28:.36),area?t*.15:Math.atan2(uy,ux)-Math.PI/2,col,a,true);
   if(!area)band(v=>point(C(u-v*.18),7,Math.min(40*g,distance*.07)),v=>(1-v)*4*g,a*.72,hot,5);}
  if(q>=0){debris('ice',area?26:22,1.45);scars('ice',area?6:4);glow(T,w*.55,hot,hit*.41);
   if(area){const a=1-E((q-.28)/.58);for(let j=0;j<5;j++){
    const age=E(q/(.09+j*.018)),xx=(j-2)*w*.17,sz=(10+N(seed+j*17)*10)*g*age;
    shard(at(xx,-h*.23+sz*.8,8+j),sz,(j-2)*-.10,col,a*.91,true);
   }}
   const grow=E(q/.20),a=1-E((q-.26)/.55);f.sprites.push({p:at(0,0,1),size:w*.87,color:col,alpha:a*.79,mode:16,rot:0,seed:grow});
   sprite(at(0,15*g,5),w*(.70+q*.3),[.30,.50,.61],a*.10,9,t*.2);}
 }
 else if(d.kind==='void'){
  const collapse=q<0?E((q+pre)/Math.max(.04,pre)):1-E(q/.25),a=q<0?collapse:1-E((q-.18)/.56),rad=w*(.14+.45*collapse);
  const pts=[];for(let j=0;j<45;j++){const an=j/44*TAU;pts.push(at(Math.cos(an)*rad,Math.sin(an)*rad*.80,0));}
  poly(pts,[.004,.002,.013],a*.96,false);ring(T,rad,rad*.8,col,a*.9,q*2,2.05*g);ring(at(0,0,1),rad*1.09,rad*.81,hot,a*.25,-q*2,.55*g);
  for(let j=0;j<5;j++){const an=j*TAU/5+t*.9;
   const path=v=>{const rr=w*(.15+.55*v)*collapse;return at(Math.cos(an+v*1.6)*rr,Math.sin(an+v*1.6)*rr*.65,4);};
   band(path,v=>Math.sin(v*Math.PI)*w*.049,a*.88,[.030,.008,.053],15,false);
   band(v=>{const p=path(v);return[p[0]+g,p[1],p[2]+1];},v=>Math.sin(v*Math.PI)*1.35*g,a*.76,col,5);
  }
  if(q>=0){glow(T,w*.35,col,hit*.32);for(let j=0;j<20;j++){const u=C(q/.45),an=N(seed+j)*TAU,rad=w*(.66*(1-u)+.02);f.particles.push({p:at(Math.cos(an)*rad,Math.sin(an)*rad*.65,8),color:col,size:(1+j%3)*g,alpha:(1-u)*.9,type:2});}}
 }
 else if(d.kind==='siphon'){
  if(q<0){ring(T,w*.26,h*.22,col,charge*.55,-q,1*g);}
  if(q>=0){const a=E(q/.025)*(1-E((q-.48)/.39));
   band(u=>[L(T[0],F[0],u),L(T[1],F[1],u)+Math.sin(u*Math.PI)*22*g,44+Math.sin(u*Math.PI)*14],u=>Math.sin(u*Math.PI)*6.5*g,a*.67,col,15);
   for(let j=0;j<(low?8:18);j++){const age=q-j*.025;if(age<0||age>.48)continue;const u=E(age/.48),p=[L(T[0],F[0],u),L(T[1],F[1],u)+Math.sin(u*Math.PI)*22*g,49];
    glow(p,20*g,col,Math.sin(u*Math.PI)*.80);f.particles.push({p,size:3.5*g,color:hot,alpha:a,type:0});}
   glow(T,w*.26,col,hit*.3);glow(F,d.from.w*.65,col,E(q/.40)*(1-E((q-.50)/.33))*.40);}
 }
 else if(d.kind==='bladeCross'){
  for(const sign of [-1,1]){const k=C((q+.09)/.18),end=k,tail=C(end-.62+E((q-.09)/.23)*.62),a=1-E((q-.10)/.30);
   band(v=>{let u=L(tail,end,v);return at((u-.5)*w*1.28,(u-.5)*h*.86*sign,9);},v=>Math.sin(v*Math.PI)**.8*w*.095,a,hot,12);}
  if(q>=0){scars('steel',4);debris('steel',25);glow(T,w*.48,hot,hit*.5);}
 }
 else if(d.kind==='contact'){
  if(q>=0){glow(T,w*.30,hot,hit*.26);debris('steel',9,.43);}
 }
 else if(d.kind==='demise'){
  if(q>=0){const age=C(q/.80),a=1-E((q-.49)/.33);for(let j=0;j<(low?12:31);j++){
   const x=(N(seed+j*13)-.5)*w*.77,y=(N(seed+j*29)-.5)*h*.65+age*h*.53;
   shard(at(x*(1-age*.4),y,6),(1.8+N(seed+j)*3.6)*g,age+j*.6,[.27,.42,.61],a*.79);}
   sprite(at(0,age*h*.18,1),w*(.55+age*.2),[.055,.05,.10],Math.sin(age*Math.PI)*.19,9,t*.3);}
 }
 else {
  // Non-offensive: no impact flash, no damage scars. Shape communicates meaning.
  const a=q<0?charge*.5:E((q+.005)/.065)*(1-E((q-.38)/.55)),u=E(Math.max(0,q)/.30);
  if(d.kind==='ward'){
   const center=at(0,0,2),r=w*.52,verts=[];for(let j=0;j<6;j++){const ang=TAU*j/6+Math.PI/6;verts.push([center[0]+Math.cos(ang)*r,center[1]+Math.sin(ang)*h*.43,center[2]]);}
   poly(verts,[.025,.12,.22],a*.48,false);for(let j=0;j<6;j++)line(verts[j],verts[(j+1)%6],2.5*g,hot,a*.96);
   ring(center,r*.63,h*.28,col,a*.62,t*.2,1.0*g);
   for(let j=0;j<3;j++){const y=(-.21+j*.18)*h;line(at(-w*.22,y,3),at(w*.22,y,3),1.0*g,col,a*.55);}
  }else if(d.kind==='heal'||d.kind==='nature'){
   ring(at(0,-h*.30,0),w*.44,h*.11,col,a*.74,-t*.4,.8*g);
   for(let j=0;j<(low?7:15);j++){
    const age=(q+.11+j*.055);if(age<0||age>.68)continue;const v=age/.68,ang=j*2.399+v*1.8,r=w*.34*(1-v*.55),p=at(Math.cos(ang)*r,L(-h*.30,h*.37,v),7+Math.sin(ang)*5);
    const k=(3.7+j%3)*g,al=Math.sin(v*Math.PI)*a;poly([[p[0],p[1]+k*1.8,p[2]],[p[0]-k,p[1],p[2]+1],[p[0],p[1]-k,p[2]],[p[0]+k*.9,p[1],p[2]+1]],[.13,.85,.44],al,false);
    line([p[0],p[1]-k,p[2]+2],[p[0],p[1]+k*1.8,p[2]+2],.35*g,[.68,1.5,.73],al*.8);
   }
   glow(T,w*.94,col,a*.27);
  }else if(d.kind==='buff'||d.kind==='holy'){
   for(let j=0;j<3;j++){const yy=L(-h*.27,h*.15,u)+j*h*.13,al=a*(1-j*.2);line(at(-w*.24,yy,4),at(0,yy+h*.14,5),2.8*g,hot,al);line(at(0,yy+h*.14,5),at(w*.24,yy,4),2.8*g,col,al);}
   ring(at(0,-h*.25,0),w*.37,h*.10,col,a*.5,0,.8*g);glow(T,w*.63,col,a*.12);
  }else{ // arcane or summon: counter-rotating construction, not an explosion.
   const r=w*(d.kind==='summon'?.53:.41),yy=d.kind==='summon'?-h*.27:0;
   for(let k=0;k<2;k++){const count=k?6:8,angle=(k?-1:1)*t*.65,verts=[];
    for(let j=0;j<=count;j++){const an=TAU*j/count+angle;verts.push(at(Math.cos(an)*r*(k?.78:1),yy+Math.sin(an)*r*(d.kind==='summon'?.32:.75),k*2));}
    for(let j=0;j<count;j++)line(verts[j],verts[j+1],k?1.15*g:2.1*g,k?hot:col,a*(k?.58:.85));}
   for(let j=0;j<(low?7:16);j++){const v=(Math.max(0,q)+j*.067)%1,an=j*2.39;f.particles.push({p:at(Math.cos(an)*w*.37,yy+v*h*.79,5),size:(1+j%3)*g,color:hot,alpha:Math.sin(v*Math.PI)*a*.70,type:j%3?0:1});}
   glow(at(0,yy,0),w*.85,col,a*.12);
  }
 }
 // R10: contact is a shaped event, not only a soft disc. Keep the primary
 // silhouette in low quality; crowd budgets attenuate embellishment, never hits.
 const budget=crowdBudget(d.crowd||1);
 const pointBurst=(direction,length,width,alpha,color=hot)=>{
  const dx=Math.cos(direction),dy=Math.sin(direction),px=-dy,py=dx;
  const p0=at(dx*length*.10,dy*length*.10,17),p1=at(dx*length,dy*length,17);
  poly([p0,at(dx*length*.36+px*width,dy*length*.36+py*width,17),p1,
   at(dx*length*.36-px*width,dy*length*.36-py*width,17)],color,alpha,true);
 };
 if(q>=0){
  const pulse=contactEnvelope(q,.055,17),out=1-Math.exp(-q*17),
   attackAngle=Math.atan2(uy,ux),physical=['arrow','spear','claw','slam','bladeCross'].includes(d.kind);
  if(physical){
   const n=d.kind==='claw'?3:d.kind==='slam'?8:5;
   for(let j=0;j<n;j++){
    const th=d.kind==='slam'?j*TAU/n+.2:attackAngle+(j-(n-1)/2)*.54;
    pointBurst(th,w*(d.kind==='slam'?.36:.25)*(1.0+.65*out)*(j%2?.75:1),g*(j%2?1.0:2.4),pulse*(j%2?.42:.78));
   }
  }
  if(d.kind==='arrow'||d.kind==='spear'){
   // Entry pressure: a single elliptical ripple, oriented across the flight.
   const radius=w*(.08+.27*out),alpha=(1-E((q-.09)/.23));
   ring(at(0,0,11),radius,radius*.62,col,alpha*.80,attackAngle,1.3*g);
   for(let j=0;j<(low?4:7);j++){
    const theta=attackAngle+(N(seed+j*47)-.5)*1.5,age=C(q/.44),speed=(.36+N(seed+j)*.26)*w;
    const p=at(Math.cos(theta)*speed*age,Math.sin(theta)*speed*age-15*g*age*age,14);
    shard(p,(1.6+N(seed+j*3)*1.9)*g,theta+q*3,[.56,.31,.12],(1-age)*.85,false);
   }
  }
  if(d.kind==='slam'){
   const rad=w*(.22+.58*out),a=1-E((q-.10)/.30);
   // Heavy pressure has an opaque dark underside and a narrow lit outer lip.
   for(let j=0;j<8;j++){
    const th=j*TAU/8,da=.11,rr=rad*(.96+N(j+seed)*.10),z=7;
    poly([at(Math.cos(th-da)*rr,Math.sin(th-da)*rr*.42,z),
     at(Math.cos(th)*rr*1.18,Math.sin(th)*rr*.48,z+3),
     at(Math.cos(th+da)*rr,Math.sin(th+da)*rr*.42,z),
     at(Math.cos(th)*rr*.83,Math.sin(th)*rr*.35,z)],[.21,.18,.14],a*.63,false);
   }
  }
  if(d.kind==='fireball'){
   // A short hot crown at contact, followed by separate turbulent fire lobes.
   for(let j=0;j<7;j++)pointBurst(j*TAU/7+.22,w*(.36+.22*out)*(j%2?.75:1),g*3.4,pulse*.66,[2.0,.91,.22]);
   for(let j=0;j<3;j++){
    const radius=w*(.18+.56*out),alpha=1-E((q-.055)/.25),start=j*TAU/3+.16;
    band(v=>{const th=start+v*1.32;return at(Math.cos(th)*radius,Math.sin(th)*radius*.60,14);},
     v=>Math.sin(v*Math.PI)*1.5*g,alpha*.62,[1.25,.33,.025],5);
   }
  }
  if(d.kind==='frost'||d.kind==='frost-field'){
   const ice=d.kind==='frost-field',a=1-E((q-.12)/.37);
   for(let j=0;j<(low?4:8);j++){
    const theta=j*TAU/8+.35,dist=w*(.10+.49*out),size=(ice?6.5:5.1)*g*(1-.50*out);
    shard(at(Math.cos(theta)*dist,Math.sin(theta)*dist*.65+q*14*g,16),size,theta-Math.PI/2,[.18,.53,.87],a,true);
   }
  }
  if(d.kind==='ward'){
   const a=E(q/.035)*(1-E((q-.44)/.38)),rx=w*.48,ry=h*.41;
   // Six broad optical faces: stronger protection silhouette without filling white.
   for(let j=0;j<6;j++){
    const th=j*TAU/6+Math.PI/6,th2=(j+1)*TAU/6+Math.PI/6;
    poly([at(0,0,4),at(Math.cos(th)*rx,Math.sin(th)*ry,4),at(Math.cos(th2)*rx,Math.sin(th2)*ry,4)],
     j%2?[.045,.29,.43]:[.035,.13,.23],a*(j%2?.28:.44),false);
   }
   ring(at(0,0,10),w*.57,h*.47,[.42,1.05,1.55],a*.62,0,1.2*g);
   const yy=L(-h*.34,h*.34,C(q/.47)),half=w*.32*Math.sin(Math.PI*C((yy/h+.40)/.80));
   line(at(-half,yy,11),at(half,yy,11),1.7*g,[1.3,1.75,2],a*.80);
  }
  if(d.kind==='heal'||d.kind==='nature'){
   const a=E(q/.04)*(1-E((q-.42)/.35));
   for(let j=0;j<2;j++)band(u=>{const th=u*TAU*1.1+j*Math.PI-q*3;
    return at(Math.cos(th)*w*.35,L(-h*.36,h*.37,u),7+Math.sin(th)*7);},
    u=>Math.sin(u*Math.PI)*1.6*g,a*.72,j?[.48,1.3,.48]:[.055,.48,.28],6);
  }
  if(d.kind==='buff'||d.kind==='holy'){
   const a=E(q/.04)*(1-E((q-.40)/.30)),rise=E(q/.32);
   for(let j=0;j<2;j++){
    const yy=(-.22+rise*.22+j*.23)*h,z=9;
    poly([at(-w*.25,yy,z),at(0,yy+h*.15,z),at(w*.25,yy,z),at(w*.20,yy-h*.035,z),at(0,yy+h*.075,z),at(-w*.20,yy-h*.035,z)],
     j?[1.3,.60,.12]:[.35,.20,.075],a*(j?.83:.94),j===1);
   }
  }
  if(d.kind==='arcane'){
   const a=E(q/.05)*(1-E((q-.35)/.42)),k=9*g*(.85+.15*Math.sin(q*3));
   shard(at(0,0,12),k,-q*.55,[.28,.22,.62],a,true);
   for(let j=0;j<6;j++){
    const th=j*TAU/6+q*.75,p=at(Math.cos(th)*w*.43,Math.sin(th)*h*.31,8);
    shard(p,3.2*g,th,[.50,.36,1.08],a,true);
   }
  }
  if(d.kind==='summon'){
   const a=E(q/.08)*(1-E((q-.43)/.37)),rise=E(q/.34);
   for(let j=0;j<2;j++){
    const sg=j?1:-1;
    band(u=>at(sg*w*(.47-.12*Math.sin(u*Math.PI)),L(-h*.35,h*.38*rise,u),8),
     u=>Math.sin(u*Math.PI)*3.2*g,a*.76,[.27,.50,1.1],12);
   }
   ring(at(0,-h*.32,10),w*.58,h*.13,[.75,.82,1.65],a*.85,0,2.3*g);
  }
 }
 // Budget bright secondary overlays in group combat; no screen flash or exposure shift.
 for(const o of f.glows)o.alpha*=budget;
 f.decorBudget=budget;

 // Lifetime is strict even when seeking over an entire effect in one step.
 return f;
}
function create(R,X){
 const {Geo}=X;
 function strip(points,widths){const out=[];if(points.length<2)return out;
  const side=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l];});
  const v=(p,u,t)=>out.push(...p,0,0,1,u,t);
  for(let i=0;i<points.length-1;i++){const corners=j=>{const p=points[j],n=side[j],w=widths[j];return[[p[0]+n[0]*w,p[1]+n[1]*w,p[2]],[p[0]-n[0]*w,p[1]-n[1]*w,p[2]]];},[a,b]=corners(i),[c,d]=corners(i+1),u=i/(points.length-1),s=(i+1)/(points.length-1);v(a,u,0);v(b,u,1);v(c,s,0);v(b,u,1);v(d,s,1);v(c,s,0);}return out;
 }
 function render(d,s,W,H,low){const f=sample(d,s.t,W,H,low);if(!f.alive)return;
  // Consecutive compatible flat meshes batch together; no new GL buffer per shard.
  const bins=new Map();for(const o of f.meshes){const key=[o.mode,o.add,o.alpha.toFixed(3),o.color.join(',')].join('/');if(!bins.has(key))bins.set(key,{...o,data:[]});const a=bins.get(key);for(let j=1;j<o.points.length-1;j++)Geo.tri(a.data,o.points[0],o.points[j],o.points[j+1]);}
  for(const o of bins.values())R.dynamicFX(o.data,o.color,{mode:o.mode,alpha:o.alpha,add:o.add,transparent:!o.add,time:s.t});
  for(const o of f.ribbons)R.dynamicFX(strip(o.points,o.widths),o.color,{mode:o.mode,alpha:o.alpha,add:o.add,transparent:!o.add,time:s.t,surface:d.seed%29});
  for(const o of f.lines)R.line(o.a,o.b,o.width,o.color,{mode:6,alpha:o.alpha,add:o.add,transparent:!o.add,time:s.t});
  for(const o of f.sprites){const cs=Math.cos(o.rot),sn=Math.sin(o.rot),w=o.size,h=o.size*(o.aspect||1);
   R.fxList.push({geo:R.geo.plane,model:new Float32Array([cs*w,sn*w,0,0,0,0,1,0,-sn*h,cs*h,0,0,...o.p,1]),color:o.color,opt:{mode:o.mode,alpha:o.alpha,transparent:true,add:false,surface:o.seed,time:s.t}});}
  for(const o of f.glows)R.glow(o.p,o.size,o.color,o.alpha);
  for(const o of f.particles)R.particle(o.p,o.size,o.color,o.alpha,o.type);
  return f;
 }
 return{render,strip,destroy(){}};
}
const api=Object.freeze({DEFINITIONS,COLORS,supports,resolve,timing,reaction,contactEnvelope,crowdBudget,sample,create});G.EmberRemasterArts=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
