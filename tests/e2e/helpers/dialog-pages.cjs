const { expect } = require("@playwright/test");
async function turnTo(page, selector) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const target = page.locator(selector).first();
  const pane = target.locator(
    'xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," folio-pane ")][1]',
  );
  if (!(await pane.count())) return;
  await expect(pane.locator(".folio-pager")).toHaveAttribute(
    "data-single",
    /true|false/,
  );
  const prev = pane.locator(".folio-pager > button").first();
  while (await prev.isEnabled()) await prev.click();
  for (let i = 0; i < 100; i++) {
    const inside = await target.evaluate((el) => {
      const v = el.closest(".folio-viewport").getBoundingClientRect();
      return [...el.getClientRects()].some(
        (r) =>
          r.width > 0 &&
          r.height > 0 &&
          r.left >= v.left - 1 &&
          r.right <= v.right + 1 &&
          r.top >= v.top - 1 &&
          r.bottom <= v.bottom + 1,
      );
    });
    if (inside) return;
    const next = pane.locator(".folio-pager > button").last();
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  throw new Error(`No complete page contains ${selector}`);
}
async function assertDialogFit(page) {
  await expect(page.locator("#modal .folio-dialog")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".folio-viewport")
        .evaluateAll((es) =>
          Math.max(
            0,
            ...es
              .filter((e) => e.clientHeight)
              .map((e) => e.scrollHeight - e.clientHeight),
          ),
        ),
    )
    .toBeLessThanOrEqual(2);
  const errors = await page.locator(".folio-dialog").evaluate((box) => {
    const errors = [],
      r = box.getBoundingClientRect();
    if (
      r.left < 0 ||
      r.top < 0 ||
      r.right > innerWidth + 1 ||
      r.bottom > innerHeight + 1
    )
      errors.push("dialog outside viewport");
    for (const e of box.querySelectorAll(".folio-viewport"))
      if (e.clientHeight && e.scrollHeight > e.clientHeight + 2)
        errors.push(`vertical overflow ${e.scrollHeight - e.clientHeight}`);
    for (const e of box.querySelectorAll(
      ":scope > .modal-footer button,:scope > .reward-footer button,.modal-close",
    )) {
      if (!e.checkVisibility()) continue;
      const b = e.getBoundingClientRect();
      if (
        b.left < r.left + 19 ||
        b.right > r.right - 19 ||
        b.bottom > r.bottom - 19 ||
        b.top < r.top + 19
      )
        errors.push(`${e.id || e.className} has no rim clearance`);
    }
    return errors;
  });
  expect(errors).toEqual([]);
}
module.exports = { turnTo, assertDialogFit };
