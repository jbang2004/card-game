'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),D=require('../src/data.js');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/anime/manifest.json'),'utf8'));
let fallbackCalls=0;
const ctx=vm.createContext({EmberData:D,EmberArt:{url(){fallbackCalls++;return 'legacy:non-card';}},document:{documentElement:{style:{setProperty(){}}}}});
for(const name of ['anime-assets.js','atelier-assets.js','atelier-art.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',name),'utf8'),ctx);
const evalJS=code=>vm.runInContext(code,ctx);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('56 manifest entries exactly equal 48 collectible + 8 token IDs',()=>{
 assert.equal(manifest.cards,56);assert.equal(D.cards.filter(c=>!c.token).length,48);assert.equal(D.cards.filter(c=>c.token).length,8);
 assert.deepEqual(Object.keys(manifest.items).sort(),D.cards.map(c=>c.id).sort());
});
test('Every output is distinct and matches its recorded file hash',()=>{
 const hashes=new Set();for(const [id,m] of Object.entries(manifest.items)){
  const blob=fs.readFileSync(path.join(root,'assets/anime',m.file));assert.equal(sha(blob),m.sha256);hashes.add(m.sha256);assert.deepEqual(m.outputSize,[336,448]);
 }assert.equal(hashes.size,56);
});
test('Source provenance points to all eight actual approved atlases',()=>{
 const atlases=new Set();for(const m of Object.values(manifest.items)){
  const file=path.join(root,'assets/anime',m.source);assert.equal(sha(fs.readFileSync(file)),m.sourceSHA256);atlases.add(m.source);
  assert.ok(m.cropNativeSize[0]>=336&&m.cropNativeSize[1]>=448);
 }assert.equal(atlases.size,8);
});
test('All 56 card routes resolve directly to their own embedded anime image',()=>{
 fallbackCalls=0;assert.ok(evalJS('EmberData.cards.every(c=>EmberArt.card(c)===AnimeAssets[c.id])'));
 assert.equal(evalJS('new Set(EmberData.cards.map(c=>EmberArt.card(c))).size'),56);assert.equal(fallbackCalls,0);
});
test('Missing future card art fails visibly rather than reverting to old vectors',()=>{
 assert.throws(()=>evalJS("EmberArt.card({id:'unprovided-card'})"),/Missing anime artwork/);assert.equal(fallbackCalls,0);
});
test('Colliding Boss/card IDs are routed by palette, never changing card imagery',()=>{
 assert.ok(evalJS("EmberArt.url('mage','void','oracle')===AnimeAssets.necromancer"));
 assert.ok(evalJS("EmberArt.card(EmberData.byId.oracle)===AnimeAssets.oracle"));
 assert.ok(evalJS("EmberArt.url('dragon','blood','dragon')===AnimeAssets.ashdragon"));
 assert.ok(evalJS("EmberArt.card(EmberData.byId.dragon)===AnimeAssets.dragon"));
});
test('Three heroes and five Bosses use documented new panels without a legacy fallback',()=>{
 fallbackCalls=0;assert.ok(evalJS('[...EmberData.heroes,...EmberData.bosses].every(h=>Object.values(AnimeAssets).includes(EmberArt.url(h.art,h.palette,h.id)))'));assert.equal(fallbackCalls,0);
});
test('No obsolete portrait-* entries remain in the environmental runtime cache',()=>{
 assert.equal(evalJS("Object.keys(AtelierAssets).filter(k=>k.startsWith('portrait-')).length"),0);
 assert.equal(evalJS('AtelierArt.paintedCards.length'),56);
});
test('All focal calibrations are valid and bounded to small non-distorting overscan',()=>{
 for(const c of D.cards)for(const mode of ['card','minion','hero','option']){
  const f=evalJS(`AtelierArt.framing('${c.id}','${mode}')`);assert.ok(/^50% \d+%$/.test(f.pos));assert.ok(f.scale>=1&&f.scale<=1.04);
 }
});
test('Rules and card data retain the original v0.5 hashes',()=>{
 const base=JSON.parse(fs.readFileSync(path.join(root,'assets/anime/base-rules.json'),'utf8'));
 for(const [name,hash]of Object.entries(base))assert.equal(sha(fs.readFileSync(path.join(root,'src',name))),hash);
});
