#!/usr/bin/env node
/* Asset-authoring helper: convert a two-panel RGB chroma atlas into a PNG
 * whose left background panel stays opaque and whose right subject panel has
 * real alpha. This is not used by the game at runtime. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");

function parseArgs(argv) {
  const allowed = new Set([
    "--input",
    "--output",
    "--split",
    "--color",
    "--similarity",
    "--blend",
    "--despill",
  ]);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i])) throw Error("Unknown option " + argv[i]);
    if (!argv[i + 1]) throw Error("Missing value for " + argv[i]);
    out[argv[i]] = argv[i + 1];
  }
  if (!out["--input"] || !out["--output"])
    throw Error(
      "Usage: node tools/chroma_motion_atlas.cjs --input INPUT.png --output OUTPUT.png [--split X] [--color 0xff00ff] [--similarity 0.18] [--blend 0.06]",
    );
  return out;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args["--input"]);
  const output = path.resolve(args["--output"]);
  if (input === output) throw Error("Input and output paths must differ");
  const colorText = (args["--color"] || "0xff00ff").replace(/^#/, "0x");
  if (!/^0x[0-9a-f]{6}$/i.test(colorText))
    throw Error(
      "--color must be a six-digit RGB value such as 0xff00ff or 0x00ff00",
    );
  const colorNumber = Number(colorText),
    keyColor = [
      (colorNumber >> 16) & 255,
      (colorNumber >> 8) & 255,
      colorNumber & 255,
    ];
  const despill = args["--despill"] || "none";
  if (!["none", "green", "blue", "green-edge"].includes(despill))
    throw Error("--despill must be none, green, blue or green-edge");
  const similarity = Number(args["--similarity"] ?? 0.18),
    blend = Number(args["--blend"] ?? 0.06);
  if (!Number.isFinite(similarity) || similarity < 0.00001 || similarity > 1)
    throw Error("--similarity must be between 0.00001 and 1");
  if (!Number.isFinite(blend) || blend < 0 || blend > 1)
    throw Error("--blend must be between 0 and 1");
  if (
    args["--split"] !== undefined &&
    (!Number.isInteger(Number(args["--split"])) || Number(args["--split"]) <= 0)
  )
    throw Error("--split must be a positive integer pixel coordinate");
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  let metrics;
  try {
    const page = await browser.newPage();
    const src =
      "data:image/png;base64," + fs.readFileSync(input).toString("base64");
    metrics = await page.evaluate(
      async ({ src, splitOverride, keyColor }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
        let split = Number(splitOverride) || 0;
        const isKey = (i) =>
          Math.abs(pixels[i] - keyColor[0]) <= 55 &&
          Math.abs(pixels[i + 1] - keyColor[1]) <= 55 &&
          Math.abs(pixels[i + 2] - keyColor[2]) <= 55;
        if (!split) {
          const start = Math.floor(image.width * 0.25);
          const end = Math.floor(image.width * 0.75);
          for (let x = start; x < end; x++) {
            let chroma = 0;
            for (let y = 0; y < image.height; y++) {
              const i = (y * image.width + x) * 4;
              if (isKey(i)) chroma++;
            }
            if (chroma / image.height > 0.98) {
              split = x;
              break;
            }
          }
        }
        if (!(split > 0 && split < image.width))
          throw Error("Could not detect chroma panel boundary");
        if (split < image.width * 0.35 || split > image.width * 0.65)
          throw Error(
            "Chroma panel boundary is implausibly far from the center",
          );
        let boundaryKey = 0,
          boundaryPixels = 0;
        for (let x = split; x < Math.min(image.width, split + 8); x++)
          for (let y = 0; y < image.height; y++) {
            const i = (y * image.width + x) * 4;
            boundaryPixels++;
            if (isKey(i)) boundaryKey++;
          }
        if (boundaryKey / boundaryPixels < 0.15)
          throw Error(
            "Requested split is not followed by the selected chroma color",
          );
        return { width: image.width, height: image.height, split };
      },
      { src, splitOverride: args["--split"], keyColor },
    );
    const right = metrics.width - metrics.split;
    const filter =
      `[0:v]crop=${metrics.split}:${metrics.height}:0:0,format=rgba[left];` +
      `[0:v]crop=${right}:${metrics.height}:${metrics.split}:0,format=rgba,` +
      `colorkey=${colorText}:${similarity}:${blend}${["none", "green-edge"].includes(despill) ? "" : ",despill=type=" + despill + ":mix=1"}[right];` +
      `[left][right]hstack=inputs=2,format=rgba`;
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        input,
        "-filter_complex",
        filter,
        "-frames:v",
        "1",
        output,
      ],
      { stdio: "inherit" },
    );
    const converted =
      "data:image/png;base64," + fs.readFileSync(output).toString("base64");
    const result = await page.evaluate(
      async ({ src, split, keyColor, despill }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const frame = ctx.getImageData(0, 0, image.width, image.height);
        const pixels = frame.data;
        let edgePixels = 0;
        if (despill === "green-edge") {
          // Only remove excess green near the keyed silhouette. Preserve cyan
          // lights and original opaque skin/fabric colors inside the subject.
          for (let y = 0; y < image.height; y++)
            for (let x = split; x < image.width; x++) {
              const i = (y * image.width + x) * 4;
              if (
                !pixels[i + 3] ||
                pixels[i + 1] <= Math.max(pixels[i], pixels[i + 2])
              )
                continue;
              let edge = pixels[i + 3] < 250;
              for (let dy = -3; !edge && dy <= 3; dy++)
                for (let dx = -3; !edge && dx <= 3; dx++) {
                  const nx = x + dx,
                    ny = y + dy;
                  if (
                    nx < split ||
                    nx >= image.width ||
                    ny < 0 ||
                    ny >= image.height ||
                    pixels[(ny * image.width + nx) * 4 + 3] < 250
                  )
                    edge = true;
                }
              if (edge) {
                pixels[i + 1] = Math.max(pixels[i], pixels[i + 2]);
                edgePixels++;
              }
            }
          ctx.putImageData(frame, 0, 0);
        }
        let leftTransparent = 0,
          rightTransparent = 0,
          rightVisible = 0,
          residualKey = 0;
        for (let y = 0; y < image.height; y++)
          for (let x = 0; x < image.width; x++) {
            const i = (y * image.width + x) * 4,
              alpha = pixels[i + 3];
            if (x < split) {
              if (alpha < 250) leftTransparent++;
            } else {
              if (alpha <= 5) rightTransparent++;
              if (alpha > 16) {
                rightVisible++;
                if (
                  Math.abs(pixels[i] - keyColor[0]) <= 35 &&
                  Math.abs(pixels[i + 1] - keyColor[1]) <= 35 &&
                  Math.abs(pixels[i + 2] - keyColor[2]) <= 35
                )
                  residualKey++;
              }
            }
          }
        const leftTotal = split * image.height,
          rightTotal = (image.width - split) * image.height;
        if (leftTransparent > leftTotal * 0.001)
          throw Error("Converted background panel is not opaque");
        if (
          rightTransparent < rightTotal * 0.02 ||
          rightVisible < rightTotal * 0.002
        )
          throw Error(
            "Converted subject panel lacks useful alpha or visible content",
          );
        if (residualKey > rightTotal * 0.02)
          throw Error(
            "Converted subject panel retains obvious chroma-color spill",
          );
        return {
          leftTransparent,
          rightTransparent,
          rightVisible,
          residualKey,
          edgePixels,
          png:
            despill === "green-edge"
              ? canvas.toDataURL("image/png").split(",")[1]
              : null,
        };
      },
      { src: converted, split: metrics.split, keyColor, despill },
    );
    if (result.png) fs.writeFileSync(output, Buffer.from(result.png, "base64"));
    delete result.png;
    console.log(
      JSON.stringify({
        input,
        output,
        color: colorText,
        similarity,
        blend,
        despill,
        cuts: [0, metrics.split, metrics.width],
        alpha: result,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
