/* R8 silhouette / material / contact refinement. Pure absolute-time sampling; no rules or timers.
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
 sourceLight:anticipation*.16,targetLight:q>=0?Math.exp(-Math.max(0,q-.028)*27)*.16:0};
}
// R8 material language is authored per style. Brightness is not a substitute
// for silhouette: each blade has a dark/mid face, an edge and a distinct breakup.
function profile(u,keys){
 for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const a=keys[i-1],b=keys[i];return L(a[1],b[1],C((u-a[0])/(b[0]-a[0])));}
 return keys.at(-1)[1];
}
function contactEnvelope(q,night=false){
 if(q<0)return 0;
 const hold=night?.018:.045,rate=night?35:20;
 return Math.exp(-Math.max(0,q-hold)*rate);
}
function sample(d,t,W=1600,H=940,low=false){
 const m=timing(d,t),a=m.a;
 const f={style:d.swordStyle,form:a?.form,name:a?.name,phase:m.stage,contact:m.q>=0,alive:m.alive,
  ribbons:[],lines:[],glows:[],particles:[],cracks:[],shards:[],plates:[],polygons:[],tip:null,
  reaction:reaction(d,t),bounds:null};
 if(!m.alive)return f;
 const q=m.q,w=d.to.w,h=d.to.h,g=C(w/116,.38,1.65),seed=d.seed||7;
 const c=[d.to.x-W/2,H/2-(d.to.y+h*.03),52],F=[d.from.x-W/2,H/2-d.from.y,42];
 const col=a.color,hot=a.hot,night=d.swordStyle==='night',ice=d.swordStyle==='frost';
 const pt=(x,y,z=0)=>[c[0]+x,c[1]+y,c[2]+z];
 f.bounds={center:c,w:w*.88,h:h*.68};
 const line=(p,b,width,alpha,color=col,add=true)=>{if(alpha>.003)f.lines.push({a:p,b,width,alpha,color,add});};
 const band=(fn,widthFn,alpha,color=col,material=13,add=false,n=low?23:45,dissolve=0)=>{
  if(alpha<=.003)return;
  const points=[],widths=[];for(let i=0;i<n;i++){const u=i/(n-1);points.push(fn(u));widths.push(Math.max(.012,widthFn(u)));}
  f.ribbons.push({points,widths,alpha,color,material,add,seed:seed%31,dissolve});
 };
 const poly=(points,color,alpha,add=false)=>{if(alpha>.003)f.polygons.push({points,color,alpha,add});};
 const ring=(x,y,r,sy,alpha,color=col,rot=0,width=.65*g)=>{
  if(alpha<.003)return;const n=low?40:64;
  for(let j=0;j<n;j++){const p0=j*TAU/n+rot,p1=(j+1)*TAU/n+rot;
   line(pt(x+Math.cos(p0)*r,y+Math.sin(p0)*r*sy,-4),pt(x+Math.cos(p1)*r,y+Math.sin(p1)*r*sy,-4),width,alpha,color);}
 };
 // Four-point sigil, sharp concave blade flares rather than a thin wire circle.
 const seal=(x,y,r,alpha)=>{
  if(alpha<.003)return;
  const coords=[[0,1.50],[.14,.31],[.85,.04],[.19,-.13],[0,-1.18],[-.19,-.13],[-.85,.04],[-.14,.31]];
  const points=coords.map(([a,b])=>pt(x+a*r,y+b*r,7));
  for(let j=0;j<8;j++){
   const p=points[j],b=points[(j+1)%8];
   poly([pt(x,y,8),p,b],j%2?[1.5,.62,.05]:[.56,.16,.012],alpha*.78,false);
   line(p,b,1.0*g,alpha*.96,[2.45,1.5,.50]);
  }
  ring(x,y,r*.80,1,alpha*.6,col,0,.60*g);
  const inner=[[0,.41],[.18,0],[0,-.36],[-.18,0],[0,.41]].map(([a,b])=>pt(x+a*r,y+b*r,10));
  for(let j=0;j<4;j++)line(inner[j],inner[j+1],.9*g,alpha,hot);
 };
 const charge=m.charge*(1-E((q+.015)/.07));
 if(!night&&q<.055&&charge>.003){
  const gy=Math.min(h*.88,112*g);
  if(!ice){
   seal(0,gy,22*g,charge*.78);
   ring(0,gy,34*g,.33,charge*.48,col,q*.5);
  }else{
   ring(0,gy,30*g,.31,charge*.52,hot,q*.8);
   // Large, purposeful orbiting crystal pieces (not pinhead glitter).
   for(let j=0;j<5;j++){const an=j*TAU/5+q*1.5;
    f.shards.push({p:pt(Math.cos(an)*30*g,gy+Math.sin(an)*10*g,j*2),size:(4.1+j%2*1.8)*g,
      angle:an,spin:q*.7,alpha:charge*.94,color:[.20,.68,.95],ice:true});}
  }
  f.glows.push({p:pt(0,gy),size:72*g,alpha:charge*.20,color:col});
  for(let j=0;j<(low?6:14);j++){
   const age=((q+m.pre)*1.2+N(seed+j*19))%1,r=(20+N(seed+j)*35)*g*(1-age),ang=N(seed+j*29)*TAU;
   f.particles.push({p:pt(Math.cos(ang)*r,gy+Math.sin(ang)*r*.7,5),size:(1+j%3*.45)*g,
     alpha:charge*Math.sin(age*Math.PI)*.8,color:hot,type:j%4?0:1,role:'charge'});
  }
 }
 if(!night&&q>=-m.flight){
  const u=C(1+q/Math.max(.001,m.flight)),drop=.40*u+.60*u*u;
  const tip=[c[0],L(H/2+64*g,c[1],drop),c[2]+5];f.tip=tip;
  // Fixed length and authored cross-section all the way through flight.
  const len=C(w*(ice?2.95:3.10),145,355),half=w*(ice?.205:.202);
  const keys=ice?[[0,0],[.14,.48],[.43,.70],[.61,1],[.71,.72],[.84,.78],[1,.22]]:
    [[0,0],[.12,.22],[.46,.63],[.65,1],[.76,.69],[1,.39]];
  const shape=v=>half*profile(v,keys);
  const fade=1-E((q-(ice?.13:.10))/(ice?.35:.32)),dissolve=E((q-.075)/(ice?.33:.29));
  if(fade>.003){
   const fn=v=>[tip[0],tip[1]+v*len,tip[2]+Math.sin(v*Math.PI)*5];
   band(fn,v=>shape(v)*1.75,fade*.14,col,5,true,low?23:45,dissolve);
   band(fn,shape,fade,ice?[.12,.46,.78]:[1.35,.48,.03],ice?14:13,false,low?23:45,dissolve);
   // High contrast facets. The central luminous vein is narrow enough that
   // saturated gold or blue faces remain visible beside it.
   for(const sg of [-1,1])band(v=>{const p=fn(v);return[p[0]+sg*shape(v)*.92,p[1],p[2]+1];},
     v=>Math.max(.06,.80*g*Math.sin(v*Math.PI)),fade*.94,hot,6,true);
   band(fn,v=>Math.sin(v*Math.PI)*1.10*g,fade*.91,hot,6,true);
   if(!ice){
    if(q<.22)seal(0,tip[1]-c[1]+len*.48,35*g,fade);
    for(const sg of [-1,1]){
     const pts=[];
     for(let j=0;j<=18;j++){const v=j/18,yy=.14+v*.68,xx=sg*shape(yy)*(.30+.38*Math.sin(v*Math.PI));pts.push([tip[0]+xx,tip[1]+yy*len,tip[2]+7]);}
     for(let j=0;j<pts.length-1;j++)line(pts[j],pts[j+1],.32*g,fade*.52,hot);
    }
   }else{
    // Non-circular crown made from actual solid faceted spikes.
    const cy=tip[1]+len*.63;
    for(let j=-2;j<=2;j++){
     const x=j*12*g,b0=[tip[0]+x*.48,cy-14*g,tip[2]+3],b1=[tip[0]+x+6*g,cy+4*g,tip[2]+3];
     const apex=[tip[0]+x*1.52,cy+(48-Math.abs(j)*8)*g,tip[2]+8],mid=[tip[0]+x*.85,cy+10*g,tip[2]+10];
     poly([b0,b1,apex],j%2?[.14,.46,.75]:[.32,.79,1.12],fade*.92,false);
     poly([b0,mid,apex],[.73,1.16,1.5],fade*.76,false);
     line(b0,apex,.70*g,fade*.96,hot);line(apex,b1,.50*g,fade*.76,col);
    }
    // Irregular diagonal fault lines break the slab into optical facets.
    for(let j=0;j<7;j++){
     const v=.12+j*.115,p=fn(v),ww=shape(v),r=N(seed+j*17);
     line([p[0]-ww*.88,p[1],p[2]+6],[p[0]+ww*.63,p[1]+len*(.033+r*.018),p[2]+6],.66*g,fade*.74,hot);
    }
   }
   if(q<.05)for(let j=0;j<4;j++){
    const sg=j%2?-1:1,xx=tip[0]+sg*(half*(1.25+j*.19));
    line([xx,tip[1]+len*.2,35],[xx,tip[1]+len*(1.08+N(j)*.15),35],.6*g,fade*(.33-j*.048),col);
   }
  }
  // Detach large recognizable fragments, then progressively fine fragments.
  if(q>.07&&q<.87)for(let j=0;j<(low?12:26);j++){
   const born=.075+N(seed+j)*.21,age=q-born,life=.26+N(j+seed*3)*.37;if(age<0||age>life)continue;
   const v=N(seed+j*47),x=(N(seed+j*31)-.5)*half*1.8,dir=N(j+71)-.5;
   const p=[tip[0]+x+dir*age*120*g,tip[1]+v*len+age*(ice?-30:65)*g,tip[2]+age*20];
   const alpha=(1-E((age-life*.38)/(life*.62)))*.88;
   if(ice)f.shards.push({p,size:(3+N(j+2)*4.8)*g,angle:N(j)*TAU,spin:age*5,alpha,color:col,ice:true});
   else{
    const an=N(j*17)*TAU,s=(2+N(j+3)*3)*g;
    poly([[p[0],p[1]+s*2,p[2]],[p[0]+s*.5,p[1],p[2]],[p[0],p[1]-s*1.4,p[2]],[p[0]-s*.5,p[1],p[2]]],hot,alpha,true);
   }
  }
 }else if(night){
  const delta=c.map((v,i)=>v-F[i]),dist=Math.hypot(delta[0],delta[1])||1,dir=[delta[0]/dist,delta[1]/dist,0],normal=[-dir[1],dir[0],0],fl=m.flight;
  if(q>=-fl&&q<.13){
   const u=q<0?C(1+q/Math.max(.001,fl))**1.55:1+Math.min(.16,q*1.40),head=F.map((v,i)=>v+delta[i]*u);
   const tailLen=Math.min(dist*.72,230*g),fade=1-E((q-.005)/.115);
   const fn=v=>[head[0]-dir[0]*tailLen*(1-v),head[1]-dir[1]*tailLen*(1-v),head[2]+8];
   const shape=v=>w*.085*profile(v,[[0,0],[.25,.73],[.56,1],[.79,.50],[1,0]]);
   band(fn,v=>shape(v)*1.3,fade,[.008,.004,.025],15,false);
   // Only one bright cutting edge; no white line through the whole tail.
   band(v=>{let p=fn(v);return[p[0]+normal[0]*shape(v)*.77,p[1]+normal[1]*shape(v)*.77,p[2]+1];},
    v=>(.50+1.1*Math.sin(v*Math.PI))*g,fade*.97,col,15,true);
   band(v=>{let p=fn(v);return[p[0]+normal[0]*shape(v)*.84,p[1]+normal[1]*shape(v)*.84,p[2]+2];},
    v=>.47*g*Math.sin(v*Math.PI),fade,hot,6,true);
   for(let j=0;j<3;j++){
    const sg=j%2?-1:1;
    band(v=>{let p=fn(v);const a=Math.sin(v*Math.PI)*(1-v)*(16+j*8)*g;return[p[0]+normal[0]*a*sg,p[1]+normal[1]*a*sg,p[2]-3];},
     v=>Math.sin(v*Math.PI)*(1-v)*(3-j*.7)*g,fade*(.66-j*.10),j%2?[.035,.006,.065]:[.06,.012,.10],15,false);
   }
   f.tip=q<0?head:c;
  }
  if(q>=0&&q<.64){
   const fade=1-E((q-.18)/.43),an=Math.atan2(dir[1],dir[0]),len=w*.81;
   const fn=v=>pt(Math.cos(an)*(v-.5)*len,Math.sin(an)*(v-.5)*len,7);
   // Faceted black incision with only the lower lip catching violet light.
   band(fn,v=>Math.sin(v*Math.PI)**.9*(5.0+N(seed+Math.floor(v*11))*1.8)*g,fade,[.002,.001,.008],15,false);
   band(v=>{let p=fn(v),n=Math.sin(v*Math.PI)*4.1*g;return[p[0]+normal[0]*n,p[1]+normal[1]*n,p[2]+1];},
     v=>1.00*g*Math.sin(v*Math.PI),fade*.90,[.67,.13,1.18],6,true);
   for(let j=0;j<7;j++){
    const u=(j+.7)/8,p=fn(u),sg=j%2?-1:1,a=3+N(seed+j)*6;
    line(p,[p[0]+normal[0]*sg*a*g-dir[0]*4*g,p[1]+normal[1]*sg*a*g-dir[1]*4*g,p[2]],.55*g,fade*.62,[.22,.035,.36],false);
   }
   for(let j=0;j<(low?5:12);j++){
    const age=q-j*.003,life=.22+N(j+seed)*.15;if(age<0||age>life)continue;
    const travel=(70+N(j)*160)*g*age,side=(N(j+8)-.5)*100*g*age;
    const p=pt(dir[0]*travel+normal[0]*side,dir[1]*travel+normal[1]*side,12);
    f.shards.push({p,size:(1.4+N(j+3)*2.7)*g,angle:an,spin:age*4,alpha:(1-age/life)*.92,color:[.06,.01,.12],ice:false});
    if(j<5)line(p,[p[0]-dir[0]*8*g,p[1]-dir[1]*8*g,p[2]],.5*g,(1-age/life)*.8,hot);
   }
  }
 }
 if(q>=0){
  const flash=contactEnvelope(q,night);
  f.glows.push({p:pt(0,0,13),size:w*(night?.40:1.08),alpha:flash*(night?.55:.76),color:col});
  f.glows.push({p:pt(0,0,14),size:w*(night?.18:.28),alpha:flash*.98,color:hot});
  // A short bright fan. Its radial expansion is visually distinct from descent.
  if(q<.21){
   const n=night?5:ice?9:11;
   for(let j=0;j<n;j++){
    const an=night?Math.atan2(c[1]-F[1],c[0]-F[0])+(N(j+seed)-.5)*1.25:j*TAU/n+.14;
    const reach=w*(night?.29:.47+N(j+seed)*.38)*(.72+.28*E(q/.05));
    band(v=>pt(Math.cos(an)*reach*v,Math.sin(an)*reach*v*.75,18),
     v=>Math.pow(1-v,2)*Math.sin(Math.PI*v)*w*(night?.020:ice?.041:.054),flash*(j%3?.85:1.0),hot,5,true,low?11:17);
   }
  }
  if(!night){
   const fade=1-E((q-.34)/(ice?.75:.63)),growth=1-Math.pow(1-C(q/(ice?.21:.15)),3),n=ice?6:8;
   // Dark puncture remains legible beneath the luminous scar edges.
   if(q>.022){
    const points=[];for(let j=0;j<12;j++){const an=j*TAU/12,rad=(j%2?.38:1)*(1.0+N(j+seed)*.2)*g;
     points.push(pt(Math.cos(an)*7.0*rad,Math.sin(an)*10.0*rad,3));}
    poly(points,ice?[.018,.052,.10]:[.008,.011,.020],fade*.96,false);
   }
   for(let j=0;j<n;j++){
    const ang=j*TAU/n+(ice?.13:.32)+(N(seed+j*11)-.5)*.50;
    let prev=pt(0,0,4);
    for(let i=1;i<=6;i++){
     const u=i/6,pr=C((growth-(i-1)/6)*6);if(!pr)break;
     const rad=u*(.66+N(j+seed)*.28),wig=(N(seed+j*79+i*29)-.5)*.26*Math.sin(u*Math.PI);
     const next=pt(Math.cos(ang+wig)*rad*w*.415,Math.sin(ang+wig)*rad*h*.31,4),b=prev.map((v,k)=>L(v,next[k],pr));
     f.cracks.push({a:prev,b,width:(3.5-u*2.95)*g,alpha:fade,color:col,group:j});
     if(i===3||i===5){const sg=j%2?-1:1,add=(.065+N(j+i)*.03)*growth;
      const end=pt((b[0]-c[0])*.91+Math.cos(ang+sg*.8)*w*add,(b[1]-c[1])*.91+Math.sin(ang+sg*.8)*h*add*.72,4);
      f.cracks.push({a:b,b:end,width:.75*g,alpha:fade*E((growth-u)/.12),color:col,group:100+j*10+i});}
     prev=next;
    }
   }
   ring(0,0,w*(.16+E(q/.19)*.49),.54,E(q/.018)*(1-E((q-.055)/.18))*.63,col,0,1.0*g);
   if(!ice){
    for(let j=0;j<(low?10:20);j++){
     const age=q-N(j+seed)*.015,life=.19+N(j*31+seed)*.20;if(age<0||age>life)continue;
     const an=N(j*29+seed)*TAU,sp=(180+N(j*41)*310)*g,r=sp*age,tail=Math.min(r,(13+N(j)*30)*g);
     line(pt(Math.cos(an)*(r-tail),Math.sin(an)*(r-tail)*.69-85*g*age*age,14),pt(Math.cos(an)*r,Math.sin(an)*r*.69-85*g*age*age,14),
      (.7+N(j)*.95)*g,(1-age/life),j%3?col:hot);
    }
    if(q>.16&&q<1.35)for(let j=0;j<(low?15:32);j++){
     const age=q-.16-N(seed+j)*.22,life=.38+N(j*3)*.57;if(age<0||age>life)continue;
     const an=N(j*27+seed)*TAU,rad=(10+N(j*12)*37)*g;
     f.particles.push({p:pt(Math.cos(an)*rad,Math.sin(an)*rad*.6+age*72*g,13+N(j+5)*15),size:(1.1+N(j*3)*1.7)*g,
      color:j%3?col:hot,alpha:Math.sin(Math.PI*age/life)*.84,type:j%4?0:1});
    }
   }else{
    const frostFade=1-E((q-.67)/.70),spread=E(q/.22);
    f.plates.push({p:pt(0,0,1),w:w*.88,h:h*.68,alpha:spread*frostFade*.94,material:16,color:[.28,.61,.84],growth:spread});
    // Visible fern branches: a few legible stems rather than uniform glitter.
    if(q>.07&&q<1.18)for(let j=0;j<6;j++){
     const an=j*TAU/6+.18,reach=E((q-.07)/.23),ex=Math.cos(an)*w*.33*reach,ey=Math.sin(an)*h*.255*reach;
     for(let k=1;k<=4;k++){
      const u=k/5,p=pt(ex*u,ey*u,5);
      for(const sg of [-1,1])line(p,pt(ex*(u+.095)+Math.cos(an+sg*.8)*6*g,ey*(u+.095)+Math.sin(an+sg*.8)*8*g,5),.52*g,frostFade*.66,hot);
     }
    }
    for(let j=0;j<(low?10:19);j++){
     const age=q-N(j+seed)*.025,life=.50+N(j*13+seed)*.43;if(age<0||age>life)continue;
     const an=N(j*71+seed)*TAU,sp=(45+N(j*19)*155)*g;
     f.shards.push({p:pt(Math.cos(an)*sp*age,Math.sin(an)*sp*age*.76-100*g*age*age,12+Math.sin(age*2.2)*40),
      size:(3.2+N(j*43)*5.1)*g,angle:N(j+5)*TAU,spin:age*(1+N(j)*4),alpha:(1-E((age-life*.55)/(life*.45)))*.96,color:col,ice:true});
    }
    if(q<1.45)for(let j=0;j<(low?3:5);j++){
     const age=q-.08-j*.035,life=.70+N(j)*.37;if(age<0||age>life)continue;
     const x=(N(seed+j*29)-.5)*w*.65,y=(N(seed+j*41)-.5)*h*.3+age*28*g;
     f.plates.push({p:pt(x,y,6),w:(36+age*42)*g,h:(24+age*26)*g,alpha:Math.sin(Math.PI*age/life)*.22,material:9,color:[.43,.62,.77],growth:1,angle:j*.7});
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
  // Card and attached VFX share a rigid rotation about the card centre. The
  // incoming attack stays perfectly vertical until the authoritative contact.
  const angle=f.contact ? -f.reaction.target[2]*Math.PI/180 : 0;
  if(Math.abs(angle)>1e-8){
   const cx=d.to.x-W/2,cy=H/2-d.to.y,co=Math.cos(angle),si=Math.sin(angle);
   const rotate=p=>{const x=p[0]-cx,y=p[1]-cy;return[cx+co*x-si*y,cy+si*x+co*y,p[2]];};
   for(const b of f.ribbons)b.points=b.points.map(rotate);
   for(const b of f.polygons)b.points=b.points.map(rotate);
   for(const b of [...f.cracks,...f.lines]){b.a=rotate(b.a);b.b=rotate(b.b);}
   for(const b of [...f.glows,...f.particles])b.p=rotate(b.p);
   for(const b of [...f.shards,...f.plates]){b.p=rotate(b.p);b.angle=(b.angle||0)+angle;}
   if(f.tip)f.tip=rotate(f.tip);
  }
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
  for(const b of f.polygons){
   const out=[],center=b.points.reduce((a,p)=>a.map((v,k)=>v+p[k]/b.points.length),[0,0,0]);
   for(let i=0;i<b.points.length;i++)Geo.tri(out,center,b.points[i],b.points[(i+1)%b.points.length]);
   R.dynamicFX(out,b.color,{mode:6,alpha:b.alpha,add:b.add,transparent:!b.add,time:s.t});
  }
  for(const b of f.ribbons)R.dynamicFX(strip(b.points,b.widths),b.color,{mode:b.material,alpha:b.alpha,add:b.add,transparent:!b.add,time:s.t,surface:b.seed,dissolve:b.dissolve||0});
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
    color:k.color,opt:{mode:0,alpha:k.alpha,transparent:true,add:false,metal:k.ice?.08:.12,roughness:k.ice?.14:.7,emission:k.ice?.38:.04,time:s.t}});
  }
  return f;
 }
 return {render,strip,destroy(){R.gl.deleteBuffer(crystal.b);}};
}
const api=Object.freeze({STYLES,supports,timing,reaction,sample,create,profile,contactEnvelope});
G.EmberBenchmarkArts=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
