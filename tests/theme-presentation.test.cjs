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
  assert.equal(manifest.assets.length, 8);
  assert.equal(new Set(manifest.assets.map((a) => a.role)).size, 8);
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

// Boss identity owns scenery; responsive layouts may only crop the same asset.
test("all six map bosses bind distinct packaged battle scenes", () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, "src/presentation/themes/silverblue.js"), "utf8") + ";this.definition=EmberThemeDefinition", context);
  const { definition } = context;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/scenes/boss-topdown-v1/generation.json")));
  const ids = ["warden", "queen", "oracle", "frost", "dragon", "moonkeeper"];
  assert.equal(manifest.records.length, ids.length);
  const sources = new Set();
  for (const id of ids) {
    const entry = manifest.records.find(r => r.id === id);
    const file = definition.art[definition.encounters[id]].replace("asset:", "assets/");
    assert.equal(file, entry.runtime);
    sources.add(file);
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  }
  assert.equal(sources.size, 6);
  assert.equal(definition.art.battlePortrait, undefined);
  assert.equal(definition.art.battleLandscape, undefined);
});

test("responsive polish sheets own layout, never a second component skin", () => {
  const materialDeclaration =
    /(?:^|[;{]\s*)(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|clip-path|color|font|font-family|font-weight|text-shadow)\s*:/gm;
  for (const file of ["polish-desktop.css", "polish-mobile.css"]) {
    const css = fs.readFileSync(
      path.join(root, "src/presentation", file),
      "utf8",
    );
    assert.doesNotMatch(
      css,
      materialDeclaration,
      `${file} must contain geometry and responsive flow only`,
    );
  }
});
