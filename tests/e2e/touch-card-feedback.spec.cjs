const { test, expect } = require('@playwright/test');
const path = require('node:path');
const out = path.resolve('artifacts/touch-card-feedback');

async function boot(page) {
  await page.goto('./?debug=1');
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function touch(cdp, type, x, y) {
  await cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
  });
}
async function rub(page, cdp, card, property, distance = 45) {
  await card.evaluate(el => el.scrollIntoView({ block: "nearest", inline: "nearest" }));
  const r = await card.boundingBox();
  const x = r.x + r.width * .5, y = r.y + r.height * .45;
  await touch(cdp, 'touchStart', x, y);
  if (await card.locator('.card-art').count())
    await expect(card.locator('.card-art')).toHaveClass(/card-relief-ready/);
  for (let d = 5; d <= distance; d += 5) {
    await touch(cdp, 'touchMove', x + d, y);
    await page.waitForTimeout(20);
  }
  await expect.poll(() => card.evaluate((el, prop) => parseFloat(el.style.getPropertyValue(prop)), property)).toBeGreaterThan(.5);
  const surface = await card.evaluate(el => el.closest('.god-stage')?.id || (el.classList.contains('scene-showcase') ? 'hero' : 'reading'));
  await page.screenshot({ path: path.join(out, `${surface}-touch-${page.viewportSize().width}.png`) });
  await touch(cdp, 'touchEnd');
}
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`native touch turns hero, library and covenant cards ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await boot(page);
    await page.locator('#start-btn').click();
    const hero = page.locator('.scene-showcase');
    await expect(hero).toHaveClass(/card-relief-ready/);
    await rub(page, cdp, hero, '--relief-ry');
    await page.keyboard.press('Escape');
    await page.locator('#lobby-library-btn').click();
    await page.locator('.library-item').first().click();
    await expect(page.locator('#card-stage.flying')).toHaveCount(0);
    const library = page.locator('#card-stage .god-card');
    await rub(page, cdp, library, '--tilt-y');
    await expect(library).toBeVisible();
    expect(await library.evaluate(el => el.style.getPropertyValue('--tilt-y'))).toBe('');
    await page.keyboard.press('Escape');
    await expect(page.locator('#card-stage')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('#quick-btn').click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.locator('#contract-open').click();
    await expect(page.locator('#god-stage.flying')).toHaveCount(0);
    const god = page.locator('#god-stage .god-card.focused');
    const id = await god.getAttribute('data-cid');
    await rub(page, cdp, god, '--tilt-y', 20);
    expect(await god.getAttribute('data-cid')).toBe(id);
    expect(await god.evaluate(el => el.style.getPropertyValue('--tilt-y'))).toBe('');
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('rubbing an opening choice does not toggle it; a tap still does', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  await boot(page);
  await page.locator('#start-btn').click();
  await page.locator('#hero-confirm').click();
  const choice = page.locator('.mulligan-card').first();
  await expect(choice).toBeVisible();
  await rub(page, cdp, choice.locator('> .card'), '--relief-ry', 25);
  await expect(choice).not.toHaveClass(/replace/);
  await choice.tap();
  await expect(choice).toHaveClass(/replace/);
  await context.close();
});

for (const viewport of [{ width: 1600, height: 940 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`fatigue coexists with keywords and clears when ready; sculpted arrow ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000 });
    const page = await context.newPage();
    await boot(page);
    await page.locator('#quick-btn').click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.active = 'p'; g.s.phase = 'battle';
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.board = g.s.p.board.slice(0, 1);
      const m = g.s.p.board[0];
      m.sick = true; m.tags = ['lifesteal']; m.frozen = false;
      g.s.p.hand = [g.card('guard')];
      g.emit();
    });
    const minion = page.locator('.minion.friendly').first();
    await expect(minion.locator('.sleep-z')).toHaveCount(3);
    await expect(minion.locator('.special')).toHaveText('♥');
    await expect(minion).toHaveAttribute('aria-label', /休息中/);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(out, `sleep-${viewport.width}.png`) });
    await page.locator('#hand .hand-card').click({ position: { x: 14, y: 30 } });
    await expect(page.locator('#target-arrow-depth')).toBeVisible();
    await expect(page.locator('#target-arrow-shine')).toBeVisible();
    const cue = await page.locator('#target-lines').evaluate(el => ({
      layer: +getComputedStyle(el).zIndex,
      liftLayer: +getComputedStyle(document.getElementById('hand-card-lift')).zIndex,
      pointerEvents: getComputedStyle(el).pointerEvents,
      segments: el.querySelector('#target-ribbon').getAttribute('d').split('M').length - 1,
      head: el.querySelector('#target-arrow').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),
      geometry: [...el.querySelectorAll('path[d]')].map(p => p.getAttribute('d')).join(' '),
      curve: el.querySelector('#target-path').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),
    }));
    expect(cue.layer).toBeGreaterThan(cue.liftLayer);
    expect(cue.pointerEvents).toBe('none');
    expect(cue.segments).toBeGreaterThan(1);
    expect(cue.segments).toBeLessThanOrEqual(viewport.width < 1000 ? 14 : 20);
    expect(cue.geometry).not.toMatch(/NaN|Infinity/);
    const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = cue.curve;
    expect(cue.head[0]).toBeCloseTo(ex, 1);
    expect(cue.head[1]).toBeCloseTo(ey, 1);
    expect(c1x).toBeCloseTo(sx + (ex - sx) / 3, 4);
    expect(c2x).toBeCloseTo(sx + (ex - sx) * 2 / 3, 4);
    expect(c1y).toBeLessThan(sy + (ey - sy) / 3);
    expect(c2y).toBeLessThan(sy + (ey - sy) * 2 / 3);
    await expect(page.locator('#target-ground-shadow')).toBeVisible();
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(out, `battle-${viewport.width}.png`) });
    await page.evaluate(() => { document.body.classList.add('reduced-motion'); });
    await expect(minion.locator('.sleep-z').first()).toHaveCSS('animation-name', 'none');
    await page.locator('#touch-cancel').click();
    await page.evaluate(() => { const g = EmberDebug.game; g.s.p.board[0].frozen = true; g.emit(); });
    await expect(minion.locator('.minion-sleep')).toHaveCount(0);
    await expect(minion.locator('.minion-status')).toHaveText('❄');
    await page.evaluate(() => { const g = EmberDebug.game; g.s.p.board[0].frozen = false; g.s.p.board[0].sick = false; g.emit(); });
    await expect(minion.locator('.minion-sleep')).toHaveCount(0);
    await context.close();
  });
}

test('pinned battlefield detail follows the finger and cancellation returns it to rest', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  await boot(page);
  await page.locator('#quick-btn').click();
  await page.waitForFunction(() => !EmberFX.busy);
  const unit = page.locator('.minion.friendly').first();
  const r = await unit.boundingBox();
  await touch(cdp, 'touchStart', r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(600);
  await touch(cdp, 'touchEnd');
  const detail = page.locator('#card-preview[data-mode=pinned]');
  await expect(detail.locator('.card-art')).toHaveClass(/card-relief-ready/);
  await rub(page, cdp, detail.locator('> .card'), '--relief-ry', 35);
  await expect(detail).toBeVisible();
  const box = await detail.boundingBox();
  await touch(cdp, 'touchStart', box.x + box.width * .8, box.y + box.height / 2);
  await touch(cdp, 'touchMove', box.x + box.width * .9, box.y + box.height / 2);
  await touch(cdp, 'touchCancel');
  await expect.poll(() => detail.locator('> .card').evaluate(el => Math.abs(parseFloat(el.style.getPropertyValue('--relief-ry'))))).toBeLessThan(1);
  await context.close();
});

test('an unaffordable lifted hand card still turns under the finger without playing', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  await boot(page);
  await page.locator('#quick-btn').click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => { const g = EmberDebug.game; g.s.p.mana = 0; g.s.p.hand = [g.card('guard')]; g.emit(); });
  const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
  await page.locator('#hand .hand-card').tap();
  const card = page.locator('#hand-card-lift > .card');
  await expect(card.locator('.card-art')).toHaveClass(/card-relief-ready/);
  await rub(page, cdp, card, '--relief-ry', 40);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(before);
  await context.close();
});
