/* Original tactile tavern diorama. Backgrounds are exported to WebP at build
 * time. Animated fire, steam, moths, leaves and interactive props stay live. */
const TavernWorld = (()=>{
 const W=1600,H=940,TAU=Math.PI*2;
 const P=(d,f,s='#322820',w=3)=>`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
 const E=(x,y,rx,ry,f,s='none',w=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${w}"/>`;
 const R=(x,y,w,h,rx,f,s='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
 function rng(){let n=912498;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
 function defs(){return `<defs>
  <pattern id="wood" width="768" height="512" patternUnits="userSpaceOnUse"><image href="${TavernMaterials.wood}" width="768" height="512"/></pattern>
  <pattern id="paper" width="512" height="512" patternUnits="userSpaceOnUse"><image href="${TavernMaterials.parchment}" width="512" height="512"/></pattern>
  <pattern id="stone" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${TavernMaterials.stone}" width="256" height="256"/></pattern>
  <linearGradient id="gold" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff0ad"/><stop offset=".23" stop-color="#c69a55"/><stop offset=".52" stop-color="#76502d"/><stop offset=".72" stop-color="#c2914b"/><stop offset="1" stop-color="#644021"/></linearGradient>
  <linearGradient id="rock" x2=".3" y2="1"><stop stop-color="#b0a58e"/><stop offset=".43" stop-color="#837965"/><stop offset="1" stop-color="#49473f"/></linearGradient>
  <linearGradient id="bevel" x2="0" y2="1"><stop stop-color="#d5be90"/><stop offset=".25" stop-color="#9f8863"/><stop offset=".6" stop-color="#736247"/><stop offset="1" stop-color="#393327"/></linearGradient>
  <linearGradient id="roof" x2=".3" y2="1"><stop stop-color="#d27148"/><stop offset=".5" stop-color="#924632"/><stop offset="1" stop-color="#482c28"/></linearGradient>
  <linearGradient id="window" x2="0" y2="1"><stop stop-color="#fff5bb"/><stop offset=".4" stop-color="#ecc477"/><stop offset="1" stop-color="#c58637"/></linearGradient>
  <linearGradient id="blue" x2=".5" y2="1"><stop stop-color="#e2ffff"/><stop offset=".22" stop-color="#8bdef1"/><stop offset=".6" stop-color="#4883bc"/><stop offset="1" stop-color="#31415d"/></linearGradient>
  <radialGradient id="shade"><stop offset=".4" stop-color="#2b1f17" stop-opacity="0"/><stop offset="1" stop-color="#1d1715" stop-opacity=".57"/></radialGradient>
  <radialGradient id="glow"><stop stop-color="#fffac6" stop-opacity=".6"/><stop offset=".2" stop-color="#eaba52" stop-opacity=".24"/><stop offset="1" stop-color="#da8a31" stop-opacity="0"/></radialGradient>
  <radialGradient id="sky"><stop stop-color="#afdbda"/><stop offset="1" stop-color="#497687"/></radialGradient>
  <radialGradient id="vellum"><stop stop-color="#f2e2b4" stop-opacity=".62"/><stop offset="1" stop-color="#966d39" stop-opacity=".15"/></radialGradient>
 </defs>`;}
 function rivet(x,y,r=5){return E(x+1,y+3,r+1,r+1,'#37291f99')+E(x,y,r,r,'url(#gold)','#684927',1)+P(`M${x-r*.3} ${y-r*.4}l${r*.5} -.8`,'none','#ffebb5',1);}
 function stone(x,y,w,h,rx=9){return R(x,y+6,w,h,rx,'#312f27','#282822',3)+R(x,y,w,h,rx,'url(#rock)','#554d3b',2)+P(`M${x+9} ${y+5}L${x+w-10} ${y+5}Q${x+w-4} ${y+6} ${x+w-4} ${y+12}`,'none','#e8d5ad55',3);}
 function roof(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=P('M-106 37L-8-93 118 31 109 62 -98 68Z','#482b27','#382c25',5);for(let row=0;row<6;row++){let yy=-75+row*22,n=2+row;for(let c=0;c<n;c++){let xx=-n*14+c*28+5;z+=P(`M${xx} ${yy}l25 2 14 25 -31 5Z`,'url(#roof)','#66352a',2)+P(`M${xx+5} ${yy+6}l19 1`,'none','#e6965a88',2);}}z+=P('M-111 41L-9-99 123 39','none','#d09d61',9)+P('M-111 43L-9-98 123 43','none','#6e4430',3);return z+'</g>';}
 function house(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(0,100,124,37,'#281d1cb0')+P('M-91 10L82 5 94 114-85 130Z','#baa16e','#4a3625',5);for(let j=0;j<4;j++)z+=P(`M-82 ${33+j*26}L87 ${25+j*26}`,'none','#715438',5);z+=P('M-81 24L-72 119M70 15L80 118','none','#5b3d29',14);z+=P('M-31 57Q-30 7 18 7Q55 17 54 54L54 105-30 109Z','url(#window)','#4d3325',7)+P('M11 18L13 106M-27 66L49 64','none','#5d3c28',6);z+=E(9,68,94,100,'url(#glow)');z+=stone(61,-89,32,111,5)+stone(55,-104,44,24,5);z+=roof(0,-15,.96);z+=P('M-65 109L-50 119 63 112 74 100','none','#e2bf80',5);return z+'</g>';}
 function crystal(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(0,20,94,26,'#262b3999');for(let j=0;j<5;j++){let xx=-65+j*31,hh=[45,84,129,74,35][j];z+=P(`M${xx} ${-hh}L${xx+21} ${-hh+26} ${xx+21} 16 ${xx+2} 35 ${xx-19} 12 ${xx-15} ${-hh+27}Z`,'url(#blue)','#334958',3)+P(`M${xx} ${-hh}L${xx+2} 35 ${xx-19} 12 ${xx-15} ${-hh+27}Z`,'#bbecf45f','#abe3f899',1.5);}return z+'</g>';}
 function barrel(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(3,71,53,18,'#2a201bcc')+P('M-42-42Q-70 17-43 62Q3 83 45 61Q67 7 42-45Z','url(#wood)','#372a22',4);for(let j=0;j<5;j++)z+=P(`M${-34+j*17}-41Q${-48+j*24} 10 ${-34+j*17} 69`,'none','#2c251ecc',3);z+=E(0,-43,43,20,'#946a3c','#593b29',4)+E(0,-44,34,14,'url(#wood)','#61442b',2);for(let yy of[-23,37])z+=P(`M-51 ${yy}Q0 ${yy+21} 52 ${yy-2}L53 ${yy+13}Q0 ${yy+35}-52 ${yy+13}Z`,'url(#rock)','#413d31',3);for(let yy of[-14,47])for(let xx of[-37,0,38])z+=rivet(xx,yy+5,3);return z+'</g>';}
 function tree(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(0,95,103,28,'#2b271ba0');z+=P('M-18 98Q8 39-9-41L16-42Q44 41 43 76L86 95 31 109-61 112Z','url(#wood)','#3c3624',5)+P('M4 36Q-45 8-49-39M19 18Q67-3 74-41','none','#694b2c',17);let r=rng();for(let j=0;j<26;j++){let a=j/26*TAU,rad=35+r()*60;z+=E(Math.cos(a)*rad,-75+Math.sin(a)*rad*.65,29+r()*24,25+r()*18,['#3d5935','#527440','#668247','#7c914c'][j%4],'#35462a',2);}for(let j=0;j<13;j++)z+=P(`M${-82+r()*153} ${-127+r()*85}q8-4 15 2`,'none','#b1b86b77',3);return z+'</g>';}
 function candle(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})">`+E(0,17,28,10,'#2b241caa')+E(0,10,21,8,'url(#gold)','#5c462a',3)+R(-10,-31,20,38,5,'#e4caa0','#9c7445',2)+P('M-10-18Q-3-8 0-21L5-29 8-8','none','#ffe6bd',4)+E(0,-32,10,4,'#b59975')+P('M0-35Q-20-54 0-77Q14-54 0-35Z','#fff4ad','#d88732',1)+E(0,-49,57,59,'url(#glow)')+'</g>';}
 function forge(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(0,79,92,27,'#261e1dcc');for(let j=0;j<3;j++)z+=stone(-70+j*4,-18+j*24,142-j*6,31,7);z+=P('M-54-20Q-59-85 0-93Q64-84 59-20Z','#201d25','#ab8053',12)+E(0,-32,47,38,'#c6682c','#4e352a',4)+P('M-37-11Q-53-51-22-57Q-21-79-8-89Q-1-55 20-69Q29-37 41-13Z','#eaae46','none')+P('M-21-12Q-29-42-6-64Q3-40 23-16Z','#fff0ab','none');z+=P('M-64 43L-104 6 36 2Q54 19 73 24L102 23Q81 48 21 47L20 78-31 80-35 47Z','url(#rock)','#3c3b36',4)+P('M-94 6L34 5 58 28-67 24Z','#b5b0a1','#494a42',2);return z+'</g>';}
 function cup(x,y,s=1){let z=`<g transform="translate(${x} ${y}) scale(${s})">`;z+=E(0,44,46,16,'#231c19aa')+P('M29-23Q73-29 68 17Q62 46 32 29','none','#b99b61',13)+P('M-35-28L-29 32Q-1 56 34 28L41-30Z','url(#gold)','#584124',4)+E(3,-29,38,17,'#ddc190','#735233',3)+E(3,-30,30,11,'#69442b')+P('M-31-30Q-37-49-17-43Q-6-54 5-43Q23-49 34-35Q41-19 24-23Q7-29 2-18Q-19-17-31-30Z','#f3e2b2','#c8b387',2);return z+'</g>';}
 function book(x,y,s=1,rot=0){let z=`<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">`;z+=R(-64,-43,134,94,8,'#352828','#211e20',4)+P('M-62-41L0-31 60-49 60 34 2 50-61 40Z','#dfc395','#846b48',5)+P('M-52-34L-2-23-1 39-52 30Z','#ecdcb7','#ac8c5c',1)+P('M8-23L51-38 51 26 8 40Z','#e9d6a9','#ac8c5c',1);for(let j=0;j<5;j++)z+=P(`M-43 ${-20+j*10}l31 8M15 ${-10+j*9}l29-8`,'none','#ab8d60',1.6);return z+'</g>';}
 function seal(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})">`+E(0,4,42,42,'#3b2f2499')+E(0,0,42,42,'url(#gold)','#624c2c',3)+E(0,0,33,33,'url(#blue)','#34556b',4)+P('M2-25Q7-11-8 1Q-18 15-3 24Q15 33 23 10Q27-3 10-15Q15 4 4 9Q-5 10-4 2Q6-8 2-25Z','#bcf4ee','#2a637f',2)+P('M-19-21Q-33-4-23 15','none','#fff0b3',2)+'</g>';}
 function board(theme=0){let r=rng(),z=defs()+R(0,0,W,H,0,'url(#wood)');
  // Heavy physical frame, deep bottom bevel, asymmetric hand-finished corners.
  z+=E(800,803,683,111,'#21181699');
  z+=P('M299 153L1279 153Q1341 149 1371 211L1390 712Q1388 773 1325 802L276 802Q210 779 212 716L227 218Q237 157 299 153Z','#372820','#201c17',8);
  z+=P('M302 141L1270 141Q1334 139 1361 200L1376 697Q1377 757 1315 783L288 783Q226 754 226 698L241 205Q250 148 302 141Z','url(#wood)','#a77843',7);
  z+=P('M305 163L1269 163Q1318 161 1340 208L1353 692Q1353 738 1305 755L298 755Q250 735 249 688L261 214Q269 171 305 163Z','url(#gold)','#3f3023',5);
  z+=P('M310 179L1263 179Q1305 179 1322 217L1330 681Q1330 717 1290 733L314 733Q274 717 274 681L283 221Q289 187 310 179Z','url(#bevel)','#514330',4);
  z+=P('M321 207L1256 207Q1282 206 1296 232L1308 665Q1309 690 1281 706L330 706Q300 693 299 664L309 238Q310 217 321 207Z','url(#paper)','#735b3b',5);
  z+=P('M321 209L1256 209Q1282 208 1294 232L1305 664Q1306 690 1281 704L330 704Q300 692 302 664L311 238Q311 218 321 209Z','url(#vellum)','#ead4a755',2);
  // Quiet stitched seam and engraved corner flourishes; middle is uncluttered.
  z+=P('M315 443Q556 439 800 446Q1038 439 1293 443','none','#9c79534a',3)+P('M315 446Q560 442 800 449Q1033 442 1293 446','none','#fff0c044',2);
  for(let j=0;j<31;j++){let x=345+j*30;z+=P(`M${x} 444l2 5`,'none','#906d4540',1);}
  for(let k=0;k<4;k++){let tx=k%2?1294:318,ty=k>1?691:222,fx=k%2?-1:1,fy=k>1?-1:1;z+=`<g transform="translate(${tx} ${ty}) scale(${fx} ${fy})">`+P('M0 52V15Q0 0 15 0H68M8 54V22Q9 8 23 8H70M18 41V26Q18 18 28 18H50','none','#9e774733',2)+'</g>';}
  // Frame blocks, joints, hammered fittings.
  for(let j=0;j<12;j++){let x=343+j*80;z+=P(`M${x} 151l-3 14M${x+5} 742l-1 28`,'none','#432e2359',2);}
  for(let x of[289,1306])for(let y of[192,735])z+=rivet(x,y,8);
  // Hero sockets carved into the field; UI portrait sits on top.
  for(let y of[226,664]){z+=E(800,y+14,90,59,'#644d3355')+E(800,y+11,83,57,'url(#gold)','#634e32',3)+E(800,y+9,76,51,'#65543f','#b99b65',2);}
  // Four distinct miniature locations.
  z+=house(191,196,1.13)+tree(131,644,1.08)+barrel(259,691,.8)+cup(291,755,.73)+book(150,793,.9,-13);
  z+=stone(1325,258,169,44)+stone(1340,219,137,44)+crystal(1395,218,.98)+book(1472,295,.56,15);
  z+=forge(1420,686,1.02)+barrel(1512,786,.65)+candle(1260,781,.75)+candle(348,784,.7);
  z+=seal(800,446,.56);
  // Aged divots; these are restrained and do not compete with the unit rows.
  for(let j=0;j<120;j++){let x=320+r()*974,y=229+r()*453;z+=E(x,y,1+r()*2,.6,'#8d6c3b20');}
  // Theme changes tint decoration only, leaving the play field easy to read.
  if(theme){const co=['','#72a959','#998acb','#addced','#e58946'][theme];z+=R(0,80,W,740,0,co+'07');}
  z+=R(0,0,W,H,0,'url(#shade)');return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="940" viewBox="0 0 1600 940">${z}</svg>`;
 }
 function lobby(){let r=rng(),z=defs()+R(0,0,W,H,0,'#776046');
  // A tavern wall, uneven stone, dark rafters and leaded windows.
  for(let j=0;j<9;j++)for(let k=0;k<13;k++){let x=k*137-(j%2)*70,y=j*83-15;z+=R(x,y,131,78,9,['#796851','#8a775d','#746551','#937c5c'][(k*3+j)%4],'#5b4f3e',4);z+=P(`M${x+12} ${y+8}L${x+115} ${y+8}`,'none','#c4aa792e',3);}
  z+=R(0,0,1600,76,0,'url(#wood)','#33281e',7)+R(35,0,58,770,4,'url(#wood)','#3d2c22',5)+R(1535,0,54,760,4,'url(#wood)','#3d2c22',5);
  for(let x of[190,1160]){z+=P(`M${x} 335V193Q${x} 101 ${x+94} 98Q${x+190} 100 ${x+190} 190V339Z`,'url(#sky)','#4a3626',19);z+=P(`M${x+8} 332V196Q${x+9} 118 ${x+94} 114Q${x+179} 119 ${x+179} 192V331Z`,'none','#c2a36e',5);z+=P(`M${x+95} 107V338M${x+4} 230H${x+183}`,'none','#5e4c36',9);for(let k=0;k<7;k++)z+=P(`M${x+k*28} 144l98 192M${x+k*28} 335l105-196`,'none','#718a8290',2);}
  z+=P('M1200 337L653 746 1449 864 1353 320Z','#ffe9aa14','none');
  // A masonry hearth at left, bathed in warm light.
  z+=P('M39 758V452Q44 348 160 345Q277 349 282 452L292 756Z','#403327','#3d3026',9);
  for(let j=0;j<6;j++){let yy=438+j*50;z+=stone(8,yy,71,46,6)+stone(244,yy,83,46,6);}for(let j=0;j<5;j++)z+=stone(44+j*44,360+Math.abs(j-2)*15,49,72,7);
  z+=P('M79 741V493Q79 400 157 400Q241 402 242 493V741Z','#2f2622','#5a4935',5)+E(163,649,107,140,'url(#glow)');
  z+=P('M87 731Q63 645 119 587Q109 545 145 501Q140 587 187 552Q195 603 214 623Q260 666 221 732Z','#e3a046','none')+P('M115 733Q96 674 145 603Q141 654 176 635Q213 680 201 733Z','#ffe7a3','none');
  z+=P('M81 724L224 746M95 759L239 708','none','#483124',24)+P('M91 720L220 740','none','#b27e44',3);
  // A chunky table supports the menu box.
  z+=P('M55 736L1543 728 1701 937-60 976Z','url(#wood)','#38251d',12)+P('M82 745L1518 740','none','#ce995955',5);
  for(let j=0;j<6;j++)z+=P(`M${96+j*269} 744l${(j-3)*34} 230`,'none','#39251d',4);
  // The chest / wooden menu architecture occupies the centre-left.
  z+=E(752,868,443,74,'#201914aa')+R(357,181,778,676,29,'#33251f','#241c19',8)+R(341,161,790,670,30,'url(#wood)','#a77940',8)+R(355,174,764,643,24,'none','#e2bc754a',3);
  z+=P('M352 242Q367 180 432 180H1041Q1101 181 1120 242L1108 331H365Z','url(#wood)','#5f4028',5);
  z+=R(376,339,722,444,18,'#33261fa0','#432e24',5)+R(389,352,696,417,13,'url(#paper)','#bb9560',5)+R(389,352,696,417,13,'url(#vellum)');
  for(let x of[369,1103])for(let y of[194,802])z+=rivet(x,y,9);
  z+=seal(736,221,1.27);
  // Cards, props and materials around the chest create a sense of place.
  z+=barrel(1305,690,1.3)+book(1265,823,1.7,-7)+cup(1457,818,1.2)+candle(1148,864,1.25)+candle(315,817,.9)+crystal(157,834,.65);
  z+=P('M1450 138Q1488 172 1478 222L1440 302','none','#392d23',6)+R(1388,250,155,67,8,'url(#wood)','#3c2c23',5)+P('M1405 263l116-1','none','#c99e57',2);
  z+=R(0,0,W,H,0,'url(#shade)');return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="940" viewBox="0 0 1600 940">${z}</svg>`;
 }
 let imgs={},hovered=null,events=[];
 function image(view,theme){const key=view==='lobby'?'lobby':'battle'+theme;if(!imgs[key]){const im=new Image();im.src=typeof TavernBackdrops!=='undefined'?TavernBackdrops[key]||TavernBackdrops.battle0:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(view==='lobby'?lobby():board(theme));imgs[key]=im;}return imgs[key];}
 function fire(c,x,y,t,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);const f=Math.sin(t*5+x)*3;const g=c.createRadialGradient(0,-14,0,0,-14,48);g.addColorStop(0,'#ffd27b66');g.addColorStop(1,'#e2993000');c.fillStyle=g;c.fillRect(-50,-64,100,100);c.fillStyle='#efb455';c.beginPath();c.moveTo(-7,0);c.bezierCurveTo(-17,-16,8+f,-20,1,-37-f);c.bezierCurveTo(24,-17,15,-5,7,0);c.fill();c.fillStyle='#fff0ad';c.beginPath();c.moveTo(-3,0);c.quadraticCurveTo(-9,-10,4,-21);c.quadraticCurveTo(12,-4,3,0);c.fill();c.restore();}
 function paint(c,t,view,theme=0,phase=false,reduced=false,low=false){const im=image(view,theme);if(im.complete&&im.naturalWidth)c.drawImage(im,0,0,W,H);else{c.fillStyle='#705139';c.fillRect(0,0,W,H);}if(reduced)return;
  if(view==='battle'){
   fire(c,1260,750,t,.75);fire(c,348,752,t,.7);fire(c,1420,640,t,.6);
   // Chimney smoke and steam use soft, moving curves, not screen-wide noise.
   for(let j=0;j<3;j++){c.strokeStyle='#e6debf33';c.lineWidth=3-j*.4;c.beginPath();let xx=274+j*5,yy=117-(t*14+j*15)%55;c.moveTo(xx,yy+23);c.bezierCurveTo(xx+14*Math.sin(t+j),yy+2,xx-16,yy-8,xx+3,yy-26);c.stroke();}
   c.save();c.globalAlpha=.24+.12*Math.sin(t*1.4);c.strokeStyle='#c8faff';c.lineWidth=2;for(let j=0;j<4;j++){c.beginPath();c.arc(1395,203,36+j*15,t*.18+j,t*.18+j+.45);c.stroke();}c.restore();
  }else{fire(c,1148,820,t,1.22);fire(c,315,785,t,.8);fire(c,162,704,t,2.2);}
  // Floating dust is limited to the perimeter and the lit tavern, never the lanes.
  const n=low?17:34;for(let j=0;j<n;j++){let x=(j*71.33+Math.sin(t*.3+j)*19)%1600,y=(j*121.23-t*(j%4+3)+94000)%940;if(view==='battle'&&x>320&&x<1300&&y>265&&y<710)continue;c.fillStyle=j%3?'#ffe6a5':'#b5d8ca';c.globalAlpha=.12+.18*Math.sin(t+j)**2;c.beginPath();c.arc(x,y,j%3*.45+.55,0,TAU);c.fill();}c.globalAlpha=1;
  if(phase&&view==='battle'){const co=['#f2ad62','#aacf78','#be9ad7','#a1e4fa','#f29458'][theme];c.save();c.globalAlpha=.17;let g=c.createRadialGradient(800,219,10,800,219,180);g.addColorStop(0,co);g.addColorStop(1,co+'00');c.fillStyle=g;c.fillRect(620,39,360,360);c.restore();}
 }
 return {board,lobby,paint,house,crystal,book,seal,get loading(){return Object.values(imgs).some(i=>!i.complete);}};
})();
