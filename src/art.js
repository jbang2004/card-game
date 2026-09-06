/* Original procedural fantasy illustration system. No external image assets. */
const EmberArt = (()=>{
 const themes={ember:['#17212b','#ad653d','#ffe0ab','#432d29'],gold:['#1d2225','#a99155','#ffefb1','#5d5134'],nature:['#142428','#66886c','#dfedb0','#26443c'],ice:['#162333','#54949f','#c7f9ff','#334e66'],arcane:['#121b2d','#7770ad','#e2e6ff','#323650'],void:['#161326','#635b85','#d3afff','#373042'],blood:['#23151d','#a64856','#ffb49f','#4e2632'],steel:['#19232a','#78878e','#dfecdb','#3b4e54']};
 const cache=new Map();
 function rng(seed){let s=0;for(let i=0;i<seed.length;i++)s=(s*31+seed.charCodeAt(i))>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
 const path=(d,fill,stroke='',sw=1)=>`<path d="${d}" fill="${fill}" ${stroke?`stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
 function baseSvg(type='mage',palette='ember',seed='default'){
  const [bg,mid,light,dark]=themes[palette]||themes.ember,r=rng(seed),a=light,b=mid,k='#0c1019';
  let scenery='',detail='';
  for(let i=0;i<35;i++){const x=r()*512,y=r()*650;scenery+=`<circle cx="${x}" cy="${y}" r="${r()*1.8+.4}" fill="${a}" opacity="${r()*.45+.12}"/>`;}
  for(let i=0;i<12;i++){let x=i*50-20,h=80+r()*200;scenery+=path(`M${x} 650V${650-h}l15 -${30+r()*20} 16 40v${h}Z`,dark)+'<path d="M'+(x+8)+' 640 V'+(675-h)+'" stroke="'+b+'" opacity=".12"/>';}
  for(let i=0;i<8;i++)scenery+=path(`M-30 ${420+i*29}Q${r()*300} ${260+i*32} 540 ${420+i*33}L550 690H-20Z`,dark)+'\n';
  let subject='';
  const glow=`<circle cx="256" cy="335" r="100" fill="url(#halo)"/><circle cx="256" cy="335" r="61" fill="none" stroke="${a}" opacity=".13" stroke-width="1"/>`;
  if(type==='mage'||type==='rogue'||type==='archer'){
   subject+=`<circle cx="266" cy="210" r="117" fill="none" stroke="${b}" opacity=".55"/><circle cx="266" cy="210" r="108" fill="none" stroke="${a}" opacity=".25" stroke-dasharray="2 12"/>`;
   subject+=path('M76 643Q102 484 165 394L190 270 321 251 367 387Q440 495 464 661Z','url(#robe)');
   subject+=path('M170 395Q200 454 217 621L158 669 109 650Z',dark,b,2)+path('M334 391L399 610 348 670 285 444Z',dark,b,2);
   subject+=path('M179 296Q148 245 191 151Q224 101 265 104Q325 124 354 192L367 302 309 389 210 374Z','url(#metal)',b,2);
   subject+=path('M193 276Q199 208 265 150Q320 205 336 276L299 341 223 337Z',k,a,1);
   subject+=path('M235 240Q257 218 288 238L307 270 293 323 267 340 239 320 223 275Z','url(#skin)');
   subject+=path('M232 267L248 273 239 276Z',a)+path('M278 273L296 265 288 277Z',a);
   subject+=path('M265 275L259 297 271 299M253 317Q268 323 281 313','none',b,2);
   subject+=path('M211 240Q230 220 269 221L219 295 211 369 190 323Z',dark,b,1)+path('M293 222L326 249 314 366 291 332Z',dark,b,1);
   for(let i=0;i<9;i++)subject+=path(`M${172+i*16} ${418+Math.abs(i-4)*13}Q${195+i*18} 514 ${147+i*31} 664`,'none',i%2?b:a,i%2?2:.6);
   subject+=path('M182 354L253 405 331 356 311 425 257 458 199 415Z','url(#metal)',b,2)+path('M252 395L273 417 253 440 235 416Z',a,k,4);
   if(type==='archer'){
    subject+=path('M366 145Q483 351 379 573M365 146L379 573','none',a,5)+path('M366 145Q408 368 379 573','none',b,11);
    subject+=path('M145 388L429 314','none',a,4)+path('M422 299L451 308 426 326Z',light);
    subject+=path('M147 404L248 394 237 426 135 438Z','url(#metal)',b,2);
   } else if(type==='rogue'){
    subject+=path('M139 465L194 296 205 471 175 505Z','url(#blade)',a,2)+path('M336 467L401 280 391 480 364 518Z','url(#blade)',a,2);
    subject+=path('M135 490L201 499M326 496L396 513','none',b,12);
   }else{
    subject+=path('M116 465L217 440 238 456 213 481 160 506Z','url(#metal)',b,2)+path('M384 466L302 445 282 466 305 484 356 509Z','url(#metal)',b,2);
    subject+=`<circle cx="263" cy="421" r="92" fill="url(#halo)"/><circle cx="263" cy="421" r="38" fill="url(#orb)" stroke="${a}" stroke-width="2"/><ellipse cx="263" cy="421" rx="61" ry="16" fill="none" stroke="${a}" opacity=".7" transform="rotate(-25 263 421)"/>`;
   }
  }else if(type==='knight'){
   subject+=path('M62 657L108 396 186 330 326 326 406 396 462 655Z',dark,b,3);
   subject+=path('M95 397L171 347 221 387 197 444 90 451Z','url(#metal)',a,2)+path('M311 378L352 347 425 397 422 452 313 438Z','url(#metal)',a,2);
   subject+=path('M170 396L248 426 326 394 313 526 256 568 188 527Z','url(#metal)',a,2);
   subject+=path('M183 414L254 451 314 414 300 472 253 506 197 473Z',dark,b,2)+path('M254 424L273 466 254 493 235 467Z',a);
   subject+=path('M201 139L254 110 311 140 331 218 308 311 256 351 204 311 182 221Z','url(#metal)',b,3);
   subject+=path('M204 157L249 193 254 298 213 280 199 242Z',dark,a,1)+path('M266 191L307 158 315 242 289 285 263 299Z',dark,a,1);
   subject+=path('M205 229L249 241 245 250 207 240Z',a)+path('M267 241L310 229 306 240 268 251Z',a);
   subject+=path('M250 126L264 126 278 303 256 329 236 303Z','url(#metal)',b,2);
   subject+=path('M193 193L153 113 152 47 197 125 217 171Z','url(#metal)',b,2)+path('M301 172L329 119 358 51 358 115 324 198Z','url(#metal)',b,2);
   for(let i=0;i<5;i++)subject+=path(`M${181+i*2} ${503+i*25}L255 ${537+i*24} ${325-i*3} ${503+i*25}`,'none',b,3);
   subject+=path('M118 401L74 363 67 418 112 446M385 411L440 370 449 421 407 448','url(#metal)',a,2);
   subject+=path('M124 299L147 541 130 622 113 547Z','url(#blade)',a,2)+path('M84 526L163 526 176 544 80 541Z','url(#metal)',a,2)+path('M125 541L131 606','none',b,10);
  }else if(type==='dragon'){
   subject+=path('M274 379Q368 216 480 110L435 293 503 265 450 359 489 392 376 444Z','url(#wing)',b,2);
   subject+=path('M220 352Q127 156 18 142L49 293 5 284 62 370 16 402 166 456Z','url(#wing)',b,2);
   subject+=path('M294 372L480 110M294 372L435 293M294 372L450 359M204 363L18 142M204 363L49 293M204 363L62 370','none',a,2);
   subject+=path('M194 650Q170 535 212 439L213 290 332 242 360 344Q388 432 328 497Q287 551 326 650Z','url(#scales)',b,3);
   subject+=path('M232 443L239 332 284 296 314 344 301 451 263 509 253 654 207 654Z','url(#metal)',b,2);
   for(let i=0;i<10;i++)subject+=path(`M218 ${392+i*24}Q254 ${425+i*22} 315 ${379+i*20}`,'none',dark,5);
   subject+=path('M199 296L172 248 190 190 236 144 286 162 321 195 343 269 303 323 274 307 226 332 168 313 144 292 181 273Z','url(#scales)',a,2);
   subject+=path('M223 161L200 121 215 54 239 141M280 169L301 105 360 69 326 155 314 200','url(#horn)',b,3);
   subject+=path('M178 250L222 223 250 236 220 250Z',dark,b,4)+path('M204 237L228 233 220 246 207 247Z',a)+path('M216 236L215 245','none','#fff4cf',2);
   subject+=path('M150 291L199 299 239 287 283 298 241 318 190 321Z',k,b,2);
   for(let i=0;i<5;i++)subject+=path(`M${183+i*17} ${298-i*2}l7 13 7 -14Z`,light);
   subject+=path('M326 242L368 236 347 266 375 285 349 302 368 328 344 338Z',dark,b,2);
   for(let i=0;i<38;i++){const x=217+r()*90,y=335+r()*245;subject+=path(`M${x} ${y}l8 -4 8 4 -8 9Z`,'none',b,1);}
   subject+=path('M182 310Q109 389 61 444Q133 421 207 338Z','url(#fire)');
  }else if(type==='wolf'||type==='sheep'){
   subject+=`<circle cx="274" cy="199" r="94" fill="${a}" opacity=".2"/><circle cx="274" cy="199" r="85" fill="none" stroke="${a}" opacity=".4"/>`;
   if(type==='wolf'){
    subject+=path('M81 658L110 426 170 347 181 211 165 121 231 166 300 160 356 112 345 226 376 331 409 470 438 654Z','url(#fur)',b,2);
    subject+=path('M169 158L203 207 186 224Z',dark)+path('M335 153L312 204 336 221Z',dark);
    subject+=path('M201 238L252 258 221 279 190 270Z',dark)+path('M273 256L323 235 334 265 293 278Z',dark);
    subject+=path('M208 256L234 259 220 267Z',a)+path('M287 260L319 250 304 265Z',a);
    subject+=path('M251 266L231 306 200 347 248 380 303 351 279 304Z','url(#metal)',b,2)+path('M233 337L270 337 252 360Z',k)+path('M249 360L249 377M248 377L226 371M249 377L272 368','none',k,3);
    subject+=path('M197 310L158 355 171 411 146 451 186 440 171 501 219 474 257 531 295 475 338 505 326 441 369 449 343 394 364 356 324 311 305 392 252 431 206 397Z','url(#fur)',b,2);
    for(let i=0;i<54;i++){const x=140+r()*230,y=380+r()*240;subject+=path(`M${x} ${y}l${(x-256)*.09} ${16+r()*17}`,'none',i%3===0?a:b,1.3);}
   }else{
    for(let i=0;i<24;i++){const ang=i/24*Math.PI*2;subject+=`<circle cx="${256+Math.sin(ang)*104}" cy="${401+Math.cos(ang)*100}" r="40" fill="url(#metal)" stroke="${b}"/>`;}
    subject+=`<ellipse cx="260" cy="354" rx="48" ry="66" fill="${dark}"/><path d="M205 333l-37 -15 9 28 33 4M308 333l38 -15 -9 29 -34 3" fill="${dark}"/><circle cx="243" cy="347" r="5" fill="${a}"/><circle cx="277" cy="347" r="5" fill="${a}"/>`;
   }
  }else if(type==='treant'||type==='golem'){
   subject+=path('M82 663L103 420 162 356 180 203 260 156 334 201 352 355 408 417 448 661Z','url(#metal)',b,3);
   if(type==='treant'){
    subject+=path('M204 258L171 173 109 141 73 63 85 159 151 208 161 270M294 242L349 166 384 75 378 178 344 237M218 217L229 137 201 53 263 123 275 198M181 369L125 318 94 239 75 248 98 344 157 425M335 364L390 308 450 270 415 341 358 425','none',b,15);
    subject+=path('M198 236L231 219 271 238 308 218 326 273 298 319 279 351 237 352 212 319 183 282Z',dark,b,3);
    subject+=path('M199 274L239 284 222 294Z',a)+path('M274 285L311 266 294 291Z',a)+path('M236 324L254 309 277 322 259 332Z',k);
    for(let i=0;i<24;i++){const x=160+r()*175;subject+=path(`M${x} ${365+r()*40}Q${x-35} 506 ${x+50-r()*100} 667`,'none',i%2?b:a,i%2?3:1);}
    for(let i=0;i<27;i++){const x=90+r()*340,y=130+r()*170;subject+=path(`M${x} ${y}q-15 -26 16 -29 10 25 -16 29Z`,i%3?b:a);}
   }else{
    for(let y=230;y<650;y+=70)for(let x=140;x<390;x+=65){const dx=(r()-.5)*20;subject+=path(`M${x+dx} ${y}l48 -12 22 42 -19 43 -47 -5 -12 -32Z`,'url(#metal)',dark,5);}
    subject+=path('M199 266L242 278 223 292 199 282Z',a)+path('M274 278L315 266 310 282 276 292Z',a);
    subject+=`<circle cx="260" cy="423" r="67" fill="url(#halo)"/>`+path('M260 370L293 413 260 462 227 416Z','url(#orb)',a,3);
   }
  }else if(type==='reaper'){
   subject+=path('M60 669Q92 479 163 371L166 241 224 153 303 149 353 242 348 372Q422 468 459 663Z','url(#robe)',b,2);
   subject+=path('M191 234L233 185 282 183 324 237 320 311 291 356 220 351 184 307Z',k,b,2);
   subject+=path('M218 231Q257 198 293 231L308 275 289 317 278 345 231 345 226 314 205 278Z','url(#metal)',b,2);
   subject+=path('M214 262L246 270 237 291 218 283Z',k)+path('M267 269L301 261 294 284 278 291Z',k)+path('M253 285L244 309 265 309Z',k);
   subject+=path('M220 275L238 278M277 278L294 272','none',a,3);
   for(let i=0;i<5;i++)subject+=path(`M${236+i*9} 326v14`,'none',k,3);
   subject+=path('M185 221L181 145 219 177 235 101 261 164 287 107 304 178 337 143 329 225Z','url(#metal)',a,2);
   subject+=path('M357 666L414 168Q303 98 188 98Q355 26 447 113L422 207Z','url(#blade)',a,2);
   for(let i=0;i<7;i++)subject+=path(`M${161+i*29} ${391+Math.abs(i-3)*15}L${102+i*53} 667`,'none',b,2);
  }else if(type==='phoenix'||type==='raven'){
   subject+=`<circle cx="257" cy="306" r="159" fill="url(#halo)"/>`;
   for(let j=0;j<2;j++){const flip=j?'translate(512 0) scale(-1 1)':'';subject+=`<g transform="${flip}">`;for(let i=0;i<9;i++)subject+=path(`M245 ${400+i*6}Q${95-i*6} ${315+i*10} ${41+i*9} ${137+i*19}Q${105+i*10} ${214+i*11} ${258+i*3} 327Z`,'url(#wing)',b,1.5);subject+='</g>';}
   subject+=path('M231 454L208 521 243 498 226 613 262 545 278 640 302 556 300 486 277 434Z','url(#fire)',b,2);
   subject+=path('M221 382L230 303 254 259 282 281 296 335 290 409 262 468 230 418Z','url(#metal)',b,2);
   subject+=path('M258 264L242 214 278 248 299 274 287 310Z','url(#metal)',a,2)+path('M297 282L324 296 290 302Z',a)+`<circle cx="278" cy="278" r="4" fill="${a}"/>`;
  }else if(type==='spider'){
   for(let j=0;j<2;j++){subject+=`<g ${j?'transform="translate(512 0) scale(-1 1)"':''}>`;for(let i=0;i<4;i++)subject+=path(`M231 ${335+i*31}L${120-i*19} ${199+i*78} ${65-i*8} ${305+i*86}`,'none',b,11)+path(`M230 ${333+i*31}L${120-i*19} ${197+i*78} ${65-i*8} ${303+i*86}`,'none',a,2);subject+='</g>';}
   subject+=`<ellipse cx="259" cy="318" rx="79" ry="104" fill="url(#metal)" stroke="${b}" stroke-width="3"/><ellipse cx="259" cy="420" rx="54" ry="47" fill="url(#metal)"/>`;
   for(let i=0;i<4;i++)subject+=`<circle cx="${232+i*17}" cy="412" r="6" fill="${a}"/>`;
   subject+=path('M231 449L234 480 250 460M282 449L278 480 262 460','none',a,5);
  }else{
   subject+=glow;
   for(let i=0;i<3;i++)subject+=`<ellipse cx="256" cy="380" rx="${145+i*20}" ry="${55+i*14}" transform="rotate(${i*55+15} 256 380)" fill="none" stroke="${b}" stroke-width="${i===1?2:1}" opacity=".65"/>`;
   if(type==='sword'){
    subject+=path('M256 93L283 370 266 455 246 455 229 370Z','url(#blade)',a,3)+path('M185 452L223 428 256 447 290 428 333 452 309 474 255 463 204 474Z','url(#metal)',a,2)+path('M256 468L256 555','none',b,22)+path('M256 545L276 573 257 597 237 574Z','url(#orb)',a,3);
   }else if(type==='book'){
    subject+=path('M103 231L237 273 270 275 409 223 412 447 282 486 240 486 111 448Z','url(#metal)',a,3)+path('M119 243L250 282 252 463 128 427Z','#c4b593',b,2)+path('M265 282L392 240 395 425 268 463Z','#dfcaaa',b,2);
    for(let i=0;i<8;i++)subject+=path(`M142 ${276+i*18}L230 ${304+i*18}M286 ${305+i*18}L373 ${276+i*18}`,'none',dark,2);
    subject+=`<circle cx="258" cy="341" r="55" fill="url(#halo)"/>`+path('M258 307L279 339 258 370 238 339Z','url(#orb)',a,2);
   }else if(type==='crystal'){
    subject+=path('M253 156L327 299 299 442 253 505 190 421 188 303Z','url(#orb)',a,3)+path('M253 156L253 505M188 303L253 276 327 299M253 276L299 442M253 276L190 421','none',a,2);
    subject+=path('M138 325L170 394 166 472 126 436Z','url(#metal)',a,2)+path('M360 258L397 375 364 423 334 366Z','url(#metal)',a,2);
   }else if(type==='potion'){
    subject+=path('M223 229L292 229 291 299Q386 363 342 451Q268 537 191 457Q133 376 224 299Z','url(#glass)',a,3)+path('M192 376Q239 351 330 375L339 431Q270 504 198 439Z','url(#orb)',b,2)+path('M216 214L299 214 299 245 216 245Z','url(#metal)',a,2);
    for(let i=0;i<9;i++)subject+=`<circle cx="${211+r()*95}" cy="${326+r()*102}" r="${r()*7+3}" fill="${a}" opacity=".6"/>`;
   }else if(type==='meteor'||type==='bolt'){
    subject+=path('M116 461Q188 231 416 102L348 244 417 216 313 353 350 329 236 475Z','url(#fire)',b,2)+path('M153 427L355 204 276 377 212 469Z',a);
    subject+=path('M133 424L183 392 233 417 248 468 213 518 151 520 120 475Z','url(#metal)',a,2)+path('M154 439L180 457 213 436M180 457L167 494M180 457L218 481','none',a,4);
   }else if(type==='banner'){
    subject+=path('M162 129L162 592','none',a,8)+path('M170 158L365 175 353 418 275 463 180 417Z','url(#robe)',a,3)+path('M193 191L336 205 326 396 271 428 204 395Z','none',b,2)+path('M264 236L303 300 272 369 232 299Z','url(#metal)',a,3);
   }else{
    subject+=`<circle cx="256" cy="352" r="95" fill="url(#orb)" opacity=".86" stroke="${a}" stroke-width="2"/><circle cx="256" cy="352" r="131" fill="none" stroke="${a}" stroke-width="2" stroke-dasharray="1 9"/>`;
    subject+=path('M256 210L378 422H134Z','none',a,3)+path('M256 491L135 281H377Z','none',a,2)+path('M256 300L289 353 255 405 222 352Z',a);
   }
  }
  for(let i=0;i<24;i++)detail+=`<circle cx="${60+r()*400}" cy="${100+r()*530}" r="${r()*2.5+.5}" fill="${a}" opacity="${r()*.6+.2}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 680"><defs>
  <linearGradient id="base" x2=".4" y2="1"><stop stop-color="${bg}"/><stop offset=".5" stop-color="${dark}"/><stop offset="1" stop-color="#0c111b"/></linearGradient>
  <radialGradient id="halo"><stop stop-color="${a}" stop-opacity=".66"/><stop offset=".4" stop-color="${b}" stop-opacity=".18"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2=".9"><stop stop-color="${light}"/><stop offset=".16" stop-color="${b}"/><stop offset=".48" stop-color="${dark}"/><stop offset=".72" stop-color="${b}"/><stop offset="1" stop-color="${k}"/></linearGradient>
  <linearGradient id="blade"><stop stop-color="${dark}"/><stop offset=".43" stop-color="${light}"/><stop offset=".5" stop-color="#ecf0df"/><stop offset=".52" stop-color="${b}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="robe" x2="1" y2=".3"><stop stop-color="${k}"/><stop offset=".4" stop-color="${dark}"/><stop offset=".55" stop-color="${b}"/><stop offset=".66" stop-color="${dark}"/><stop offset="1" stop-color="${k}"/></linearGradient>
  <linearGradient id="skin" x2=".8" y2="1"><stop stop-color="#d5c0a5"/><stop offset=".5" stop-color="#7d767b"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="wing" x2=".7" y2="1"><stop stop-color="${dark}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${k}"/></linearGradient>
  <linearGradient id="scales" x2="1" y2=".6"><stop stop-color="${b}"/><stop offset=".35" stop-color="${dark}"/><stop offset=".8" stop-color="${b}"/><stop offset="1" stop-color="${k}"/></linearGradient>
  <linearGradient id="horn" x2="1" y2="1"><stop stop-color="#e2c4a0"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="fur" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".4" stop-color="${b}"/><stop offset=".75" stop-color="${dark}"/><stop offset="1" stop-color="${k}"/></linearGradient>
  <linearGradient id="fire" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="${a}"/><stop offset=".32" stop-color="${b}"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></linearGradient>
  <radialGradient id="orb" cx=".36" cy=".28"><stop stop-color="#fff7dc"/><stop offset=".22" stop-color="${light}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
  <linearGradient id="glass"><stop stop-color="${a}" stop-opacity=".55"/><stop offset=".4" stop-color="${bg}" stop-opacity=".25"/><stop offset="1" stop-color="${b}" stop-opacity=".7"/></linearGradient>
  <linearGradient id="vignette" x2="0" y2="1"><stop stop-color="#080c13" stop-opacity=".1"/><stop offset=".65" stop-color="#080c13" stop-opacity="0"/><stop offset="1" stop-color="#080c13" stop-opacity=".8"/></linearGradient>
  <filter id="texture"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".10"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
  </defs><rect width="512" height="680" fill="url(#base)"/><circle cx="265" cy="223" r="235" fill="url(#halo)"/>${scenery}<g>${subject}</g>${detail}<rect width="512" height="680" fill="url(#vignette)"/><rect width="512" height="680" opacity=".27" filter="url(#texture)"/></svg>`;
 }

 // All illustrations are original vector constructions. The second edition adds
 // engraved surfaces, story-specific silhouettes, rim lighting and environmental depth.
 function engraving(type,palette,seed){
  const [bg,mid,lit,dark]=themes[palette]||themes.ember,r=rng(seed+'engraved'),P=path;
  let out='',back='';
  const isPerson=['knight','mage','archer','rogue','reaper','treant','golem'].includes(type);
  // The celestial wheel gives each portrait its own archeological context.
  back+=`<g fill="none" stroke="${lit}" opacity=".28"><circle cx="256" cy="236" r="148" stroke-width="1.3"/><circle cx="256" cy="236" r="157" stroke-width=".5"/>`;
  for(let i=0;i<32;i++){let t=i*Math.PI/16,rr=i%4?148:138;back+=P(`M${256+Math.cos(t)*rr} ${236+Math.sin(t)*rr}L${256+Math.cos(t)*157} ${236+Math.sin(t)*157}`,'none',lit,i%4?.6:1.6);}
  back+='</g>';
  // Volumetric-looking rays, independently shaped for every illustration.
  for(let i=0;i<5;i++){let x=30+r()*420;back+=`<path d="M${x} -50L${x-100} 650L${x+30} 650Z" fill="url(#light-ray)" opacity="${.06+r()*.08}"/>`;}
  for(let i=0;i<36;i++){let x=25+r()*455,y=35+r()*510,rr=.4+r()*1.5;out+=`<circle cx="${x}" cy="${y}" r="${rr}" fill="${lit}" opacity="${.18+r()*.6}"/>`;if(i%8===0)out+=P(`M${x-5} ${y}h10M${x} ${y-5}v10`,'none',lit,.6);}
  if(type==='knight'){
    // Repeated chased silver lines on breastplate, pauldrons and sword hilt.
    for(let side of [-1,1]){
      out+=`<g transform="translate(256 0) scale(${side} 1)">`;
      for(let i=0;i<7;i++)out+=P(`M${62+i*3} ${359+i*7}q${26+i*3} 11 ${63+i*2} 32`,'none',lit,.65);
      out+=P('M30 447q23 18 18 49q-32 -13 -30 -28q11 6 14 20M49 430q14 2 20 14M23 501q16 3 24 24M41 209q-20 9-18 26','none',lit,1.1);
      for(let i=0;i<5;i++)out+=`<circle cx="${75+i*10}" cy="${386+i*4}" r="2" fill="${lit}" opacity=".7"/>`;
      out+='</g>';
    }
    out+=P('M256 177v30M252 299l4 17 4-17M245 502v26l11 8 11-8v-26','none',lit,1.4);
    if(seed==='warden'||seed==='berserker'){
      for(let i=0;i<5;i++)out+=P(`M${118+i*8} ${365+i*4}L${93+i*10} ${297+i*10}L${142+i*7} ${376+i*4}Z`,'url(#metal)',mid,1.2);
      out+=P('M268 151L276 221 264 238 272 300','none','#ffc387',2.8);
    }
    if(['solaris','paladin','squire'].includes(seed)){
      back+=`<circle cx="256" cy="217" r="174" fill="none" stroke="${lit}" stroke-width="5" opacity=".17"/>`;
      for(let side of [-1,1])for(let i=0;i<8;i++){out+=`<g transform="translate(256 0) scale(${side} 1)">`+P(`M${86+i*9} ${404+i*9}Q${164+i*12} ${310+i*5} ${160+i*12} ${250+i*14}Q${145+i*7} ${316+i*7} ${86+i*9} ${404+i*9}Z`,'url(#light-ray)',mid,.8)+'</g>';}
    }
  }
  if(type==='mage'||type==='archer'||type==='rogue'||type==='reaper'){
    for(let side of [-1,1]){
      out+=`<g transform="translate(256 0) scale(${side} 1)">`;
      out+=P('M78 211q-18 -45 -68 -78M75 213q-15 -29 -53 -51','none',lit,.8);
      for(let i=0;i<11;i++){let y=466+i*16,x=68+i*3;out+=P(`M${x} ${y}q-14 -12 -12 -24q15 11 12 24q18 -6 20 -20q-19 1 -20 20`,'none',lit,.65);}
      out+='</g>';
    }
    if(type==='mage'){
      out+=`<g fill="none" stroke="${lit}"><ellipse cx="263" cy="421" rx="78" ry="23" stroke-width="1.2" transform="rotate(26 263 421)" opacity=".7"/><ellipse cx="263" cy="421" rx="72" ry="19" stroke-width=".7" transform="rotate(-49 263 421)" opacity=".8"/></g>`;
      for(let i=0;i<9;i++){let t=i*Math.PI/4.5;out+=`<path d="M-3 -5h6v10h-6zM-3 0h6" transform="translate(${263+Math.cos(t)*75} ${421+Math.sin(t)*45}) rotate(${i*40})" fill="none" stroke="${lit}" stroke-width=".8"/>`;}
      if(seed==='nyx'||seed==='oracle'){
       back+=P('M132 292L102 198 139 234 122 136 184 213 210 74 236 195 269 32 293 181 330 96 328 206 388 164 356 263Z','url(#metal)',lit,1.5);
       for(let i=0;i<6;i++)out+=P(`M${66+i*67} ${335+i%2*46}l17 -10 8 29 -18 12Z`,dark,lit,.7);
      }
    }
    if(type==='archer')for(let i=0;i<8;i++)out+=P(`M${105+i*5} ${274+i*13}L${76+i*4} ${227+i*10}M${105+i*5} ${274+i*13}L${116+i*3} ${231+i*12}`,'none',lit,1.2);
  }
  if(type==='dragon'){
    // Draw individual lit scale edges with small shadow cores.
    for(let row=0;row<16;row++)for(let col=0;col<7;col++){
      let x=225+col*14+(row%2)*6,y=340+row*18;
      out+=P(`M${x} ${y}q6 -5 13 0l-6 10Z`,dark,mid,.85);
      out+=P(`M${x+2} ${y}q5 -3 9 0`,'none',lit,.45);
    }
    for(let side of [-1,1]){out+=`<g transform="translate(256 0) scale(${side} 1)">`;for(let i=0;i<12;i++){out+=P(`M48 378Q${89+i*7} ${305-i*8} ${174+i*3} ${168+i*10}`,'none',lit,.45);}out+='</g>';}
    for(let i=0;i<11;i++)out+=P(`M${301+i%2*9} ${350+i*21}L${358+i%3*5} ${331+i*23}L${316+i%2*7} ${363+i*21}Z`,'url(#horn)',mid,.6);
    out+=`<ellipse cx="219" cy="239" rx="17" ry="8" fill="url(#halo)"/><path d="M209 240l18 -3 -7 9 -10 -1Z" fill="#fff0ad"/><path d="M218 239v6" stroke="#542c18" stroke-width="2"/>`;
  }
  if(type==='wolf'){
    for(let i=0;i<120;i++){let x=150+r()*190,y=380+r()*220;out+=P(`M${x} ${y}q${(x-255)*.07} 14 ${(x-255)*.13} 23`,'none',lit,.4+r()*.4);}
    out+=P('M196 265l27 -5M294 263l25 -9','none',lit,3);
  }
  if(type==='treant'){
    for(let i=0;i<50;i++){let x=165+r()*185,y=379+r()*260;out+=P(`M${x} ${y}q18 4 4 36t-6 29`,'none',lit,.6);}
    for(let i=0;i<22;i++){let x=87+r()*339,y=135+r()*212;out+=P(`M${x} ${y}q-18 -20 11 -29q18 14 -11 29`,'url(#metal)',lit,.4);}
    if(seed==='queen')back+=P('M157 226L81 121 157 169 174 86 235 163 256 41 292 160 350 95 358 172 431 99 354 248Z','url(#metal)',mid,1.5);
  }
  if(type==='golem'){
    for(let i=0;i<16;i++){let x=160+r()*190,y=352+r()*232;out+=P(`M${x} ${y}l8 -11 7 18 -9 10 10 8`,'none',lit,1.1);}
    out+=P('M246 373l-8 41 13 26 13 -24 9 -36M239 396l31 17','none',lit,2.2);
  }
  if(['orb','sigil','mirror','crystal','book','potion','meteor','bolt','sword','banner'].includes(type)){
    for(let i=0;i<48;i++){let a=i*Math.PI/24,x=256+Math.cos(a)*165,y=350+Math.sin(a)*165;back+=P(`M${x} ${y}l${Math.cos(a)*8} ${Math.sin(a)*8}`,'none',lit,.7);}
    out+=`<ellipse cx="256" cy="351" rx="181" ry="76" fill="none" stroke="${lit}" stroke-width="1" opacity=".38" transform="rotate(-30 256 351)"/>`;
    if(type==='crystal')for(let i=0;i<15;i++){let x=81+r()*350,y=161+r()*328;out+=P(`M${x} ${y}l-5 14 7 12 5 -17Z`,'url(#glass)',lit,.7);}
    if(type==='meteor'||type==='bolt')for(let i=0;i<21;i++){let x=150+r()*270,y=135+r()*340;out+=P(`M${x} ${y}l-${15+r()*25} ${30+r()*50}`,'none',lit,.5+r()*1.5);}
    if(type==='sword')out+=P('M255 250v181m-8 -141 16 13 -16 21 16 15 -16 23 16 15 -15 21','none',lit,1.5);
  }
  return {back,out};
 }
 // Sculptural key art: curved silhouette, chased bronze scales and translucent
 // wing membranes. Unlike the small-card glyphs, this is authored for hero scale.
 function dragonSculpture(palette,seed,transparent){
  const r=rng(seed+'sculpture'),cold=palette==='ice',ink='#101a1e',edge=cold?'#a7c8cc':'#bfa989',mid=cold?'#49616b':'#685546',shine=cold?'#d1eff0':'#ebd2a8';
  let scales='',veins='',spines='',etch='';
  for(let row=0;row<43;row++){const y=350+row*11,cx=338+32*Math.sin((y-340)/132),half=48+17*Math.sin((y-320)/130);for(let col=-7;col<=7;col++){let x=cx+col*12+(row%2?6:0);if(Math.abs(x-cx)>half+12)continue;const w=5+r()*2,h=10+r()*3;scales+=`<path d="M${x-w} ${y} Q${x} ${y-3} ${x+w} ${y} L${x+w*.65} ${y+h*.58} Q${x} ${y+h+2} ${x-w*.65} ${y+h*.58}Z" fill="url(#ds-scale)" stroke="${edge}" stroke-opacity="${.12+r()*.19}" stroke-width=".65"/><path d="M${x-w+1.5} ${y+1.5} Q${x} ${y-.6} ${x+w-1.5} ${y+1.5}" stroke="${shine}" stroke-opacity="${.06+r()*.12}" stroke-width=".6" fill="none"/>`;}}
  for(let i=0;i<13;i++){let y=343+i*28,x=383+24*Math.sin(i/3);spines+=`<path d="M${x-12} ${y+13} Q${x+9} ${y+1} ${x+48-i*.8} ${y-18} Q${x+35} ${y+15} ${x+3} ${y+30}Z" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".43" stroke-width=".8"/>`;}
  const beams=[[[351,448],[447,206],[591,107]],[[351,448],[479,309],[550,246]],[[351,448],[460,362],[508,348]],[[351,448],[443,423],[550,476]],[[351,448],[430,456],[478,570]],[[323,449],[190,299],[92,172]],[[323,449],[194,378],[84,347]],[[323,449],[212,429],[142,465]]];
  beams.forEach((v,i)=>{const [[a,b],[c,d],[e,f]]=v;veins+=`<path d="M${a} ${b} Q${c} ${d} ${e} ${f}" fill="none" stroke="${edge}" stroke-width="${i%3===0?3:1.5}" stroke-opacity=".4"/>`;for(let j=1;j<9;j++){const k=j/10;let x=(1-k)*(1-k)*a+2*k*(1-k)*c+k*k*e,y=(1-k)*(1-k)*b+2*k*(1-k)*d+k*k*f;veins+=`<path d="M${x} ${y} q${i<5?-12:12} -9 ${i<5?-34:34} -${12+j*1.9}" fill="none" stroke="${edge}" stroke-width=".55" stroke-opacity=".14"/>`;}});
  for(let i=0;i<36;i++){const x=240+r()*94,y=243+r()*95;etch+=`<path d="M${x} ${y} l${5+r()*9} ${-3-r()*4}" fill="none" stroke="${edge}" stroke-width=".5" stroke-opacity=".13"/>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 820"><defs>
   <linearGradient id="ds-body" x1="0" y1="0" x2="1" y2=".1"><stop stop-color="#172025"/><stop offset=".3" stop-color="${mid}"/><stop offset=".53" stop-color="#88735d"/><stop offset=".72" stop-color="#463f35"/><stop offset="1" stop-color="${ink}"/></linearGradient>
   <linearGradient id="ds-horn" x1="0" y1="0" x2=".95" y2=".7"><stop stop-color="${edge}"/><stop offset=".22" stop-color="${mid}"/><stop offset=".5" stop-color="#2a2a27"/><stop offset="1" stop-color="#10191d"/></linearGradient>
   <linearGradient id="ds-wing" x1=".15" y1=".9" x2=".7" y2=".1"><stop stop-color="#101a1e"/><stop offset=".32" stop-color="#343b36"/><stop offset=".73" stop-color="${mid}"/><stop offset="1" stop-color="#b09a78" stop-opacity=".65"/></linearGradient>
   <linearGradient id="ds-scale" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${edge}" stop-opacity=".40"/><stop offset=".18" stop-color="${mid}" stop-opacity=".65"/><stop offset=".7" stop-color="#182123" stop-opacity=".65"/><stop offset="1" stop-color="#091417" stop-opacity=".96"/></linearGradient>
   <linearGradient id="ds-face" x1="0" y1=".1" x2=".85" y2=".8"><stop stop-color="${edge}"/><stop offset=".27" stop-color="${mid}"/><stop offset=".59" stop-color="#414038"/><stop offset=".85" stop-color="#162023"/></linearGradient>
   <radialGradient id="ds-halo"><stop stop-color="${mid}" stop-opacity=".5"/><stop offset="1" stop-color="#132029" stop-opacity="0"/></radialGradient>
   <radialGradient id="ds-eye"><stop stop-color="#fff0c0"/><stop offset=".18" stop-color="#dbaf73"/><stop offset="1" stop-color="#c8884200"/></radialGradient>
   <clipPath id="ds-body-clip"><path d="M280 316C303 334 328 352 335 384C347 431 309 462 306 513C301 590 352 641 338 710C329 755 298 790 289 829L428 829C461 764 449 705 422 648C403 608 430 550 422 489C415 413 379 347 334 305Z"/></clipPath>
  </defs>${transparent?'':`<rect width="650" height="820" fill="#152129"/><ellipse cx="332" cy="285" rx="380" ry="340" fill="url(#ds-halo)"/>`}
  <g fill="none" stroke="${edge}" opacity=".15"><circle cx="338" cy="288" r="222" stroke-width=".7"/><circle cx="338" cy="288" r="213" stroke-width=".6"/>${Array.from({length:64},(_,i)=>`<path transform="rotate(${i*5.625} 338 288)" d="M338 66v${i%4?4:10}" stroke-width=".7"/>`).join('')}</g>
  <g stroke-linejoin="round" stroke-linecap="round">
   <path d="M325 453Q229 266 91 170Q126 277 84 347Q148 334 192 363Q137 405 142 465Q221 403 246 464L302 526Z" fill="url(#ds-wing)" stroke="${edge}" stroke-opacity=".45" stroke-width="1.3"/>
   <path d="M349 457Q422 224 592 106Q547 200 550 246Q517 280 508 348Q485 359 550 476Q477 424 451 439Q466 492 478 570Q402 530 349 457Z" fill="url(#ds-wing)" stroke="${edge}" stroke-opacity=".5" stroke-width="1.5"/>${veins}
   <path d="M349 457Q422 224 592 106" fill="none" stroke="${edge}" stroke-width="4.2" stroke-opacity=".55"/>
   <path d="M324 451Q230 264 91 170" fill="none" stroke="${edge}" stroke-width="3.4" stroke-opacity=".43"/>
   ${spines}
   <path d="M280 316C303 334 328 352 335 384C347 431 309 462 306 513C301 590 352 641 338 710C329 755 298 790 289 829L428 829C461 764 449 705 422 648C403 608 430 550 422 489C415 413 379 347 334 305Z" fill="url(#ds-body)" stroke="${edge}" stroke-opacity=".48" stroke-width="1.4"/>
   <g clip-path="url(#ds-body-clip)">${scales}<path d="M312 361Q355 410 326 473T346 644T321 827" fill="none" stroke="#d3b68c" stroke-width="9" stroke-opacity=".06"/></g>
   <path d="M330 353Q382 446 366 514Q350 566 387 668Q413 747 382 824" fill="none" stroke="#091519" stroke-width="9" stroke-opacity=".39"/>
   <path d="M321 246C332 196 374 121 420 68C410 131 367 194 357 265Z" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".48" stroke-width="1.2"/>
   <path d="M286 221C291 176 304 146 336 109C320 166 318 199 320 233Z" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".44" stroke-width="1.1"/>
   <path d="M300 206Q270 221 252 247Q224 259 210 280L170 294Q150 297 150 313L186 330Q229 351 272 346Q308 341 330 324L345 288L337 245Z" fill="url(#ds-face)" stroke="${edge}" stroke-opacity=".53" stroke-width="1.5"/>
   <path d="M168 310Q218 320 255 316Q284 310 301 309Q266 339 242 340L188 328Z" fill="#080f14" stroke="#a18a6859" stroke-width="1"/>
   <path d="M175 314l7 12 5-9m8 3 5 12 7-10m8 1 6 12 6-12m9-1 5 11 8-13m8-2 4 8 6-10" fill="${edge}" stroke="#d7bc94" stroke-width=".35" opacity=".77"/>
   <path d="M202 331Q249 364 291 335L312 319L298 348Q262 373 220 351Z" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".4" stroke-width=".8"/>
   <path d="M223 280Q246 253 276 257L266 270Q245 274 233 285Z" fill="#081417"/>
   <ellipse cx="248" cy="273" rx="26" ry="16" fill="url(#ds-eye)" opacity=".48"/>
   <path d="M233 275Q247 265 261 266Q252 276 240 277Z" fill="#e9d2a2"/><path d="M247 268l-2 7" stroke="#091014" stroke-width="2.2"/>
   <path d="M218 275Q234 252 269 249L303 232" fill="none" stroke="${edge}" stroke-opacity=".65" stroke-width="2.5"/>
   <path d="M152 307l16-6 10 5-15 5Z" fill="#0a1418"/><path d="M159 298Q177 289 195 291" fill="none" stroke="${edge}" stroke-opacity=".58" stroke-width="1.3"/>
   <path d="M279 278l21-21 30 7-20 20-13 36-17 2 11-27Z" fill="url(#ds-scale)" stroke="${edge}" stroke-opacity=".36" stroke-width="1"/>
   <path d="M301 278l28-7m-34 31 30-12m-34 27 24-6M280 235l13-16 19 15M275 248l24-9 11 14" fill="none" stroke="${edge}" stroke-opacity=".23" stroke-width=".8"/>
   ${etch}
   <path d="M320 305Q350 291 390 276Q362 307 336 324L366 327 328 342Z" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".5" stroke-width="1.1"/>
   <path d="M304 352Q300 380 281 396Q315 381 320 365" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".3" stroke-width=".8"/>
   <path d="M319 371Q316 395 297 409Q331 397 332 381" fill="url(#ds-horn)" stroke="${edge}" stroke-opacity=".25" stroke-width=".7"/>
  </g></svg>`;
 }

 function svg(type='mage',palette='ember',seed='default',transparent=false){
  if(type==='dragon')return dragonSculpture(palette,seed,transparent);
  let original=baseSvg(type,palette,seed),[bg,mid,light,dark]=themes[palette]||themes.ember;
  const e=engraving(type,palette,seed);
  const extraDefs=`<linearGradient id="light-ray" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></linearGradient><radialGradient id="portrait-edge"><stop stop-color="#001019" stop-opacity="0"/><stop offset=".7" stop-color="#04121c" stop-opacity="0"/><stop offset="1" stop-color="#04121c" stop-opacity=".5"/></radialGradient>`;
  original=original.replace('</defs>',extraDefs+'</defs>');
  // Avoid costly per-image SVG turbulence: engravings supply deterministic texture.
  original=original.replace(/<rect width="512" height="680" opacity=".27" filter="url\(#texture\)"\/>/g,'');
  if(transparent){
    const defs=original.match(/<defs>[\s\S]*?<\/defs>/)[0],subject=original.match(/<g>([\s\S]*?)<\/g>/)?.[1]||'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 680">${defs}<circle cx="256" cy="340" r="230" fill="url(#halo)" opacity=".4"/>${e.back}<g>${subject}${e.out}</g></svg>`;
  }
  original=original.replace('<g>','<g>'+e.back+'</g><g>');
  return original.replace('</svg>',e.out+'<rect width="512" height="680" fill="url(#portrait-edge)"/></svg>');
 }
 function portrait(type,palette,seed=''){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,palette,seed,true));}

 function url(type,palette,seed=''){const key=type+palette+seed;if(!cache.has(key))cache.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,palette,seed)));return cache.get(key);}
 function card(c){return url(c.art,c.palette,c.id);}
 function icon(name){const p={sword:'M5 3l13 13m-3-1 4-4M3 3l2 7 4-4-6-3Zm13 13 4 4m-6-3 3-3',shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z',heart:'M20 5c-3-3-6-1-8 2C9 2 3 2 2 8c-1 5 10 13 10 13S24 11 22 7l-2-2Z',gem:'m12 2 8 10-8 10-8-10 8-10Zm0 0v20M4 12h16',book:'M12 5C8 2 3 3 2 4v16c3-2 7-1 10 1m0-16c4-3 9-2 10-1v16c-3-2-7-1-10 1V5Z',fire:'M13 2c2 7-6 8-4 14-5-1-3-6-3-6-10 12 16 19 14 4-1-7-6-8-7-12Z',arrow:'M4 12h16m-7-7 7 7-7 7',close:'m6 6 12 12M6 18 18 6',sound:'M4 9v6h4l5 4V5L8 9H4Zm12-2c4 3 4 7 0 10m3-13c6 4 6 12 0 16',mute:'M4 9v6h4l5 4V5L8 9H4Zm12 0 6 6m-6 0 6-6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-6h4l1 4 4 1 3 3v4l-3 3-4 1-1 4h-4l-1-4-4-1-3-3v-4l3-3 4-1 1-4Z',map:'M3 5 9 2l6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17',help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',skull:'M7 16v5h10v-5c9-9 2-14-5-14S-2 7 7 16Zm1-8v3m8-3v3m-4 2v2M9 18v3m6-3v3',pause:'M8 4v16M16 4v16',chevron:'m8 4 8 8-8 8',check:'m4 12 5 5L20 6',refresh:'M20 9A8 8 0 1 0 20 15M20 3v6h-6',full:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name]||p.gem}"/></svg>`;}
 return {url,svg,card,icon,themes,portrait};
})();
