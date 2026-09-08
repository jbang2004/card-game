/* Current named deck collection only; obsolete test data may be reset explicitly. */
const EmberDeckStore = (() => {
  const Rules =
    typeof EmberDeckRules !== "undefined"
      ? EmberDeckRules
      : require("../rules/decks.js");
  const KEY = "emberfall.deck.v1";
  const empty = () => ({ version: 2, activeId: null, decks: [] });
  const cardsValid = (cards) =>
    Array.isArray(cards) && cards.every((id) => typeof id === "string");
  function decode(raw, data) {
    if (raw === null) return empty();
    if (
      !raw ||
      raw.version !== 2 ||
      !Array.isArray(raw.decks) ||
      Object.keys(raw).some(
        (k) => !["version", "activeId", "decks"].includes(k),
      )
    )
      throw Error("无法读取此版本的牌组收藏，已保留原数据。");
    const ids = new Set();
    for (const d of raw.decks) {
      if (
        !d ||
        typeof d.id !== "string" ||
        !/^[a-z][a-z0-9_]*$/.test(d.id) ||
        ids.has(d.id) ||
        typeof d.name !== "string" ||
        !d.name.trim() ||
        d.name.length > 40 ||
        !data.heroes.some((h) => h.id === d.heroId) ||
        !cardsValid(d.cards) ||
        Object.keys(d).some(
          (k) => !["id", "name", "heroId", "cards"].includes(k),
        )
      )
        throw Error("牌组收藏内容损坏，已保留原数据。");
      ids.add(d.id);
    }
    if (!(raw.activeId === null || ids.has(raw.activeId)))
      throw Error("牌组选择记录损坏，已保留原数据。");
    return structuredClone(raw);
  }
  function create({ data, read, write }) {
    function load() {
      try {
        const result = read(KEY);
        if (!result.ok) throw Error("无法读取本地牌组，原数据不会被覆盖。");
        return { ok: true, collection: decode(result.value, data) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }
    function save({ id = null, name, heroId, cards }) {
      const loaded = load();
      if (!loaded.ok) return loaded;
      const result = Rules.check(data, cards, heroId);
      if (!heroId || !result.ok)
        return { ok: false, error: result.errors.join("；") || "请选择英雄" };
      if (typeof name !== "string" || !name.trim() || name.trim().length > 40)
        return { ok: false, error: "牌组名称需要 1–40 个字" };
      const collection = loaded.collection;
      const index = collection.decks.findIndex((d) => d.id === id);
      if (id !== null && index < 0)
        return { ok: false, error: "原牌组已不存在，请另存为新牌组。" };
      if (id === null) {
        let n = 1;
        while (collection.decks.some((d) => d.id === "deck_" + n)) n++;
        id = "deck_" + n;
      }
      const record = { id, name: name.trim(), heroId, cards: [...cards] };
      if (index < 0) collection.decks.push(record);
      else collection.decks[index] = record;
      collection.activeId = id;
      if (!write(KEY, collection))
        return {
          ok: false,
          error: "牌组未能保存，请检查浏览器存储设置后重试。",
        };
      return { ok: true, record, collection };
    }
    function reset() {
      const collection = empty();
      return write(KEY, collection)
        ? { ok: true, collection }
        : { ok: false, error: "无法重建牌组收藏，请检查浏览器存储设置。" };
    }
    return Object.freeze({ load, save, reset });
  }
  return Object.freeze({ create, decode });
})();
if (typeof module !== "undefined") module.exports = EmberDeckStore;
