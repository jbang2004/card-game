/* VII: visual material bindings and non-destructive daylight choice.
 * No card definitions, gameplay probabilities or saved battle data are changed. */
(()=>{
 'use strict';
 const E=Emberfall,$=s=>document.querySelector(s),root=document.documentElement.style;
 document.title='烬域 · 风起之境 — WIND BORNE v0.7';
 root.setProperty('--wind-paper-texture',`url("${WindborneAssets.paper}")`);
 root.setProperty('--wind-leaf-seal',`url("${WindborneAssets['leaf-seal']}")`);
 root.setProperty('--parchment-texture',`url("${WindborneAssets.paper}")`);
 root.setProperty('--wood-texture',`url("${WindborneAssets.wood}")`);
 $('.lobby-copy>.eyebrow').textContent='A LITTLE WORLD · A GREAT ADVENTURE';
 $('.lobby-chinese').textContent='风起之境';
 $('.lobby-tagline').textContent='风吹过山谷，好故事正要开始。';
 $('.lobby-desc').textContent='三位旅人 · 四十八张卡牌 · 五段首领冒险';
 $('.lobby-world-label').innerHTML='<span>THE WAYFARER’S TAVERN</span><i></i><span>旅人的酒馆 · 炉火正暖</span>';
 $('.lobby-bottom small').textContent='VOL. VII / WIND BORNE';
 $('.lobby-collection>.section-label').textContent='收集故事，踏上旅途';
 // The actual existing character assets are unchanged, selected for the lighter hub.
 $('#lobby-card-one').innerHTML=E.cardHTML(EmberData.byId.huntress);
 $('#lobby-card-two').innerHTML=E.cardHTML(EmberData.byId.phoenix);
 $('#atelier-open').innerHTML='漫游四境<small>THE ILLUSTRATED WORLD</small>';
 $('.board-empty').textContent='故事的下一笔，由你来写';
 const metadata={
   chimney:{name:'旅人的酒馆',hint:'屋檐上的猫正打着盹，窗内炉火正暖',box:{left:'12px',top:'58px',width:'440px',height:'217px'}},
   crystals:{name:'星辉观测台',hint:'轻拨星环，让远方的星光落在掌心',box:{left:'1270px',top:'63px',width:'310px',height:'211px'}},
   tree:{name:'蓝晶矿脉',hint:'敲响蓝晶，听见山谷深处的回声',box:{left:'18px',top:'510px',width:'277px',height:'232px'}},
   forge:{name:'余烬锻炉',hint:'叩一叩铁砧，旅人的新剑就快做好了',box:{left:'1320px',top:'607px',width:'252px',height:'222px'}}
 };
 for(const b of document.querySelectorAll('[data-prop]')){const a=metadata[b.dataset.prop];b.title=a.name;b.setAttribute('aria-label',a.hint);Object.assign(b.style,a.box);}
 const button=document.createElement('button');button.id='wind-time';button.type='button';button.setAttribute('aria-label','切换晴昼与暮色环境');button.title='仅改变环境光，不影响对局';
 $('.top-actions').prepend(button);
 const key='emberfall.world.v1';
 let isDusk=false;try{isDusk=JSON.parse(localStorage.getItem(key))?.dusk===true;}catch{}
 const sun='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>';
 const moon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/></svg>';
 function sync(){button.innerHTML=(AtelierWorld.dusk?moon:sun)+(AtelierWorld.dusk?'暮色':'晴昼');button.setAttribute('aria-pressed',String(AtelierWorld.dusk));
  document.querySelectorAll('.wind-time-setting').forEach(b=>{b.textContent=AtelierWorld.dusk?'暮色 · 切换晴昼':'晴昼 · 切换暮色';b.setAttribute('aria-pressed',String(AtelierWorld.dusk));});}
 function toggle(){AtelierWorld.setDusk(!AtelierWorld.dusk);try{localStorage.setItem(key,JSON.stringify({dusk:AtelierWorld.dusk}));}catch{}
  EmberFX.configure(E.settings.reduced,E.settings.low);sync();}
 button.onclick=toggle;AtelierWorld.setDusk(isDusk);sync();
 // A native-size alternative to the toolbar toggle is available in mobile settings.
 function enhanceSettings(){const box=$('#modal .settings-box');if(!box||box.querySelector('.wind-light-row'))return;
  const row=document.createElement('div');row.className='setting-row wind-light-row';
  row.innerHTML='<div><h3>山谷时光</h3><p>晴昼或暮色，仅改变环境氛围</p></div><button type="button" class="wind-time-setting" aria-label="切换环境时光"></button>';
  box.insertBefore(row,box.querySelector('.modal-footer'));row.querySelector('button').onclick=toggle;sync();}
 new MutationObserver(enhanceSettings).observe(document.getElementById('modal'),{childList:true});
 Object.assign(window.AtelierDiagnostics,{version:'0.7.0',worldAssets:9,paintedBuildings:4,theme:'hand-painted anime village / matte travel journal'});
 if(window.PocketDiagnostics)PocketDiagnostics.version='0.7.0';
 window.WindborneDiagnostics=Object.freeze({version:'0.7.0',worldAssets:9,buildings:4,cardAssetsUnchanged:56,mechanics:'unchanged from v0.6',source:'approved-village concept extraction, authored surface and live UI',new3DMeshes:false});
 E.toggleWorldTime=toggle;
})();
