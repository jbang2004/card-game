/* Strict, immutable asset API. Cards, characters and relics have explicit routes. */
const EmberArt = (() => {
  function card(c) {
    const record = CharacterCatalog[c?.id];
    const image = record && AnimeAssets[record.staticKey];
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
  /* Card badges. Each one is one self-contained SVG frame: a cut sapphire for
   * mana, an amber blade medallion for attack, a crimson heart crest for
   * health and a steel ward for weapon durability. Only solid tones are used,
   * so a frame needs no gradient ids and behaves identically whether one card
   * or sixty are on screen. Costs, attack and health stay live DOM text on
   * top of the frame; nothing is baked into the artwork. */
  const HEART =
    "M50 96C24 76 3 58 3 37 3 18 17 5 33 5c8 0 14 4.5 17 11 3-6.5 9-11 17-11 16 0 30 13 30 32 0 21-21 39-47 59Z";
  const SHIELD =
    "M50 3 94 17v30c0 26-20 45-44 51-24-6-44-25-44-51V17Z";
  const CREST = {
    mana: [
      '<polygon points="50,1 84,17 99,50 84,83 50,99 16,83 1,50 16,17" fill="#06192f"/>',
      '<polygon points="21,21 50,7 50,30 37.2,36.1" fill="#b4e6f9"/>',
      '<polygon points="50,7 79,21 62.8,36.1 50,30" fill="#86d2ee"/>',
      '<polygon points="79,21 93,50 68.9,48.9 62.8,36.1" fill="#4a9fd4"/>',
      '<polygon points="93,50 79,79 62.8,59.9 68.9,48.9" fill="#1b548e"/>',
      '<polygon points="79,79 50,93 50,66 62.8,59.9" fill="#123f72"/>',
      '<polygon points="50,93 21,79 37.2,59.9 50,66" fill="#1d5c96"/>',
      '<polygon points="21,79 7,50 31.1,48.9 37.2,59.9" fill="#3a86bf"/>',
      '<polygon points="7,50 21,21 37.2,36.1 31.1,48.9" fill="#5cb2de"/>',
      '<polygon points="50,30 62.8,36.1 68.9,48.9 62.8,59.9 50,66 37.2,59.9 31.1,48.9 37.2,36.1" fill="#2c77b6" stroke="#9fdcf2" stroke-width="1.4" stroke-opacity=".5"/>',
      '<polygon points="26,20.5 42,12.7 44.2,16.6 28.2,24.4" fill="#fff" opacity=".4"/>',
      '<polygon points="26,23.5 32,20.5 33.6,23.4 27.6,26.4" fill="#fff" opacity=".62"/>',
      '<path d="M79 79 93 50" fill="none" stroke="#bfeafc" stroke-width="1.8" stroke-opacity=".38"/>',
    ],
    blade: [
      '<circle cx="50" cy="50" r="49" fill="#3a2306"/>',
      '<circle cx="50" cy="50" r="46.4" fill="#e0ac48"/>',
      '<circle cx="50" cy="50" r="41.6" fill="none" stroke="#a8761f" stroke-width="2.6" stroke-opacity=".75"/>',
      '<circle cx="50" cy="50" r="44.6" fill="none" stroke="#ffeaa8" stroke-width="2.2" stroke-opacity=".7"/>',
      '<circle cx="50" cy="50" r="33" fill="#c08d24"/>',
      '<circle cx="50" cy="50" r="33" fill="none" stroke="#8a5c17" stroke-width="1.4" stroke-opacity=".75"/>',
      '<g transform="rotate(45 50 50)">',
      '<path d="M50 11 57.6 27 55.8 60H44.2L42.4 27Z" fill="#d3dfe5"/>',
      '<path d="M50 11 42.4 27 44.2 60H50Z" fill="#93a5ae"/>',
      '<rect x="29" y="60" width="42" height="7.6" rx="3.4" fill="#5a3a12"/>',
      '<rect x="31.5" y="60.8" width="37" height="1.9" rx=".95" fill="#e0b56a" opacity=".55"/>',
      '<rect x="45.6" y="67.6" width="8.8" height="13.6" rx="2.8" fill="#4a2f0c"/>',
      '<circle cx="50" cy="85" r="5.6" fill="#5a3a12"/>',
      '<circle cx="50" cy="85" r="2.8" fill="#e0b56a" opacity=".5"/>',
      "</g>",
      '<circle cx="50" cy="51" r="24" fill="#2c1c05" opacity=".22"/>',
      '<polygon points="8.5,38.9 14.8,25.3 25.3,14.8 41.1,7.9 42.5,14.8 29.4,20.5 20.5,29.4 15.2,40.7" fill="#fff6d8" opacity=".3"/>',
      '<ellipse cx="33.5" cy="24" rx="5" ry="2.2" fill="#fff" opacity=".5" transform="rotate(-30 33.5 24)"/>',
    ],
    heart: [
      `<path d="${HEART}" fill="#430e16"/>`,
      `<path d="${HEART}" fill="#ab2130" transform="translate(50 50) scale(.955) translate(-50 -50)"/>`,
      `<path d="${HEART}" fill="#c9484e" transform="translate(50 50) scale(.9) translate(-50 -50)"/>`,
      `<path d="${HEART}" fill="#7d1622" transform="translate(50 50) scale(.73) translate(-50 -50)"/>`,
      '<ellipse cx="31" cy="23" rx="12" ry="5" fill="#fff" opacity=".17" transform="rotate(-34 31 23)"/>',
      '<ellipse cx="27.5" cy="19" rx="4" ry="1.9" fill="#fff" opacity=".4" transform="rotate(-34 27.5 19)"/>',
    ],
    ward: [
      `<path d="${SHIELD}" fill="#1b262e"/>`,
      `<path d="${SHIELD}" fill="#b3c2c8" transform="translate(50 50) scale(.95) translate(-50 -50)"/>`,
      `<path d="${SHIELD}" fill="none" stroke="#eef4f6" stroke-width="2.4" stroke-opacity=".45" transform="translate(50 50) scale(.945) translate(-50 -50)"/>`,
      `<path d="${SHIELD}" fill="none" stroke="#6f8188" stroke-width="2" stroke-opacity=".5" transform="translate(50 50) scale(.84) translate(-50 -50)"/>`,
      `<path d="${SHIELD}" fill="#0d171c" opacity=".2" transform="translate(50 50) scale(.8) translate(-50 -50)"/>`,
      '<ellipse cx="34" cy="28" rx="11" ry="6" fill="#fff" opacity=".24" transform="rotate(-38 34 28)"/>',
      '<ellipse cx="30.5" cy="23.5" rx="3.6" ry="2" fill="#fff" opacity=".45" transform="rotate(-38 30.5 23.5)"/>',
    ],
  };
  function badgeFrame(kind) {
    const key = CREST[kind] ? kind : "mana";
    return `<svg class="badge-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${CREST[key].join("")}</svg>`;
  }
  function icon(name) {
    const p = {
      star: "M12 2 14.5 9.5 22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2ZM4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2",
      sun: "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2",
      hunt: "M12 5v16M8 3 5 8l4 5m7-10 3 5-4 5M3 5l1 7 8 6 8-6 1-7M8 19l4 3 4-3",
      moon: "M17 3A10 10 0 1 0 21 17 9 9 0 0 1 17 3ZM17 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z",
      sword: "M5 3l13 13m-3-1 4-4M3 3l2 7 4-4-6-3Zm13 13 4 4m-6-3 3-3",
      shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z",
      heart: "M20 5c-3-3-6-1-8 2C9 2 3 2 2 8c-1 5 10 13 10 13S24 11 22 7l-2-2Z",
      gem: "m12 2 8 10-8 10-8-10 8-10Zm0 0v20M4 12h16",
      book: "M12 5C8 2 3 3 2 4v16c3-2 7-1 10 1m0-16c4-3 9-2 10-1v16c-3-2-7-1-10 1V5Z",
      fire: "M13 2c2 7-6 8-4 14-5-1-3-6-3-6-10 12 16 19 14 4-1-7-6-8-7-12Z",
      arrow: "M4 12h16m-7-7 7 7-7 7",
      close: "m6 6 12 12M6 18 18 6",
      sound:
        "M11 5 6 9H2v6h4l5 4V5Zm4.54 3.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14",
      mute: "M11 5 6 9H2v6h4l5 4V5Zm11 4-6 6m0-6 6 6",
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
    const key = p[name] ? name : "gem";
    return `<svg class="ui-icon ui-icon-${key}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${p[key]}"/></svg>`;
  }
  for (const c of EmberData.cards) card(c);
  for (const h of [...EmberData.heroes, ...EmberData.bosses]) character(h);
  for (const r of EmberData.relics) relic(r.id);
  return Object.freeze({ card, character, relic, icon, badgeFrame });
})();
