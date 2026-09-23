const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
// The theme and scene sources are not in the repository; the runtime copies the
// build inlines (art/) are, so provenance checks skip and binding checks stay.
const sources = fs.existsSync(path.join(root, "assets/themes/silverblue"))
  ? {}
  : { skip: "assets/themes is not in the repository (see README 素材源)" };
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
test("theme artwork has independent roles, verified local payloads and provenance", sources, () => {
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
  const { theme, document, events } = runtime(definition);
  assert.equal(document.documentElement.dataset.theme, "replacement");
  assert.equal(document.title, "Test theme");
  // `data-skin` is the slate skin's CSS namespace, not a switch: it is written
  // unconditionally, with no URL parsing, for every theme definition.
  assert.equal(document.documentElement.dataset.skin, "slate");
  // The retired silverblue bitmap skins are gone: the backdrop is the only
  // custom property a definition without a victory seal publishes.
  assert.deepEqual(events, [
    ["--scene-backdrop", 'url("local/background.webp")'],
  ]);
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

// The battle backdrop is rendered live; the theme ships no scene bitmaps and
// the arena module owns its material maps (normal / roughness / AO / emission).
test("the theme ships no battle scene bitmaps; the arena owns its material maps", sources, () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, "src/presentation/themes/silverblue.js"), "utf8") + ";this.definition=EmberThemeDefinition", context);
  const { definition } = context;
  assert.equal(definition.encounters, undefined);
  assert.equal(definition.scenes.battle.art, null);
  assert.deepEqual(Object.keys(definition.art).filter((k) => k.startsWith("battle")), []);
  assert.equal(fs.existsSync(path.join(root, "assets/scenes/boss-topdown-v1")), false);
  assert.equal(fs.existsSync(path.join(root, "art/scenes/boss-topdown-v1")), false);
  const arena = fs.readFileSync(path.join(root, "src/presentation/arena-3d.js"), "utf8");
  const maps = [...arena.matchAll(/asset:(scenes\/lava-forge\/[\w-]+\.jpg)/g)].map((m) => m[1]);
  assert.equal(new Set(maps).size, 6);
  for (const file of maps) {
    const bytes = fs.readFileSync(path.join(root, "assets", file));
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.ok(bytes.length < 700 * 1024, file + " stays under 700 KB");
  }
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
