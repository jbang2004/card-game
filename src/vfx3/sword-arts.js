/* R6 — authored sword-light, not steel models. Presentation only.
 * Pure sample(time) -> ribbons / threads / particles / cracks. One renderer,
 * one authoritative contact per attack; multiple light trails are NOT extra hits.
 * Coordinate units are CSS-stage px; z points toward the fixed stage camera.
 */
(function(G){
'use strict';
const C=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const E=x=>{x=C(x);return x*x*(3-2*x);};
const L=(a,b,t)=>a+(b-a)*t;
const R=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const TAU=Math.PI*2;
const Bench=G.EmberBenchmarkArts||(typeof require==="function"?require("./benchmark-arts.js"):null);
const definitions={
 dawn:{name:'曦锋 · 一闪',en:'DAWN EDGE',form:'arc',color:[.20,.65,1.25],angle:-.48,radius:1.15,sweep:2.4,width:.088,pre:.090,post:.120,tail:480,weight:.70},
 bastion:{name:'铁誓 · 破阵',en:'BASTION CROSS',form:'cross',color:[.20,.54,1.18],angle:.73,radius:.78,sweep:1.85,width:.105,pre:.100,post:.125,tail:580,weight:1.0},
 night:{name:'夜幕 · 无声刺',en:'SILENT NEEDLE',form:'needle',color:[.52,.17,1.20],angle:-.38,radius:1.1,width:.035,pre:.075,post:.085,tail:720,weight:.72},
 blood:{name:'血月 · 回刃',en:'BLOOD RETURN',form:'blood',color:[1.45,.065,.19],angle:.35,radius:1.0,sweep:2.9,width:.13,pre:.120,post:.150,tail:730,weight:.86},
 judgment:{name:'圣裁 · 天剑',en:'HEAVENLY VERDICT',form:'sky',color:[1.45,.69,.14],pre:.140,post:.12,tail:1440,weight:1.25},
 crescent:{name:'黯月 · 弦刈',en:'CRESCENT REAP',form:'crescent',color:[.49,.23,1.42],angle:-.17,radius:1.22,sweep:3.5,width:.18,pre:.130,post:.165,tail:780,weight:1.1},
 sunfall:{name:'逐日 · 三曜',en:'TRIPLE SUNFALL',form:'sunfall',color:[1.9,.55,.045],pre:.160,post:.14,tail:1090,weight:1.35},
 frost:{name:'白霜 · 王敕',en:'FROST EDICT',form:'frost',color:[.065,.87,1.70],pre:.145,post:.14,tail:1710,weight:1.16},
 bone:{name:'骸骨 · 残锋',en:'BONE SPLINTER',form:'bone',color:[.65,.81,.59],angle:.56,radius:.65,sweep:1.8,width:.050,pre:.07,post:.100,tail:420,weight:.52},
 thrust:{name:'新兵 · 直进',en:'RECRUIT LUNGE',form:'thrust',color:[.10,.88,.92],width:.040,pre:.10,post:.08,tail:430,weight:.55},
 twins:{name:'银月 · 双弦',en:'TWIN MOONS',form:'twins',color:[.32,.80,1.6],angle:.28,radius:.93,sweep:2.8,width:.082,pre:.10,post:.15,tail:670,weight:1.05},
 daybreak:{name:'日耀 · 开天',en:'DAYBREAK WAVE',form:'daybreak',color:[1.65,.57,.12],angle:.10,radius:1.35,sweep:2.7,width:.19,pre:.135,post:.18,tail:850,weight:1.3},
 shatter:{name:'碎誓 · 解构',en:'OATHBREAKER',form:'shatter',color:[.28,.68,.92],angle:-.65,radius:.83,sweep:1.7,width:.082,pre:.095,post:.13,tail:750,weight:1.0},
};
for(const v of Object.values(definitions)){Object.freeze(v.color);Object.freeze(v);}Object.freeze(definitions);
const resolve=id=>Object.hasOwn(definitions,id)?id:'judgment';
const get=id=>definitions[resolve(id)];
function phase(d,t){const a=get(d.swordStyle),hit=(d.impact-d.start)/1000,scale=C(d.scale||1,.1,1),q=(t-hit)/scale;
 const pre=Math.min(a.pre,Math.max(0,hit/scale));
 return {a,q,hit,pre,visible:t>=0&&q>=-pre&&q<a.tail/1000,contact:q>=0,
  stage:q<-pre?'待机':q<0?'出剑':q<.06?'接触':'余韵'};
}
function sweep(q,pre,post){return q<0?.5*C(1+q/Math.max(pre,.000001))**2:.5+.5*(1-(1-C(q/post))**2);}
function sample(d,t,W=1600,H=940,low=false){
 if(Bench?.supports(d.swordStyle))return Bench.sample(d,t,W,H,low);
 const m=phase(d,t),a=m.a,q=m.q,seed=d.seed||7;
 const f={style:resolve(d.swordStyle),form:a.form,name:a.name,phase:m.stage,contact:m.contact,
  ribbons:[],lines:[],glows:[],particles:[],cracks:[],shards:[],tip:null,alive:m.visible};
 if(!m.visible)return f;
 const g=C(d.to.w/116,.40,1.75),w=d.to.w,c=[d.to.x-W/2,H/2-(d.to.y+d.to.h*.03),42];
 const from=[d.from.x-W/2,H/2-(d.from.y-d.from.h*.08),42],sign=d.to.x>=d.from.x?1:-1;
 const col=a.color,hot=col.map(x=>.90+x*.18);
 const pt=(x,y,z=0)=>[c[0]+x,c[1]+y,c[2]+z];
 const line=(p,b,width,alpha,color=col)=>{if(alpha>.003)f.lines.push({a:p,b,width,alpha,color});};
 const ribbon=(fn,u0,u1,width,alpha,color=col,material=12)=>{
  u0=C(u0);u1=C(u1);if(u1-u0<.0001||alpha<.003)return;
  const n=low?25:49,points=[],widths=[];
  for(let i=0;i<n;i++){
   const v=i/(n-1),u=L(u0,u1,v);points.push(fn(u));
   widths.push(Math.max(.015,Math.pow(Math.sin(Math.PI*v),.62)*width*(.30+.70*v)));
  }
  f.ribbons.push({points,widths,alpha,color,material,seed:seed%17});
 };
 // The swept front crosses the card center exactly at q=0. A trail samples
 // that SAME analytic path; completion advances its tail rather than scaling it.
 function arc(angle,radius,sweepAngle,width,offset=0,reverse=false,color=col){
  const k=sweep(q-offset,m.pre,a.post||.13),fade=1-E((q-(a.post||.13)*.60)/.31);
  const end=C(k),tail=C(end-.46+E((q-(a.post||.13))/.28)*.46);
  const cs=Math.cos(angle),sn=Math.sin(angle),rad=radius*w;
  const fn=u=>{const th=(u-.5)*sweepAngle*(reverse?-1:1),x=Math.sin(th)*rad,y=(Math.cos(th)-1)*rad*.70;
   return pt((x*cs-y*sn)*sign,x*sn+y*cs,Math.sin(u*Math.PI)*13);};
  ribbon(fn,tail,end,width*w,fade*.82,color);
  // Flow filaments follow the exact curve: asymmetry gives a blade edge, not a hoop.
  for(let j=0;j<(low?2:4);j++){
   const ofs=(j-1.5)*width*w*.23;
   ribbon(u=>{const p=fn(u);return[p[0]+Math.sin(angle)*ofs,p[1]-Math.cos(angle)*ofs,p[2]+.6];},
    C(tail+.035*j),end,width*w*.032,fade*(.38-j*.045),hot,5);
  }
  if(q<.14)f.tip=fn(end);
 }
 function needle(angle,width,length=1.35){
  const cs=Math.cos(angle)*sign,sn=Math.sin(angle),k=sweep(q,m.pre,a.post),fade=1-E((q-.075)/.26);
  const fn=u=>pt((u-.5)*w*length*cs,(u-.5)*w*length*sn,5+Math.sin(u*Math.PI)*7);
  ribbon(fn,C(k-.72),C(k),width*w,fade*.98);
  ribbon(fn,C(k-.60),C(k),width*w*.12,fade*.90,hot,5);f.tip=fn(C(k));
 }
 function sky(offset=0,small=1){
  const flight=Math.max(.001,m.pre),u=C(1+q/flight),drop=.40*u+.60*u*u;
  const tip=[c[0]+offset*w,L(H/2+90,c[1],drop),c[2]+5];
  const len=C(w*2.0,125,320)*small,fade=1-E((q-.16)/.40);
  const fn=u=>[tip[0]+Math.sin(u*Math.PI)*.7*g,tip[1]+u*len,tip[2]+Math.sin(u*Math.PI)*6];
  const width=(a.form==='frost'?.072:.096)*w*small;
  // Spectral lancet: finely tapering cross section. No hilt, metal or rigid model.
  if(fade>.003){
   const n=low?28:46,points=[],widths=[];
   for(let i=0;i<n;i++){const v=i/(n-1);points.push(fn(v));widths.push(.01+width*Math.sin(Math.PI*v)**.80*(.52+.48*v));}
   f.ribbons.push({points,widths,color:col,alpha:fade*.92,material:12,seed:seed%17});
   for(const sg of [-1,1])ribbon(v=>{const p=fn(v);return[p[0]+sg*width*.60*Math.sin(v*Math.PI),p[1],p[2]+1];},0,1,width*.045,fade*.65,hot,5);
   // A handful of small etched chevrons, kept behind the slender central blade.
   for(let j=0;j<4;j++)for(const sg of [-1,1]){
    const y=tip[1]+len*(.26+j*.155),x=tip[0]+sg*(width+5*g);
    line([x+sg*5*g,y+6*g,40],[x,y,40],.55*g,fade*.38,hot);
    line([x,y,40],[x+sg*3*g,y-6*g,40],.40*g,fade*.3);
   }
  }
  // Air threads trailing above the projectile vanish immediately after impact.
  if(q<.055){for(const sg of [-1,1])line([tip[0]+sg*width*1.4,tip[1]+len*.34,38],[tip[0]+sg*width*1.5,tip[1]+len*1.28,38],.45*g,(q<0?.45:Math.exp(-q*65)*.45));}
  f.tip=tip;
 }
 switch(a.form){
 case 'arc':arc(a.angle,a.radius,a.sweep,a.width);break;
 case 'cross':arc(.72,1.02,1.85,.115);arc(-.72,1.02,1.85,.115,0,true);break;
 case 'needle':needle(-.38,.040,1.75);break;
 case 'bone':{
  const k=sweep(q,m.pre,a.post),fade=1-E((q-.07)/.24);
  const fn=u=>pt((u-.5)*w*.95*sign,(u-.5)*w*.56+Math.sin(u*6*Math.PI)*w*.024,5);
  ribbon(fn,C(k-.43),C(k),w*.048,fade*.8);break;
 }
 case 'thrust':{
  const u=q<0?C(1+q/Math.max(.001,m.pre)):1,fade=1-E((q-.045)/.24),dx=c[0]-from[0],dy=c[1]-from[1];
  const fn=v=>[from[0]+dx*v,from[1]+dy*v,42+Math.sin(v*Math.PI)*12];
  const tail=Math.min(.6,65*g/(Math.hypot(dx,dy)||1));ribbon(fn,C(u-tail),u,w*.036,fade*.92);ribbon(fn,C(u-tail*.85),u,w*.008,fade,hot,5);f.tip=fn(u);break;
 }
 case 'blood':arc(.35,1.0,2.9,.12);break;
 case 'crescent':arc(-.17,1.22,3.5,.18);break;
 case 'twins':arc(.40,.93,2.8,.075);arc(-.40,.93,2.8,.075,0,true);break;
 case 'daybreak':arc(.10,1.35,2.7,.19);arc(.10,1.13,2.7,.040,0,false,hot);break;
 case 'sky':sky();break;
 case 'sunfall':sky(-.28,.72);sky(.28,.72);sky();break;
 case 'frost':sky();break;
 case 'shatter':arc(-.65,.83,1.7,.09);needle(.7,.030,.85);break;
 }
 // Negative-space contrast: a quiet in-card scar with a narrow emissive rim.
 // No crack, ring, particle or damage indication may appear before contact.
 if(q>=0){
  const flash=Math.exp(-q*33)*a.weight;
  f.glows.push({p:c,size:w*.64,alpha:flash*.26,color:col},{p:pt(0,0,9),size:w*.20,alpha:flash*.80,color:hot});
  const count=low?12:32;
  for(let i=0;i<count;i++){
   const k=seed+i*29,life=.18+R(k)*.30;if(q>life)continue;
   const ang=R(k+1)*TAU,sp=(50+R(k+2)*180)*g*a.weight;
   const p=pt(Math.cos(ang)*sp*q,Math.sin(ang)*sp*q*.65-100*g*q*q,10+q*24);
   f.particles.push({p,size:(.9+R(k+3)*1.5)*g,alpha:(1-q/life)**1.7,color:i%5?col:hot,type:i%7?2:1});
  }
  const blocked=['shield','armor'].includes(d.outcome?.kind);
  if(!blocked&&['sky','sunfall','frost','shatter','cross'].includes(a.form)){
   const grow=1-(1-C(q/.17))**3,fade=1-E((q-.38)/.52);
   const n=a.form==='frost'?6:a.form==='sunfall'?9:a.form==='cross'?4:7;
   for(let j=0;j<n;j++){
    const angle=j*TAU/n+(a.form==='cross'?Math.PI/4:.19)+(R(seed+j)-.5)*.15;
    let prev=pt(0,0,3);
    for(let i=1;i<=5;i++){
     const u=i/5,pr=C((grow-(i-1)/5)*5);if(pr<=0)break;
     const wig=(R(seed+j*31+i*17)-.5)*.39*Math.sin(u*Math.PI),r=u*(.65+R(j+seed+93)*.24);
     const next=pt(Math.cos(angle+wig)*r*w*.43,Math.sin(angle+wig)*r*d.to.h*.31,3);
     const b=prev.map((v,k)=>L(v,next[k],pr));f.cracks.push({a:prev,b,width:(2.05-u*1.38)*g,alpha:fade,color:col,group:j});
     if(i===3&&j%2===0){const branch=pt((next[0]-c[0])*.97+Math.cos(angle+.7)*w*.10,(next[1]-c[1])+Math.sin(angle+.7)*d.to.h*.07,3);f.cracks.push({a:next,b:branch,width:.60*g,alpha:fade*E((grow-.65)/.2),color:col,group:j+100});}
     prev=next;
    }
   }
  }else if(!blocked&&q<.5){
   const an=a.angle||0,fade=1-E((q-.09)/.34),dx=Math.cos(an)*w*.35,dy=Math.sin(an)*w*.35;
   f.cracks.push({a:pt(-dx,-dy,2),b:pt(dx,dy,2),width:1.0*g,alpha:fade*.78,color:col});
  }
  // The iconic motifs deliberately differ in geometry and motion, not just hue.
  if(['sky','sunfall','daybreak'].includes(a.form)){
   const fade=E(q/.045)*(1-E((q-.12)/.31)),rad=w*(.29+.17*E(q/.23));
   const n=a.form==='sunfall'?14:8;
   for(let j=0;j<n;j++){
    const ang=j*TAU/n,span=a.form==='sunfall'?.18:.12;
    for(let k=0;k<4;k++){
     const aa=ang+k/4*span,bb=ang+(k+1)/4*span;
     line(pt(Math.cos(aa)*rad,Math.sin(aa)*rad*.73,-1),pt(Math.cos(bb)*rad,Math.sin(bb)*rad*.73,-1),.64*g,fade*.7);
    }
    if(a.form==='sunfall')line(pt(Math.cos(ang)*rad*1.16,Math.sin(ang)*rad*.73*1.16,-1),pt(Math.cos(ang)*rad*1.32,Math.sin(ang)*rad*.73*1.32,-1),.75*g,fade*.55);
   }
  }
  if(a.form==='frost'){
   for(let j=0;j<(low?5:13);j++){
    const k=seed+j*23,ang=R(k)*TAU,v=32+R(k+2)*54,life=.42+R(k+1)*.33;if(q>life)continue;
    f.shards.push({p:pt(Math.cos(ang)*v*q*g,Math.sin(ang)*v*q*g-40*q*q,10+Math.sin(q*4)*16),size:(2+R(k+3)*3)*g,angle:ang+q*1.4,alpha:1-E((q-life*.55)/(life*.45)),color:col});
   }
  }
  if(a.form==='blood'&&q>.05){
   for(let j=0;j<(low?9:23);j++){
    const k=seed+j*41,age=q-.05-R(k)*.1,life=.38+R(k+1)*.18;if(age<0||age>life)continue;
    const u=age/life,ang=R(k+2)*TAU,rad=w*(.35+R(k+3)*.2)*(1-u);
    const p=pt(Math.cos(ang+u*2)*rad,Math.sin(ang+u*2)*rad*.6,8);
    f.particles.push({p,size:2.3*g,color:col,alpha:Math.sin(u*Math.PI)*.72,type:0});
   }
  }
  if(a.form==='crescent'&&q<.5){
   for(let j=0;j<(low?9:25);j++){
    const ang=L(-2.2,1.5,j/24)+q*.8,rad=w*(.78+q*.25);
    f.particles.push({p:pt(Math.cos(ang)*rad,Math.sin(ang)*rad*.55,10),size:(j%5===0?2.7:1.1)*g,color:hot,alpha:(1-E((q-.12)/.38))*.6,type:j%5?0:1});
   }
  }
 }
 // Clamp visibility only at boundaries, never mutate input/seed on random seek.
 return f;
}
function create(R,X){
 const {Geo}=X,benchmark=Bench.create(R,X);
 function strip(points,widths){
  const out=[];if(points.length<2)return out;
  const sides=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return[-dy/len,dx/len];});
  const vertex=(p,u,v)=>out.push(...p,0,0,1,u,v);
  for(let i=0;i<points.length-1;i++){
   const corners=(j)=>{const p=points[j],n=sides[j],w=widths[j];return[[p[0]+n[0]*w,p[1]+n[1]*w,p[2]],[p[0]-n[0]*w,p[1]-n[1]*w,p[2]]];};
   const [a,b]=corners(i),[c,d]=corners(i+1),u=i/(points.length-1),v=(i+1)/(points.length-1);
   vertex(a,u,0);vertex(b,u,1);vertex(c,v,0);vertex(b,u,1);vertex(d,v,1);vertex(c,v,0);
  }return out;
 }
 function render(d,s,W,H,low){
  if(Bench.supports(d.swordStyle))return benchmark.render(d,s,W,H,low);
  const f=sample(d,s.t,W,H,low);if(!f.alive)return;
  const q=s.after/d.scale;
  // Draw scars first, with over blending, then luminous blade skin above.
  const dark=[],edge=[],inner=[];
  const groups=new Map();
  for(const c of f.cracks){if(c.alpha<.003)continue;const key=c.group??0;
   if(!groups.has(key))groups.set(key,{points:[c.a],widths:[c.width]});
   const chain=groups.get(key);chain.points.push(c.b);chain.widths.push(Math.max(.30,c.width*.85));
  }
  for(const chain of groups.values()){
   dark.push(...strip(chain.points,chain.widths));
   edge.push(...strip(chain.points.map(p=>[p[0]+.7,p[1]-.40,p[2]+.1]),chain.widths.map(w=>Math.max(.28,w*.24))));
   inner.push(...strip(chain.points.map(p=>[p[0],p[1],p[2]+.2]),chain.widths.map(w=>Math.max(.15,w*.14))));
  }
  const crackAlpha=Math.max(0,...f.cracks.map(x=>x.alpha));
  if(dark.length){R.dynamicFX(dark,'#080c1c',{mode:6,alpha:crackAlpha*.89,transparent:true,add:false,time:s.t});R.dynamicFX(edge,'#8299ad',{mode:6,alpha:crackAlpha*.30,transparent:true,add:false,time:s.t});R.dynamicFX(inner,get(d.swordStyle).color,{mode:6,alpha:crackAlpha*.18,time:s.t});}
  for(const b of f.ribbons){
   // Thin airy backing, not a huge white glow. One fine edge in material 12.
   if(b.material===12){
    const style=d.swordStyle,shadow=['blood','crescent','bone'].includes(style),gold=['sunfall','daybreak'].includes(style);
    const middle=shadow?b.color.map(x=>x*.19):b.color.map(x=>x*.50);
    R.dynamicFX(strip(b.points,b.widths.map(x=>x*1.15)),middle,{mode:15,alpha:b.alpha*.78,add:false,transparent:true,time:s.t,surface:b.seed});
    R.dynamicFX(strip(b.points,b.widths),b.color,{mode:gold?13:12,alpha:b.alpha*.86,add:!gold,transparent:gold,time:s.t,surface:b.seed,dissolve:Math.max(0,(q-.14)/.45)});
    // Single lit leading edge, with a contrasting back face. No uniform white tube.
    const edge=b.points.map((p,i)=>{const a=b.points[Math.max(0,i-1)],c=b.points[Math.min(b.points.length-1,i+1)],dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy)||1;return [p[0]-dy/len*b.widths[i]*.76,p[1]+dx/len*b.widths[i]*.76,p[2]+.25];});
    R.dynamicFX(strip(edge,b.widths.map(x=>Math.max(.10,x*.055))),b.color.map(x=>x*1.25+.26),{mode:6,alpha:b.alpha*.80,add:true,time:s.t});
   }else R.dynamicFX(strip(b.points,b.widths),b.color,{mode:b.material,alpha:b.alpha,add:true,time:s.t,surface:b.seed});
  }
  for(const l of f.lines)R.line(l.a,l.b,l.width,l.color,{mode:6,alpha:l.alpha,time:s.t});
  for(const p of f.glows)R.glow(p.p,p.size,p.color,p.alpha);
  for(const p of f.particles)R.particle(p.p,p.size,p.color,p.alpha,p.type);
  for(const c of f.shards){
   const o=[],[x,y,z]=c.p,k=c.size,ca=Math.cos(c.angle),sa=Math.sin(c.angle);
   const p=(u,v,dz=0)=>[x+u*ca-v*sa,y+u*sa+v*ca,z+dz];
   Geo.tri(o,p(0,k*2),p(-k*.42,0),p(0,-k));Geo.tri(o,p(0,k*2),p(0,-k),p(k*.42,0));
   R.dynamicFX(o,c.color,{mode:6,alpha:c.alpha*.72,add:true,time:s.t});
  }
 }
 return {render,destroy(){benchmark.destroy();},strip};
}
const api=Object.freeze({definitions,resolve,get,phase,sample,create});G.EmberSwordArts=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
