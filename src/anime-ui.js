/* Non-destructive art inspection; no game rules or save changes. */
(()=>{
 'use strict';
 const E=Emberfall,D=EmberData;
 document.title='烬域 · 动漫秘境 — ANIME ATELIER v0.6';
 document.querySelector('.lobby-copy>.eyebrow').textContent='EMBERFALL · ANIME ATELIER';
 document.querySelector('.lobby-chinese').textContent='动漫秘境';
 document.querySelector('.lobby-tagline').textContent='让每一张卡牌，成为一段新的冒险。';
 document.querySelector('.lobby-bottom small').textContent='VOL. VI / ANIME ATELIER';
 // Keep diagnostics current without displaying developer UI on the board.
 Object.assign(window.AtelierDiagnostics,{version:'0.6.0',paintedCards:56,animeSourceAtlases:8,legacyCardFallbacks:0});
 if(window.PocketDiagnostics)PocketDiagnostics.version='0.6.0';
 const modal=document.getElementById('modal');
 let viewer=null,previousFocus=null;
 function close(){if(!viewer)return;viewer.remove();viewer=null;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
 function open(id){
  if(viewer||!AnimeAssets[id])return;
  previousFocus=document.activeElement;
  viewer=document.createElement('div');viewer.className='anime-viewer';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label',D.byId[id].name+'原画');
  const image=new Image();image.src=AnimeAssets[id];image.alt=D.byId[id].name;image.draggable=false;
  const caption=document.createElement('p');caption.textContent=D.byId[id].name;
  const note=document.createElement('small');note.textContent='完整原画 · 查看不改变对局';
  const button=document.createElement('button');button.textContent='×';button.setAttribute('aria-label','关闭原画');button.onclick=close;
  viewer.append(image,caption,note,button);document.body.append(viewer);button.focus();
 }
 function enhance(){
  const sheet=modal.querySelector('.touch-card-sheet,.touch-inline-detail');
  const card=sheet?.querySelector('[data-card-key]');
  const detail=sheet?.querySelector('.touch-inspect-detail');
  if(!card||!detail||detail.querySelector('.anime-art-button'))return;
  const button=document.createElement('button');button.className='anime-art-button';button.type='button';button.textContent='查看完整原画';
  button.onclick=()=>open(card.dataset.cardKey);detail.append(button);
 }
 new MutationObserver(enhance).observe(modal,{childList:true,subtree:true});
 document.addEventListener('keydown',ev=>{if(!viewer)return;if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();close();}else if(ev.key==='Tab'){ev.preventDefault();viewer.querySelector('button').focus();}},true);
 window.addEventListener('ember:viewport',close);
 E.showFullArt=open;
 window.AnimeDiagnostics=Object.freeze({version:'0.6.0',cardImages:56,collectible:48,tokens:8,sourceAtlases:8,
  legacyCardFallbacks:0,heroPanels:AtelierArt.heroPanels,bossPanels:AtelierArt.bossPanels,
  source:'eight approved anime atlas sheets; caption-free individual panel assets',nativePanelOutput:'336×448',publicDeployment:'not configured'});
})();
