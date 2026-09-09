const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
test("authored UI materials match manifest and are registered as valid embedded WebP", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "assets/ui/manifest.json")),
  );
  const values = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src/ui-assets.js"), "utf8"),
    {
      document: {
        documentElement: { style: { setProperty: (k, v) => (values[k] = v) } },
      },
    },
  );
  for (const [key, asset] of Object.entries(manifest.assets)) {
    for (const field of ["source", "runtime"]) {
      const data = fs.readFileSync(path.join(root, asset[field]));
      assert.equal(
        crypto.createHash("sha256").update(data).digest("hex"),
        asset[field + "Sha256"],
      );
    }
    const packed = values["--ui-" + key];
    assert.ok(packed.startsWith('url("data:image/webp;base64,'));
    const data = Buffer.from(
      packed.slice(packed.indexOf(",") + 1, -2),
      "base64",
    );
    assert.equal(data.toString("ascii", 8, 12), "WEBP");
    assert.deepEqual(data, fs.readFileSync(path.join(root, asset.runtime)));
  }
  assert.equal(Object.keys(values).length, Object.keys(manifest.assets).length);
});
