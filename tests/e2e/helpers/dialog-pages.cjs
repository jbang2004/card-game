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
  const viewport = pane.locator(".folio-viewport");
  await target.scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) {
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
    await viewport.evaluate((v) =>
      v.scrollBy({ top: Math.max(1, v.clientHeight * 0.8), behavior: "instant" }),
    );
  }
  throw new Error(`No complete scroll position contains ${selector}`);
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
              .filter(
                (e) =>
                  getComputedStyle(e).overflowY !== "auto",
              )
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
      if (
        e.clientHeight &&
        e.scrollHeight > e.clientHeight + 2 &&
        getComputedStyle(e).overflowY !== "auto"
      )
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
