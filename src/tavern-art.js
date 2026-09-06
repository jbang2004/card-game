/* The Tavern Edition: original illustrated portraits. Curved silhouettes,
 * expressive faces, material highlights and authored character accessories.
 * Intentionally no Blizzard names, logos, card scans, portraits or audio. */
const TavernArt = (()=>{
 'use strict';
 const palettes={
  ember:{sky:'#193d53',haze:'#ffbe65',main:'#b73528',hi:'#f68e47',shade:'#561924',trim:'#edb85a',eye:'#fff19c'},
  gold:{sky:'#386c86',haze:'#ffe7a0',main:'#d0a13b',hi:'#fff0a0',shade:'#78511f',trim:'#ffe8a2',eye:'#fffac5'},
  nature:{sky:'#204d49',haze:'#d0e77c',main:'#4c8649',hi:'#a7cd70',shade:'#243b2c',trim:'#d7bb68',eye:'#d9ffbd'},
  ice:{sky:'#264b72',haze:'#b9efff',main:'#4c84a5',hi:'#c5f5ff',shade:'#213a62',trim:'#bbdbe3',eye:'#e0ffff'},
  arcane:{sky:'#212956',haze:'#a2c6ee',main:'#6652ac',hi:'#c4a7ed',shade:'#302056',trim:'#e7bd68',eye:'#aef6ff'},
  void:{sky:'#182240',haze:'#887daf',main:'#5a367f',hi:'#a780c4',shade:'#211c37',trim:'#c6a878',eye:'#dca6ff'},
  blood:{sky:'#283346',haze:'#d88583',main:'#942c4d',hi:'#df6774',shade:'#391e36',trim:'#e7bc8e',eye:'#ffd4b0'},
  steel:{sky:'#496875',haze:'#e4c887',main:'#536e81',hi:'#c9dfdf',shade:'#283f55',trim:'#d0a757',eye:'#d8f4ee'}
 };
 const cache=new Map();
 function random(seed){let n=0;for(const s of seed)n=(Math.imul(n,31)+s.charCodeAt(0))>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
 const P=(d,fill,stroke='#261e2c',sw=3)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
 const E=(x,y,rx,ry,fill,stroke='none',sw=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
 const C=(x,y,r,fill,stroke='none',sw=1)=>E(x,y,r,r,fill,stroke,sw);
 function grad(id,colors,x2='1',y2='1'){return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${colors.map((c,i)=>`<stop offset="${i/(colors.length-1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;}
 function gem(x,y,r,color='#9dfbff'){return C(x,y,r+4,'url(#gold)','#392e37',2)+P(`M${x} ${y-r}L${x+r*.72} ${y} ${x} ${y+r} ${x-r*.72} ${y}Z`,color,'#d8fffa',1.5)+P(`M${x} ${y-r}L${x} ${y+r} ${x-r*.72} ${y}Z`,'#27597899','none')+C(x-2,y-r*.4,2.5,'#fff6dd');}
 function magic(x,y,c,r=55){let z=C(x,y,r*1.9,'url(#aura)')+C(x,y,r,'none',c,2)+C(x,y,r*.86,'none',c,1);for(let j=0;j<12;j++){let a=j*Math.PI/6;z+=P(`M${x+Math.cos(a)*(r+3)} ${y+Math.sin(a)*(r+3)}l${Math.cos(a)*9} ${Math.sin(a)*9}`,'none',c,2);}return z;}
 function face(p,r,{beard=false,elf=false,female=false,evil=false}={}){
  let s='';
  if(elf)s+=P('M181 229Q125 208 120 183L191 206M317 229Q362 205 374 175L310 204','url(#skin)','#50394b',3);
  s+=E(184,242,13,23,'url(#skin)','#50343c',2)+E(320,238,12,24,'url(#skin)','#50343c',2);
  s+=P('M195 174Q242 139 294 174Q326 209 315 256Q310 285 276 310Q247 324 217 295Q184 270 183 229Q181 197 195 174Z','url(#skin)','#4c303d',3.5);
  s+=P('M195 181Q214 185 218 233Q213 262 226 282L218 290Q190 268 187 233Q186 204 195 181Z','#9c5d5390','none');
  s+=P('M204 229Q221 219 237 230Q221 239 207 233Z','#fff2d1','#573540',2)+P('M268 229Q288 216 303 224Q294 235 274 233Z','#fff2d1','#573540',2);
  s+=E(223,230,5.3,7.4,p.sky)+E(286,226,5.4,7.4,p.sky)+C(224,228,2,'#fff')+C(287,223,2,'#fff');
  s+=P('M198 217Q217 207 236 218M270 217Q292 202 308 213','none',beard?'#584140':'#352738',female?5:7);
  s+=P('M252 224Q247 248 241 253Q250 261 262 251','none','#925750',3)+P('M222 276Q250 288 277 270','none','#884745',3);
  s+=P('M225 276Q247 280 269 273','none','#ffdcc0',2);
  if(female){s+=P('M231 278Q249 269 262 276Q248 287 234 282Z','#b6535d','#83454f',1)+P('M219 285Q227 296 242 296','none','#ffcfaa',2);}
  if(evil){s+=P('M202 231L237 230M271 228L303 221','none',p.eye,3);}
  if(beard){s+=P('M189 251Q196 278 221 283Q230 265 248 273Q262 263 281 278Q307 269 318 244Q319 299 294 331L253 365 216 330Q187 300 189 251Z','url(#hair)','#46323a',3);s+=P('M206 283Q224 303 246 289Q267 297 295 279M220 305Q234 329 244 335M265 303Q268 325 259 346M296 293L279 323','none','#f4d79e66',3);s+=P('M222 282Q239 270 250 280Q266 267 285 279','none','#ffe5b999',4);}
  return s;
 }
 function human(type,p,r,seed){
  const knight=type==='knight',archer=type==='archer',rogue=type==='rogue';const female=!knight&&(r()>.32||['mage','nyx','ranger','huntress'].includes(seed));const old=knight||seed==='oracle'||seed==='necromancer';
  let s='';
  // Flowing silhouette, not a stack of geometric polygons.
  s+=P('M156 315Q91 334 67 459L29 640H494L445 453Q417 348 334 313Z','url(#cloth)','#211c32',5);
  s+=P('M144 352Q85 463 83 636L197 650 217 372Z',p.shade,'#251e32',3)+P('M324 353Q413 426 442 640L324 654 276 382Z',p.shade,'#251e32',3);
  s+=P('M192 326L166 590Q240 626 332 582L306 328Z','url(#cloth)','#36283d',3);
  for(let j=0;j<9;j++){let x=154+j*24;s+=P(`M${x} ${410+Math.abs(j-4)*8}Q${x-10} 520 ${x+(j-4)*7} 644`,'none',j%2?p.hi+'44':'#151b3644',j%2?3:6);}
  // Arms, shoulder pads and cuffs.
  s+=P('M142 343Q93 338 78 389L107 422Q153 413 185 385L167 357Z','url(#metal)',p.trim,3)+P('M315 351Q356 321 395 355L428 391Q398 421 353 414L317 388Z','url(#metal)',p.trim,3);
  s+=P('M95 375Q126 355 158 369M344 364Q377 346 400 375','none',p.hi,3);
  s+=P('M168 360Q209 340 246 379Q285 343 327 357L307 439Q252 463 192 432Z','url(#metal)',p.trim,3);
  s+=P('M183 379L202 414 246 437 289 417 310 378','none','#ffe3a985',4);s+=gem(249,393,20,p.eye);
  s+=P('M169 539Q240 556 325 527L330 558Q244 593 160 570Z','#543c37',p.trim,3)+gem(249,560,19,'#f3a94e');
  // Hair/cowl sits behind the face.
  s+=P('M170 199Q155 121 228 112Q312 92 336 163Q356 224 332 335L301 305 191 331Q152 272 170 199Z',knight?'url(#metal)':'url(#hair)','#292332',5);
  s+=face(p,r,{beard:old,elf:archer,female,evil:rogue});
  if(knight){
   s+=P('M164 208Q145 127 199 111Q221 70 282 110Q337 112 340 198L319 227 305 181Q247 145 198 184L191 232Z','url(#metal)','#34303c',5);
   s+=P('M169 190Q247 134 331 187L321 206Q251 159 179 211Z','url(#gold)','#654835',3);
   s+=P('M238 111Q217 83 233 39Q263 13 289 26Q260 60 272 111Z',p.main,'#41223a',3);
   s+=P('M250 95Q242 57 272 34','none',p.hi,5);s+=gem(253,163,17,p.eye);
   // Broad sword and an etched shield, forward of the torso.
   s+=P('M389 114Q404 151 405 192L392 493 372 511 359 489 370 190Z','url(#blade)','#354357',4);
   s+=P('M387 139L380 472','none','#f8fcde',4)+P('M340 480Q377 496 415 474L426 489 404 511 374 513 337 502Z','url(#gold)','#594735',3)+P('M374 512L369 579','none','#493b3d',15)+P('M369 521L365 570','none',p.trim,4);
   s+=P('M68 421Q134 404 191 433L182 544Q145 602 112 612Q64 575 53 519Z','url(#metal)','#2c2930',5)+P('M71 436Q130 422 178 442L168 535Q137 576 113 592Q77 561 67 517Z','none','url(#gold)',8);
   s+=P('M123 449L144 480 171 484 152 509 153 539 122 525 95 539 98 507 79 484 108 481Z','url(#gold)','#604533',3);
  }else if(archer||rogue){
   s+=P('M162 216Q155 140 211 111Q277 75 325 155Q342 178 345 239L313 203Q297 160 248 156Q204 176 185 235Z','url(#cloth)','#211d35',4);
   s+=P('M177 196Q233 123 309 160','none',p.trim,5);
   s+=P('M300 177Q332 237 304 314L337 354Q353 307 342 238Z',p.shade,p.hi,2);
   if(archer){s+=P('M400 116Q493 342 391 569Q421 354 400 116Z','url(#gold)','#3c3639',4)+P('M400 122L391 562','none','#fff2c1',2)+P('M124 410L448 294','none','#e0c786',5)+P('M430 293L462 279 449 313 444 300Z','url(#blade)','#364052',2);s+=P('M137 409Q161 388 175 401L194 415 177 435 139 434Z','url(#skin)','#533549',3);}
   else{s+=P('M117 297Q83 377 97 477L119 510 136 466Z','url(#blade)','#3b3f5e',4)+P('M95 477L151 492','none',p.trim,13)+P('M348 292Q318 369 331 469L349 500 368 460Z','url(#blade)','#3b3f5e',4)+P('M321 472L382 489','none',p.trim,13);}
  }else{
   // High, folded wizard hat for apprentices; jewel circlet for hero/queen.
   if(seed==='spark'||seed==='oracle'||seed==='necromancer'){
    s+=P('M161 178Q159 117 222 32Q269 45 284 114L327 178Q242 212 161 178Z','url(#cloth)','#312536',4);
    s+=P('M139 182Q168 155 207 168Q277 155 342 190Q303 218 244 213Q183 222 139 198Z','url(#cloth)','#2c2439',4)+P('M176 173Q240 192 307 180','none',p.trim,6);
   }else{
    s+=P('M176 200Q149 153 185 120Q233 73 295 117Q331 129 335 183Q293 150 263 149Q242 191 193 212Z','url(#hair)','#36293c',4);
    s+=P('M187 173Q217 151 253 145M217 137Q256 114 293 139','none','#f4d6a359',4);
    s+=P('M183 185Q242 172 309 181L322 194Q254 184 190 205Z','url(#gold)','#5c413f',2)+gem(253,187,15,p.eye);
    if(seed==='nyx'){s+=P('M204 183L202 136 226 164 251 112 274 162 300 135 297 183Z','url(#gold)','#62413a',3);s+=gem(252,150,10,'#a3edff');}
   }
   // An asymmetrical staff and spell-bearing hand.
   s+=P('M101 165L133 604','none','#3c273d',18)+P('M97 166L127 604','none',p.trim,5);
   s+=P('M97 239Q58 209 67 166Q67 131 99 116Q136 133 137 169Q143 211 108 235Z','url(#gold)','#4c3742',4);s+=gem(101,170,28,p.eye);
   s+=P('M318 440Q344 418 361 394L376 399 371 424 393 414 399 427Q372 466 341 472Z','url(#skin)','#533449',3);
   s+=magic(360,353,p.eye,47)+C(360,353,32,'url(#orb)','#d7fff4',2)+P('M349 330Q329 354 350 370','none','#effffd',4);
   s+=P('M125 470Q107 451 98 467L91 492Q105 517 137 502Z','url(#skin)','#533449',3);
  }
  return s;
 }
 function wolf(p,r,sheep=false){
  let s='';
  if(sheep){for(let j=0;j<25;j++){let a=j*Math.PI*2/25;s+=C(260+Math.cos(a)*108,346+Math.sin(a)*96,40,'url(#ivory)','#99877b',3);}s+=P('M189 391L185 492 213 496 229 400M283 409L294 497 325 496 326 386','url(#horn)','#584639',4);s+=E(254,267,57,80,'url(#metal)','#35313f',5)+P('M202 227Q151 179 145 224Q158 257 208 263M300 224Q343 182 356 217Q346 254 304 259','url(#ivory)','#695c54',3);s+=E(232,253,9,13,'#fff7df')+E(275,249,9,13,'#fff7df')+C(235,256,4,'#302d3d')+C(274,253,4,'#302d3d')+P('M244 287Q251 276 263 286Q256 298 252 296Z','#262638')+P('M239 311Q253 321 274 307','none','#d2cbb4',3);return s;}
  s+=P('M67 642Q72 458 139 368L150 283 160 170 143 80Q202 97 226 142Q264 129 302 142Q335 91 379 73L367 222 385 305Q379 360 401 430L467 641Z','url(#fur)','#243247',5);
  s+=P('M165 113Q190 127 204 162L172 202Z',p.shade,'#252e41',3)+P('M351 109L341 204 321 166Z',p.shade,'#252e41',3);
  s+=P('M168 230Q216 183 255 206Q302 177 353 222L332 269 301 292 286 353 251 386 215 351 199 294 169 273Z','url(#ivory)','#485264',3);
  s+=P('M163 234Q205 208 237 244Q206 248 193 267Z',p.shade,'#233142',3)+P('M274 242Q306 208 351 224L328 259Q305 252 274 254Z',p.shade,'#233142',3);
  s+=P('M186 238Q208 224 229 240Q208 252 191 245Z',p.eye,'#192b40',2)+P('M282 240Q305 221 334 231Q316 251 287 247Z',p.eye,'#192b40',2)+E(209,239,3.3,9,'#163641')+E(309,236,3,10,'#163641');
  s+=P('M247 246Q221 280 205 310Q236 345 256 344Q279 342 307 307L275 253Z','url(#ivory)','#677582',2);
  s+=P('M227 313Q252 300 281 311Q268 336 252 336Q240 332 227 313Z','#243748','#a2cad6',2)+P('M252 337L252 352M224 353Q249 363 275 350','none','#31435a',4);
  for(let j=0;j<23;j++){let x=139+j*10;let y=365+Math.sin(j)*16;s+=P(`M${x} ${y}Q${x+10} ${y+44} ${x-9+(x-250)*.18} ${y+69}`,'none',j%2?p.hi:p.shade,4);}
  s+=P('M176 475L180 622 209 649 229 476M300 477L292 631 323 650 348 484','none',p.shade,8);
  if(r()>.5)s+=P('M171 382Q246 438 337 376L340 404Q258 466 169 411Z','#5e3e38',p.trim,5)+gem(250,435,20,p.eye);
  return s;
 }
 function treant(p,r,queen=false){
  let s='';if(queen){s+=human('mage',p,r,'queen');s+=P('M183 180Q133 106 116 75L79 55M156 136L101 123 61 79M323 178Q372 112 383 65L415 38M350 135L420 117 451 81','none','#81563b',15);s+=P('M183 180Q133 106 116 75L79 55M323 178Q372 112 383 65L415 38','none','#d2a56f',4);for(let j=0;j<20;j++){let x=100+r()*321,y=60+r()*80;s+=P(`M${x} ${y}q-27 -20 -9 -41q38 6 9 41Z`,j%2?p.main:p.hi,'#34482d',2);}return s;}
  s+=P('M65 642L93 398 155 337Q132 222 172 186L195 104 224 164 291 156 324 104 337 187Q377 246 344 335L424 400 472 642Z','url(#bark)','#2b392d',5);
  s+=P('M113 391Q64 324 36 300L28 220M110 393L39 381 10 341M356 337Q409 309 433 263L466 226M201 183Q182 111 169 67L124 24M182 126L120 91 106 59M286 178Q316 100 313 47L348 11','none','#674633',22);
  s+=P('M113 391Q64 324 36 300L28 220M356 337Q409 309 433 263L466 226M201 183Q182 111 169 67','none','#bd965b',5);
  s+=P('M163 237Q207 204 239 240M270 237Q311 205 349 224','none','#342d28',18)+P('M179 244Q210 225 235 246M276 244Q307 224 331 234','none',p.eye,5);
  s+=P('M247 224Q229 273 220 285L269 291 266 270','url(#bark)','#443729',4)+P('M190 318Q234 343 302 311L283 358Q237 384 200 351Z','#28362c','#a2895b',4);
  for(let j=0;j<12;j++){let x=138+j*19;s+=P(`M${x} ${360+Math.sin(j)*15}Q${x-30} 449 ${x+16} 550L${x-4} 651`,'none',j%2?'#deb88088':'#332f27aa',j%2?3:7);}
  for(let j=0;j<34;j++){let x=45+r()*402,y=40+r()*174;s+=P(`M${x} ${y}q-39 -28 -8 -54q50 17 8 54Z`,j%3?p.main:p.hi,'#29412c',2)+P(`M${x} ${y}l-8 -35`,'none','#c1d58288',1.5);}
  for(let j=0;j<6;j++)s+=E(172+j*27,178+Math.sin(j)*11,15,8,p.main);
  return s;
 }
 function golem(p,r){let s=P('M70 640L88 406 150 350 163 199Q165 167 218 143L299 151Q344 168 348 210L346 352 423 410 454 640Z','url(#rock)','#29363b',6);for(let j=0;j<30;j++){let x=112+r()*282,y=194+r()*442,rx=22+r()*33,ry=20+r()*20;s+=P(`M${x-rx} ${y-ry}Q${x} ${y-ry-18} ${x+rx} ${y-ry}L${x+rx+8} ${y+ry-8}Q${x+1} ${y+ry+12} ${x-rx-7} ${y+ry}Z`,'url(#rock)','#293940',5)+P(`M${x-rx+5} ${y-ry+2}Q${x} ${y-ry-12} ${x+rx-3} ${y-ry+3}`,'none',p.hi+'77',3);}
 s+=P('M182 243Q211 225 239 239L229 259 191 263Z','#1b2c36',p.hi,2)+P('M268 238Q303 215 328 235L315 257 274 257Z','#1b2c36',p.hi,2)+P('M192 246L231 245M279 244L317 239','none',p.eye,5)+P('M230 292L252 266 271 293Z','url(#rock)','#1e2e38',3)+P('M204 320L288 316','none','#24313a',7);
 s+=magic(257,432,p.eye,59)+gem(257,432,36,p.eye);return s;}
 function dragon(p,r){
  let s='';
  for(let side=0;side<2;side++){s+=`<g transform="${side?'translate(512 0) scale(-1 1)':''}">`;
   s+=P('M268 388Q192 255 24 124Q61 233 42 343Q112 302 155 370Q184 406 200 489L273 448Z','url(#wing)','#441f31',5);
   s+=P('M251 411Q172 258 24 124M248 409Q138 308 44 341M242 420Q172 349 156 373','none','#f0b879',5);
   s+=P('M58 183Q112 239 170 301M70 252Q111 268 142 297','none','#fdbb7955',3);s+='</g>';}
  s+=P('M187 641Q160 523 204 432L217 361Q188 344 175 313L186 228 282 182Q353 201 363 278Q355 334 329 357Q404 438 366 512Q327 558 377 642Z','url(#scales)','#411b2a',5);
  s+=P('M257 359Q294 383 318 429Q336 466 298 525Q283 569 312 642L226 642Q206 572 233 511Q264 455 248 417Z','url(#belly)','#763b34',4);
  for(let j=0;j<9;j++)s+=P(`M${235-j%2*5} ${422+j*25}Q278 ${450+j*25} ${319-j*1.3} ${421+j*25}`,'none','#9d5d3e',4);
  s+=P('M216 224Q180 183 196 118Q224 160 247 166M293 185Q300 122 354 81Q346 163 326 213','url(#horn)','#593a33',4);
  s+=P('M201 219Q164 247 150 278L92 304Q84 324 110 339Q170 363 224 342Q259 380 315 328L340 271Q326 233 278 209Z','url(#scales)','#461b2b',5);
  s+=P('M95 316Q152 327 217 313Q259 308 278 301L250 337Q183 370 113 339Z','#2d1d2d','#c97b44',4);
  for(let j=0;j<8;j++){let x=117+j*17,y=326+Math.sin(j/2)*4;s+=P(`M${x} ${y}l8 20 9 -20Z`,'url(#horn)','#6a3b35',1.5);}
  s+=P('M167 269Q202 235 249 252L226 274 186 283Z','#3a1829','#ec9b5d',4)+P('M183 270Q208 250 230 260L219 271Z',p.eye,'#ab542e',1)+E(212,262,3,8,'#7c3125')+C(204,260,2,'#fff');
  s+=P('M269 267L304 245 319 263 293 285 284 323 265 321Z','url(#scales)','#a5533e',3)+E(115,311,9,4,'#562131');
  s+=P('M326 281L380 262 348 302 375 317 344 325 356 350 326 348Z','url(#horn)','#6b3934',4);
  // Individually shaded scales and dorsal horns, not a flat silhouette.
  for(let j=0;j<58;j++){let x=203+r()*140,y=365+r()*260;if(x>237&&x<305)continue;s+=P(`M${x} ${y}q7 -12 17 -3l-7 14Z`,'url(#scales)','#b9614255',1.4);}
  s+=P('M226 448Q178 415 154 433L128 483 147 498 160 475 158 505 181 501 187 476 200 497 223 480Z','url(#scales)','#4f2533',4)+P('M313 445Q358 402 391 435L420 487 401 505 383 479 389 516 365 510 351 480 341 491Z','url(#scales)','#4f2533',4);
  return s;
 }
 function bird(p,r,raven=false){let s='';for(let side=0;side<2;side++){s+=`<g transform="${side?'translate(512 0) scale(-1 1)':''}">`;for(let j=0;j<10;j++){let x=26+j*13,y=112+j*27;s+=P(`M265 400Q${95+j*8} ${409+j*7} ${x} ${y}Q${140+j*4} ${234+j*14} 263 300Z`,'url(#wing)','#592c3c',3);}s+='</g>';}
  s+=P('M237 416Q165 545 157 632L248 517 261 636 290 534 343 612Q335 503 280 415Z','url(#flame)','#79394a',3);
  s+=P('M245 235Q231 302 215 343Q207 407 258 465Q308 398 296 343L273 254Z','url(#metal)','#482944',4);
  s+=P('M252 273Q228 228 252 190L288 222 303 251 285 282Z','url(#metal)','#462c3a',3)+P('M288 229L326 247 294 255Z','url(#gold)','#573337',3)+C(275,234,6,'#faffd0')+C(276,234,2,'#201c31');
  s+=P('M252 205L231 163 269 186 291 161 285 213Z','url(#gold)','#6b3638',3);return s;
 }
 function reaper(p,r){let s=P('M56 642Q89 438 164 340L155 238Q154 125 232 108Q320 97 356 212L347 346Q415 432 467 643Z','url(#cloth)','#241c37',5);s+=P('M195 183Q251 137 310 191L315 278Q301 329 267 354L231 344Q195 313 189 263Z','url(#ivory)','#604d63',4);s+=P('M196 234Q218 216 242 242L229 266 208 258Z','#25213c',p.hi,2)+P('M269 239Q294 212 311 230L303 256 278 266Z','#25213c',p.hi,2)+P('M207 242L233 245M279 246L305 237','none',p.eye,4)+P('M253 252L240 281 268 281Z','#31263b');s+=P('M223 306Q251 316 282 302L277 334 231 334Z','url(#ivory)','#5e4761',3);for(let j=0;j<5;j++)s+=P(`M${236+j*9} 309l1 24`,'none','#6c5666',3);
 s+=P('M175 199L166 130 206 162 220 87 251 146 287 84 302 157 342 120 326 202Q255 179 175 199Z','url(#metal)',p.trim,3)+gem(251,172,19,p.eye);
 for(let j=0;j<8;j++)s+=P(`M${159+j*28} ${364+Math.abs(j-4)*9}Q${108+j*45} 473 ${100+j*49} 642`,'none',p.hi+'55',3);
 s+=P('M366 641L405 167','none','#3b283f',19)+P('M363 641L401 166','none',p.trim,5)+P('M405 186Q330 123 176 113Q296 44 405 114L453 156 435 198Z','url(#blade)','#354052',5)+P('M196 110Q315 99 418 167','none',p.hi,3);return s;}
 function spider(p,r){let s='';for(let k=0;k<2;k++){s+=`<g transform="${k?'translate(512 0) scale(-1 1)':''}">`;for(let j=0;j<4;j++){s+=P(`M235 ${330+j*32}Q${115-j*12} ${188+j*83} ${68-j*4} ${224+j*78}Q${88-j*8} ${317+j*52} ${35+j*9} ${481+j*27}`,'none','#252c30',16)+P(`M235 ${326+j*32}Q${115-j*12} ${182+j*83} ${68-j*4} ${224+j*78}Q${88-j*8} ${317+j*52} ${35+j*9} ${481+j*27}`,'none',p.hi,4);}s+='</g>';}
 s+=E(254,302,88,118,'url(#metal)','#273230',5)+E(255,425,61,60,'url(#metal)','#273230',4);for(let j=0;j<6;j++)s+=C(223+j*13,420+Math.sin(j)*5,8,p.eye,'#31402f',2);s+=P('M229 462Q207 493 239 509L247 469M279 464Q303 494 270 510L263 467','url(#ivory)','#44392f',3)+P('M226 247L254 215 284 247 257 287Z',p.hi,'#354536',3);return s;}
 function objects(type,p,r){let s='';
  if(type==='book'){s+=P('M65 222Q162 214 251 267Q343 208 444 213L436 440Q343 441 264 497L240 497Q153 448 75 451Z','#65442f','#362c30',7)+P('M82 218Q164 216 246 258L244 468Q164 425 87 431Z','url(#paper)','#a4855a',4)+P('M261 260Q348 211 426 215L420 429Q336 435 264 472Z','url(#paper)','#a4855a',4);for(let j=0;j<9;j++)s+=P(`M104 ${246+j*19}Q164 ${246+j*19} 227 ${282+j*19}M281 ${282+j*19}Q347 ${248+j*19} 404 ${245+j*19}`,'none','#8b684a',j%3===0?3:1.7);s+=magic(257,280,p.eye,88)+gem(255,290,33,p.eye);}
  else if(type==='sword'){s+=P('M256 68L295 290 278 405 254 446 231 403 219 293Z','url(#blade)','#354659',5)+P('M255 97L255 410','none','#fcf2c6',5)+P('M158 403Q207 383 248 408Q300 378 354 402L348 426 298 447 254 430 204 449 165 429Z','url(#gold)','#685237',4)+P('M253 443L253 554','none','#382c36',31)+P('M243 453L265 464M241 476L263 487M241 499L263 510M241 522L265 533','none',p.trim,5)+gem(254,566,23,p.eye);}
  else if(type==='crystal'){s+=P('M249 106L319 253 302 395 250 470 184 391 179 255Z','url(#ice)','#bdfaff',4)+P('M249 106L245 468 180 255 252 231 319 253 302 395 250 232Z','#c6fbff50','#c6f4ff',2);for(let j=0;j<5;j++){let x=101+j*74,y=368+(j%2)*55;s+=P(`M${x} ${y-87}L${x+22} ${y-12} ${x+10} ${y+67} ${x-19} ${y+29} ${x-23} ${y-24}Z`,'url(#ice)','#c7faff',2);}s+=magic(252,471,'#c8fdff',98);}
  else if(type==='potion'){s+=P('M218 171L291 171 292 261Q369 302 371 382Q369 480 264 493Q155 488 149 397Q149 309 218 264Z','url(#glass)','#c8e5bf',5)+P('M165 362Q207 378 254 356Q305 342 355 362L355 413Q323 479 261 478Q189 475 168 417Z','url(#liquid)','#afd77b',3)+E(261,363,94,14,'#c2eea7')+P('M214 143L293 142 293 192 219 192Z','url(#bark)','#695438',4)+P('M178 324Q161 364 177 403','none','#f3fff0aa',11)+P('M309 297Q333 315 338 339','none','#f3fff066',6);for(let j=0;j<13;j++)s+=C(198+r()*118,337+r()*91,2+r()*6,'#defabb99');}
  else if(type==='meteor'||type==='bolt'){s+=P('M95 438Q158 280 422 102Q397 227 309 306L423 249Q356 354 299 410L331 388Q295 477 212 497Z','url(#flame)','#bd4a24',4)+P('M138 432Q251 282 371 174Q322 318 223 433Z','#fff1af','none')+P('M161 408Q221 387 248 430Q284 468 247 513Q210 547 161 520Q115 491 132 446Z','url(#rock)','#c36531',4)+P('M157 430L190 449 224 426M190 449L169 497M190 449L239 485','none','#ffdc76',5);for(let j=0;j<17;j++){let x=130+r()*256,y=215+r()*223;s+=P(`M${x} ${y}l23 -31`,'none',j%2?'#ffde8877':'#df5a23aa',2+r()*3);}}
  else if(type==='banner'){s+=P('M141 114L147 594','none','#5b3b27',17)+P('M137 121L141 590','none','#e5bf69',4)+P('M147 140Q248 123 386 155L374 418 267 471 158 436Z','url(#cloth)','#3c2735',5)+P('M164 156Q262 145 367 171L356 407 267 450 175 422Z','none',p.trim,6)+P('M264 216L286 271 337 289 296 326 293 382 264 352 216 380 229 323 197 287 247 271Z','url(#gold)','#7a553a',4);}
  else {s+=magic(256,320,p.eye,126);if(type==='mirror'){s+=P('M170 181Q254 97 340 181L353 418Q256 474 159 418Z','url(#gold)','#674b35',6)+P('M186 195Q253 135 326 195L336 401Q255 439 178 401Z','url(#ice)','#374467',4)+P('M199 368L304 183M229 410L328 246','none','#defaff88',11);}else{s+=C(256,318,90,'url(#orb)','#e7fff8',3)+P('M256 182L371 386H141Z','none',p.trim,4)+P('M256 457L141 250H371Z','none',p.trim,3)+gem(256,318,31,p.eye);}}
  return s;
 }
 function svg(type='mage',palette='ember',seed='default',transparent=false){
  const p=palettes[palette]||palettes.ember,r=random(type+palette+seed);let defs=grad('bg',[p.sky,p.haze,p.shade],'0','1')+grad('cloth',[p.hi,p.main,p.shade],'1','.5')+grad('metal',[p.hi,p.main,p.shade,p.main],'1','1')+grad('skin',['#ffe1b8','#edb083','#b87367'],'1','.6')+grad('hair',[['gold','ice','steel'].includes(palette)?'#edddbc':'#ce9253',['gold','ice','steel'].includes(palette)?'#928777':'#713c3b','#33243d'],'1','1')+grad('gold',['#fff0b0','#e0b660','#8b592c','#cb8f43'],'1','1')+grad('blade',['#f2f4d8','#80aebd','#e0f7ec','#4e688b'],'1','.2')+grad('rock',[p.hi,p.main,p.shade],'1','1')+grad('bark',['#c5a26b','#82613e','#443e2e'],'1','1')+grad('ivory',['#ffebc6','#d0cdb6','#7b8a96'],'1','1')+grad('fur',[p.hi,p.main,p.shade],'1','1')+grad('scales',[p.hi,p.main,p.shade],'1','.6')+grad('belly',['#ffcb7b','#bb773a','#773f29'],'1','1')+grad('horn',['#fff0c0','#b39064','#63453e'],'1','.5')+grad('wing',[p.hi,p.main,p.shade],'0','1')+grad('flame',['#fffbe1','#ffdb68','#ef7a26','#a52d2a'],'1','0')+grad('paper',['#fff3ca','#d7bb83','#b89662'],'1','1')+grad('ice',['#f4ffff','#82e5f1','#3b82be','#243d78'],'1','.5')+grad('glass',['#eefbc950','#90cfb644','#356d6f88'],'1','1')+grad('liquid',['#c3f77a','#5eba68','#257365'],'1','1');
  defs+=`<radialGradient id="aura"><stop stop-color="${p.eye}" stop-opacity=".8"/><stop offset=".35" stop-color="${p.hi}" stop-opacity=".36"/><stop offset="1" stop-color="${p.main}" stop-opacity="0"/></radialGradient><radialGradient id="orb" cx=".3" cy=".25"><stop stop-color="#fffde2"/><stop offset=".18" stop-color="${p.eye}"/><stop offset=".62" stop-color="${p.main}"/><stop offset="1" stop-color="${p.shade}"/></radialGradient><radialGradient id="edge"><stop offset=".45" stop-color="#171827" stop-opacity="0"/><stop offset="1" stop-color="#151528" stop-opacity=".44"/></radialGradient><filter id="shadow" x="-.3" y="-.2" width="1.6" height="1.5"><feDropShadow dx="5" dy="11" stdDeviation="7" flood-color="#131e30" flood-opacity=".48"/></filter>`;
  let bg='',front='';
  if(!transparent){bg+=`<rect width="512" height="640" fill="url(#bg)"/>`+C(312,156,122,p.haze+'99');
   // Background scene silhouettes, painted strokes and broken atmospheric edges.
   for(let j=0;j<4;j++){let y=255+j*78;bg+=P(`M-30 ${y+30}Q85 ${y-75} 183 ${y+10}Q320 ${y-113} 550 ${y+25}V660H-30Z`,[p.sky+'50',p.shade+'55',p.sky+'a0',p.shade+'d0'][j],'none');}
   if(['nature','wolf','archer','treant','spider'].includes(palette)||['archer','treant','wolf','spider'].includes(type)){
    for(let j=0;j<9;j++){let x=j*76-55;bg+=P(`M${x} 633Q${x+30} 401 ${x-7} 113L${x+14} 112Q${x+38} 332 ${x+46} 642Z`,p.shade+'bb','none');bg+=P(`M${x+4} 363L${x-55} 244M${x+13} 251L${x+84} 181`,'none',p.shade+'aa',14);}
    for(let j=0;j<26;j++)bg+=E(r()*530,32+r()*122,35+r()*36,24+r()*18,p.main+(j%2?'66':'99'));
   }else{for(let j=0;j<7;j++){let x=j*94-35,h=90+r()*135;bg+=P(`M${x} 530V${h+126}L${x+16} ${h+114} ${x+16} ${h} ${x+37} ${h-37} ${x+59} ${h} ${x+58} ${h+115} ${x+76} ${h+126}V630Z`,p.sky+'c0','none');bg+=P(`M${x+28} ${h+63}v35M${x+49} ${h+159}v30`,'none',p.haze+'55',5);}}
   // Short textured brush strokes; authored and deterministic, no costly filter.
   for(let j=0;j<185;j++){let x=r()*520,y=r()*640,len=4+r()*30;bg+=P(`M${x} ${y}q${len*.6} ${r()*6-3} ${len} ${r()*6-3}`,'none',j%2?p.haze+'18':p.sky+'29',1+r()*4);}
  }
  let sub='';if(['mage','knight','archer','rogue'].includes(type))sub=human(type,p,r,seed);else if(type==='wolf'||type==='sheep')sub=wolf(p,r,type==='sheep');else if(type==='treant')sub=treant(p,r,seed==='queen');else if(type==='golem')sub=golem(p,r);else if(type==='dragon')sub=dragon(p,r);else if(type==='reaper')sub=reaper(p,r);else if(type==='raven'||type==='phoenix')sub=bird(p,r,type==='raven');else if(type==='spider')sub=spider(p,r);else sub=objects(type,p,r);
  for(let j=0;j<26;j++){let x=r()*512,y=100+r()*504;front+=C(x,y,.6+r()*2.4,j%3===0?'#fff0c788':p.eye+'55');}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><defs>${defs}</defs>${bg}<g filter="url(#shadow)">${sub}</g>${front}${transparent?'':'<rect width="512" height="640" fill="url(#edge)"/>'}</svg>`;
 }
 function url(type,palette,seed=''){let key=type+'|'+palette+'|'+seed;if(typeof TavernPortraits!=='undefined'&&TavernPortraits[key])return TavernPortraits[key];if(!cache.has(key))cache.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,palette,seed)));return cache.get(key);}
 function portrait(type,palette,seed=''){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,palette,seed,true));}
 if(typeof EmberArt!=='undefined'){EmberArt.svg=svg;EmberArt.url=url;EmberArt.card=c=>url(c.art,c.palette,c.id);EmberArt.portrait=portrait;}
 return {svg,url,portrait,palettes};
})();
