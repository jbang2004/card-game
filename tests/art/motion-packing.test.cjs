const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../.."),
  packer = path.join(root, "tools/pack_motion_assets.cjs"),
  chroma = path.join(root, "tools/chroma_motion_atlas.cjs"),
  hasPlaywright = (() => {
    try {
      require.resolve("@playwright/test");
      return true;
    } catch {
      return false;
    }
  })();

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

test(
  "a later invalid native-alpha layer does not overwrite earlier packed files",
  { skip: !hasPlaywright },
  () => {
    const tag = `__motion_txn_${process.pid}`,
      first = `${tag}_first`,
      invalid = `${tag}_invalid`,
      manifest = path.join(os.tmpdir(), `${tag}.json`),
      firstBackground = path.join(
        root,
        "assets/motion",
        `${first}-background.webp`,
      ),
      firstSubject = path.join(root, "assets/motion", `${first}-subject.webp`),
      invalidBackground = path.join(
        root,
        "assets/motion",
        `${invalid}-background.webp`,
      ),
      invalidSubject = path.join(
        root,
        "assets/motion",
        `${invalid}-subject.webp`,
      ),
      markerBackground = Buffer.from("existing-background"),
      markerSubject = Buffer.from("existing-subject");
    const whole = (atlas, cuts) => ({
      motion: {
        atlas,
        cuts,
        nativeAlpha: true,
        size: [384, 512],
        rig: {
          template: "whole-subject",
          speed: 1,
          lift: 0.01,
          sway: 0.01,
          turn: 0.01,
        },
        files: [],
      },
    });
    fs.writeFileSync(firstBackground, markerBackground);
    fs.writeFileSync(firstSubject, markerSubject);
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        cards: {
          [first]: whole("sources/pup-atlas-alpha.png", [0, 729, 1536]),
          // This is deliberately an opaque chroma source falsely declared native alpha.
          [invalid]: whole("sources/pup-atlas-chroma.png", [0, 729, 1536]),
        },
      }),
    );
    try {
      const result = run(packer, ["--manifest", manifest]);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /no effective transparent background/);
      assert.deepEqual(fs.readFileSync(firstBackground), markerBackground);
      assert.deepEqual(fs.readFileSync(firstSubject), markerSubject);
      assert.equal(fs.existsSync(invalidBackground), false);
      assert.equal(fs.existsSync(invalidSubject), false);
      assert.deepEqual(
        JSON.parse(fs.readFileSync(manifest, "utf8")).cards[first].motion.files,
        [],
      );
    } finally {
      for (const file of [
        manifest,
        firstBackground,
        firstSubject,
        invalidBackground,
        invalidSubject,
      ])
        fs.rmSync(file, { force: true });
    }
  },
);

test(
  "chroma helper rejects unknown options before touching output",
  { skip: !hasPlaywright },
  () => {
    const output = path.join(
      os.tmpdir(),
      `motion-chroma-unknown-${process.pid}.png`,
    );
    try {
      const result = run(chroma, [
        "--input",
        "assets/motion/sources/pup-atlas-chroma.png",
        "--output",
        output,
        "--colour",
        "0xff00ff",
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown option --colour/);
      assert.equal(fs.existsSync(output), false);
    } finally {
      fs.rmSync(output, { force: true });
    }
  },
);

test(
  "chroma helper rejects an implausible explicit split",
  { skip: !hasPlaywright },
  () => {
    const output = path.join(
      os.tmpdir(),
      `motion-chroma-split-${process.pid}.png`,
    );
    try {
      const result = run(chroma, [
        "--input",
        "assets/motion/sources/pup-atlas-chroma.png",
        "--output",
        output,
        "--split",
        "10",
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /implausibly far from the center/);
      assert.equal(fs.existsSync(output), false);
    } finally {
      fs.rmSync(output, { force: true });
    }
  },
);

test(
  "chroma helper rejects similarity and blend values outside their ranges",
  { skip: !hasPlaywright },
  () => {
    const cases = [
      ["--similarity", "-0.1", /--similarity must be between/],
      ["--similarity", "1.1", /--similarity must be between/],
      ["--blend", "-0.1", /--blend must be between/],
      ["--blend", "1.1", /--blend must be between/],
    ];
    for (const [option, value, message] of cases) {
      const output = path.join(
        os.tmpdir(),
        `motion-chroma-range-${process.pid}-${option.slice(2)}-${value}.png`,
      );
      try {
        const result = run(chroma, [
          "--input",
          "assets/motion/sources/pup-atlas-chroma.png",
          "--output",
          output,
          option,
          value,
        ]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, message);
        assert.equal(fs.existsSync(output), false);
      } finally {
        fs.rmSync(output, { force: true });
      }
    }
  },
);

test(
  "edge despill removes silhouette green while retaining cyan, skin and interior color",
  { skip: !hasPlaywright },
  async () => {
    const { chromium } = require("@playwright/test");
    const browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
    });
    const input = path.join(os.tmpdir(), `edge-input-${process.pid}.png`),
      output = path.join(os.tmpdir(), `edge-output-${process.pid}.png`);
    try {
      const page = await browser.newPage();
      const png = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 64;
        const x = c.getContext("2d");
        x.fillStyle = "#203050";
        x.fillRect(0, 0, 64, 64);
        x.fillStyle = "#00ff00";
        x.fillRect(64, 0, 64, 64);
        x.fillStyle = "#c8aa78";
        x.fillRect(80, 12, 32, 40);
        x.fillStyle = "#609060";
        x.fillRect(80, 12, 1, 40);
        x.fillStyle = "#32c8dc";
        x.fillRect(84, 24, 8, 8);
        x.fillStyle = "#46a064";
        x.fillRect(88, 40, 8, 8);
        return c.toDataURL().split(",")[1];
      });
      fs.writeFileSync(input, Buffer.from(png, "base64"));
      const result = run(chroma, [
        "--input",
        input,
        "--output",
        output,
        "--split",
        "64",
        "--color",
        "0x00ff00",
        "--similarity",
        "0.1",
        "--blend",
        "0.02",
        "--despill",
        "green-edge",
      ]);
      assert.equal(result.status, 0, result.stderr);
      const pixels = await page.evaluate(
        async (src) => {
          const im = new Image();
          im.src = src;
          await im.decode();
          const c = document.createElement("canvas");
          c.width = 128;
          c.height = 64;
          const x = c.getContext("2d");
          x.drawImage(im, 0, 0);
          return [
            [80, 28],
            [86, 28],
            [103, 30],
            [91, 43],
            [70, 4],
            [10, 10],
          ].map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data));
        },
        "data:image/png;base64," + fs.readFileSync(output).toString("base64"),
      );
      assert.deepEqual(pixels[0], [96, 96, 96, 255]);
      assert.deepEqual(pixels[1], [50, 200, 220, 255]);
      assert.deepEqual(pixels[2], [200, 170, 120, 255]);
      assert.deepEqual(pixels[3], [70, 160, 100, 255]);
      assert.equal(pixels[4][3], 0);
      assert.deepEqual(pixels[5], [32, 48, 80, 255]);
    } finally {
      await browser.close();
      fs.rmSync(input, { force: true });
      fs.rmSync(output, { force: true });
    }
  },
);
