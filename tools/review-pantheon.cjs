/* Observe existing game renderer at board/detail sizes across complete slow cycles.
 * Local debug demo only; does not touch saved user games. */
const { chromium } = require("@playwright/test"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const samples = [];
  try {
    await page.goto("http://127.0.0.1:8000/tools/animation-demo.html?zoom=1");
    await page.waitForSelector("#zoom[open]");
    for (const id of ["jingchen", "aurion"]) {
      await page.evaluate(async (id) => {
        const ids = run(() =>
          EmberData.cards.filter((c) => c.type === "minion").map((c) => c.id),
        );
        portraitPage = Math.floor(ids.indexOf(id) / 6);
        await showPortraitPage();
      }, id);
      await page.waitForTimeout(1200);
      for (let i = 0; i < 7; i++) {
        const frames = await page
          .locator(".zoom-grid canvas")
          .evaluateAll((cs) =>
            cs.map((c) => ({
              id: c.dataset.zoom,
              width: c.width,
              height: c.height,
              frame: c.toDataURL(),
            })),
          );
        samples.push({
          group: id,
          seconds: i * 5,
          frames: frames.map((x) => ({
            id: x.id,
            width: x.width,
            height: x.height,
            hash: crypto.createHash("sha256").update(x.frame).digest("hex"),
          })),
        });
        await page.screenshot({
          path: `artifacts/qa/pantheon-motion-${id}-${i}.png`,
        });
        if (i < 6) await page.waitForTimeout(5000);
      }
    }
    const gods = ["jingchen", "aurion", "fenlos"];
    for (const id of gods) {
      const frames = samples
        .flatMap((s) => s.frames)
        .filter((x) => x.id === id);
      if (frames.length !== 7 || new Set(frames.map((f) => f.hash)).size !== 7)
        throw Error(id + " failed full-cycle observation");
    }
    if (errors.length) throw Error(errors.join("\n"));
    fs.writeFileSync(
      "artifacts/qa/pantheon-motion-review.json",
      JSON.stringify(
        {
          method:
            "Two existing roster pages, seven five-second samples per page (30 seconds each), real board and detail renderer; not video or device testing.",
          samples,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "All three deity portraits changed in every sample across 30-second observations.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
