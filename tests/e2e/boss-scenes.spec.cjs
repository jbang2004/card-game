const { test, expect } = require('@playwright/test');
test('every map boss fights on the live arena, which follows the layout through resize and awakening',async({page})=>{
  await page.goto('./?debug=1');
  await page.waitForFunction(()=>window.Emberfall&&!AtelierWorld.loading);
  await page.locator('#quick-btn').click();
  await page.waitForFunction(()=>Emberfall.inBattle&&!EmberFX.busy);
  await page.waitForFunction(()=>EmberArena3D.active&&EmberArena3D.ready,null,{timeout:20000});
  const ids=await page.evaluate(()=>EmberData.bosses.map(b=>b.id));
  for(let i=0;i<ids.length;i++){
    await page.evaluate(i=>{EmberDebug.game.s.bossIndex=i;Emberfall.renderNow();},i);
    expect(await page.evaluate(()=>EmberArena3D.encounter)).toBe(ids[i]);
    expect(await page.evaluate(()=>EmberArena3D.sceneId)).toBe('lava-forge');
  }
  for(const [width,height] of [[1672,941],[1117,884],[390,844],[844,390]]){
    const state=await page.evaluate(()=>JSON.stringify(EmberDebug.game.s));
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>AtelierWorld.cacheSize[0]===EmberViewport.width&&AtelierWorld.cacheSize[1]===EmberViewport.height);
    await page.waitForTimeout(200);
    const board=await page.evaluate(()=>EmberArena3D.board);
    expect(board.width).toBe(await page.evaluate(()=>EmberViewport.width));
    expect(board.height).toBe(await page.evaluate(()=>EmberViewport.height));
    expect(board.hz).toBeGreaterThan(200);
    expect(await page.evaluate(()=>{const c=document.getElementById('arena-gl');return getComputedStyle(c).display;})).toBe('block');
    expect(await page.evaluate(()=>JSON.stringify(EmberDebug.game.s))).toBe(state);
  }
  await page.evaluate(()=>{EmberDebug.game.s.phase2=true;Emberfall.renderNow();AtelierWorld.setDusk(true);});
  expect(await page.evaluate(()=>EmberArena3D.active)).toBe(true);
  await page.evaluate(()=>{EmberDebug.game.s.phase2=false;AtelierWorld.setDusk(false);Emberfall.home();});
  await page.waitForFunction(()=>!Emberfall.inBattle);
  expect(await page.evaluate(()=>EmberArena3D.active)).toBe(false);
  expect(await page.evaluate(()=>getComputedStyle(document.getElementById('arena-gl')).display)).toBe('none');
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
