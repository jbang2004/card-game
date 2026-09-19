/* R7 deterministic procedural cue bank. Shared by live mixer and video export.
 * No recordings, web requests, or rule-side effects. Samples are generated once
 * per style/cue/sample-rate, then owned and disposed by the existing audio mixer.
 */
(function(G){
"use strict";
const keys=["judgment","night","frost"],clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function events(d){
 if(!keys.includes(d.swordStyle))return [];
 const flight={judgment:125,night:95,frost:140}[d.swordStyle]*d.scale;
 return [
  {id:"charge",at:d.start},
  {id:"launch",at:Math.max(d.start,d.impact-flight)},
  {id:"impact",at:d.impact},
  {id:"tail",at:d.impact+({judgment:180,night:85,frost:110}[d.swordStyle])*d.scale}
 ];
}
function recipe(style,cue){
 const layers=[],tone=(at,dur,f0,f1,vol,kind="sine")=>layers.push({at,dur,f0,f1,vol,kind}),
 noise=(at,dur,cut0,cut1,vol,high=false)=>layers.push({at,dur,f0:cut0,f1:cut1,vol,kind:high?"hiss":"noise"});
 if(style==="judgment"){
  if(cue==="charge"){tone(0,.23,392,440,.13);tone(.018,.25,588,660,.075);tone(.032,.24,784,880,.045);}
  if(cue==="launch"){noise(0,.125,800,5500,.32);tone(0,.12,420,115,.13);}
  if(cue==="impact"){tone(0,.28,110,38,.45);noise(0,.075,7200,800,.47);tone(.007,.36,784,740,.19);tone(.022,.38,1176,1110,.08);}
  if(cue==="tail"){tone(0,.44,1568,1510,.06);tone(.08,.34,2092,2010,.04);noise(.02,.24,3700,900,.045,true);}
 }else if(style==="night"){
  if(cue==="charge"){noise(0,.11,1100,420,.045);tone(0,.12,98,82,.08);}
  if(cue==="launch"){noise(0,.09,7200,3500,.23,true);tone(0,.08,2300,700,.08);}
  if(cue==="impact"){noise(0,.05,8800,850,.35);tone(0,.13,165,57,.31);tone(.012,.10,1120,280,.09);}
  if(cue==="tail")noise(0,.16,3100,450,.05);
 }else if(style==="frost"){
  if(cue==="charge"){tone(0,.28,1100,1400,.085);tone(.035,.26,1650,1950,.042);noise(0,.21,7200,9200,.05,true);}
  if(cue==="launch"){noise(0,.14,8400,3400,.18,true);tone(0,.16,1800,310,.11);}
  if(cue==="impact"){tone(0,.20,138,42,.35);noise(0,.10,9200,2200,.38,true);[1320,1980,2640,3520].forEach((f,i)=>tone(i*.012,.29-i*.021,f,f*.96,.13/(1+i*.35)));}
  if(cue==="tail"){[.0,.075,.14,.23].forEach((at,i)=>{tone(at,.16,2800+i*390,2660+i*390,.045);noise(at,.035,9300,4500,.07,true);});noise(.06,.36,4200,1200,.045,true);}
 }
 return layers;
}
function pcm(style,cue,rate=44100){
 const layers=recipe(style,cue),duration=Math.max(.01,...layers.map(l=>l.at+l.dur))+.025;
 const data=new Float32Array(Math.ceil(duration*rate));let state=6721+style.length*137+cue.length*29;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return (state>>>0)/4294967296*2-1;};
 for(const l of layers){
  let phase=0,lp=0;const begin=Math.round(l.at*rate),len=Math.round(l.dur*rate);
  for(let i=0;i<len;i++){
   const u=i/Math.max(1,len-1),t=i/rate,f=l.f0*(l.f1/l.f0)**u;
   let x;if(l.kind==="noise"||l.kind==="hiss"){const n=random(),a=1-Math.exp(-2*Math.PI*f/rate);lp+=a*(n-lp);x=l.kind==="hiss"?n-lp:lp;}
   else{phase+=2*Math.PI*f/rate;x=l.kind==="triangle"?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase);}
   const attack=Math.min(1,t/.004),env=attack*(1-u)**2;
   data[begin+i]+=x*l.vol*env;
  }
 }
 for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]*1.15)*.82;
 return data;
}
function timeline(d,rate=44100,speed=1){
 const total=(d.impact-d.start+d.tail)/1000/speed+.5,out=new Float32Array(Math.ceil(total*rate));
 for(const e of events(d)){
  const src=pcm(d.swordStyle,e.id,rate),offset=Math.round((e.at-d.start)/1000/speed*rate);
  for(let i=0;i<src.length&&i+offset<out.length;i++)if(i+offset>=0)out[i+offset]+=src[i]*.65;
 }
 return out;
}
const api=Object.freeze({events,recipe,pcm,timeline});G.EmberBenchmarkCues=api;
if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
