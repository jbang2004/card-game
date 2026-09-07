/* Strict, immutable asset API. Cards, characters and relics have explicit routes. */
const EmberArt = (() => {
  function card(c) {
    const image = AnimeAssets[c?.id];
    if (!image) throw Error("Missing anime artwork for card: " + c?.id);
    return image;
  }
  function character(h) {
    return card({ id: h.portraitId });
  }
  function relic(id) {
    const image = EmberRelicAssets[id];
    if (!image) throw Error("Missing relic artwork: " + id);
    return image;
  }
  function icon(name) {
    const p = {
      sword: "M5 3l13 13m-3-1 4-4M3 3l2 7 4-4-6-3Zm13 13 4 4m-6-3 3-3",
      shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z",
      heart: "M20 5c-3-3-6-1-8 2C9 2 3 2 2 8c-1 5 10 13 10 13S24 11 22 7l-2-2Z",
      gem: "m12 2 8 10-8 10-8-10 8-10Zm0 0v20M4 12h16",
      book: "M12 5C8 2 3 3 2 4v16c3-2 7-1 10 1m0-16c4-3 9-2 10-1v16c-3-2-7-1-10 1V5Z",
      fire: "M13 2c2 7-6 8-4 14-5-1-3-6-3-6-10 12 16 19 14 4-1-7-6-8-7-12Z",
      arrow: "M4 12h16m-7-7 7 7-7 7",
      close: "m6 6 12 12M6 18 18 6",
      sound: "M4 9v6h4l5 4V5L8 9H4Zm12-2c4 3 4 7 0 10m3-13c6 4 6 12 0 16",
      mute: "M4 9v6h4l5 4V5L8 9H4Zm12 0 6 6m-6 0 6-6",
      settings:
        "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-6h4l1 4 4 1 3 3v4l-3 3-4 1-1 4h-4l-1-4-4-1-3-3v-4l3-3 4-1 1-4Z",
      map: "M3 5 9 2l6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17",
      help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
      skull:
        "M7 16v5h10v-5c9-9 2-14-5-14S-2 7 7 16Zm1-8v3m8-3v3m-4 2v2M9 18v3m6-3v3",
      pause: "M8 4v16M16 4v16",
      chevron: "m8 4 8 8-8 8",
      check: "m4 12 5 5L20 6",
      refresh: "M20 9A8 8 0 1 0 20 15M20 3v6h-6",
      full: "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6",
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name] || p.gem}"/></svg>`;
  }
  for (const c of EmberData.cards) card(c);
  for (const h of [...EmberData.heroes, ...EmberData.bosses]) character(h);
  for (const r of EmberData.relics) relic(r.id);
  return Object.freeze({ card, character, relic, icon });
})();
