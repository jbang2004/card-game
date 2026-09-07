/* Asset packing only: turn image_gen layer atlases and mattes into WebP RGBA.
 * Uses the project's declared Playwright browser; ordinary build needs no browser. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, "assets/motion");
(async () => {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--manifest", "--card"].includes(args[i]) || !args[i + 1])
      throw Error(
        "Usage: node tools/pack_motion_assets.cjs [--manifest PATH] [--card ID]",
      );
    options[args[i]] = args[i + 1];
  }
  const manifestPath = path.resolve(
    root,
    options["--manifest"] || "assets/characters.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  if (options["--card"] && !manifest.cards[options["--card"]]?.motion)
    throw Error("No motion entry for " + options["--card"]);
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  try {
    const page = await browser.newPage();
    let count = 0,
      layerCount = 0;
    const packed = [];
    for (const [id, card] of Object.entries(manifest.cards)) {
      const meta = card.motion;
      if (!meta || (options["--card"] && id !== options["--card"])) continue;
      const roles =
        meta.rig.template === "whole-subject"
          ? ["background", "subject"]
          : ["background", "subject", "accent"];
      const images = (meta.mask ? ["atlas", "mask"] : ["atlas"]).map(
        (k) =>
          "data:image/png;base64," +
          fs.readFileSync(path.join(dir, meta[k])).toString("base64"),
      );
      const layers = await page.evaluate(
        async ({ images, meta, roles }) => {
          const [art, mask] = await Promise.all(
            images.map(
              (src) =>
                new Promise((resolve, reject) => {
                  const im = new Image();
                  im.onload = () => resolve(im);
                  im.onerror = reject;
                  im.src = src;
                }),
            ),
          );
          if (!art.width || !art.height) throw Error("empty atlas image");
          const validateCuts = (cuts, width, label) => {
            if (
              !Array.isArray(cuts) ||
              cuts.length < roles.length + 1 ||
              cuts
                .slice(0, roles.length + 1)
                .some((v) => !Number.isInteger(v)) ||
              cuts
                .slice(0, roles.length + 1)
                .some((v, i, a) => v < 0 || (i && v <= a[i - 1])) ||
              cuts[roles.length] > width
            )
              throw Error(`${label} cuts outside ${width}px image`);
          };
          validateCuts(meta.cuts, art.width, "atlas");
          if (mask) {
            if (!mask.width || !mask.height) throw Error("empty mask image");
            validateCuts(meta.maskCuts, mask.width, "mask");
          }
          if (
            meta.backgroundWidth &&
            (!Number.isInteger(meta.backgroundWidth) ||
              meta.backgroundWidth <= 0 ||
              meta.cuts[0] + meta.backgroundWidth > art.width)
          )
            throw Error("backgroundWidth outside atlas image");
          const result = [];
          for (let panel = 0; panel < roles.length; panel++) {
            const canvas = document.createElement("canvas");
            canvas.width = 384;
            canvas.height = 512;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(
              art,
              meta.cuts[panel],
              0,
              (panel === 0 && meta.backgroundWidth) ||
                meta.cuts[panel + 1] - meta.cuts[panel],
              art.height,
              0,
              0,
              384,
              512,
            );
            if (panel && mask) {
              const a = ctx.getImageData(0, 0, 384, 512);
              ctx.clearRect(0, 0, 384, 512);
              ctx.drawImage(
                mask,
                meta.maskCuts[panel],
                0,
                meta.maskCuts[panel + 1] - meta.maskCuts[panel],
                mask.height,
                0,
                0,
                384,
                512,
              );
              const m = ctx.getImageData(0, 0, 384, 512).data;
              for (let y = 0; y < 512; y++)
                for (let x = 0; x < 384; x++) {
                  // A one-pixel inward matte removes the generated checker edge.
                  let v = 255;
                  for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                      const j =
                        (Math.max(0, Math.min(511, y + dy)) * 384 +
                          Math.max(0, Math.min(383, x + dx))) *
                        4;
                      v = Math.min(v, m[j]);
                    }
                  const k = (y * 384 + x) * 4;
                  const rgb = [a.data[k], a.data[k + 1], a.data[k + 2]];
                  // The matte is AI-authored: suppress neutral checker spill only
                  // in the uncertain silhouette band, retaining interior highlights.
                  let interior = 255;
                  for (const [dx, dy] of [
                    [-24, 0],
                    [24, 0],
                    [0, -24],
                    [0, 24],
                  ]) {
                    const j =
                      (Math.max(0, Math.min(511, y + dy)) * 384 +
                        Math.max(0, Math.min(383, x + dx))) *
                      4;
                    interior = Math.min(interior, m[j]);
                  }
                  if (
                    !meta.preserveHighlights &&
                    Math.max(...rgb) - Math.min(...rgb) < 30 &&
                    Math.min(...rgb) > 140 &&
                    (meta.accent !== "ice" || interior < 160)
                  )
                    v = 0;
                  if (
                    meta.edgeTrim &&
                    (x < meta.edgeTrim[0] || x >= 384 - meta.edgeTrim[1])
                  )
                    v = 0;
                  a.data[k + 3] = Math.max(
                    0,
                    Math.min(255, ((v - 30) * 255) / 205),
                  );
                }
              ctx.putImageData(a, 0, 0);
            }
            const pixels = ctx.getImageData(0, 0, 384, 512).data;
            let visible = 0,
              opaque = 0,
              transparent = 0;
            for (let i = 3; i < pixels.length; i += 4) {
              if (pixels[i] > 16) visible++;
              if (pixels[i] >= 250) opaque++;
              if (pixels[i] <= 5) transparent++;
            }
            const total = 384 * 512,
              role = roles[panel];
            if (role === "background") {
              if (visible < total * 0.25 || opaque < total * 0.9)
                throw Error(
                  `${role} layer is empty or substantially transparent`,
                );
            } else {
              const minimum = role === "accent" ? 4 : Math.ceil(total * 0.002);
              if (visible < minimum)
                throw Error(`${role} layer has only ${visible} visible pixels`);
              if (transparent < total * 0.02)
                throw Error(
                  `${role} layer has no effective transparent background`,
                );
            }
            result.push({
              url: canvas.toDataURL("image/webp", 0.9),
              stats: { role, visible, opaque, transparent },
            });
          }
          return result;
        },
        { images, meta, roles },
      );
      count++;
      layerCount += layers.length;
      packed.push({ id, meta, roles, layers });
    }
    // Do not touch any existing output until every card has loaded, rendered,
    // and passed structural/alpha validation.
    for (const { id, meta, roles, layers } of packed) {
      meta.files = layers.map(({ url }, i) => {
        const data = Buffer.from(url.split(",")[1], "base64"),
          file = `${id}-${roles[i]}.webp`;
        fs.writeFileSync(path.join(dir, file), data);
        return {
          file,
          role: roles[i],
          bytes: data.length,
          sha256: crypto.createHash("sha256").update(data).digest("hex"),
        };
      });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    if (manifestPath === path.join(root, "assets/characters.json"))
      require("node:child_process").execFileSync(
        "python3",
        [path.join(root, "tools/characters.py")],
        { stdio: "inherit" },
      );
    console.log(`Packed ${layerCount} motion layers for ${count} cards.`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
