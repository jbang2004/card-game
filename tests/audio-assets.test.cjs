const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const folder = path.resolve(__dirname, "../assets/audio");
const manifest = JSON.parse(
  fs.readFileSync(path.join(folder, "manifest.json")),
);

test("bundled Foley has retained CC0 originals and measured, bounded contact transients", () => {
  assert.equal(manifest.assets.length, 12);
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    assert.equal(asset.license, "CC0-1.0");
    assert.match(asset.sourceUrl, /^https:\/\/kenney.nl\/assets\//);
    assert.ok(
      fs
        .readFileSync(path.join(folder, asset.licensePath), "utf8")
        .includes("CC0"),
    );
    for (const [file, hash] of [
      [asset.path, asset.sha256],
      [asset.sourcePath, asset.sourceSha256],
    ]) {
      const bytes = fs.readFileSync(path.join(folder, file));
      assert.equal(
        crypto.createHash("sha256").update(bytes).digest("hex"),
        hash,
      );
    }
    totalBytes += fs.statSync(path.join(folder, asset.path)).size;
    assert.ok(asset.metrics.peakDbfs < -3);
    assert.ok(asset.metrics.decodedDurationSeconds < 1.5);
    if (["card-play", "card-play-alt"].includes(asset.id))
      assert.ok(asset.metrics.strongOnsetSecondsAtMinus12DbRelative < 0.008);
  }
  assert.ok(totalBytes < 150000);
});
