/* R9: DOM articulation sampled by the same host frame as mesh VFX.
 * Owns only inline transform/filter; layout translate, damage and state stay with
 * the existing director. No puppet/model replacement and no permanent frost state.
 */
const EmberRemasterFeedback=(()=>{
 "use strict";
 function create(){
  const owned=new Map(),audioSeen=new Set();let enabled=true;
  function element(ref){
   if(!ref)return null;
   return ref.uid==="hero"?document.querySelector(ref.side==="p"?"#player-hero .hero-card-inner":"#enemy-hero .hero-card-inner"):
     document.querySelector(`#battle .minion[data-uid="${CSS.escape(String(ref.uid))}"][data-side="${ref.side}"]`);
  }
  function release(el,o){if(el?.isConnected){el.style.transform=o.transform;el.style.filter=o.filter;}owned.delete(el);}
  function clear(){for(const [el,o] of owned)release(el,o);audioSeen.clear();lastNow=null;}
  function sound(d,e,options={}){
   if(!enabled||document.hidden||typeof EmberAudio==="undefined")return false;
   const key=d.id+":"+e.id;if(audioSeen.has(key))return false;
   const ok=EmberAudio.fx("remaster-"+d.kind+"-"+e.id,{
    gain:1,pan:(d.to.x/(typeof EmberViewport!=="undefined"?EmberViewport.width:1600)-.5)*.8,...options});
   if(ok)audioSeen.add(key);return ok;
  }
  function schedule(d){
   if(!EmberRemasterArts.supports(d.kind))return;
   const now=performance.now();
   for(const e of EmberRemasterCues.events(d)){
    if(now-e.at<=160)sound(d,e,{atMs:e.at});
   }
  }
  function play(d,prev,next){
   for(const e of EmberRemasterCues.events(d))
    if(e.at>prev&&e.at<=next&&next-e.at<180)sound(d,e);
  }
  let lastNow=null;
  function frame(instances,now,manual=false){
   const used=new Set(),values=new Map(),sources=new Set();
   for(const d of instances){
    if(!EmberRemasterArts.supports(d.kind)||d.visualOnly)continue;
    const t=(now-d.start)/1000,p=EmberRemasterArts.reaction(d,t);
    for(const [ref,pose,light] of [[d.sourceRef,p.source,p.sourceLight],[d.targetRef,p.target,p.targetLight]]){
     if(ref===d.sourceRef){const key=(d.groupId||d.id)+":"+ref?.side+ref?.uid;if(sources.has(key))continue;sources.add(key);}
     const el=element(ref);if(!el)continue;used.add(el);
     const v=values.get(el)||{x:0,y:0,angle:0,light:0,target:false};
     v.target ||= ref===d.targetRef;v.x+=pose[0];v.y+=pose[1];v.angle+=pose[2];v.light=Math.max(v.light,light);values.set(el,v);
    }
    if(!manual)schedule(d);
   }
   for(const [el,o] of owned)if(!used.has(el))release(el,o);
   for(const [el,v] of values){
    if(!owned.has(el))owned.set(el,{transform:el.style.transform,filter:el.style.filter});
    const o=owned.get(el),len=Math.hypot(v.x,v.y),max=v.target?14:18;
    if(len>max){v.x*=max/len;v.y*=max/len;}v.angle=Math.max(-3.4,Math.min(3.4,v.angle));
    el.style.transform=`${o.transform||""} translate(${v.x.toFixed(3)}px,${v.y.toFixed(3)}px) rotate(${v.angle.toFixed(3)}deg)`;
    el.style.filter=`${o.filter&&o.filter!=="none"?o.filter:""} brightness(${(1+v.light).toFixed(3)})`;
   }
   lastNow=manual?null:now;
  }
  return {frame,clear,play,schedule,resetAudio(){audioSeen.clear();lastNow=null;},setEnabled(v){enabled=!!v;},get active(){return owned.size;}};
 }
 return Object.freeze({create});
})();
