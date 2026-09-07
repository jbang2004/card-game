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
