/* v0.6: complete, strict anime artwork routing.
 * Every one of the 56 card IDs has its own asset; never silently use legacy
 * vector artwork for a card. Heroes/Bosses reuse explicitly documented panels.
 * The fallback below is ONLY for non-card relic/icon illustrations.
 */
const AtelierArt=(()=>{
 'use strict';
 const oldUrl=EmberArt.url;
 const exact=Object.freeze(Object.fromEntries(EmberData.cards.map(c=>[c.id,c.id])));
 const aliases=Object.freeze({mage:'oracle',ranger:'archer',warden:'berserker',queen:'treant',frost:'frostking',worldender:'ashdragon'});
 const heroPanels=Object.freeze({mage:'oracle',paladin:'paladin',ranger:'archer'});
 const bossPanels=Object.freeze({warden:'berserker',queen:'treant',oracle:'necromancer',frost:'frostking',dragon:'ashdragon'});
 const focuses=Object.freeze({
  spark:12,squire:14,wolf:20,archer:21,guard:21,oracle:24,wisp:27,
  spider:14,sentinel:29,assassin:17,cleric:21,berserker:24,golem:13,leech:25,
  treant:26,phoenix:26,rider:19,necromancer:17,paladin:12,titan:16,huntress:22,
  dragon:23,reaper:23,colossus:16,solaris:28,nyx:19,ashdragon:20,frostking:24,
  bolt:15,frostbolt:17,fireball:20,nova:51,storm:52,wisdom:49,blessing:32,
  renew:27,execute:30,silence:46,rally:24,wolves:42,shield:26,lifedrain:37,
  dagger:42,sunblade:41,polymorph:52,discovery:24,ambush:31,battlecry:44,coin:56,
  pup:40,spiritwolf:33,skeleton:29,stone:19,sheep:45,recruit:25,thorn:37
 });
 function mapFor(type,palette,seed=''){
  if(seed==='oracle'&&palette==='void')return 'necromancer';
  if(seed==='dragon'&&palette==='blood')return 'ashdragon';
  if(aliases[seed])return aliases[seed];
  return exact[seed]||null;
 }
 function card(c){
  if(!c?.id||!AnimeAssets[c.id])throw new Error('Missing anime artwork for card: '+(c?.id||'<unknown>'));
  return AnimeAssets[c.id];
 }
 function url(type,palette,seed=''){
  const id=mapFor(type,palette,seed);
  return id?AnimeAssets[id]:oldUrl(type,palette,seed);
 }
 // Focal data belongs to artwork, not to a specific old sheet or DOM layout.
 // A small overscan avoids seams; no artificial blurred padding or stretching.
 function framing(key,context='card'){
  const pos=focuses[key]??25;
  return {pos:`50% ${context==='card'||context==='option'?pos:Math.max(12,pos-3)}%`,
   scale:context==='card'?1.025:context==='option'?1.015:1.04};
 }
 function frameHero(h,context='hero'){return framing(mapFor(h.art,h.palette,h.id),context);}
 const missing=EmberData.cards.filter(c=>!AnimeAssets[c.id]);
 if(missing.length)throw new Error('Incomplete artwork release: '+missing.map(c=>c.id).join(', '));
 EmberArt.url=url;EmberArt.card=card;EmberArt.portrait=url;
 const root=document.documentElement.style;
 for(const key of ['minion','spell','nature','legendary','weapon','hero'])root.setProperty('--atelier-frame-'+key,`url("${AtelierAssets['frame-'+key]}")`);
 return Object.freeze({url,card,exact,mapFor,framing,frameHero,heroPanels,bossPanels,focuses,
  get paintedCards(){return EmberData.cards.filter(c=>!!AnimeAssets[c.id]);},get cardFallbackCount(){return 0;}});
})();
