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
    const role = "relic" + id[0].toUpperCase() + id.slice(1);
    const image =
      typeof EmberTheme !== "undefined" && EmberTheme.hasArt(role)
        ? EmberTheme.art(role)
        : EmberRelicAssets[id];
    if (!image) throw Error("Missing relic artwork: " + id);
    return image;
  }
  // Card badges: one cut gem per stat, seated in a pale metal bezel. The live
  // numeral is DOM text laid over the centre, so every gem keeps a calm,
  // mid-dark table there and pushes its facets and glints to the rim.
  const badgeArt = {
    // 法力：切割蓝宝石，六角台面。
    mana: (id) => `<defs>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f6fbff"/><stop offset=".5" stop-color="#9fb8d2"/><stop offset="1" stop-color="#e6f2ff"/></linearGradient>
    <linearGradient id="${id}-gem" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#bfefff"/><stop offset=".45" stop-color="#3f9fe0"/><stop offset="1" stop-color="#123a6b"/></linearGradient>
    <linearGradient id="${id}-table" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#2f78c4"/><stop offset="1" stop-color="#143f78"/></linearGradient>
    <radialGradient id="${id}-glint"><stop stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M50 3 89 25.5v49L50 97 11 74.5v-49Z" fill="url(#${id}-rim)" stroke="#2b4c73" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M50 9 83 28v44L50 91 17 72V28Z" fill="url(#${id}-gem)"/>
  <g fill="#fff"><path d="M50 9 83 28 50 30Z" opacity=".38"/><path d="M17 28 50 9 50 30Z" opacity=".55"/><path d="M17 28 50 30 17 72Z" opacity=".22"/></g>
  <g fill="#0b2a52"><path d="M83 28 83 72 50 30Z" opacity=".28"/><path d="M83 72 50 91 50 30Z" opacity=".42"/><path d="M17 72 50 91 50 30Z" opacity=".18"/></g>
  <path d="M50 27 71 39v24L50 75 29 63V39Z" fill="url(#${id}-table)" stroke="#8fd5ff" stroke-width=".9" stroke-opacity=".7" stroke-linejoin="round"/>
  <ellipse cx="33" cy="24" rx="12" ry="5" fill="url(#${id}-glint)" transform="rotate(-30 33 24)"/>
  <path d="M24 33Q33 21 45 20" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".85"/>`,
    // 攻击：一只正面握拳的黄金拳套，四指关节、拇指与护腕各嵌一颗宝石，
    // 手背铠板作为数字台面，体量与其余三枚徽章齐平。
    blade: (id) => {
      const finger = (x, gem) => `<path d="M${x} 40V15a8.5 8.5 0 0 1 17 0v25Z" fill="url(#${id}-gold)" stroke="#4a2a10" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M${x + 3} 14a5.5 5.5 0 0 1 8-3" stroke="#fff6dc" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".8"/>
    <path d="M${x + 1} 29h15" stroke="#6e3c0f" stroke-width="1" opacity=".7"/>
    <circle cx="${x + 8.5}" cy="20" r="4.2" fill="${gem}" stroke="#fff3c9" stroke-width=".9"/>
    <circle cx="${x + 7}" cy="18.5" r="1.3" fill="#fff" opacity=".85"/>`;
      return `<defs>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0bd"/><stop offset=".45" stop-color="#e2ad4a"/><stop offset="1" stop-color="#9a5f1c"/></linearGradient>
    <linearGradient id="${id}-plate" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d98d2e"/><stop offset="1" stop-color="#8a4e14"/></linearGradient>
    <linearGradient id="${id}-cuff" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#9a5f1c"/><stop offset=".5" stop-color="#f3c56a"/><stop offset="1" stop-color="#9a5f1c"/></linearGradient>
    <radialGradient id="${id}-glint"><stop stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M20 78h60l-4 18H24Z" fill="url(#${id}-cuff)" stroke="#4a2a10" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M22 86h56" stroke="#6e3c0f" stroke-width="1" opacity=".7"/>
  <circle cx="50" cy="88" r="3.8" fill="#ffe15a" stroke="#fff3c9" stroke-width=".9"/>
  ${finger(12, "#b56cff")}${finger(31, "#4ab0ff")}${finger(50, "#ff4a3a")}${finger(69, "#ffb33a")}
  <path d="M12 38h76v34a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8Z" fill="url(#${id}-gold)" stroke="#4a2a10" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M17 43h66v27a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5Z" fill="url(#${id}-plate)" stroke="#f3c56a" stroke-width=".9" stroke-opacity=".55" stroke-linejoin="round"/>
  <path d="M14 46c-8 4-11 14-7 24 2 6 8 10 15 9l4-12c-6-2-9-8-8-15Z" fill="url(#${id}-gold)" stroke="#4a2a10" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M10 56c-2 4-2 9 0 13" stroke="#fff6dc" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".7"/>
  <circle cx="13" cy="66" r="3.8" fill="#5ce39a" stroke="#fff3c9" stroke-width=".9"/>
  <ellipse cx="20" cy="11" rx="4.5" ry="2.2" fill="url(#${id}-glint)" transform="rotate(-20 20 11)"/>`;
    },
    // 生命：切割红宝石心形，金边包镶。
    heart: (id) => `<defs>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3c9"/><stop offset=".5" stop-color="#d9ad55"/><stop offset="1" stop-color="#fff0bd"/></linearGradient>
    <linearGradient id="${id}-gem" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb3c2"/><stop offset=".45" stop-color="#d9264f"/><stop offset="1" stop-color="#5a0f28"/></linearGradient>
    <linearGradient id="${id}-table" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c8284f"/><stop offset="1" stop-color="#7a1234"/></linearGradient>
    <radialGradient id="${id}-glint"><stop stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M50 96C27 78 6 62 6 36 6 19 18 6 33 6c7 0 13 3.5 17 9.5C54 9.5 60 6 67 6c15 0 27 13 27 30 0 26-21 42-44 60Z" fill="url(#${id}-rim)" stroke="#5a2f0a" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M50 89C31 74 12 59 12 37c0-13 9-25 21-25 7 0 13 4 17 10 4-6 10-10 17-10 12 0 21 12 21 25 0 22-19 37-38 52Z" fill="url(#${id}-gem)"/>
  <g fill="#fff"><path d="M12 37c0-13 9-25 21-25 7 0 13 4 17 10L50 40 22 45Z" opacity=".3"/><path d="M50 22c4-6 10-10 17-10L50 40Z" opacity=".16"/></g>
  <g fill="#3a0716"><path d="M67 12c12 0 21 12 21 25L50 40Z" opacity=".22"/><path d="M88 37c0 22-19 37-38 52L50 40Z" opacity=".4"/><path d="M50 89 22 45 50 40Z" opacity=".16"/></g>
  <path d="M50 34c-3-4-7-6-11-6-7 0-12 6-12 13 0 11 11 19 23 29 12-10 23-18 23-29 0-7-5-13-12-13-4 0-8 2-11 6Z" fill="url(#${id}-table)" stroke="#ff9fb5" stroke-width=".9" stroke-opacity=".6" stroke-linejoin="round"/>
  <ellipse cx="30" cy="24" rx="11" ry="5" fill="url(#${id}-glint)" transform="rotate(-25 30 24)"/>
  <path d="M20 30Q26 18 38 18" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".85"/>`,
    // 耐久：铆钉钢盾，中央压一块深钢板。
    ward: (id) => `<defs>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f6fbff"/><stop offset=".5" stop-color="#9fb8d2"/><stop offset="1" stop-color="#e6f2ff"/></linearGradient>
    <linearGradient id="${id}-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dbe7f2"/><stop offset=".5" stop-color="#7d92aa"/><stop offset="1" stop-color="#2e3c50"/></linearGradient>
    <linearGradient id="${id}-plate" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5f7590"/><stop offset="1" stop-color="#2a3748"/></linearGradient>
    <radialGradient id="${id}-glint"><stop stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M50 3 90 17v32c0 23-17 41-40 48C27 90 10 72 10 49V17Z" fill="url(#${id}-rim)" stroke="#1b262e" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M50 10 84 22v27c0 19-14 35-34 41-20-6-34-22-34-41V22Z" fill="url(#${id}-steel)"/>
  <path d="M50 10 84 22 50 34Z" fill="#fff" opacity=".2"/><path d="M16 22 50 10 50 34Z" fill="#fff" opacity=".32"/>
  <path d="M84 49c0 19-14 35-34 41V34Z" fill="#0d141a" opacity=".3"/>
  <path d="M50 26 72 34v16c0 12-9 22-22 27-13-5-22-15-22-27V34Z" fill="url(#${id}-plate)" stroke="#c6d6e6" stroke-width=".9" stroke-opacity=".6" stroke-linejoin="round"/>
  <g fill="#e6f2ff" stroke="#1b262e" stroke-width=".5"><circle cx="50" cy="16" r="1.8"/><circle cx="24" cy="26" r="1.8"/><circle cx="76" cy="26" r="1.8"/><circle cx="20" cy="50" r="1.8"/><circle cx="80" cy="50" r="1.8"/><circle cx="32" cy="74" r="1.8"/><circle cx="68" cy="74" r="1.8"/></g>
  <ellipse cx="32" cy="24" rx="11" ry="5" fill="url(#${id}-glint)" transform="rotate(-30 32 24)"/>
  <path d="M22 34Q30 22 44 19" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".8"/>`,
  };

  let badgeSerial = 0;
  function badgeFrame(kind) {
    const key = badgeArt[kind] ? kind : "mana";
    const id = "badge-" + ++badgeSerial;
    return `<svg class="badge-frame badge-${key}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${badgeArt[key](id)}</svg>`;
  }
  // Card and board stat gems: shape IS meaning. Attack is an amber diamond
  // behind crossed swords, health a ruby heart, weapon durability a cyan
  // shield. Each gem is a steel bezel stroke over a faceted fill with one top
  // specular sweep; the live numeral stays DOM text laid over the centre.
  const GEM_SHAPE = {
    blade: "M50 5 L95 50 L50 95 L5 50 Z",
    heart:
      "M50 91 C22 68 8 52 8 33 C8 19 19 9 31 9 C40 9 46 13 50 20 C54 13 60 9 69 9 C81 9 92 19 92 33 C92 52 78 68 50 91 Z",
    shield: "M50 6 L88 24 V58 Q88 66 82 71 L50 94 L18 71 Q12 66 12 58 V24 Z",
  };
  // Equal optical area: the diamond fills its box, the heart and shield do not.
  const GEM_SCALE = { blade: 1, heart: 0.94, shield: 0.96 };
  const GEM_TINT = {
    blade: ["#ffd27a", "#e8862a", "#6a2f06"],
    heart: ["#ff8a9c", "#c81a3c", "#4c0716"],
    shield: ["#a8f4ff", "#1d9ab8", "#063a4a"],
  };
  let gemSerial = 0;
  function statGem(kind) {
    const key = GEM_SHAPE[kind] ? kind : "blade";
    const [core, body, edge] = GEM_TINT[key];
    // Gradients are referenced by id, so every instance needs its own set.
    const id = "gem-" + ++gemSerial;
    const d = GEM_SHAPE[key];
    const T = `transform="translate(50 50) scale(${GEM_SCALE[key]}) translate(-50 -50)"`;
    const swords =
      key === "blade"
        ? `<defs><g id="${id}w"><path d="M50 -2 L56 10 V58 H44 V10 Z" fill="url(#${id}b)" stroke="#04091a" stroke-width="1.6" stroke-linejoin="round"/><rect x="35" y="58" width="30" height="6" rx="2" fill="#c9a24a" stroke="#04091a" stroke-width="1.4"/><rect x="45.5" y="64" width="9" height="16" rx="2" fill="#3a2a16" stroke="#04091a" stroke-width="1.2"/><circle cx="50" cy="85" r="4.6" fill="#c9a24a" stroke="#04091a" stroke-width="1.2"/><path d="M50 2 L52.5 10 V56 H50 Z" fill="#fff" opacity=".45"/></g></defs>
  <use href="#${id}w" transform="translate(50 50) scale(1.16) rotate(-40) translate(-50 -50)"/><use href="#${id}w" transform="translate(50 50) scale(1.16) rotate(40) translate(-50 -50)"/>`
        : "";
    return `<svg class="stat-gem stat-gem-${key}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef5fb"/><stop offset=".35" stop-color="#8ea3b8"/>
      <stop offset=".6" stop-color="#e3edf6"/><stop offset="1" stop-color="#5f7590"/>
    </linearGradient>
    <radialGradient id="${id}g" cx=".5" cy=".62" r=".62">
      <stop offset="0" stop-color="${core}"/><stop offset=".55" stop-color="${body}"/><stop offset="1" stop-color="${edge}"/>
    </radialGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${id}c"><path d="${d}" ${T}/></clipPath>
  </defs>
  ${swords}
  <g ${T}><path d="${d}" fill="#04091a"/>
  <path d="${d}" fill="url(#${id}g)" stroke="url(#${id}b)" stroke-width="5" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="#04091a" stroke-width="1.4" stroke-linejoin="round" transform="translate(50 50) scale(.9) translate(-50 -50)"/></g>
  <g clip-path="url(#${id}c)">
    <ellipse cx="46" cy="24" rx="34" ry="16" fill="url(#${id}s)"/>
    <path d="M12 60 Q50 74 88 60 V100 H12 Z" fill="#000" opacity=".28"/>
  </g>
</svg>`;
  }
  // Hero power emblems: layered, tinted marks that read at 26px on the battle
  // button and at 46px inside the hero chooser medallion. Each one keeps the
  // `ui-icon-<powerIcon>` class so hero bindings stay verifiable in tests.
  const spark = (x, y, r, fill, opacity = 1) =>
    `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28} ${x + r} ${y} ${x + r * 0.28} ${y + r * 0.28} ${x} ${y + r} ${x - r * 0.28} ${y + r * 0.28} ${x - r} ${y} ${x - r * 0.28} ${y - r * 0.28}Z" fill="${fill}" opacity="${opacity}"/>`;
  const halo = (id, c1, c2, cx = 32, cy = 32, r = 27, a = 0.5) =>
    `<radialGradient id="${id}-halo"><stop stop-color="${c1}" stop-opacity="${a}"/><stop offset=".6" stop-color="${c2}" stop-opacity="${a * 0.3}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-halo)"/>`;
  const lin = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((s, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${s}"/>`).join("")}</linearGradient>`;
  const rad = (id, stops) =>
    `<radialGradient id="${id}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
  const polar = (cx, cy, r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
  };
  // Gear outline: `teeth` trapezoid teeth between an outer and root radius.
  const gearPath = (cx, cy, outer, root, teeth) => {
    const pts = [];
    for (let i = 0; i < teeth; i++) {
      const a = (i * 360) / teeth,
        half = 360 / teeth / 2;
      pts.push(polar(cx, cy, root, a - half * 0.62), polar(cx, cy, outer, a - half * 0.3), polar(cx, cy, outer, a + half * 0.3), polar(cx, cy, root, a + half * 0.62));
    }
    return "M" + pts.map((p) => p.join(" ")).join("L") + "Z";
  };
  // Tapered rays fanned across an angular range.
  const rays = (cx, cy, from, to, start, end, count, width) => {
    let d = "";
    for (let i = 0; i < count; i++) {
      const a = start + ((end - start) * i) / (count - 1);
      const [x1, y1] = polar(cx, cy, from, a - width),
        [x2, y2] = polar(cx, cy, from, a + width),
        [x3, y3] = polar(cx, cy, to, a);
      d += `M${x1} ${y1}L${x3} ${y3}L${x2} ${y2}Z`;
    }
    return d;
  };
  // Laurel half-wreath: a stem arc with leaves laid along it.
  const laurel = (cx, cy, r, start, end, count, fill, stroke) => {
    const [sx, sy] = polar(cx, cy, r, start),
      [ex, ey] = polar(cx, cy, r, end),
      dir = end > start ? 1 : -1;
    let out = `<path d="M${sx} ${sy}A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${ex} ${ey}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>`;
    for (let i = 0; i < count; i++) {
      const a = start + ((end - start) * i) / (count - 1);
      for (const side of [-1, 1]) {
        const [x, y] = polar(cx, cy, r + side * 1.2, a),
          tilt = a + dir * 90 + side * 38 + dir * 10;
        out += `<path d="M0 0Q4 -2.6 8.5 0Q4 2.6 0 0Z" fill="${fill}" stroke="${stroke}" stroke-width=".45" transform="translate(${x} ${y}) rotate(${tilt.toFixed(1)})"/>`;
      }
    }
    return out;
  };
  const STEEL = ["#f2f7fc", "#aebfd1", "#5f7590"];
  const GOLD = ["#fff2c8", "#e2ad4a", "#8b5f22"];
  const emblems = {
    // ---- 英雄技能 -------------------------------------------------------
    // 星火：一簇余烬火焰，心口燃着一颗四芒星。
    fire: (id) => `<defs>
    ${lin(id + "-outer", ["#ffb457", "#ff6a2f", "#b8262f"])}
    ${lin(id + "-inner", ["#fff3c2", "#ffc466", "#ff8b3a"])}
    ${rad(id + "-core", [[0, "#fff", 1], [0.45, "#fff6d6", 0.9], [1, "#ffd27a", 0]])}
    ${halo(id, "#ff9c4a", "#ff7a2e", 32, 36, 27, 0.55)}
  <path d="M32 59C19.5 59 11 50 11 39.5 11 30 17.5 25.5 19.5 16.5 23.5 22.5 27 24 28.5 21.5 26 13.5 30 7.5 36.5 3.5 35.5 11.5 40.5 15 44.5 20 49 25.5 53 31 53 39.5 53 50 44.5 59 32 59Z" fill="url(#${id}-outer)"/>
  <path d="M32 55C24.5 55 19.5 49.5 19.5 42.5 19.5 36 24.5 32.5 26.5 27 28.5 31 30.5 32.5 32 30 31 25.5 33 21.5 36.5 18.5 36.5 24 40.5 27 42.5 31 44.5 34.5 44.5 38.5 44.5 42.5 44.5 49.5 39.5 55 32 55Z" fill="url(#${id}-inner)"/>
  <path d="M32 51C27.5 51 25 47.5 25 43.5 25 40.5 28 38.5 29.5 35.5 30.5 37.5 31.5 37.5 32.5 34.5 35 37.5 39 40.5 39 43.5 39 47.5 36.5 51 32 51Z" fill="#fffbe8" opacity=".92"/>
  <circle cx="32" cy="41" r="11" fill="url(#${id}-core)"/>
  <path d="M32 29.5 34.6 38.4 43.5 41 34.6 43.6 32 52.5 29.4 43.6 20.5 41 29.4 38.4Z" fill="#fff"/>
  <path d="M32 29.5 34.6 38.4 43.5 41 34.6 43.6 32 52.5Z" fill="#ffe7b0" opacity=".85"/>
  <g stroke="#ffd68a" stroke-width=".9" stroke-linecap="round" opacity=".9"><path d="M17 27.5 15.5 24m32 5-1.5-4"/></g>
  ${spark(50, 12, 3.2, "#d9c6ff")}${spark(13, 15, 2.4, "#ffe2a4")}${spark(54, 27, 1.8, "#ffe2a4", 0.85)}
  <circle cx="45" cy="9" r="1" fill="#fff" opacity=".8"/><circle cx="9" cy="27" r=".9" fill="#d9c6ff" opacity=".8"/>`,
    // 征召 / 誓约战旗：交叉长矛之前竖起一面金色军旗，旗心是初升的太阳。
    banner: (id) => `<defs>
    ${lin(id + "-cloth", ["#f7d98a", "#e2ad4a", "#a86f22"])}
    ${lin(id + "-pole", ["#fff0c0", "#d7ab58", "#8b5f22"], 0, 0, 1, 0)}
    ${lin(id + "-steel", STEEL, 0, 0, 1, 1)}
    ${halo(id, "#ffe6a0", "#f1c86e")}
  <g stroke="url(#${id}-steel)" stroke-width="2.6" stroke-linecap="round"><path d="M13 58 27 34M51 58 37 34"/></g>
  <path d="M27 34 22.5 27.5 29.5 29.5ZM37 34 41.5 27.5 34.5 29.5Z" fill="#e8f0f8"/>
  <rect x="30" y="8" width="4" height="52" rx="2" fill="url(#${id}-pole)"/>
  <path d="M32 2 36.5 9.5H27.5Z" fill="#fff2c8" stroke="#a97b2e" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M16 13H48" stroke="#f3d98f" stroke-width="3" stroke-linecap="round"/>
  <circle cx="16" cy="13" r="2.3" fill="#fff2c8"/><circle cx="48" cy="13" r="2.3" fill="#fff2c8"/>
  <path d="M18 15H46V43.5L38.5 38 32 47 25.5 38 18 43.5Z" fill="url(#${id}-cloth)" stroke="#fff0c2" stroke-width="1" stroke-linejoin="round"/>
  <path d="M21 18H43V40.5L38.5 37 32 45 25.5 37 21 40.5Z" fill="none" stroke="#fff4d0" stroke-width=".8" opacity=".55"/>
  <g stroke="#fff8e0" stroke-width="1.6" stroke-linecap="round"><path d="M32 20.5v3M25.5 23l2 2M38.5 23l-2 2M23 29.5h3M38 29.5h3"/></g>
  <path d="M25 33.5A7 7 0 0 1 39 33.5Z" fill="#fff8e0"/>
  <path d="M23.5 33.5H40.5" stroke="#8b5f22" stroke-width="1.2" stroke-linecap="round"/>`,
    // 穿心箭：一支银翎长箭自左下贯穿心脏，从右上破出。
    bow: (id) => `<defs>
    ${lin(id + "-heart", ["#d94a68", "#9c1f3f", "#4b0d22"])}
    ${lin(id + "-shaft", ["#9fb4c2", "#f4f9fc", "#b9cbd8"], 0, 1, 1, 0)}
    ${lin(id + "-head", ["#c6d6e2", "#ffffff"], 0, 1, 1, 0)}
    ${lin(id + "-feather", ["#bff5cf", "#3f9d63"], 0, 0, 1, 1)}
    ${halo(id, "#8fe0aa", "#4fb877", 32, 33, 27, 0.42)}
  <g stroke="#9ce4b4" stroke-width="1.2" stroke-linecap="round" opacity=".45"><path d="M6 50 18 38M12 60 22 50"/></g>
  <path d="M32 52C21 43 12.5 37 12.5 27.5 12.5 21 17 16.5 22.5 16.5 26.5 16.5 30 18.5 32 22 34 18.5 37.5 16.5 41.5 16.5 47 16.5 51.5 21 51.5 27.5 51.5 37 43 43 32 52Z" fill="url(#${id}-heart)" stroke="#f3b7c4" stroke-width="1" stroke-linejoin="round"/>
  <path d="M19 21.5C21 19.5 24 19.5 26.5 21" stroke="#ffd7df" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
  <path d="M35 27 32.5 33 35.5 36.5 32.5 42" stroke="#3a0716" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>
  <path d="M10.5 57.5 25 43" stroke="#26313d" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M10.5 57.5 25 43" stroke="url(#${id}-shaft)" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M38 30 51 17" stroke="#26313d" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M38 30 51 17" stroke="url(#${id}-shaft)" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M36 31.5C34.5 28.5 36.5 26 39.5 27.5Z" fill="#ffd3dc" opacity=".9"/>
  <path d="M57 11 46.5 14.5 53.5 21.5Z" fill="url(#${id}-head)" stroke="#5c7188" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M57 11 53.5 21.5" stroke="#8ea4b8" stroke-width=".8"/>
  <path d="M9 59 12.5 49 17 53.5Z" fill="url(#${id}-feather)" stroke="#1f4a33" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M9 59 19 55.5 14.5 51Z" fill="url(#${id}-feather)" stroke="#1f4a33" stroke-width=".8" stroke-linejoin="round"/>`,
    // 送魂灯：一盏悬挂的月光提灯，灯芯是一缕游魂，四周浮着灵魂微光。
    lantern: (id) => `<defs>
    ${lin(id + "-metal", ["#e3ecfb", "#8ea2c4", "#46587a"], 0, 0, 1, 1)}
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6e93e6" stop-opacity=".55"/><stop offset=".6" stop-color="#2c4188" stop-opacity=".78"/><stop offset="1" stop-color="#151f4a" stop-opacity=".92"/></linearGradient>
    ${rad(id + "-glow", [[0, "#e9fbff", 0.95], [0.45, "#8fe3ff", 0.55], [1, "#4ab0ff", 0]])}
    ${lin(id + "-soul", ["#ffffff", "#a6ecff", "#4fb6ff"])}
    ${halo(id, "#9ad8ff", "#6c8dff", 32, 34)}
  <path d="M51 7a5.2 5.2 0 1 0 4.6 7.6A4.2 4.2 0 0 1 51 7Z" fill="#e6edff" opacity=".9"/>
  <g fill="#bfefff"><circle cx="13" cy="20" r="1.7" opacity=".9"/><circle cx="10" cy="38" r="1.2" opacity=".7"/><circle cx="52" cy="30" r="1.4" opacity=".8"/><circle cx="47" cy="47" r="1" opacity=".6"/><circle cx="17" cy="52" r="1.1" opacity=".6"/></g>
  <g stroke="#bfefff" stroke-width=".8" stroke-linecap="round" opacity=".5"><path d="M13 23.5c-1 2 .5 3-.5 5M52 33c-1 2 .5 3-.5 5"/></g>
  <circle cx="32" cy="7" r="3" fill="none" stroke="url(#${id}-metal)" stroke-width="1.8"/>
  <path d="M32 10v3.5" stroke="#d6e1f5" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M22.5 13.5h19l-3 6h-13Z" fill="url(#${id}-metal)" stroke="#2f3d5c" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M25 19.5h14l3 5v20l-3 4H25l-3-4v-20Z" fill="url(#${id}-glass)" stroke="#c6d6f4" stroke-width="1.1" stroke-linejoin="round"/>
  <circle cx="32" cy="36" r="10.5" fill="url(#${id}-glow)"/>
  <path d="M32 44c-5 0-7.2-4.2-6.2-8.2C26.8 32 29.8 30 31 24.5c1.8 4 4.6 6 5.8 9.2C38.6 38.5 37 44 32 44Z" fill="url(#${id}-soul)"/>
  <path d="M32 41.5c-2.6 0-3.8-2.3-3.2-4.5.5-2 2-3.2 2.7-6 .9 2.2 2.4 3.3 3 5 .9 2.7.1 5.5-2.5 5.5Z" fill="#fff" opacity=".9"/>
  <g stroke="#dce8ff" stroke-width=".7" opacity=".45"><path d="M27 21v26M37 21v26"/></g>
  <path d="M24 48.5h16l-2 4.5H26Z" fill="url(#${id}-metal)" stroke="#2f3d5c" stroke-width=".8" stroke-linejoin="round"/>
  <circle cx="32" cy="56" r="2.4" fill="url(#${id}-metal)" stroke="#2f3d5c" stroke-width=".7"/>`,
    // ---- 职业印记（卡牌封印、契约标记）-----------------------------------
    // 星界：一颗放射的紫金星辰，外环绕着轨道弧线。
    star: (id) => `<defs>
    ${lin(id + "-body", ["#ffffff", "#d9c6ff", "#7b63e6"])}
    ${rad(id + "-core", [[0, "#fff", 1], [0.5, "#e6dcff", 0.8], [1, "#8f7cff", 0]])}
    ${halo(id, "#b9a4ff", "#6c5ce7", 32, 32, 27, 0.5)}
  <g fill="none" stroke="#c9b9ff" stroke-width="1.1" stroke-linecap="round" opacity=".7"><path d="M12 22A22 22 0 0 1 22 12M52 42A22 22 0 0 1 42 52"/><path d="M9 34A23 23 0 0 0 30 55" stroke-width=".7" opacity=".6"/></g>
  <circle cx="32" cy="32" r="13" fill="url(#${id}-core)"/>
  <path d="M32 6 36.2 26.5 57 32 36.2 37.5 32 58 27.8 37.5 7 32 27.8 26.5Z" fill="url(#${id}-body)" stroke="#5b47c9" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M32 6 36.2 26.5 57 32 32 32Z" fill="#fff" opacity=".55"/>
  <path d="M32 58 27.8 37.5 7 32 32 32Z" fill="#4b3aa8" opacity=".35"/>
  <path d="M32 17 34 30 45 32 34 34 32 47 30 34 19 32 30 30Z" fill="#fff" opacity=".9"/>
  ${spark(52, 12, 3, "#ffe2a4")}${spark(12, 50, 2.4, "#ffe2a4", 0.9)}${spark(50, 52, 1.8, "#d9c6ff", 0.9)}`,
    // 曙光：金色初阳越过地平线，光芒放射。
    sun: (id) => `<defs>
    ${lin(id + "-disc", ["#fffbe6", "#ffd978", "#e2952e"])}
    ${lin(id + "-ray", ["#fff2c8", "#e2ad4a"])}
    ${halo(id, "#ffe6a0", "#f1c86e", 32, 34, 27, 0.55)}
  <g fill="url(#${id}-ray)" stroke="#a97b2e" stroke-width=".5" stroke-linejoin="round">
    <path d="${rays(32, 35, 16.5, 29, -165, -15, 7, 4)}"/>
    <path d="${rays(32, 35, 16.5, 23.5, -152.5, -27.5, 6, 2.6)}" opacity=".7"/>
  </g>
  <circle cx="32" cy="35" r="13.5" fill="url(#${id}-disc)" stroke="#b07a2a" stroke-width="1"/>
  <path d="M22 30.5C25 25 32 24 36.5 26.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
  <path d="M10 45H54" stroke="#8b5f22" stroke-width="3" stroke-linecap="round"/>
  <path d="M10 45H54" stroke="#f3d98f" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M14 51H50M20 56H44" stroke="#e2ad4a" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
    // 荒猎：一支镶金环的猎号，翠绿号绳垂挂，号口向着荒野。
    hunt: (id) => `<defs>
    ${lin(id + "-horn", ["#f7efdc", "#c9b48a", "#6e5230"], 0, 0, 1, 1)}
    ${lin(id + "-band", GOLD)}
    ${lin(id + "-cord", ["#bff5cf", "#3f9d63"])}
    ${halo(id, "#8fe0aa", "#4fb877", 32, 33, 27, 0.45)}
  <path d="M14 9c-7 12-5 27 6 37 6 5 13 8 22 9l12-10c-9-1-16-4-21-9C24 27 21 18 22 8Z" fill="url(#${id}-horn)" stroke="#3b2a15" stroke-width="1" stroke-linejoin="round"/>
  <path d="M17 13c-4 11-1 22 8 31 5 5 11 7 17 8" fill="none" stroke="#fff8e8" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
  <ellipse cx="48" cy="50" rx="10" ry="5.2" transform="rotate(-38 48 50)" fill="#3b2a15" stroke="#e2c98f" stroke-width="1.3"/>
  <ellipse cx="48" cy="50" rx="6.2" ry="3" transform="rotate(-38 48 50)" fill="#8a6531"/>
  <g fill="url(#${id}-band)" stroke="#8b5f22" stroke-width=".7" stroke-linejoin="round">
    <path d="M12 7c3-1.5 7-1.5 11 0l-1 5c-3-1.5-7-1.5-10 0Z"/>
    <path d="M17 26c3 2 7 3 11 2l1 5c-4 1-8 0-12-2Z"/>
    <path d="M30 42c3 2 8 3 12 3l1 5c-5 0-10-1-14-3Z"/>
  </g>
  <path d="M15 12C6 20 5 32 11 43c2 4 5 8 9 11" fill="none" stroke="url(#${id}-cord)" stroke-width="2.3" stroke-linecap="round"/>
  <path d="M15 12C6 20 5 32 11 43c2 4 5 8 9 11" fill="none" stroke="#1f4a33" stroke-width=".6" opacity=".6"/>
  <path d="M9 36c-3-3-2-7 1-8 2 2 2 6-1 8Z" fill="#7fd39a" stroke="#1f4a33" stroke-width=".6"/>
  ${spark(53, 22, 2.6, "#d9ffe8", 0.9)}${spark(57, 36, 1.8, "#d9ffe8", 0.8)}`,
    // 冥月：银蓝新月与它环抱的暗夜，星辰与魂息点缀其间。
    moon: (id) => `<defs>
    ${lin(id + "-cres", ["#ffffff", "#c9d8ff", "#7f96d6"], 0, 0, 1, 1)}
    ${rad(id + "-night", [[0, "#2a3a78", 0.9], [1, "#101a44", 0.2]])}
    ${halo(id, "#9ad8ff", "#6c8dff", 32, 32, 27, 0.5)}
  <circle cx="32" cy="32" r="18" fill="url(#${id}-night)"/>
  <path d="M38 8A24 24 0 1 0 56 40 19 19 0 0 1 38 8Z" fill="url(#${id}-cres)" stroke="#5f77b8" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M30 14A18 18 0 0 0 20 40" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".75"/>
  <g fill="#e6edff"><circle cx="46" cy="18" r="1.4"/><circle cx="52" cy="28" r="1"/><circle cx="44" cy="46" r="1.2" opacity=".8"/></g>
  ${spark(50, 12, 2.8, "#fff")}${spark(55, 46, 2, "#bfefff", 0.9)}
  <path d="M43 30c-1.5 3 .8 4.5-.7 7.5" stroke="#bfefff" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".6"/>`,
    // ---- 遗物 -----------------------------------------------------------
    // 不熄之心：宝石般的心脏，顶端燃着不灭的余焰。
    heart: (id) => `<defs>
    ${lin(id + "-heart", ["#ff8fa6", "#c8284f", "#5a0f28"])}
    ${lin(id + "-flame", ["#fff3c2", "#ffb457", "#ff6a2f"])}
    ${halo(id, "#ff9cb0", "#e0405f", 32, 36, 27, 0.5)}
  <path d="M32 26c-2-5-6-8-11-8-6 0-10 4.5-10 10.5C11 39 20 46 32 57c12-11 21-18 21-28.5C53 22.5 49 18 43 18c-5 0-9 3-11 8Z" fill="url(#${id}-heart)" stroke="#ffc6d2" stroke-width="1" stroke-linejoin="round"/>
  <path d="M17 27c1.5-3 5-4.5 8.5-3.5" stroke="#ffe0e6" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".85"/>
  <ellipse cx="24" cy="31" rx="4" ry="6" fill="#fff" opacity=".16" transform="rotate(20 24 31)"/>
  <path d="M32 28c-6 0-9-4-9-9 0-4 3-6 4-10 1.5 2.5 3 3.5 4 2-1-3.5.5-6.5 3-8.5 0 3.5 3 5 4.5 7.5 1.5 2.5 2.5 4.5 2.5 6.5 0 5.5-4 11.5-9 11.5Z" fill="url(#${id}-flame)" stroke="#b8552a" stroke-width=".6"/>
  <path d="M32 25c-3 0-4.5-2-4.5-4.5 0-2 1.5-3 2.5-5 .6 1.2 1.2 1.2 1.8 0 1.4 1.8 3.7 3.5 3.7 5 0 2.5-1.5 4.5-3.5 4.5Z" fill="#fffbe8" opacity=".92"/>
  ${spark(48, 26, 2.2, "#ffe2a4", 0.9)}${spark(14, 44, 1.8, "#ffd7df", 0.8)}`,
    // 星界透镜：银环嵌着一枚水晶透镜，镜中映出星辰。
    orb: (id) => `<defs>
    ${lin(id + "-ring", STEEL, 0, 0, 1, 1)}
    ${rad(id + "-glass", [[0, "#eafaff", 0.95], [0.5, "#7bd5ec", 0.8], [1, "#153d67", 0.95]])}
    ${halo(id, "#9ad8ff", "#4ab0ff", 32, 32, 27, 0.5)}
  <g stroke="url(#${id}-ring)" stroke-width="2.4" fill="none"><circle cx="32" cy="32" r="21"/></g>
  <circle cx="32" cy="32" r="24.5" fill="none" stroke="#c6d6f4" stroke-width=".8" stroke-dasharray="2 4" opacity=".7"/>
  <circle cx="32" cy="32" r="18.5" fill="url(#${id}-glass)" stroke="#eaf6ff" stroke-width="1"/>
  <path d="M18 27c3-8 12-11 19-8" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".85"/>
  <path d="M46 39c-2 6-8 9-13 8" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".45"/>
  <path d="M32 21 34 30 43 32 34 34 32 43 30 34 21 32 30 30Z" fill="#fff"/>
  <g fill="#fff" opacity=".85"><circle cx="24" cy="38" r="1.1"/><circle cx="40" cy="25" r=".9"/></g>
  <g fill="url(#${id}-ring)" stroke="#2f3d5c" stroke-width=".6"><path d="M32 6 35 11H29ZM32 58 29 53H35ZM6 32 11 29V35ZM58 32 53 35V29Z"/></g>`,
    // 晨曦王冠：五尖金冠，冠心镶着朝霞宝石。
    sigil: (id) => `<defs>
    ${lin(id + "-gold", ["#fff2c8", "#e2ad4a", "#8b5f22"])}
    ${lin(id + "-gem", ["#ffe0a3", "#ff8a4a", "#b2361f"])}
    ${halo(id, "#ffe6a0", "#f1c86e", 32, 34, 27, 0.5)}
  <path d="M10 46 8 20 20 31 32 12 44 31 56 20 54 46Z" fill="url(#${id}-gold)" stroke="#a97b2e" stroke-width="1" stroke-linejoin="round"/>
  <path d="M10 46 8 20 20 31 32 12 32 46Z" fill="#fff" opacity=".18"/>
  <path d="M12 38 32 42 52 38" stroke="#8b5f22" stroke-width="1" fill="none" opacity=".6"/>
  <rect x="10" y="46" width="44" height="8" rx="2" fill="url(#${id}-gold)" stroke="#a97b2e" stroke-width="1"/>
  <g fill="#fff8e0"><circle cx="8" cy="20" r="2.2"/><circle cx="32" cy="12" r="2.6"/><circle cx="56" cy="20" r="2.2"/><circle cx="20" cy="31" r="1.6"/><circle cx="44" cy="31" r="1.6"/></g>
  <path d="M32 27 37 33 32 41 27 33Z" fill="url(#${id}-gem)" stroke="#fff0c2" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M32 27 37 33H27Z" fill="#fff" opacity=".4"/>
  <g fill="#7bd5ec" stroke="#fff" stroke-width=".5"><circle cx="18" cy="50" r="1.6"/><circle cx="32" cy="50" r="1.6"/><circle cx="46" cy="50" r="1.6"/></g>`,
    // 渡鸦之羽：一根泛着紫光的漆黑羽毛，羽尖凝着一点星辉。
    raven: (id) => `<defs>
    ${lin(id + "-quill", ["#8d7cc9", "#2c2350", "#0d0a1e"], 0, 0, 1, 1)}
    ${lin(id + "-sheen", ["#c9b6ff", "#6a55b8"], 0, 0, 1, 1)}
    ${halo(id, "#b9a4ff", "#5c4ac7", 32, 32, 27, 0.45)}
  <path d="M50 8C36 10 22 24 16 40c-2 5-3 10-3 15 6-2 12-6 17-11C42 32 50 22 50 8Z" fill="url(#${id}-quill)" stroke="#b7a6ee" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M50 8C40 16 30 30 19 48" stroke="url(#${id}-sheen)" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  <g stroke="#b7a6ee" stroke-width=".7" stroke-linecap="round" opacity=".55"><path d="M42 14 36 15M40 20 33 22M37 26 29 29M33 32 25 36M29 38 21 43"/></g>
  <path d="M16 40 13 55" stroke="#dcd2ff" stroke-width="2" stroke-linecap="round"/>
  <path d="M13 55 10 59" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  ${spark(51, 8, 3, "#fff")}${spark(14, 22, 2, "#d9c6ff", 0.85)}${spark(54, 44, 1.8, "#d9c6ff", 0.8)}`,
    // 初火余烬：一块炭黑余烬，裂纹中透出雷光般的初火。
    bolt: (id) => `<defs>
    ${lin(id + "-coal", ["#4a3c3a", "#211a1c", "#0e0a0c"])}
    ${lin(id + "-ember", ["#fff3c2", "#ffb457", "#ff4f2a"])}
    ${halo(id, "#ff9c4a", "#ff5a2e", 32, 34, 27, 0.55)}
  <path d="M14 26 24 12 44 10 54 22 52 44 40 56 20 54 10 42Z" fill="url(#${id}-coal)" stroke="#ff9a5a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M14 26 24 12 44 10 32 32Z" fill="#fff" opacity=".08"/>
  <path d="M37 12 26 33h8l-5 21 16-27h-8Z" fill="url(#${id}-ember)" stroke="#ffd9a6" stroke-width=".7" stroke-linejoin="round"/>
  <path d="M37 12 26 33h8" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  <g stroke="#ff7a3a" stroke-width="1.2" stroke-linecap="round" opacity=".85"><path d="M18 30 24 36M44 22 40 28M46 42 42 40M22 46 27 44"/></g>
  <g fill="#ffd27a"><circle cx="52" cy="14" r="1.4"/><circle cx="10" cy="50" r="1.1"/><circle cx="56" cy="50" r=".9"/></g>`,
    // ---- 战报 -----------------------------------------------------------
    // 凯旋：金色桂冠环抱着一簇升起的星火。
    victory: (id) => `<defs>
    ${lin(id + "-leaf", ["#fff2c8", "#e2ad4a", "#8b5f22"])}
    ${lin(id + "-flame", ["#fff3c2", "#ffc466", "#ff7a3a"])}
    ${halo(id, "#ffe6a0", "#f1c86e", 32, 32, 28, 0.6)}
  ${laurel(32, 34, 21, 118, 236, 6, `url(#${id}-leaf)`, "#a97b2e")}
  ${laurel(32, 34, 21, 62, -56, 6, `url(#${id}-leaf)`, "#a97b2e")}
  <path d="M26 56c2 2 10 2 12 0" stroke="#e2ad4a" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  <path d="M32 47c-7 0-11-5-11-11 0-5 4-8 5-13 2 3 4 4 5 2-1-4 1-8 4-10 0 4 3 6 5 9 2 3 3 6 3 9 0 7-5 14-11 14Z" fill="url(#${id}-flame)" stroke="#b8552a" stroke-width=".7"/>
  <path d="M32 43c-3.5 0-5.5-2.5-5.5-5.5 0-2.5 2-4 3-6.5.8 1.5 1.5 1.5 2.3 0 1.8 2.3 4.7 4.5 4.7 6.5 0 3-2 5.5-4.5 5.5Z" fill="#fffbe8" opacity=".92"/>
  ${spark(32, 8, 3, "#fff")}${spark(21, 22, 1.8, "#ffe2a4", 0.9)}${spark(43, 22, 1.8, "#ffe2a4", 0.9)}`,
    // 陨落：灰烬中的残裂头骨，眼窝里只剩将熄的余火。
    defeat: (id) => `<defs>
    ${lin(id + "-bone", ["#d9dee6", "#8d97a8", "#3f4756"])}
    ${rad(id + "-eye", [[0, "#ffb457", 1], [0.5, "#ff5a2e", 0.7], [1, "#3a0f0a", 0]])}
    ${halo(id, "#8d97a8", "#3a4356", 32, 32, 27, 0.45)}
  <path d="M32 6C18 6 10 16 10 28c0 6 3 11 7 14v8h30v-8c4-3 7-8 7-14C54 16 46 6 32 6Z" fill="url(#${id}-bone)" stroke="#e8edf5" stroke-width="1" stroke-linejoin="round"/>
  <path d="M38 8 33 20l5 5-4 9" stroke="#1d232e" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".8"/>
  <ellipse cx="23" cy="30" rx="6" ry="6.5" fill="#141922"/><ellipse cx="41" cy="30" rx="6" ry="6.5" fill="#141922"/>
  <circle cx="23" cy="31" r="4" fill="url(#${id}-eye)"/><circle cx="41" cy="31" r="3" fill="url(#${id}-eye)" opacity=".7"/>
  <path d="M32 36 29 42h6Z" fill="#141922"/>
  <g fill="url(#${id}-bone)" stroke="#2a313e" stroke-width=".6"><path d="M21 50h4v8h-4ZM27 50h4v9h-4ZM33 50h4v9h-4ZM39 50h4v8h-4Z"/></g>
  <g fill="#8d97a8" opacity=".7"><circle cx="10" cy="50" r="1.4"/><circle cx="54" cy="46" r="1.2"/><circle cx="14" cy="14" r="1"/></g>
`,
    // ---- 关键词 ---------------------------------------------------------
    // 嘲讽：一副带外弯犄角的青铜战面，眼缝里烧着怒火。
    "taunt-mask": (id) => `<defs>
    ${lin(id + "-bronze", ["#f0d6a0", "#b5793a", "#5a3516"])}
    ${lin(id + "-horn", ["#fff3d6", "#d9b16a", "#6e4a1c"], 0, 0, 1, 1)}
    ${halo(id, "#f0b070", "#b5793a", 32, 34, 27, 0.45)}
  <path d="M22 22C12 20 4 14 4 4c7 1 13 6 17 13ZM42 22c10-2 18-8 18-18-7 1-13 6-17 13Z" fill="url(#${id}-horn)" stroke="#f6e2b8" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M8 6c4 2 8 6 11 11M56 6c-4 2-8 6-11 11" fill="none" stroke="#6e4a1c" stroke-width=".7" opacity=".6"/>
  <path d="M32 12 48 21v18L32 56 16 39V21Z" fill="url(#${id}-bronze)" stroke="#f6e2b8" stroke-width="1" stroke-linejoin="round"/>
  <path d="M32 12 16 21v18l16 17Z" fill="#fff" opacity=".1"/>
  <path d="M32 14v12" stroke="#fff4d6" stroke-width="1" opacity=".7"/>
  <path d="M20 30 30 26.5l.5 5-9.5 2.5ZM44 30 34 26.5l-.5 5 9.5 2.5Z" fill="#161c2a"/>
  <path d="M22 30.5 29 28.5M42 30.5 35 28.5" stroke="#ff8a3a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M32 33v9" stroke="#3a2210" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M25 46c4 2.5 10 2.5 14 0" stroke="#3a2210" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  <g stroke="#3a2210" stroke-width="1.2" stroke-linecap="round"><path d="M28 45.5v3M32 46.8v3M36 45.5v3"/></g>`,
    // 圣盾：一面水晶棱面盾，盾心透出圣光。
    ward: (id) => `<defs>
    ${lin(id + "-face", ["#edfcff", "#7bd5ec", "#287eac", "#153d67"], 0, 0, 1, 1)}
    ${rad(id + "-light", [[0, "#fff", 0.9], [1, "#fff", 0]])}
    ${halo(id, "#9ad8ff", "#4ab0ff", 32, 32, 27, 0.5)}
  <path d="M32 5 54 14v18c0 13-9 22-22 27C19 54 10 45 10 32V14Z" fill="url(#${id}-face)" stroke="#eaf6ff" stroke-width="1.2" stroke-linejoin="round"/>
  <g fill="#fff" opacity=".22"><path d="M32 5 54 14 32 32Z"/><path d="M10 14 32 32 10 32Z" opacity=".6"/></g>
  <path d="M32 32 54 32c0 13-9 22-22 27Z" fill="#153d67" opacity=".35"/>
  <path d="M32 5v54M10 32h44" stroke="#fff" stroke-width=".8" opacity=".45"/>
  <ellipse cx="24" cy="18" rx="9" ry="4.5" fill="url(#${id}-light)" transform="rotate(-30 24 18)"/>
  <path d="M32 12 47 18v13c0 9-6 16-15 20-9-4-15-11-15-20V18Z" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>
  <path d="M32 22 34 30 42 32 34 34 32 42 30 34 22 32 30 30Z" fill="#fff"/>`,
    // 亡语：一枚泛着幽绿魂火的骷髅。
    "keyword-skull": (id) => `<defs>
    ${lin(id + "-bone", ["#eef2f6", "#b7c2cf", "#5b6675"])}
    ${rad(id + "-eye", [[0, "#d8ffe8", 1], [0.5, "#5ce39a", 0.8], [1, "#0b3a22", 0]])}
    ${halo(id, "#7cf0aa", "#2f9a63", 32, 34, 27, 0.5)}
  <g fill="#8ff0b0" opacity=".7"><path d="M12 22c-1-3 1-5 0-8 2 2 2 5 0 8ZM52 24c-1-3 1-5 0-8 2 2 2 5 0 8ZM10 42c-1-3 1-5 0-8 2 2 2 5 0 8Z"/></g>
  <path d="M32 8C19 8 11 17 11 29c0 6 3 10 7 13v7h28v-7c4-3 7-7 7-13C53 17 45 8 32 8Z" fill="url(#${id}-bone)" stroke="#f4f8fc" stroke-width="1" stroke-linejoin="round"/>
  <ellipse cx="23" cy="30" rx="6" ry="6.5" fill="#0d1a14"/><ellipse cx="41" cy="30" rx="6" ry="6.5" fill="#0d1a14"/>
  <circle cx="23" cy="31" r="4.2" fill="url(#${id}-eye)"/><circle cx="41" cy="31" r="4.2" fill="url(#${id}-eye)"/>
  <path d="M32 35 28.5 41h7Z" fill="#0d1a14"/>
  <g fill="url(#${id}-bone)" stroke="#3b4653" stroke-width=".6"><path d="M21 49h4v8h-4ZM27 49h4v9h-4ZM33 49h4v9h-4ZM39 49h4v8h-4Z"/></g>
  <path d="M22 14c3-3 7-4 10-4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`,
    // 冲锋：一道金色雷光劈开风痕。
    lightning: (id) => `<defs>
    ${lin(id + "-bolt", ["#fffbe6", "#ffd978", "#e2952e"])}
    ${halo(id, "#ffe6a0", "#f1c86e", 32, 32, 27, 0.55)}
  <g stroke="#fff2c8" stroke-width="1.2" stroke-linecap="round" opacity=".45"><path d="M8 24h10M6 32h8M10 40h9M46 26h8M48 36h10"/></g>
  <path d="M38 4 16 36h13l-4 24 23-34H34Z" fill="#8b5f22" transform="translate(1.5 1.5)" opacity=".6"/>
  <path d="M38 4 16 36h13l-4 24 23-34H34Z" fill="url(#${id}-bolt)" stroke="#fff6d6" stroke-width="1" stroke-linejoin="round"/>
  <path d="M38 4 16 36h13" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
  ${spark(50, 12, 2.6, "#fff")}${spark(14, 52, 2, "#ffe2a4", 0.9)}`,
    // ---- 说明与菜单 -----------------------------------------------------
    // 手牌：三张银蓝卡牌呈扇形展开。
    cards: (id) => `<defs>
    ${lin(id + "-face", ["#eef5fc", "#c3d3e2", "#7a8fa6"])}
    ${lin(id + "-art", ["#4a6fb4", "#1d2b57"])}
    ${halo(id, "#9ad8ff", "#4ab0ff", 32, 34, 27, 0.4)}
  <g transform="rotate(-18 32 46)"><rect x="21" y="14" width="22" height="32" rx="2.5" fill="url(#${id}-face)" stroke="#5c7188" stroke-width=".9"/><rect x="24" y="17" width="16" height="12" rx="1.2" fill="url(#${id}-art)" opacity=".8"/></g>
  <g transform="rotate(18 32 46)"><rect x="21" y="14" width="22" height="32" rx="2.5" fill="url(#${id}-face)" stroke="#5c7188" stroke-width=".9"/><rect x="24" y="17" width="16" height="12" rx="1.2" fill="url(#${id}-art)" opacity=".8"/></g>
  <rect x="21" y="10" width="22" height="34" rx="2.5" fill="url(#${id}-face)" stroke="#5c7188" stroke-width="1"/>
  <rect x="24" y="13" width="16" height="13" rx="1.2" fill="url(#${id}-art)"/>
  ${spark(32, 19.5, 3.2, "#fff")}
  <g stroke="#7a8fa6" stroke-width="1.2" stroke-linecap="round"><path d="M25 31h14M25 35h10M25 39h12"/></g>
  <circle cx="24.5" cy="13.5" r="2.2" fill="#7bd5ec" stroke="#fff" stroke-width=".6"/>`,
    // 沙漏：黄铜沙漏，沙粒在光中坠落。
    hourglass: (id) => `<defs>
    ${lin(id + "-brass", GOLD, 0, 0, 1, 0)}
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bfefff" stop-opacity=".45"/><stop offset="1" stop-color="#4a6fb4" stop-opacity=".3"/></linearGradient>
    ${lin(id + "-sand", ["#fff3c2", "#ffc466"])}
    ${halo(id, "#ffe6a0", "#f1c86e", 32, 32, 27, 0.4)}
  <path d="M20 12h24v6c0 6-6 10-9 14 3 4 9 8 9 14v6H20v-6c0-6 6-10 9-14-3-4-9-8-9-14Z" fill="url(#${id}-glass)" stroke="#dbe9f4" stroke-width="1"/>
  <path d="M24 16h16v2c0 4-5 7-8 10-3-3-8-6-8-10Z" fill="url(#${id}-sand)"/>
  <path d="M26 50h12c0-4-3-7-6-10-3 3-6 6-6 10Z" fill="url(#${id}-sand)"/>
  <path d="M32 30v14" stroke="#ffe2a4" stroke-width="1.2" stroke-dasharray="1.5 2" stroke-linecap="round"/>
  <g fill="url(#${id}-brass)" stroke="#8b5f22" stroke-width=".8" stroke-linejoin="round"><rect x="16" y="8" width="32" height="5" rx="1.5"/><rect x="16" y="51" width="32" height="5" rx="1.5"/></g>
  <g stroke="url(#${id}-brass)" stroke-width="2.2" stroke-linecap="round"><path d="M19 13v38M45 13v38"/></g>
  <path d="M23 18c1 3 3 5 5 7" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>`,
    // 手册：一本皮革典籍，书页间透出微光。
    book: (id) => `<defs>
    ${lin(id + "-cover", ["#5a7fc4", "#2c4188", "#151f4a"], 0, 0, 1, 1)}
    ${lin(id + "-page", ["#fffdf3", "#e8dfc4"])}
    ${lin(id + "-gold", GOLD)}
    ${halo(id, "#9ad8ff", "#6c8dff", 32, 32, 27, 0.4)}
  <path d="M14 12h32a4 4 0 0 1 4 4v34a2 2 0 0 1-2 2H16a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z" fill="url(#${id}-cover)" stroke="#c6d6f4" stroke-width="1" stroke-linejoin="round"/>
  <path d="M18 12v40" stroke="#8ea2c4" stroke-width="1" opacity=".6"/>
  <path d="M22 10h26v36H22Z" fill="url(#${id}-page)" stroke="#8b7b56" stroke-width=".8"/>
  <path d="M22 10v36c-1.5-1-3-1.5-4-1.5V12c1-1 2.5-1.8 4-2Z" fill="#c9bd9c"/>
  <g stroke="#b3a37a" stroke-width="1.2" stroke-linecap="round" opacity=".8"><path d="M27 18h16M27 23h16M27 28h11M27 33h16M27 38h9"/></g>
  <path d="M34 8 44 8 44 24 39 20 34 24Z" fill="#c8284f" stroke="#ffc6d2" stroke-width=".6" stroke-linejoin="round"/>
  <rect x="44" y="26" width="6" height="12" rx="1.2" fill="url(#${id}-gold)" stroke="#8b5f22" stroke-width=".7"/>
  ${spark(14, 20, 2.4, "#fff", 0.9)}${spark(52, 46, 2, "#ffe2a4", 0.85)}`,
    // 宝石：一枚切割的星蓝宝石。
    gem: (id) => `<defs>
    ${lin(id + "-top", ["#ffffff", "#bfefff", "#7bd5ec"], 0, 0, 1, 1)}
    ${lin(id + "-side", ["#5fbfe0", "#287eac", "#153d67"])}
    ${halo(id, "#9ad8ff", "#4ab0ff", 32, 32, 27, 0.5)}
  <path d="M18 12h28l12 14-26 32L6 26Z" fill="url(#${id}-side)" stroke="#eaf6ff" stroke-width="1" stroke-linejoin="round"/>
  <path d="M18 12h28l6 14H12Z" fill="url(#${id}-top)"/>
  <path d="M12 26h40L32 58Z" fill="#fff" opacity=".12"/>
  <path d="M24 26 32 12 40 26Z" fill="#fff" opacity=".45"/>
  <path d="M24 26 32 58 40 26Z" fill="#bfefff" opacity=".3"/>
  <path d="M6 26h52M24 26 32 58 40 26M24 26 18 12M40 26 46 12" stroke="#fff" stroke-width=".8" opacity=".5"/>
  ${spark(20, 18, 2.6, "#fff")}${spark(50, 40, 1.8, "#fff", 0.8)}`,
    // 首领情报：戴着裂痕的暗骨头骨，眼中燃着赤红杀意。
    skull: (id) => `<defs>
    ${lin(id + "-bone", ["#c9d1dc", "#6f7a8c", "#2b3240"])}
    ${rad(id + "-eye", [[0, "#ffd0c0", 1], [0.5, "#ff4a3a", 0.85], [1, "#3a0a0a", 0]])}
    ${halo(id, "#ff7a6a", "#7a2a2a", 32, 34, 27, 0.4)}
  <path d="M32 7C18 7 10 16 10 28c0 6 3 11 7 14v8h30v-8c4-3 7-8 7-14C54 16 46 7 32 7Z" fill="url(#${id}-bone)" stroke="#e1e8f2" stroke-width="1" stroke-linejoin="round"/>
  <path d="M27 8 30 18l-4 5 3 8" stroke="#141922" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>
  <ellipse cx="23" cy="30" rx="6" ry="6.5" fill="#141922"/><ellipse cx="41" cy="30" rx="6" ry="6.5" fill="#141922"/>
  <circle cx="23" cy="31" r="4" fill="url(#${id}-eye)"/><circle cx="41" cy="31" r="4" fill="url(#${id}-eye)"/>
  <path d="M32 35 29 41h6Z" fill="#141922"/>
  <g fill="url(#${id}-bone)" stroke="#1d232e" stroke-width=".6"><path d="M21 50h4v8h-4ZM27 50h4v9h-4ZM33 50h4v9h-4ZM39 50h4v8h-4Z"/></g>
  <path d="M8 26 4 18M56 26 60 18" stroke="#c9d1dc" stroke-width="2.2" stroke-linecap="round"/>`,
    // 远征图：一幅羊皮地图，红线勾出前路。
    map: (id) => `<defs>
    ${lin(id + "-paper", ["#fbf3dc", "#e5d5ad", "#b79d6b"], 0, 0, 1, 1)}
    ${halo(id, "#ffe6a0", "#c9a45a", 32, 32, 27, 0.4)}
  <path d="M8 14 22 8l20 6 14-6v40l-14 6-20-6-14 6Z" fill="url(#${id}-paper)" stroke="#8b7b56" stroke-width="1" stroke-linejoin="round"/>
  <path d="M22 8v40M42 14v40" stroke="#8b7b56" stroke-width=".8" opacity=".6"/>
  <path d="M14 40c6-8 10 2 16-6s8-10 14-14" stroke="#c8284f" stroke-width="1.6" stroke-dasharray="3 2.5" stroke-linecap="round" fill="none"/>
  <circle cx="14" cy="40" r="2.6" fill="#7bd5ec" stroke="#fff" stroke-width=".8"/>
  ${spark(44, 20, 3, "#c8284f")}
  <g stroke="#a48c5b" stroke-width=".9" stroke-linecap="round" opacity=".7"><path d="M27 26l3-3 3 3M30 34l2-2 2 2M12 22l2-2 2 2"/></g>`,
  };
  const heroPowers = new Set(["fire", "banner", "bow", "lantern"]);
  function icon(name) {
    // Traced against the 62×68 reference crop: broken rings and four tapered
    // cardinal points, not orbit ellipses or nested star polygons.
    if (name === "compass" || name === "compass-small") {
      const compact = name === "compass-small";
      return `<svg class="ui-icon ui-icon-compass" viewBox="0 0 62 68" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true" focusable="false">
        <path d="M25 13A22 22 0 0 0 8.5 30M8.5 39A22 22 0 0 0 25 56M34 56A22 22 0 0 0 51 39M51 30A22 22 0 0 0 34 13"/>
        ${compact ? "" : '<path d="M24 20A16 16 0 0 0 14 29M14 40A16 16 0 0 0 24 50M36 50A16 16 0 0 0 45 40M45 29A16 16 0 0 0 36 20" stroke-width=".75" opacity=".65"/>'}
        <g fill="currentColor" stroke="none">
          <path d="M12 16 26 27 23 30ZM49 15 38 30 34 27ZM49 54 34 42 38 39ZM10 55 23 39 26 42Z"/>
          <path d="M29.5 5 31.8 22Q32.5 26 35 28L32 30 29.5 15 27 30 24 28Q27 25 27.6 21Z"/>
          <path d="M59 34.5 41 36.5Q37 37 35 40L33 37 49 34.5 33 32 35 29Q38 32 42 32.6Z"/>
          <path d="M29.5 64 27.5 46Q27 42 24 40L27 38 29.5 54 32 38 35 40Q32 43 31.5 47Z"/>
          <path d="M1 34.5 18 32.5Q22 32 24 29L26 32 10 34.5 26 37 24 40Q21 37 17 36.5Z"/>
        </g>
        <path d="M29.5 29 34.5 34.5 29.5 40 24.5 34.5Z" stroke-width="1.05"/>
        <path d="M29.5 32.5 31.2 34.5 29.5 36.5 27.8 34.5Z" fill="currentColor" stroke="none"/>
      </svg>`;
    }
    // Layered silver blades use broad faces rather than intersecting wire outlines.
    // Local geometry keeps this small heraldic mark crisp at every UI scale.
    if (name === "swords") {
      const blade = (angle, front) => `<g transform="rotate(${angle} 32 32)">
        <path d="M32 3 36 12 34.5 41H29.5L28 12Z" fill="${front ? "#edf5fc" : "#a9bdcf"}" stroke="#617e98" stroke-width=".65"/>
        <path d="M32 3V41H29.5L28 12Z" fill="${front ? "#a9c3d9" : "#7896b0"}"/>
        <path d="M32 7V39" fill="none" stroke="#f5faff" stroke-opacity=".8" stroke-width=".75"/>
        <path d="M22 39.5 25 41 39 41 42 39.5 40 44 24 44Z" fill="${front ? "#dce8f1" : "#9eb3c5"}" stroke="#617e98" stroke-width=".65"/>
        <path d="M30 44H34V54H30Z" fill="#738da5" stroke="#dbe9f4" stroke-width=".7"/>
        <path d="M30 47H34M30 50H34" stroke="#dbe9f4" stroke-width=".75"/>
        <path d="M32 53 35 56 32 59 29 56Z" fill="#dceaf6" stroke="#617e98" stroke-width=".65"/>
      </g>`;
      return `<svg class="ui-icon ui-icon-swords" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${blade(-43, false)}${blade(43, true)}</svg>`;
    }
    if (emblems[name])
      return `<svg class="ui-icon ui-icon-emblem${heroPowers.has(name) ? " ui-icon-power" : ""} ui-icon-${name}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${emblems[name]("emblem-" + ++badgeSerial)}</svg>`;
    // Chrome glyphs: one confident 1.7px stroke for the silhouette, plus a
    // faint engraved detail layer, all in currentColor so states still tint.
    // Names that also exist as emblems never arrive here, so this map only
    // carries the system marks the emblem set deliberately leaves out.
    const faint = (d, w = 1) =>
      `<path d="${d}" stroke-width="${w}" opacity=".38"/>`;
    const glyphs = {
      return: `<path d="M9 5 3 11l6 6"/><path d="M3 11h10.5a5.5 5.5 0 0 1 0 11H10"/>`,
      plus: `<path d="M12 5v14M5 12h14"/>${faint("M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z")}`,
      waveform: `<path d="M4 10v4M8 6.5v11M12 3v18M16 7.5v9M20 10v4"/>`,
      monitor: `<path d="M3 4.5h18v12H3ZM9 20h6M12 16.5V20"/>${faint("M6 7.5h5")}`,
      arrow: `<path d="M4 12h15M13 6l6 6-6 6"/>`,
      close: `<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>${faint("M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z")}`,
      sound: `<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>${faint("M18.5 5.5a9.5 9.5 0 0 1 0 13", 1.2)}`,
      mute: `<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M16 9l6 6M22 9l-6 6"/>`,
      settings: `<path d="${gearPath(12, 12, 10, 7.4, 8)}"/><path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"/>`,
      chevron: `<path d="m9 5 7 7-7 7"/>`,
      check: `<path d="m4 12.5 5 5L20 6.5"/>${faint("M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z")}`,
      refresh: `<path d="M20.5 14.5a9 9 0 1 1-2.1-9.4L21 7.5M21 3v5h-5"/>`,
      full: `<path d="M4 9V4h5M15 4h5v5M4 15v5h5M15 20h5v-5"/>${faint("M9 9h6v6H9Z")}`,
      lock: `<path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5Z"/><path d="M12 14.5v3"/>`,
      menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
    };
    // Unknown names resolve to the `gem` emblem so a missing binding renders the
    // same mark as an explicit icon("gem") instead of a second, line-art gem.
    if (!glyphs[name]) return icon("gem");
    return `<svg class="ui-icon ui-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${glyphs[name]}</svg>`;
  }
  for (const c of EmberData.cards) card(c);
  for (const h of [...EmberData.heroes, ...EmberData.bosses]) character(h);
  for (const r of EmberData.relics) relic(r.id);
  return Object.freeze({ card, character, relic, icon, badgeFrame, statGem });
})();
