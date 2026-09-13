const { test, expect } = require('@playwright/test');
const path = require('node:path');
const out=path.resolve('output/boss-topdown-20260913');
test('each map boss keeps one scene through resize, awakening and environment preference',async({page})=>{
  await page.goto('./?debug=1');
  await page.waitForFunction(()=>window.Emberfall&&!AtelierWorld.loading);
  await page.locator('#quick-btn').click();
  await page.waitForFunction(()=>Emberfall.inBattle&&!EmberFX.busy);
  const ids=await page.evaluate(()=>EmberData.bosses.map(b=>b.id));
  const sources=new Set();
  for(let i=0;i<ids.length;i++){
    await page.evaluate(i=>{EmberDebug.game.s.bossIndex=i;Emberfall.renderNow();},i);
    const expected='battle_'+ids[i];
    await page.waitForFunction(expected=>AtelierWorld.sceneId===expected&&!AtelierWorld.loading,expected);
    const source=await page.evaluate(()=>EmberTheme.image(AtelierWorld.sceneId).src);
    sources.add(source);
    for(const [width,height] of [[1672,941],[1117,884],[390,844],[844,390]]){
      const state=await page.evaluate(()=>JSON.stringify(EmberDebug.game.s));
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>AtelierWorld.cacheSize[0]===EmberViewport.width&&AtelierWorld.cacheSize[1]===EmberViewport.height&&!AtelierWorld.loading);
      expect(await page.evaluate(()=>AtelierWorld.sceneId)).toBe(expected);
      expect(await page.evaluate(()=>EmberTheme.image(AtelierWorld.sceneId).src)).toBe(source);
      expect(await page.evaluate(()=>JSON.stringify(EmberDebug.game.s))).toBe(state);
      await page.waitForTimeout(150);
      await page.screenshot({path:path.join(out,`${ids[i]}-${width}.png`)});
    }
    await page.evaluate(()=>{EmberDebug.game.s.phase2=true;Emberfall.renderNow();AtelierWorld.setDusk(true);});
    await page.waitForFunction(()=>!AtelierWorld.loading);
    expect(await page.evaluate(()=>AtelierWorld.sceneId)).toBe(expected);
    await page.evaluate(()=>{EmberDebug.game.s.phase2=false;AtelierWorld.setDusk(false);});
  }
  expect(sources.size).toBe(ids.length);
});
test('battle offers optional information without a campaign sidebar',async({page})=>{
 await page.goto('./?debug=1');await page.waitForFunction(()=>window.Emberfall&&!AtelierWorld.loading);
 await page.locator('#quick-btn').click();await page.waitForFunction(()=>Emberfall.inBattle&&!EmberFX.busy);
 await expect(page.locator('.campaign-panel,#path-list,.board-props')).toHaveCount(0);
 for(const [id,panel] of [['intel-toggle','.boss-panel'],['log-toggle','.log-panel']]){
  await expect(page.locator(panel)).toBeHidden();
  await page.locator('#'+id).click();await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator('#'+id)).toHaveAttribute('aria-expanded','true');
  await page.locator('#'+id).click();await expect(page.locator(panel)).toBeHidden();
 }
 for(const id of ['end-turn','power-btn','contract-open']) await page.locator('#'+id).click({trial:true});
});
