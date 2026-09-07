const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const D = require("../src/data.js");
const P = require("../src/presentation/fx-profiles.js");
const { Game } = require("../src/engine.js");
const { compile } = require("../src/presentation/combat.js");
const folder = path.resolve(__dirname, "../assets/vfx");
const manifest = JSON.parse(
  fs.readFileSync(path.join(folder, "manifest.json")),
);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

test("every playable card and token has an explicit immutable combat profile", () => {
  assert.deepEqual(
    Object.keys(P.records).sort(),
    D.cards.map((c) => c.id).sort(),
  );
  for (const card of D.cards) {
    const p = P.get(card);
    assert.ok(Object.isFrozen(p));
    assert.ok(p.windup >= 300 && p.windup <= 800);
    assert.ok(p.attack);
    assert.ok(p.cast);
  }
  assert.throws(
    () => P.get("unregistered-card"),
    /Missing combat presentation/,
  );
  assert.equal(
    new Set(
      ["solaris", "nyx", "ashdragon", "frostking"].map(
        (id) => P.get(id).arrival,
      ),
    ).size,
    4,
  );
  assert.equal(
    new Set(
      ["guard", "wolf", "titan", "archer", "huntress", "nyx", "dragon"].map(
        (id) => P.get(id).attack,
      ),
    ).size,
    7,
  );
});
test("licensed local textures and atlases retain source evidence and bounded RGBA memory", () => {
  assert.equal(manifest.assets.length, 13);
  for (const source of manifest.sources) {
    assert.equal(source.license, "CC0-1.0");
    assert.match(source.url, /^https:\/\/(kenney.nl|opengameart.org)\//);
    for (const file of source.licenseEvidence.split("; "))
      assert.match(fs.readFileSync(path.join(folder, file), "utf8"), /CC0/);
  }
  let decoded = 0,
    compressed = 0;
  for (const a of manifest.assets) {
    const bytes = fs.readFileSync(path.join(folder, a.file));
    assert.equal(sha(bytes), a.sha256);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    let dimensions;
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const chunk = bytes.toString("ascii", offset, offset + 4),
        length = bytes.readUInt32LE(offset + 4);
      assert.ok(!["ANIM", "ANMF", "VP8 "].includes(chunk));
      if (chunk === "VP8L") {
        assert.equal(bytes[offset + 8], 0x2f);
        const bits = bytes.readUInt32LE(offset + 9);
        dimensions = [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
      }
      offset += 8 + length + (length & 1);
    }
    assert.deepEqual(dimensions, [a.width, a.height]);
    assert.equal(a.format, "webp-lossless");
    assert.match(a.rgbaSha256, /^[a-f0-9]{64}$/);
    const renderer = fs.readFileSync(
      path.resolve(__dirname, "../src/presentation/vfx.js"),
      "utf8",
    );
    assert.ok(
      renderer.includes('sprite("' + a.id + '"') ||
        renderer.includes('texture("' + a.id + '"'),
      a.id + " must be rendered, not only preloaded",
    );
    assert.ok(a.width <= 1024 && a.height <= 1024);
    assert.ok(fs.existsSync(path.join(folder, a.sourcePath)));
    if (a.sourceSha256)
      assert.equal(
        sha(fs.readFileSync(path.join(folder, a.sourcePath))),
        a.sourceSha256,
      );
    if (a.frames) {
      for (const frame of a.sourceFrames)
        assert.equal(
          sha(fs.readFileSync(path.join(folder, frame.file))),
          frame.sha256,
        );
      assert.equal(a.rows, Math.ceil(a.frames / a.columns));
      assert.equal(a.width, a.columns * a.frameWidth);
      assert.equal(a.height, a.rows * a.frameHeight);
      for (const n of a.targetAnchor) assert.ok(n >= 0 && n <= 1);
      assert.equal(
        fs
          .readdirSync(path.join(folder, a.sourcePath))
          .filter((f) => f.endsWith(".png")).length,
        a.frames,
      );
    }
    decoded += a.width * a.height * 4;
    compressed += bytes.length;
  }
  assert.equal(decoded, manifest.decodedBytesRGBA);
  assert.equal(compressed, manifest.compressedBytes);
  assert.ok(decoded <= 12 * 1024 * 1024);
  assert.ok(compressed <= 900000);
});
test("major spell travel and all affected health changes meet at one beat without touching rules", () => {
  const g = new Game();
  g.demo();
  g.s.e.board = [];
  for (let i = 0; i < 3; i++) g.summon("e", "treant");
  g.s.p.mana = 10;
  g.s.p.hand = [g.card("storm")];
  g.events = [];
  const before = g.snapshot();
  const result = g.dispatch({
    type: "play",
    side: "p",
    uid: g.s.p.hand[0].uid,
  });
  assert.ok(result.ok);
  const final = g.snapshot();
  const saved = JSON.stringify(final);
  const plan = compile(result.events, before, final);
  const cast = plan.beats.find((b) => b.kind === "play"),
    hit = plan.beats.find((b) => b.kind === "hit");
  assert.equal(hit.at - cast.at, P.get("storm").windup);
  assert.equal(hit.events.length, 3);
  assert.equal(JSON.stringify(final), saved);
  assert.ok(plan.duration <= 6500);
  const reduced = compile(result.events, before, final, true);
  assert.ok(reduced.beats.every((b) => b.at === 0 && b.hold === 0));
  assert.equal(JSON.stringify(final), saved);
});
