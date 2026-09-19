/* R9 original deterministic cue bank. Reuses the existing mixer and absolute clock. */
(function(G){'use strict';
const Arts=G.EmberRemasterArts||(typeof require==='function'?require('./remaster-arts.js'):null);
function events(d){if(!Arts.supports(d.kind)||d.visualOnly||d.silent)return[];
 const flight=Arts.DEFINITIONS[d.kind].flight*1000*d.scale;
 return[{id:'charge',at:d.start},{id:'launch',at:Math.max(d.start,d.impact-flight)},{id:'impact',at:d.impact},{id:'tail',at:d.impact+130*d.scale}]
  .filter(e=>e.id==='charge'||e.id==='launch'?d.audioPrimary!==false:
   !['shield','armor'].includes(d.outcome?.kind)&&(e.id==='impact'||d.audioPrimary!==false))
  .map(e=>({...e,gain:([0,.75,.9,1][d.tier]||1)*(['impact','tail'].includes(e.id)?d.audioGain??1:1)}));}
function recipe(kind,cue){const ls=[],tone=(dur,f0,f1,vol,at=0)=>ls.push({at,dur,f0,f1,vol,kind:'sine'}),noise=(dur,f0,f1,vol,at=0,high=false)=>ls.push({at,dur,f0,f1,vol,kind:high?'hiss':'noise'});
 const physical=['arrow','spear','claw','slam','bladeCross','contact'].includes(kind),soft=['heal','ward','buff','summon','holy','nature','arcane','demise','soulbind'].includes(kind);
 if(cue==='charge'){if(physical){tone(.14,kind==='slam'?75:210,kind==='slam'?58:320,.05);noise(.10,400,1100,.055);}else{tone(.20,soft?523:196,soft?660:250,.065);noise(.16,1300,3400,.035);}}
 if(cue==='launch'){if(kind==='arrow'||kind==='spear'){tone(.07,760,230,.19);noise(.13,7100,2200,.16,0,true);}else if(kind==='claw'){noise(.10,6800,1600,.22,0,true);noise(.06,5900,1900,.08,.020,true);}else if(kind==='slam'){noise(.13,2200,250,.20);tone(.13,165,65,.16);}else{noise(.14,4200,1200,soft?.055:.18);tone(.15,soft?880:420,soft?1046:185,.08);}}
 if(cue==='impact'){
  if(kind==='arrow'||kind==='spear'){noise(.048,4800,750,.40);tone(.13,200,55,.27);noise(.08,6200,1300,.09,.025);}
  else if(kind==='claw'){noise(.085,6800,700,.28,0,true);noise(.040,5400,2000,.14,.021,true);tone(.1,145,68,.18);}
  else if(kind==='slam'){tone(.28,82,30,.48);noise(.12,1800,140,.40);noise(.075,6500,1700,.12,.028);}
  else if(kind==='frost'||kind==='frost-field'){[1360,2130,3180].forEach((f,i)=>tone(.25-i*.04,f,f*.94,.10/(1+i*.2),i*.010));noise(.09,8200,2700,.27,0,true);}
  else if(soft){[523,784,1046].forEach((f,i)=>tone(.29,f,f*1.004,.095/(1+i*.4),i*.017));noise(.16,3500,1500,.038,0,true);}
  else{tone(.25,kind==='fireball'?102:138,35,.32);noise(.17,4400,260,.28);}
 }
 if(cue==='tail'){if(physical){noise(.18,4800,600,.06);if(kind==='slam')noise(.24,1400,200,.07,.03);}else if(soft){tone(.38,1568,1520,.045);tone(.29,2092,2050,.025,.055);}else{noise(.32,3000,420,.07,0,true);if(kind.includes('frost'))[.0,.07,.15].forEach((t,i)=>tone(.13,2700+i*520,2630+i*480,.03,t));}}
 return ls;
}
function pcm(kind,cue,rate=44100){const ls=recipe(kind,cue),n=Math.ceil((Math.max(.01,...ls.map(l=>l.at+l.dur))+.02)*rate),data=new Float32Array(n);
 let seed=5911+kind.length*431+cue.length*59;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1;};
 for(const l of ls){let phase=0,lp=0,start=Math.round(l.at*rate),len=Math.round(l.dur*rate);for(let i=0;i<len;i++){const u=i/(len||1),f=l.f0*(l.f1/l.f0)**u;let x;if(l.kind==='sine'){phase+=Math.PI*2*f/rate;x=Math.sin(phase);}else{let raw=rnd(),a=1-Math.exp(-2*Math.PI*f/rate);lp+=a*(raw-lp);x=l.kind==='hiss'?raw-lp:lp;}data[start+i]+=x*l.vol*Math.min(1,i/(rate*.003))*(1-u)**2;}}
 for(let i=0;i<n;i++)data[i]=Math.tanh(data[i]*1.15)*.82;return data;
}
const api=Object.freeze({events,recipe,pcm});G.EmberRemasterCues=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
