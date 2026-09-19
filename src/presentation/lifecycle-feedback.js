/* Read-only old-art overlays for metamorphosis and overdraw. The original
 * card and all rule values stay intact. Ghosts are ignored by input and AT. */
const EmberLifecycleFeedback=(()=>{
 function create(){
  const ghosts=new Map();
  function clear(){for(const n of ghosts.values())n.remove();ghosts.clear();}
  function frame(instances,now){
   const used=new Set();
   for(const d of instances){
    if(!['morph','overdraw'].includes(d.kind))continue;
    const q=(now-d.impact)/1000/d.scale,limit=d.kind==='morph'?.63:.70;
    const cid=d.kind==='morph'?d.previousCid:(d.targetRef?.side==='p'?d.sourceCid:null);
    const card=cid&&EmberData.byId[cid];if(!card||q<0||q>=limit)continue;
    used.add(d.id);let n=ghosts.get(d.id);
    if(!n){n=document.createElement('img');n.className='lifecycle-art-ghost';n.alt='';n.setAttribute('aria-hidden','true');n.draggable=false;n.src=EmberArt.card(card);document.getElementById('app').append(n);ghosts.set(d.id,n);}
    const u=Math.min(1,Math.max(0,(q-.10)/(limit-.10))),b=d.to;
    n.style.left=(b.x-b.w*.50)+'px';n.style.top=(b.y-b.h*.50)+'px';n.style.width=b.w+'px';n.style.height=b.h+'px';
    n.style.objectPosition=d.artPosition||'50% 28%';
    n.style.clipPath=`inset(${(u*100).toFixed(3)}% 1% ${d.kind==='morph'?11:0}% 1% round 6px)`;
    n.style.opacity=String(d.kind==='morph'?1:1-u*.4);
   }
   for(const [id,n]of ghosts)if(!used.has(id)){n.remove();ghosts.delete(id);}
  }
  return{frame,clear,get active(){return ghosts.size;}};
 }
 return Object.freeze({create});
})();
