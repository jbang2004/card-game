/* R7 benchmark choreography. Pure absolute-time sampling; no rules or timers.
 * Storyboard interpretation: holy offscreen verdict, silent shadow puncture,
 * crystalline frost edict. The existing dragon flame is deliberately untouched.
 * Positions use the existing CSS-stage plane and a shallow 3D depth axis.
 */
(function(G){
"use strict";
const C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const E=v=>{v=C(v);return v*v*(3-2*v);};
const L=(a,b,t)=>a+(b-a)*t;
const N=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453123;return n-Math.floor(n);};
const TAU=Math.PI*2;
const STYLES=Object.freeze({
 judgment:Object.freeze({name:"圣裁 · 天剑",form:"sky",tail:1440,flight:.125,color:[1.55,.65,.105],hot:[2.3,1.85,.98]}),
 night:Object.freeze({name:"夜幕 · 无声刺",form:"needle",tail:720,flight:.095,color:[.48,.16,1.1],hot:[1.5,1.16,2.25]}),
 frost:Object.freeze({name:"白霜 · 王敕",form:"frost",tail:1710,flight:.14,color:[.15,.68,1.2],hot:[1.5,2.0,2.25]})
});
const supports=k=>Object.hasOwn(STYLES,k);
function timing(d,t){
 const a=STYLES[d.swordStyle],scale=C(d.scale||1,.1,1),hit=(d.impact-d.start)/1000;
 const q=(t-hit)/scale,pre=Math.min(.34,hit/scale),flight=Math.min(a?.flight||.1,pre);
 return {a,hit,q,pre,flight,charge:E((q+pre)/Math.max(.02,pre-flight)),
   alive:!!a&&t>=0&&q<a.tail/1000,stage:q<-flight?"凝聚":q<0?"释放":q<.08?"命中":q<.5?"裂痕":"消散"};
}
function reaction(d,t){
 if(!supports(d.swordStyle))return {source:[0,0,0],target:[0,0,0],sourceLight:0,targetLight:0};
 const m=timing(d,t),q=m.q,a=m.a,night=d.swordStyle==="night";
 const dx=d.to.x-d.from.x,dy=d.to.y-d.from.y,len=Math.hypot(dx,dy)||1;
 const anticipation=E((q+m.pre)/Math.max(.025,m.pre*.5))*(1-E((q+m.flight)/Math.max(.015,m.flight)));
 const release=Math.sin(Math.PI*C((q+m.flight)/(m.flight+.11)));
 const punch=q<0?0:(1-Math.exp(-q*170))*Math.exp(-Math.max(0,q-.05)*(night?21:12));
 const s=night?Math.min(len*.058,18)*release:-4*anticipation;
 return {source:[dx/len*s,dy/len*s,night?release*-1.4:anticipation*-1.0],
 target:night?[dx/len*5*punch,dy/len*5*punch,punch*1.5]:[0,7*punch,-punch*1.2],
 sourceLight:anticipation*.16,targetLight:q>=0?Math.exp(-q*25)*.20:0};
}
function sample(d,t,W=1600,H=940,low=false){
 const m=timing(d,t),a=m.a;
 const f={style:d.swordStyle,form:a?.form,name:a?.name,phase:m.stage,contact:m.q>=0,alive:m.alive,
  ribbons:[],lines:[],glows:[],particles:[],cracks:[],shards:[],plates:[],tip:null,
  reaction:reaction(d,t),bounds:null};
 if(!m.alive)return f;
 const q=m.q,w=d.to.w,h=d.to.h,g=C(w/116,.38,1.65),seed=d.seed||7;
 const c=[d.to.x-W/2,H/2-(d.to.y+h*.03),52],F=[d.from.x-W/2,H/2-d.from.y,42];
 const col=a.color,hot=a.hot,night=d.swordStyle==="night",ice=d.swordStyle==="frost";
 const pt=(x,y,z=0)=>[c[0]+x,c[1]+y,c[2]+z];
 f.bounds={center:c,w:w*.88,h:h*.68};
 const line=(p,b,width,alpha,color=col,add=true)=>{
  if(alpha>.003)f.lines.push({a:p,b,width,alpha,color,add});
 };
 const band=(fn,widthFn,alpha,color=col,material=13,add=false,n=low?19:37)=>{
  if(alpha<=.003)return;
  const points=[],widths=[];for(let i=0;i<n;i++){const u=i/(n-1);points.push(fn(u));widths.push(Math.max(.012,widthFn(u)));}
  f.ribbons.push({points,widths,alpha,color,material,add,seed:seed%31});
 };
 const circle=(x,y,r,squash,alpha,color=col,rotation=0,segments=64,start=0,sweep=TAU,width=.6*g)=>{
  if(alpha<.003)return;
  const n=low?Math.ceil(segments*.6):segments;
  const fn=i=>pt(x+Math.cos(rotation+start+i/n*sweep)*r,y+Math.sin(rotation+start+i/n*sweep)*r*squash,-4);
  for(let i=0;i<n;i++)line(fn(i),fn(i+1),width,alpha,color);
 };
 const star=(x,y,r,alpha,color=hot,angle=0)=>{
  if(alpha<.004)return;
  const fn=(u,v)=>pt(x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),6);
  for(const [rx,ry] of [[r*.17,r],[r*.80,r*.15]]){
   const points=[fn(0,ry),fn(rx,0),fn(0,-ry),fn(-rx,0),fn(0,ry)];
   for(let i=0;i<4;i++)line(points[i],points[i+1],.70*g,alpha,color);
  }
 };
 const glyph=(y,alpha,r=22*g)=>{
  circle(0,y,r,.94,alpha*.65,col,0,54);
  circle(0,y,r*1.12,.94,alpha*.23,hot,0,54);
  star(0,y,r*1.32,alpha,hot);
  for(let j=0;j<8;j++){
   const ang=j*TAU/8,r0=r*1.19,r1=r*(j%2?1.34:1.59);
   line(pt(Math.cos(ang)*r0,y+Math.sin(ang)*r0,3),pt(Math.cos(ang)*r1,y+Math.sin(ang)*r1,3),.52*g,alpha*.60);
  }
 };
 const charge=m.charge*(1-E((q+.015)/.09));
 if(!night&&q<.075&&charge>.003){
  const gy=h*.78;
  if(!ice){
   glyph(gy,charge*.55,24*g);
   circle(0,gy,35*g,.35,charge*.45,col,q*.7,70);
   f.glows.push({p:pt(0,gy),size:75*g,alpha:charge*.15,color:col});
  }else{
   circle(0,gy,29*g,.37,charge*.57,hot,q*1.2,64,0,TAU*1.65);
   circle(0,gy,37*g,.26,charge*.32,col,-q*.8,64,.3,TAU*1.25);
   for(let j=0;j<6;j++){const ang=j*TAU/6+q*1.4;
    f.shards.push({p:pt(Math.cos(ang)*24*g,gy+Math.sin(ang)*8*g,(j%2)*12),size:(2+j%3)*g,angle:ang,alpha:charge*.76,color:col,spin:q*1.4,ice:true});}
  }
  for(let j=0;j<(low?6:14);j++){
   const age=((q+m.pre)*1.2+N(seed+j*19))%1,r=(20+N(seed+j)*35)*g*(1-age);
   const ang=N(seed+j*29)*TAU;
   f.particles.push({p:pt(Math.cos(ang)*r,gy+Math.sin(ang)*r*.7,5),size:(1+j%3*.45)*g,alpha:charge*Math.sin(age*Math.PI)*.8,color:hot,type:j%4?0:1,role:"charge"});
  }
 }
 if(!night&&q>=-m.flight){
  const u=C(1+q/Math.max(.001,m.flight)),drop=.32*u+.68*u*u;
  const tip=[c[0],L(H/2+64*g,c[1],drop),c[2]+5];
  f.tip=tip;
  const len=C(w*(ice?2.95:3.10),145,355),half=w*(ice?.115:.105);
  const vanish=1-E((q-(ice?.075:.09))/(ice?.23:.21));
  const dissolve=E((q-.07)/.26);
  if(vanish>.003){
   const fn=v=>[tip[0],tip[1]+v*len,tip[2]+Math.sin(v*Math.PI)*5];
   const wid=v=>half*Math.pow(Math.sin(Math.PI*v),ice?.62:.78)*(.57+.43*v);
   band(fn,v=>wid(v)*2.0,vanish*.10,col,5,true);
   band(fn,wid,vanish,ice?[.28,.70,.91]:[1.32,.58,.10],ice?14:13,false);
   // Two sharply defined blade facets flank a narrow saturated center.
   for(const sg of [-1,1]){
    band(v=>{let p=fn(v);return[p[0]+sg*wid(v)*.88,p[1],p[2]+1];},
      v=>Math.max(.08,.60*g*Math.sin(v*Math.PI)),vanish*.80,hot,6,true);
   }
   band(fn,v=>Math.sin(v*Math.PI)*.85*g,vanish*.90,hot,6,true);
   if(!ice&&q<.20)glyph(tip[1]-c[1]+len*.70,vanish*.87,21*g);
   if(ice){
    // Angular splines read as a crystal crown, not a recolored solar halo.
    for(let j=-2;j<=2;j++){
     const yy=tip[1]+len*.69,x=j*9*g,apex=[tip[0]+x*1.5,yy+(34-Math.abs(j)*8)*g,tip[2]+4];
     line([tip[0]+x,yy-9*g,tip[2]+4],apex,.8*g,vanish*.75,hot);
     line(apex,[tip[0]+x*.4,yy+2*g,tip[2]+4],.65*g,vanish*.65,col);
    }
    for(let j=0;j<5;j++){
     const v=.22+j*.13,p=fn(v),dx=wid(v);
     line([p[0]-dx*.8,p[1],p[2]+1],[p[0]+dx*.7,p[1]+len*.08,p[2]+1],.45*g,vanish*.42,hot);
    }
   }
   if(q<.04){
    for(let j=0;j<6;j++){
     const sg=j%2?-1:1,xx=tip[0]+sg*(half*(1.1+j*.15));
     line([xx,tip[1]+len*.25,35],[xx,tip[1]+len*(1.18+N(j)*.25),35],.45*g,vanish*(.3-j*.035),col);
    }
   }
  }
  // During collapse fragments detach along the blade instead of dimming it as a whole.
  if(q>.10&&q<.62){
   for(let j=0;j<(low?12:30);j++){
    const born=.10+N(seed+j)*.17,age=q-born;if(age<0)continue;
    const life=.20+N(seed+j*13)*.23;if(age>life)continue;
    const v=N(seed+j*47),x=(N(seed+j*31)-.5)*half*2;
    const p=[tip[0]+x+(N(j+71)-.5)*age*80*g,tip[1]+v*len+age*35*g,tip[2]+age*20];
    if(ice)f.shards.push({p,size:(1.2+N(j+2)*2.2)*g,angle:N(j)*TAU,spin:age*4,alpha:(1-age/life)*.75,color:col,ice:true});
    else f.particles.push({p,size:(1+N(j+12)*2.1)*g,alpha:(1-age/life)*.83,color:j%3?col:hot,type:j%4?0:1});
   }
  }
 }else if(night){
  const delta=c.map((v,i)=>v-F[i]),dist=Math.hypot(delta[0],delta[1])||1,dir=[delta[0]/dist,delta[1]/dist,0],normal=[-dir[1],dir[0],0];
  const fl=m.flight;
  if(q>=-fl&&q<.18){
   // One advancing front; black body and light edge travel together.
   const p=q<0?C(1+q/Math.max(.001,fl))**1.8:1+Math.min(.12,q*.85);
   const head=F.map((v,i)=>v+delta[i]*p);
   const tailLen=Math.min(dist*.78,230*g),fade=1-E((q-.01)/.14);
   const fn=u=>[head[0]-dir[0]*tailLen*(1-u),head[1]-dir[1]*tailLen*(1-u),head[2]+8];
   const shape=u=>Math.pow(Math.sin(Math.PI*u),.65)*w*.061*(1-u*.7);
   band(fn,u=>shape(u)*1.5,fade*.88,[.028,.016,.062],15,false);
   band(fn,u=>shape(u)*.31,fade*.96,col,15,true);
   band(fn,u=>Math.max(.03,.68*g*Math.sin(u*Math.PI)),fade,hot,6,true);
   for(let j=0;j<3;j++){
    const sg=j%2?-1:1,offset=(6+j*4)*g;
    band(u=>{const v=fn(u),s=Math.sin(u*Math.PI)*(1-u)*offset;
      return [v[0]+normal[0]*s*sg,v[1]+normal[1]*s*sg,v[2]-3];},
     u=>Math.sin(u*Math.PI)*(1-u)*1.1*g,fade*(.36-j*.06),col,15,true);
   }
   f.tip=q<0?head:c;
  }
  if(q>=0&&q<.57){
   const fade=1-E((q-.14)/.40),an=Math.atan2(dir[1],dir[0]),width=w*.43;
   const fn=u=>pt(Math.cos(an)*(u-.5)*width*1.85,Math.sin(an)*(u-.5)*width*1.85,7);
   band(fn,u=>Math.sin(Math.PI*u)*(3.5+N(seed+Math.floor(u*8))*1.2)*g,fade*.95,[.015,.008,.035],15,false);
   for(const sg of [-1,1])band(u=>{const p=fn(u);return[p[0]+normal[0]*sg*1.8*g*Math.sin(u*Math.PI),p[1]+normal[1]*sg*1.8*g*Math.sin(u*Math.PI),p[2]+1];},
     u=>.55*g*Math.sin(u*Math.PI),fade*.80,col,6,true);
   for(let j=0;j<(low?4:10);j++){
    const age=q-j*.006,life=.15+N(j+seed)*.17;if(age<0||age>life)continue;
    const p=pt(dir[0]*(25+N(j)*48)*g*age*3+normal[0]*(N(j+8)-.5)*25*g*age,
      dir[1]*(25+N(j)*48)*g*age*3+normal[1]*(N(j+8)-.5)*25*g*age,15);
    f.particles.push({p,size:(1+N(j+3)*1.5)*g,alpha:(1-age/life)*.85,color:hot,type:2});
   }
  }
 }
 if(q>=0){
  const flash=Math.exp(-q*(night?58:38));
  f.glows.push({p:pt(0,0,13),size:w*(night?.35:.77),alpha:flash*(night?.44:.53),color:col});
  f.glows.push({p:pt(0,0,14),size:w*.20,alpha:flash*.90,color:hot});
  star(0,0,w*(night?.15:.41)*(1+E(q/.05)*.30),flash,hot,night?.55:.18);
  if(q<.115){
   const axes=night?[.52]:[.16,Math.PI/2+.10];
   for(const an of axes){
    const len=w*(night?.48:.74)*(1+E(q/.035)*.18);
    band(u=>pt(Math.cos(an)*(u-.5)*len,Math.sin(an)*(u-.5)*len,20),
     u=>Math.sin(Math.PI*u)**3*w*(night?.010:.035),flash*.9,hot,5,true,19);
   }
  }
  if(!night){
   const fade=1-E((q-.16)/.49),growth=1-Math.pow(1-C(q/(ice?.22:.16)),3);
   const n=ice?8:7;
   for(let j=0;j<n;j++){
    const ang=j*TAU/n+.16+(N(seed+j*11)-.5)*.56;
    let prev=pt(0,0,4);
    for(let i=1;i<=7;i++){
     const u=i/7,advance=C((growth-(i-1)/7)*7);if(!advance)break;
     const rad=u*(.48+N(j+seed)*.47),wig=(N(seed+j*79+i*29)-.5)*.30*Math.sin(u*Math.PI);
     const next=pt(Math.cos(ang+wig)*rad*w*.425,Math.sin(ang+wig)*rad*h*.315,4);
     const b=prev.map((v,k)=>L(v,next[k],advance));
     f.cracks.push({a:prev,b,width:(2.65-u*1.9)*g,alpha:fade,color:col,group:j});
     if(i===4&&j%2===0){
      const v=pt((next[0]-c[0])*.86+Math.cos(ang+.75)*w*.095,(next[1]-c[1])*.90+Math.sin(ang+.75)*h*.06,4);
      f.cracks.push({a:next,b:v,width:.7*g,alpha:fade*E((growth-.54)/.16),color:col,group:100+j});
     }
     prev=next;
    }
   }
   // Tight pressure ring, kept behind the target's face highlight.
   circle(0,0,w*(.20+E(q/.20)*.38),.53,E(q/.025)*(1-E((q-.09)/.19))*.58,col,0,64,0,TAU,.6*g);
   if(!ice){
    const rays=low?12:23;
    for(let j=0;j<rays;j++){
     const age=q-N(j+seed)*.025,life=.11+N(j*31+seed)*.23;if(age<0||age>life)continue;
     const ang=N(j*29+seed)*TAU,sp=(170+N(j*41)*390)*g,r0=sp*age,tail=Math.min(r0,(10+N(j)*34)*g);
     const p=pt(Math.cos(ang)*r0,Math.sin(ang)*r0*.71-80*g*age*age,12);
     const b=pt(Math.cos(ang)*(r0-tail),Math.sin(ang)*(r0-tail)*.71-80*g*age*age,12);
     line(b,p,(.55+N(j)*.9)*g,(1-age/life)*1.10,j%3?col:hot);
    }
    if(q>.14&&q<1.25)for(let j=0;j<(low?18:44);j++){
     const age=q-.14-N(seed+j)*.24,life=.32+N(j*3)*.50;if(age<0||age>life)continue;
     const ang=N(j*27+seed)*TAU,rad=(10+N(j*12)*37)*g;
     f.particles.push({p:pt(Math.cos(ang)*rad,Math.sin(ang)*rad*.6+age*50*g,13+N(j+5)*15),size:(.8+N(j*3)*1.4)*g,
      color:j%4?col:hot,alpha:Math.sin(Math.PI*age/life)*.65,type:j%4?0:1});
    }
   }else{
    const frostFade=1-E((q-.68)/.65),spread=E(q/.20);
    f.plates.push({p:pt(0,0,1),w:w*.86,h:h*.67,alpha:spread*frostFade*.75,material:16,color:[.45,.77,.92],growth:spread});
    // Fine fern-like crystallization; never a complete "frozen status" frame.
    if(q>.09&&q<1.10)for(let j=0;j<6;j++){
     const an=j*TAU/6+.23,reach=E((q-.09)/.22),fade=frostFade*.40;
     const ex=Math.cos(an)*w*.31*reach,ey=Math.sin(an)*h*.25*reach;
     for(let k=1;k<=3;k++){
      const u=k/4,p0=pt(ex*u,ey*u,3);
      for(const sg of [-1,1])line(p0,pt(ex*(u+.10)+Math.cos(an+sg*.8)*5*g,ey*(u+.10)+Math.sin(an+sg*.8)*7*g,3),.32*g,fade,hot);
     }
    }
    const count=low?12:29;
    for(let j=0;j<count;j++){
     const age=q-N(j+seed)*.022,life=.40+N(j*13+seed)*.50;if(age<0||age>life)continue;
     const ang=N(j*71+seed)*TAU,sp=(32+N(j*19)*112)*g;
     f.shards.push({p:pt(Math.cos(ang)*sp*age,Math.sin(ang)*sp*age*.75-85*g*age*age,12+Math.sin(age*2.2)*30),
      size:(1.7+N(j*43)*3.1)*g,angle:N(j+5)*TAU,spin:age*(1+N(j)*4),alpha:(1-E((age-life*.55)/(life*.45)))*.94,color:col,ice:true});
    }
    if(q<1.42)for(let j=0;j<(low?4:8);j++){
     const age=q-.08-j*.034;if(age<0)continue;const life=.66+N(j)*.38;if(age>life)continue;
     const x=(N(seed+j*29)-.5)*w*.65,y=(N(seed+j*41)-.5)*h*.3+age*24*g;
     f.plates.push({p:pt(x,y,6),w:(35+age*38)*g,h:(20+age*25)*g,alpha:Math.sin(Math.PI*age/life)*.13,material:9,color:[.40,.58,.70],growth:1,angle:j*.7});
    }
   }
  }
 }
 return f;
}
function create(R,X){
 const {Geo,M}=X;
 const crystal=R.mesh((()=>{
  const out=[],tip=[0,1.7,0],bottom=[0,-.9,0],ring=[[.40,0,0],[0,0,.35],[-.40,0,0],[0,0,-.35]];
  for(let i=0;i<4;i++){Geo.tri(out,tip,ring[i],ring[(i+1)%4]);Geo.tri(out,bottom,ring[(i+1)%4],ring[i]);}return out;
 })());
 function strip(points,widths){
  const out=[],n=points.length;if(n<2)return out;
  const sides=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(n-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],k=Math.hypot(dx,dy)||1;return[-dy/k,dx/k];});
  const v=(p,u,z)=>out.push(...p,0,0,1,u,z);
  const edges=i=>{const p=points[i],s=sides[i],w=widths[i];return[[p[0]+s[0]*w,p[1]+s[1]*w,p[2]],[p[0]-s[0]*w,p[1]-s[1]*w,p[2]]];};
  for(let i=0;i<n-1;i++){const[a,b]=edges(i),[c,d]=edges(i+1),u=i/(n-1),q=(i+1)/(n-1);v(a,u,0);v(b,u,1);v(c,q,0);v(b,u,1);v(d,q,1);v(c,q,0);}return out;
 }
 function render(d,s,W,H,low){
  const f=sample(d,s.t,W,H,low);if(!f.alive)return;
  // Real card-local frost film goes below fractures, not above numbers or cards.
  for(const p of f.plates){
   const ca=Math.cos(p.angle||0),sa=Math.sin(p.angle||0);
   const model=new Float32Array([ca*p.w,sa*p.w,0,0,0,0,1,0,-sa*p.h,ca*p.h,0,0,...p.p,1]);
   R.fxList.push({geo:R.geo.plane,model,color:p.color,opt:{mode:p.material,alpha:p.alpha,transparent:true,add:false,surface:p.growth||0,time:s.t}});
  }
  const groups=new Map(),dark=[],edge=[],lit=[];
  for(const k of f.cracks){if(!groups.has(k.group))groups.set(k.group,{p:[k.a],w:[k.width]});const a=groups.get(k.group);a.p.push(k.b);a.w.push(k.width*.82);}
  for(const k of groups.values()){
   dark.push(...strip(k.p,k.w));
   edge.push(...strip(k.p.map(p=>[p[0]+.65,p[1]-.4,p[2]+.25]),k.w.map(v=>Math.max(.2,v*.27))));
   lit.push(...strip(k.p.map(p=>[p[0],p[1],p[2]+.3]),k.w.map(v=>Math.max(.12,v*.14))));
  }
  const alpha=Math.max(0,...f.cracks.map(x=>x.alpha));
  if(dark.length){
   R.dynamicFX(dark,'#0c1220',{mode:6,alpha:alpha*.88,transparent:true,add:false,time:s.t});
   R.dynamicFX(edge,d.swordStyle==='frost'?[.62,.85,1]:[.86,.63,.30],{mode:6,alpha:alpha*.72,transparent:true,add:false,time:s.t});
   R.dynamicFX(lit,STYLES[d.swordStyle].hot,{mode:6,alpha:alpha*.66,add:true,time:s.t});
  }
  for(const b of f.ribbons)R.dynamicFX(strip(b.points,b.widths),b.color,{mode:b.material,alpha:b.alpha,add:b.add,transparent:!b.add,time:s.t,surface:b.seed});
  // Batch all continuous threads by color/opacity; no hundreds of small GL draws.
  const batches=new Map();
  for(const l of f.lines){
   const key=l.color.join(',')+'|'+Math.round(l.alpha*16)+'|'+l.add;
   if(!batches.has(key))batches.set(key,{data:[],color:l.color,alpha:l.alpha,add:l.add});
   batches.get(key).data.push(...strip([l.a,l.b],[l.width,l.width]));
  }
  for(const b of batches.values())R.dynamicFX(b.data,b.color,{mode:6,alpha:b.alpha,add:b.add,transparent:!b.add,time:s.t});
  for(const g of f.glows)R.glow(g.p,g.size,g.color,g.alpha);
  for(const p of f.particles)R.particle(p.p,p.size,p.color,p.alpha,p.type);
  for(const k of f.shards){
   R.fxList.push({geo:crystal,model:M.trs(k.p,[k.spin||0,(k.spin||0)*.65,k.angle],[k.size,k.size,k.size]),
    color:k.color,opt:{mode:0,alpha:k.alpha,transparent:true,add:false,metal:.32,roughness:.17,emission:.17,time:s.t}});
  }
  return f;
 }
 return {render,strip,destroy(){R.gl.deleteBuffer(crystal.b);}};
}
const api=Object.freeze({STYLES,supports,timing,reaction,sample,create});
G.EmberBenchmarkArts=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
