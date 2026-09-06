/* WIND BORNE / VII — approved hand-painted dioramas. A single cached composition
 * serves both viewport modes; atmospheric accents never move hit-test geometry.
 * Illustration extraction metadata is in assets/windborne/manifest.json. */
const AtelierWorld=(()=>{
 'use strict';
 const images={},cache=document.createElement('canvas'),cc=cache.getContext('2d');
 let loaded=0,dirty=true,lastKey='',hover=null,dusk=false;
 const hits=[];
 for(const [key,src] of Object.entries(WindborneAssets)){
   const im=new Image();im.onload=()=>{loaded++;dirty=true;};im.onerror=()=>{loaded++;dirty=true;};im.src=src;images[key]=im;
 }
 for(const k of ['brewery','observatory','mine','forge'])AtelierAssets['building-'+k]=WindborneAssets['building-'+k];
 // Both renderer branches and the gallery use the same new materials.
 AtelierAssets['table-surface']=WindborneAssets.paper;
 const layers=[
  {id:'chimney',key:'brewery',x:0,y:42,w:478,focus:[390,184],light:'#ffd08a'},
  {id:'crystals',key:'observatory',x:1248,y:42,w:358,focus:[1480,156],light:'#92cddd'},
  {id:'tree',key:'mine',x:0,y:493,w:418,focus:[135,674],light:'#82d5ef'},
  {id:'forge',key:'forge',x:1211,y:488,w:407,focus:[1467,721],light:'#ffc180'}
 ];
 function glow(c,x,y,r,color,alpha){c.save();c.globalCompositeOperation='screen';c.globalAlpha=alpha;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();}
 function plate(c,key,x,y,w,alpha=1){const im=images[key];if(!im?.naturalWidth)return;c.save();c.globalAlpha=alpha;c.drawImage(im,x,y,w,w*im.naturalHeight/im.naturalWidth);c.restore();}
 function leaf(c,x,y,s,angle,alpha){c.save();c.translate(x,y);c.rotate(angle);c.scale(s,s);c.globalAlpha=alpha;c.fillStyle='#8c9c62';c.strokeStyle='#596c45';c.lineWidth=.6;c.beginPath();c.moveTo(-6,0);c.bezierCurveTo(-1,-7,8,-5,7,0);c.bezierCurveTo(2,7,-5,5,-6,0);c.fill();c.beginPath();c.moveTo(-6,0);c.lineTo(6,0);c.stroke();c.restore();}
 function round(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)));}
 function makeBase(view,theme){
  const V=EmberViewport,W=V.width,H=V.height,m=V.mobile,p=V.portrait,l=V.layout;
  const d=m?Math.min(devicePixelRatio||1,1.5):1;
  cache.width=Math.round(W*d);cache.height=Math.round(H*d);cc.setTransform(d,0,0,d,0,0);
  let g=cc.createLinearGradient(0,0,0,H);g.addColorStop(0,'#bed4d9');g.addColorStop(.25,'#acc4b0');g.addColorStop(.68,'#6f8263');g.addColorStop(1,'#5f6451');cc.fillStyle=g;cc.fillRect(0,0,W,H);
  const sky=images.horizon;if(sky?.naturalWidth){const h=m?(p?W*.26:H*.25):161;if(m)cc.drawImage(sky,570,0,650,130,0,l.header,W,h);else cc.drawImage(sky,570,0,650,130,438,36,964,179);}
  if(images.wood?.naturalWidth){cc.save();cc.globalAlpha=.22;cc.fillStyle=cc.createPattern(images.wood,'repeat');cc.fillRect(0,H*.33,W,H*.67);cc.restore();}
  // A sunlit stone courtyard replaces an empty flat backdrop. Deterministic,
  // irregular pavers provide perspective; this is a surface, never character art.
  if(!m){
   cc.save();const floorTop=182;const floor=cc.createLinearGradient(0,floorTop,0,H);floor.addColorStop(0,'#8ca08c');floor.addColorStop(.45,'#92937a');floor.addColorStop(1,'#646e58');cc.fillStyle=floor;cc.fillRect(0,floorTop,W,H-floorTop);
   for(let row=0;row<11;row++){const y=floorTop+row*row*6.5,hh=13+row*12,ww=86+row*26;for(let j=-1;j<W/ww+1;j++){
    const x=j*ww+(row%2)*ww*.5,delta=Math.sin(j*41+row*19)*4;
    cc.beginPath();cc.moveTo(x+3,y+3+delta);cc.lineTo(x+ww-6,y+1);cc.lineTo(x+ww-1,y+hh-3);cc.lineTo(x+6,y+hh+delta);cc.closePath();
    cc.fillStyle=`rgba(${135+row*2},${145+row},${115+row},${.11+(j%3)*.012})`;cc.fill();cc.strokeStyle='#364c3724';cc.lineWidth=1.3;cc.stroke();
   }}cc.restore();
   if(view==='battle')plate(cc,'board',0,0,1600);
   else{cc.save();cc.fillStyle='#56705210';cc.fillRect(0,265,W,H-265);cc.restore();}
   for(const a of layers){plate(cc,'building-'+a.key,a.x,a.y,a.w);}
   // A foreground writing desk, kept clear of baked cards from the source image.
   if(view==='battle'){
    cc.save();g=cc.createLinearGradient(0,737,0,940);g.addColorStop(0,'#4e564000');g.addColorStop(.45,'#555a48a0');g.addColorStop(1,'#4d513ff0');cc.fillStyle=g;cc.fillRect(315,732,880,208);cc.restore();
   }
  }else if(view==='lobby'){
   plate(cc,'building-brewery',-15,l.header-6,p?W*.65:W*.34);
   plate(cc,'building-observatory',W-(p?W*.42:W*.26),l.header-6,p?W*.48:W*.31);
   plate(cc,'building-mine',-22,H-(p?W*.65:H*.65),p?W*.58:W*.26,.92);
   plate(cc,'building-forge',W-(p?W*.47:W*.26),H-(p?W*.78:H*.83),p?W*.58:W*.32,.92);
  }else{
   plate(cc,'building-brewery',-40,l.header-12,p?W*.51:153,.95);
   plate(cc,'building-observatory',W-(p?W*.32:121),l.header-4,p?W*.38:141,.95);
   plate(cc,'building-mine',-22,p?l.player.y-3:H-169,p?134:132,.95);
   plate(cc,'building-forge',W-130,p?l.player.y-10:H-180,162,.98);
   const a=l.arena;
   cc.save();cc.shadowColor='#3346336b';cc.shadowBlur=12;cc.shadowOffsetY=5;round(cc,a.x-4,a.y-5,a.w+8,a.h+10,22);cc.fillStyle='#7e785e';cc.fill();cc.restore();
   round(cc,a.x-2,a.y-2,a.w+4,a.h+4,19);cc.fillStyle='#c4b68d';cc.fill();
   round(cc,a.x+2,a.y+2,a.w-4,a.h-4,16);cc.fillStyle='#9d8e67';cc.fill();
   round(cc,a.x+5,a.y+5,a.w-10,a.h-10,13);cc.fillStyle='#e4d2a9';cc.fill();
   if(images.paper?.naturalWidth){cc.save();cc.clip();cc.globalAlpha=.62;cc.fillStyle=cc.createPattern(images.paper,'repeat');cc.fillRect(a.x,a.y,a.w,a.h);cc.restore();}
   cc.strokeStyle='#b0a17a';cc.lineWidth=1;round(cc,a.x+10,a.y+10,a.w-20,a.h-20,10);cc.stroke();
   cc.beginPath();cc.moveTo(a.x+18,a.y+a.h*.5);cc.lineTo(a.x+a.w-18,a.y+a.h*.5);cc.strokeStyle='#9d8f653f';cc.stroke();
   for(const x of [a.x+18,a.x+a.w-18])for(const y of [a.y+18,a.y+a.h-18])leaf(cc,x,y,.65,.8,.4);
   // Quiet timber under the hand; it does not intercept horizontal scrolling.
   g=cc.createLinearGradient(0,l.hand.y-15,0,H);g.addColorStop(0,'#52694d00');g.addColorStop(.3,'#394c3db0');g.addColorStop(1,'#3d4f40f0');cc.fillStyle=g;cc.fillRect(0,l.hand.y-15,W,H-l.hand.y+15);
  }
  if(dusk){cc.save();cc.fillStyle='#2e385456';cc.fillRect(0,0,W,H);cc.restore();}
  if(view==='battle'&&theme){cc.save();cc.globalAlpha=.045;cc.fillStyle=['#ffcf92','#4f9169','#797aaa','#abc8dd','#cd8e61'][theme];cc.fillRect(0,0,W,H);cc.restore();}
  dirty=false;
 }
 function paint(c,t,view,theme,phase,reduced,low){
  const V=EmberViewport,W=V.width,H=V.height,m=V.mobile,l=V.layout;
  const key=[W,H,m,V.portrait,view,theme,dusk].join(':');
  if(dirty||key!==lastKey){makeBase(view,theme);lastKey=key;}
  c.drawImage(cache,0,0,W,H);
  // Static lamp pools remain in reduced-motion mode; no moving accents.
  if(dusk){if(m){glow(c,25,l.header+77,85,'#ffe1a3',.22);glow(c,W-30,H*.7,85,'#ffd18c',.19);}else for(const a of layers)glow(c,...a.focus,125,a.light,.20);}
  if(reduced)return;
  const n=low?4:m?6:14;
  for(let i=0;i<n;i++){
    const f=(t*.020+i*.077)%1,x=(i*139.7+f*W*.35)%W;
    const y=m?(i%2?l.header+20+f*60:H-18-f*30):(i%2?57+f*163:720+f*128);
    leaf(c,x,y,m?.52:.75,Math.sin(t*.35+i)+i,.25+Math.sin(f*Math.PI)*.27);
  }
  if(!m){
   for(let j=0;j<10;j++){const f=(t*.14+j*.1)%1;glow(c,1459+Math.sin(j*19)*28,731-f*66,2.3,'#ffde91',.55*(1-f));}
   // Star rings are positioned over the actual observatory, not the play mat.
   c.save();c.translate(1490,138);c.strokeStyle='#f9e4b77d';c.lineWidth=1.1;for(let j=0;j<2;j++){c.beginPath();c.ellipse(0,0,44,25,t*.10+j*1.9,0,Math.PI*2);c.stroke();}c.restore();
   glow(c,385,174,49,'#ffe1a5',.08+Math.sin(t*2)*.018);
  }else glow(c,W*.94,l.header+38,40,'#d9e5b4',.07+Math.sin(t)*.015);
  for(let i=hits.length-1;i>=0;i--){const a=hits[i],f=(performance.now()-a.t)/1100;if(f>=1){hits.splice(i,1);continue;}glow(c,a.x,a.y,45+65*f,a.color,(1-f)*.27);}
  if(phase)glow(c,m?W/2:800,m?l.enemy.y+20:182,m?55:95,'#ffe2a0',.04+Math.sin(t)*.02);
 }
 function ping(id){const a=layers.find(x=>x.id===id);if(!a)return;hits.push({x:a.focus[0],y:a.focus[1],color:a.light,t:performance.now()});if(hits.length>8)hits.shift();}
 function setDusk(v){dusk=!!v;dirty=true;document.body.classList.toggle('world-dusk',dusk);return dusk;}
 TavernWorld.paint=paint;
 return {paint,ping,setHover:id=>hover=id,setDusk,layers,get dusk(){return dusk;},get loading(){return loaded<Object.keys(images).length;},get cacheSize(){return [cache.width,cache.height];},invalidate(){dirty=true;}};
})();
