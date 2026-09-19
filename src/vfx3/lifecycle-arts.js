/* R11 state lifecycle: deterministic, presentation-only event compositions.
 * All coordinates are stage pixels. No state changes, timers or random-per-frame.
 * These cues start at the event's actual presentation deadline, never before it.
 */
(function(G){
'use strict';
const C=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), E=x=>{x=C(x);return x*x*(3-2*x);};
const N=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x);}, PI=Math.PI, TAU=2*PI;
const DEFINITIONS=Object.freeze({
 'shield-break':{name:'圣盾 · 碎光',tail:820,color:[1.4,.83,.25]},
 thaw:{name:'冰壳 · 解冻',tail:920,color:[.31,.86,1.3]},
 'stealth-in':{name:'潜行 · 入影',tail:740,color:[.41,.28,.83]},
 'stealth-out':{name:'潜行 · 显形',tail:580,color:[.66,.4,1.2]},
 silence:{name:'沉默 · 封印',tail:800,color:[.71,.57,1.1]},
 morph:{name:'化形 · 易相',tail:1000,color:[.42,.94,1.3]},
 rebirth:{name:'复生 · 归魂',tail:1120,color:[.36,1.1,.82]},
 expire:{name:'增益 · 消退',tail:690,color:[.67,.77,.91]},
 'armor-break':{name:'护甲 · 承击',tail:580,color:[1.12,.72,.35]},
 'secret-reveal':{name:'奥秘 · 揭示',tail:940,color:[.91,.43,1.2]},
 counterspell:{name:'反制 · 截断',tail:900,color:[.81,.48,1.3]},
 'weapon-equip':{name:'武器 · 铸誓',tail:850,color:[1.25,.84,.39]},
 'weapon-break':{name:'武器 · 断裂',tail:940,color:[1.15,.7,.31]},
 overdraw:{name:'爆牌 · 焚毁',tail:1050,color:[1.6,.42,.10]},
 fatigue:{name:'疲劳 · 空竭',tail:800,color:[.87,.19,.30]},
 trigger:{name:'能力 · 回响',tail:620,color:[1.2,.8,.39]},
 'turn-ready':{name:'回合 · 蓄能',tail:850,color:[.38,.82,1.3]},
 'hero-fall':{name:'英雄 · 陨落',tail:1120,color:[.68,.25,.4]},
 victory:{name:'胜利 · 加冕',tail:1200,color:[1.4,.94,.4]},
 defeat:{name:'败北 · 余烬',tail:1050,color:[.64,.31,.49]},
 awaken:{name:'首领 · 觉醒',tail:1200,color:[1.4,.36,.12]},
 'draw-arrive':{name:'抽牌 · 收束',tail:500,color:[.51,.78,1.2]}
});
function kindFor(e){
 if(!e)return null;
 if(e.type==='shield')return 'shield-break';
 if(e.type==='weaponWear')return e.broken?'weapon-break':null;
 if(e.type==='secret')return e.cid==='counterspell'?'counterspell':'secret-reveal';
 if(e.type==='burn')return 'overdraw';
 if(e.type==='summon')return e.rebornFrom?'rebirth':e.tags?.includes('stealth')?'stealth-in':null;
 if(e.type==='status')return ({thaw:'thaw',silence:'silence',transform:'morph',expire:'expire',trigger:'trigger'})[e.kind] || (e.kind==='grant'&&e.tag==='stealth'?'stealth-in':null);
 return null;
}
function sample(d,t,W=1600,H=940,low=false){
 const spec=DEFINITIONS[d.kind],q=(t-(d.impact-d.start)/1000)/(d.scale||1);
 const f={kind:d.kind,alive:!!spec&&q>=0&&q<spec.tail/1000-1e-6,meshes:[],ribbons:[],lines:[],sprites:[],glows:[],particles:[],q};
 if(!f.alive)return f;
 const w=C(d.to.w,24,400),h=C(d.to.h,30,500),g=C(w/116,.4,1.8),seed=d.seed||7,col=spec.color,hot=col.map(x=>x*.4+1.04);
 const P=(x,y,z=0)=>[d.to.x-W/2+x,H/2-d.to.y+y,62+z];
 const fade=(a=.28,b=.72)=>1-E((q-a)/(b-a));
 const poly=(pts,c=col,a=1,add=false)=>{if(a>.004)f.meshes.push({points:pts,color:c,alpha:a,add,mode:6});};
 const line=(a,b,width,c=col,alpha=1,add=true)=>{if(alpha>.004)f.lines.push({a,b,width,color:c,alpha,add});};
 const glow=(p,size,c,a)=>{if(a>.004)f.glows.push({p,size,color:c,alpha:a});};
 const path=(pts,width,c,a,add=true)=>{if(a>.004&&pts.length>1)f.ribbons.push({points:pts,widths:pts.map(()=>width),color:c,alpha:a,mode:6,add});};
 const ring=(rx,ry,a,c=col,start=0,end=TAU,rotation=0,width=1.1*g,cy=0)=>{
  const pts=[],n=low?24:42;for(let j=0;j<=n;j++){const u=start+(end-start)*j/n+rotation;pts.push(P(Math.cos(u)*rx,Math.sin(u)*ry+cy,3));}path(pts,width,c,a);
 };
 const shard=(x,y,size,angle,c,alpha,velocity=true)=>{
  const cs=Math.cos(angle),sn=Math.sin(angle),F=(a,b,z=0)=>P(x+cs*a-sn*b,y+sn*a+cs*b,z);
  poly([F(0,size*1.5),F(-size*.72,-size*.5),F(0,-size,3),F(size*.38,0,4)],c,alpha,false);
  poly([F(0,size*1.5),F(size*.38,0,4),F(size*.7,-size*.65),F(0,-size,3)],c.map(v=>v*.46),alpha,false);
  line(F(0,size*1.5),F(-size*.72,-size*.5),.65*g,hot,alpha*.76);
 };
 const sparks=(count,style='out',duration=.68)=>{
  for(let j=0;j<(low?Math.ceil(count*.48):count);j++){
   const k=seed+j*23,life=duration*(.6+N(k)*.4);if(q>life)continue;
   const a=N(k+1)*TAU,r=(40+N(k+2)*95)*g,up=style==='up'?90:style==='down'?-55:22;
   const x=Math.cos(a)*r*q,y=Math.sin(a)*r*q*.5+up*g*q-(style==='up'?0:110*g*q*q),al=(1-q/life)**1.1;
   if(j%4===0)shard(x,y,(2.3+N(k+5)*4.1)*g,a+q*(N(k+6)-.5)*6,col,al*.82);
   else f.particles.push({p:P(x,y,8+Math.sin(q/life*PI)*20),size:(1+N(k+8)*2.2)*g,color:j%3?col:hot,alpha:al,type:j%5?0:1});
  }
 };
 const rune=(radius,alpha,rot=0,count=8)=>{
  ring(radius,radius*.72,alpha*.65,col,0,TAU,rot,.7*g);
  for(let j=0;j<count;j++){
   const a=j*TAU/count+rot,x=Math.cos(a)*radius,y=Math.sin(a)*radius*.72;
   line(P(x-3*g,y),P(x+3*g,y),1*g,col,alpha);line(P(x,y-4*g),P(x,y+4*g),.8*g,hot,alpha*.75);
  }
 };
 const peak=Math.exp(-Math.max(0,q-.05)*13);
 switch(d.kind){
 case 'shield-break':case 'armor-break':{
  const metal=d.kind==='armor-break',separate=E(q/.17),a=fade(.24,metal?.53:.76),rx=w*(metal?.34:.52),ry=h*(metal?.30:.48);
  for(let j=0;j<6;j++){
   const a0=j*TAU/6+PI/6,a1=(j+1)*TAU/6+PI/6,mid=(a0+a1)/2;
   const dx=Math.cos(mid)*28*g*separate,dy=Math.sin(mid)*28*g*separate-90*g*q*q;
   const c=P(dx*.30,dy*.3,5),p1=P(Math.cos(a0)*rx+dx,Math.sin(a0)*ry+dy,10+separate*8),p2=P(Math.cos(a1)*rx+dx,Math.sin(a1)*ry+dy,7);
   poly([c,p1,p2],j%2?col.map(x=>x*.25):col.map(x=>x*.46),a*.46,false);line(p1,p2,2*g,hot,a);line(c,p1,.85*g,col,a*.77);
  }
  glow(P(0,0,10),w*.70,col,peak*.38);sparks(26,'out',.68);break;
 }
 case 'thaw':{
  const a=fade(.28,.82),sep=E(q/.30);
  for(let j=0;j<8;j++){
   const side=j%2?1:-1,x=side*w*(.28+.19*N(seed+j)),y=(j/7-.5)*h*.77;
   shard(x+side*28*g*sep,y-105*g*q*q,(9+N(seed+j+4)*8)*g,side*(q*2.5+.18),j%2?col:col.map(x=>x*.5),a*.73);
  }
  for(let j=0;j<3;j++)ring(w*(.40+q*.18),h*(.4+q*.13),a*.30,col,j*2.1,j*2.1+1.25,0,.9*g,-q*18*g);
  sparks(25,'down',.88);glow(P(0,0),w*.9,col,peak*.20);break;
 }
 case 'stealth-in':case 'stealth-out':{
  const inward=d.kind==='stealth-in',u=E(q/.45),r=inward?1-u:.2+u*.9,a=fade(.17,.65);
  for(let j=0;j<6;j++){
   const pts=[];for(let k=0;k<22;k++){const t=k/21,ang=j*TAU/6+t*1.4+q*(inward?-2:3);pts.push(P(Math.cos(ang)*w*.62*r,Math.sin(ang)*h*.52*r,4+t*5));}
   path(pts,3.4*g,[.014,.009,.036],a*.82,false);path(pts.map(p=>[p[0]+g,p[1],p[2]+.2]),.85*g,col,a*.78);
  }
  ring(w*.37,h*.39,a*.75,col,0,TAU,q*2,.8*g);sparks(18,'up',.58);break;
 }
 case 'silence':case 'expire':{
  const off=d.kind==='expire',r=w*(off?.4:.5)*(1-E(q/.48)*.54),a=fade(.24,.73);
  rune(r,a,-q*1.7,off?6:10);
  for(let j=0;j<6;j++){const a0=j*TAU/6,rr=r*(1.0+q);shard(Math.cos(a0)*rr,Math.sin(a0)*rr*.76,4*g,a0+q*3,col,a*.58);}
  if(!off){const u=E(q/.13),x=w*.24*u,y=h*.22*u;line(P(-x,-y,9),P(x,y,9),3.8*g,[.025,.019,.05],a,false);line(P(-x,y,9),P(x,-y,9),3.8*g,[.025,.019,.05],a,false);line(P(-x+g,-y,10),P(x+g,y,10),1.1*g,hot,a*.75);line(P(-x+g,y,10),P(x+g,-y,10),1.1*g,hot,a*.75);}
  sparks(18,'down',.72);break;
 }
 case 'morph':{
  const wave=Math.sin(C(q/.69)*PI),a=fade(.52,.96),r=w*.5*(.45+.55*wave);
  rune(r,a,q*2.1,9);ring(r*1.11,h*.48*a,a*.55,hot,0,TAU,-q*1.1,1.5*g);
  const y=h*(.46-E(q/.56)*.92);
  line(P(-w*.48,y,12),P(w*.48,y,12),4.6*g,[.025,.064,.096],a,false);
  line(P(-w*.48,y+1.8*g,13),P(w*.48,y+1.8*g,13),1.4*g,hot,a);
  glow(P(0,y),w*.65,col,wave*.30);sparks(38,'up',.97);break;
 }
 case 'rebirth':{
  const a=fade(.63,1.08),rise=E(q/.65),ry=h*.44;
  for(let j=0;j<3;j++)ring(w*(.27+.08*j),h*.12,a*(.75-j*.14),j%2?hot:col,0,TAU,0,1.4*g,-ry+rise*h*.82-j*13*g);
  for(let side of [-1,1]){
   const pts=[];for(let i=0;i<22;i++){let u=i/21;pts.push(P(side*Math.sin(u*PI)*w*(.44-.10*rise),-h*.42+u*h*.84,8));}path(pts,1.2*g,col,a*.85);
   for(let j=0;j<5;j++)shard(side*w*(.18+.05*j),h*(.08+j*.055)+rise*15*g,5*g,side*(.6+j*.1),col,a*.64);
  }
  glow(P(0,h*(rise-.4)),w*.80,col,a*.27);sparks(48,'up',1.1);break;
 }
 case 'secret-reveal':case 'counterspell':{
  const a=fade(.49,.88),r=w*(.26+E(q/.17)*.19),rot=.1+q*.6;
  rune(r,a,rot,8);
  const pts=[];for(let j=0;j<5;j++){let b=j*TAU/4+PI/4+rot;pts.push(P(Math.cos(b)*r*.78,Math.sin(b)*r*.90,10));}path(pts,2*g,col,a);
  line(P(0,-r*.25,12),P(0,r*.32,12),3*g,hot,a);glow(P(0,-r*.46,12),7*g,hot,a);
  if(d.kind==='counterspell'){
   const source=[d.from.x-W/2,H/2-d.from.y,60],u=E(q/.23),head=P(0,0,12),pts=[];
   for(let j=0;j<24;j++){let v=j/23*u;pts.push([source[0]+(head[0]-source[0])*v,source[1]+(head[1]-source[1])*v+Math.sin(v*PI)*w*.25,68]);}
   path(pts,1.7*g,col,fade(.27,.61));line(P(-w*.3,-h*.24,14),P(w*.3,h*.24,14),2.8*g,hot,peak);line(P(-w*.3,h*.24,14),P(w*.3,-h*.24,14),2.8*g,hot,peak);
  }
  sparks(30,'out',.84);break;
 }
 case 'weapon-equip':case 'weapon-break':{
  const broken=d.kind==='weapon-break',a=fade(broken?.30:.49,.87),sep=broken?E(q/.21):1-E(q/.22);
  for(let side of [-1,1]){
   const dx=side*(broken?24:18)*g*sep,dy=(broken?-100*q*q:0)*g;
   const pts=side<0?[[0,-h*.34],[-w*.075,-h*.20],[-w*.075,h*.18],[0,h*.28]]:[[0,h*.28],[w*.075,h*.18],[w*.075,-h*.20],[0,-h*.34]];
   const vs=pts.map(([x,y])=>P(x+dx,y+dy,5));poly(vs,side<0?col.map(v=>v*.52):col,a*.92,false);path(vs,1*g,hot,a*.74);
  }
  if(!broken){line(P(-w*.22,h*.19,8),P(w*.22,h*.19,8),3.2*g,col,a);line(P(0,h*.20,8),P(0,h*.42,8),4*g,[.3,.23,.14],a,false);rune(w*.55,a*.56,-q,6);}
  else sparks(30,'down',.87);
  glow(P(0,0),w*.82,col,peak*.29);break;
 }
 case 'overdraw':{
  const a=fade(.61,1.02),burn=E(q/.66),rx=w*.43,ry=h*.43,y=ry-burn*h*.86;
  if(q<.68)poly([P(-rx,-ry),P(rx,-ry),P(rx,y),P(-rx,y)],[.035,.043,.064],.76,false);
  line(P(-rx,y,8),P(rx,y,8),3*g,col,a);
  for(let j=0;j<(low?7:14);j++){
   const x=(j/13-.5)*w*.9,delay=N(seed+j)*.08,age=C(q-delay),s=(11+N(j+seed)*14)*g;
   f.sprites.push({p:P(x,y+age*45*g,12),size:s,aspect:1.45,color:col,alpha:a*.5,mode:8,rot:(N(j)-.5)*.5,seed:j+seed});
  }
  sparks(36,'up',1.0);break;
 }
 case 'fatigue':case 'hero-fall':case 'defeat':{
  const fall=d.kind==='hero-fall',a=fade(fall?.61:.35,fall?1.08:.94);
  for(let j=0;j<7;j++){
   const aa=j*TAU/7+.24,len=w*(.3+.12*N(seed+j))*E(q/.16);
   const pts=[P(0,0,4),P(Math.cos(aa)*len*.55,Math.sin(aa)*len*.5,4),P(Math.cos(aa+.12)*len,Math.sin(aa+.12)*len,4)];
   path(pts,2.3*g,[.014,.008,.023],a,false);path(pts.map(p=>[p[0]+g,p[1],p[2]+1]),.8*g,col,a*.82);
  }
  for(let j=0;j<4;j++){let r=w*(.43+q*.15);ring(r,h*.41,a*.47,col,j*PI/2,j*PI/2+.92,q*.3,1.5*g);}
  sparks(fall?42:23,'down',fall?1.08:.82);glow(P(0,0),w*.96,[.35,.07,.13],peak*.36);break;
 }
 case 'victory':case 'awaken':{
  const a=fade(.71,1.17),u=E(q/.18);
  for(let side of [-1,1])for(let j=0;j<7;j++){
   const ang=-1.15+j*.33,rx=w*.6*u,ry=h*.47*u,x=side*Math.cos(ang)*rx,y=Math.sin(ang)*ry;
   shard(x,y,6.5*g,side*(.8-j*.16),col,a*(.6+j*.04));
  }
  const pts=[[-.34,.40],[-.22,.64],[-.08,.48],[0,.72],[.08,.48],[.22,.64],[.34,.40]].map(([x,y])=>P(x*w*u,y*h*.62,8));path(pts,2*g,hot,a);
  ring(w*.66,h*.54,a*.44,col,0,TAU,q*.2,1.2*g);sparks(40,'up',1.14);glow(P(0,0),w*1.1,col,peak*.27);break;
 }
 case 'trigger':{
  const a=fade(.16,.58),u=E(q/.31),s=[d.from.x-W/2,H/2-d.from.y,67],end=P(0,0,4),pts=[];
  for(let j=0;j<24;j++){let v=j/23;pts.push([s[0]+(end[0]-s[0])*v,s[1]+(end[1]-s[1])*v+Math.sin(v*PI)*18*g,67]);}path(pts,.85*g,col,a*.45);
  glow([s[0]+(end[0]-s[0])*u,s[1]+(end[1]-s[1])*u+Math.sin(u*PI)*18*g,68],15*g,hot,a*.83);
  rune(w*.36,a*.65,q,4);break;
 }
 case 'turn-ready':case 'draw-arrive':{
  const a=fade(.22,d.kind==='draw-arrive'?.48:.82),u=E(q/.32),n=d.kind==='turn-ready'?10:4;
  for(let j=0;j<n;j++){
   const ang=TAU*j/n-PI/2,x=Math.cos(ang)*w*.48,y=Math.sin(ang)*h*.4;
   shard(x,y,(d.kind==='turn-ready'?4.8:3.5)*g,ang,col,a*(.35+.65*E((u-j/n)*4)));
  }
  ring(w*.54,h*.47,a*.58,col,0,TAU*u,-PI/2,1.5*g);glow(P(0,0),w*.85,col,peak*.15);break;
 }
 }
 return f;
}
function create(R,X){
 const strip=G.EmberRemasterArts.create(R,X).strip;
 function render(d,s,W,H,low){const f=sample(d,s.t,W,H,low);if(!f.alive)return f;
  const bins=new Map();for(const o of f.meshes){const key=[o.mode,o.add,o.alpha.toFixed(3),o.color.join(',')].join('/');if(!bins.has(key))bins.set(key,{...o,data:[]});let b=bins.get(key);for(let j=1;j<o.points.length-1;j++)X.Geo.tri(b.data,o.points[0],o.points[j],o.points[j+1]);}
  for(const o of bins.values())R.dynamicFX(o.data,o.color,{mode:6,alpha:o.alpha,add:o.add,transparent:!o.add,time:s.t});
  for(const o of f.ribbons)R.dynamicFX(strip(o.points,o.widths),o.color,{mode:6,alpha:o.alpha,add:o.add,transparent:!o.add,time:s.t});
  for(const o of f.lines)R.line(o.a,o.b,o.width,o.color,{mode:6,alpha:o.alpha,add:o.add,transparent:!o.add});
  for(const o of f.sprites){const cs=Math.cos(o.rot),sn=Math.sin(o.rot),w=o.size,h=w*o.aspect;R.fxList.push({geo:R.geo.plane,model:new Float32Array([cs*w,sn*w,0,0,0,0,1,0,-sn*h,cs*h,0,0,...o.p,1]),color:o.color,opt:{mode:o.mode,alpha:o.alpha,transparent:true,add:false,surface:o.seed,time:s.t}});}
  for(const o of f.glows)R.glow(o.p,o.size,o.color,o.alpha);for(const o of f.particles)R.particle(o.p,o.size,o.color,o.alpha,o.type);return f;
 }
 return {render,destroy(){}};
}
const api=Object.freeze({DEFINITIONS,kindFor,supports:k=>Object.hasOwn(DEFINITIONS,k),sample,create});G.EmberLifecycleArts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
