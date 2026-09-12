const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
function runtime(definition) {
  const events = [];
  const document = {
    title: "",
    documentElement: {
      dataset: {},
      style: {
        setProperty(k, v) {
          events.push([k, v]);
        },
      },
    },
  };
  class Image {
    set src(value) {
      this.value = value;
    }
  }
  const context = {
    EmberThemeDefinition: definition,
    document,
    Image,
    Map,
    console,
    CustomEvent: class {},
    window: { dispatchEvent: (e) => events.push(e) },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src/presentation/theme.js"), "utf8") +
      ";this.theme=EmberTheme",
    context,
  );
  return { theme: context.theme, document, events };
}
test("theme artwork has independent roles, verified local payloads and provenance", () => {
  const dir = path.join(root, "assets/themes/silverblue");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json")));
  assert.equal(manifest.assets.length, 9);
  assert.equal(new Set(manifest.assets.map((a) => a.role)).size, 9);
  for (const entry of manifest.assets) {
    const bytes = fs.readFileSync(path.join(dir, entry.file));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
    );
    assert.equal(bytes.length, entry.bytes);
  }
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, "provenance.json"))));
});
test("a replacement theme binds semantic art without gameplay or storage services", () => {
  const definition = {
    id: "replacement",
    title: "Test theme",
    art: { backdrop: "local/background.webp", home: "local/home.webp" },
  };
  const { theme, document } = runtime(definition);
  assert.equal(document.documentElement.dataset.theme, "replacement");
  assert.equal(document.title, "Test theme");
  const bound = [];
  const nodes = [
    {
      tagName: "DIV",
      dataset: { themeArt: "home" },
      style: { setProperty: (k, v) => bound.push([k, v]) },
    },
    { tagName: "IMG", dataset: { themeArt: "backdrop" } },
  ];
  theme.bind({ querySelectorAll: () => nodes });
  assert.deepEqual(bound, [["--scene-art", 'url("local/home.webp")']]);
  assert.equal(nodes[1].src, "local/background.webp");
  assert.equal(theme.image("home"), theme.image("home"));
  assert.equal(theme.hasArt("missing"), false);
  assert.throws(() => theme.art("missing"), /Theme artwork missing/);
});
