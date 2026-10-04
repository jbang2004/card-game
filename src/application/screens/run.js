/* The descent's screens (EmberRun, rules/run.js; the words are EmberStory's): the Copper Kettle and its notebook,
 * each act's opening, its map, the people met on it, what is done with them, the events, the chapel, Amara's basket,
 * the spoils and the end of a run. Page-owned presentation and actions, injected by the application controller;
 * every change goes through EmberRun and is saved at once (context.saveRun), and what a run finds is folded into the
 * chronicle (EmberChronicle) as it goes. No theme colors or asset file names belong in this module. */
const EmberRunScreens = (() => {
  function create(context) {
    const { showModal, closeModal, toast, home, startRunBattle, saveRun, clearRun, showHeroes } = context;
    const D = EmberData,
      A = EmberArt,
      R = EmberRun,
      S = D.story,
      Chron = EmberChronicle,
      $ = (id) => document.getElementById(id);
    const { escape, cardHTML } = EmberCards;
    const heroOf = (run) => D.heroes.find((h) => h.id === run.heroId);
    const actOf = (run) => D.dungeon.acts[run.act];
    const tale = (run) => S.acts[actOf(run).id];
    const scene = (id) => EmberStoryArt.scenes[id];
    const prose = (lines) => (Array.isArray(lines) ? lines : [lines]).filter(Boolean).map((t) => `<p>${escape(t)}</p>`).join("");
    const RARITY = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };
    const TYPE = { minion: "随从", spell: "法术", weapon: "武器" };
    // the marks of the places on the map (24-unit line glyphs; an opponent's place shows its face instead)
    const GLYPH = {
      event: '<path d="M9 9a3 3 0 1 1 4.6 2.5c-1 .7-1.6 1.3-1.6 2.5"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/>',
      chapel: '<path d="M12 3c2.6 3 4 5 4 7.3A4 4 0 0 1 8 10.3C8 8.6 9 7.2 10.2 6c.2 1.3.8 2 1.6 2.4C11.500 6.600 11.400 4.800 12 3Z"/><path d="M6 20h12M8 17h8"/>',
      shop: '<path d="M5 10h14l-1.6 9H6.600ZM8 10l2.500-5M16 10l-2.500-5M9.500 13.500v2.500M12 13.500v2.500M14.500 13.500v2.500"/>',
      cache: '<path d="M4 10.500 12 6l8 4.500v7L12 21l-8-3.500ZM4 10.500l8 4 8-4M12 14.500V21"/>',
    };
    const glyph = (kind) => `<svg class="ui-icon run-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[kind] || ""}</svg>`;
    const flame = '<svg class="run-flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c3.600 4 6 7 6 10.600A6 6 0 0 1 6 12.600c0-2.400 1.300-4.300 3-6 .300 1.900 1.200 3 2.300 3.500C10.900 7.200 11.100 4.500 12 2Z"/></svg>';

    // ---------------------------------------------------------------- the chronicle
    /** save the run; fold what it found into the chronicle and say so when a page is new */
    function keep(run) {
      saveRun(run);
      const c = context.chronicle(), fresh = Chron.news(c, run);
      context.saveChronicle(Chron.absorb(c, run));
      if (fresh.length) {
        const page = S.pages.find((p) => p.id === fresh[fresh.length - 1]);
        toast(`手札新增一页：《${page.title}》`, { kind: "info" });
      }
    }
    function apply(result) {
      if (result.error) { toast(result.error); return null; }
      keep(result);
      return result;
    }

    // ---------------------------------------------------------------- faces
    /** the face, name and rules of an opponent as the screens show it */
    function faceOf(run, id = run.foe, tier = run.tier) {
      const f = R.foe(D, tier, id, { pawned: run.pawned });
      const boss = f.kind === "boss" ? D.bosses[f.bossIndex] : null;
      const who = boss || A.rivalFace(D.heroes.find((h) => h.id === f.hero), D.archetypes.find((a) => a.id === f.archetype));
      return { foe: f, boss, who, image: A.character(who), focus: EmberPortraits[who.portraitId]?.focus ?? 16 };
    }

    // ---------------------------------------------------------------- the run at a glance (every screen's header)
    function status(run) {
      const counts = {};
      for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
      const deckList = Object.keys(counts)
        .sort((a, b) => D.byId[a].cost - D.byId[b].cost || D.byId[a].name.localeCompare(D.byId[b].name))
        .map((id) => `<li><span class="run-deck-cost">${D.byId[id].cost}</span>${escape(D.byId[id].name)}${counts[id] > 1 ? ` <em>×${counts[id]}</em>` : ""}</li>`)
        .join("");
      const hero = heroOf(run), relic = (id) => D.relics.find((r) => r.id === id);
      const embers = Array.from({ length: D.dungeon.embers }, (_, i) => `<i class="${i < run.embers ? "lit" : ""}">${flame}</i>`).join("");
      const relics = run.relics.map(relic).map((r) => `<span class="run-relic" title="${escape(r.name)}：${escape(r.text)}"><img src="${A.relic(r.id)}" alt="${escape(r.name)}"></span>`).join("");
      const boons = run.boons.map(relic).map((r) => `<span class="run-relic run-boon" title="${escape(r.name)}（下一场战斗）：${escape(r.text)}"><img src="${A.relic(r.id)}" alt="${escape(r.name)}"></span>`).join("");
      const contracts = run.contracts.map((id) => `<span class="run-contract">${escape(D.byId[id].name)}</span>`).join("");
      return `<div class="run-status" aria-label="下井状态"><span class="run-hero"><img src="${A.character(hero)}" alt="" draggable="false">${escape(hero.name)}</span><span class="run-embers" role="img" aria-label="火种 ${run.embers} / ${D.dungeon.embers}" title="火种：输掉一场战斗熄灭一格，全部熄灭则被拉回地面">${embers}</span><span class="run-gold" title="马克">${A.icon("gem")}<strong>${run.gold}</strong></span>${relics ? `<span class="run-relics" aria-label="信物"><small>信物</small>${relics}</span>` : ""}${boons ? `<span class="run-relics" aria-label="祝福"><small>祝福</small>${boons}</span>` : ""}${contracts ? `<span class="run-contracts"><small>神契</small>${contracts}</span>` : ""}<details class="run-deck"><summary>牌组 <strong>${run.deck.length}</strong>${A.icon("chevron")}</summary><ul>${deckList}</ul></details></div>`;
    }
    /** one page of the descent: the scene behind it, a heading, the run's status, a body, a footer */
    function page({ run = null, step, art, eyebrow, title, sub = "", body, footer, free = false }) {
      showModal(
        `<section class="modal-box run-box${free ? " run-free" : ""}" data-run-step="${step}"><div class="run-backdrop" aria-hidden="true"><img src="${art}" alt="" draggable="false"></div><div class="modal-heading run-heading"><div class="run-title"><div class="run-eyebrow">${eyebrow}</div><h2>${title}</h2><p class="run-sub">${sub}</p></div>${run ? status(run) : ""}</div>${body}<div class="modal-footer run-footer">${footer}</div></section>`,
        "run",
        !free,
      );
      const back = $("run-home");
      if (back) back.onclick = () => { closeModal(false); home(); };
      // a card anywhere on a page can be read large
      document.querySelectorAll("#modal .run-box [data-card]").forEach((el) => {
        el.addEventListener("mouseenter", () => context.preview?.(el.dataset.card, el));
        el.addEventListener("mouseleave", () => context.hidePreview?.());
      });
    }
    // the footer every step shares: back to the tavern, a line of status, the step's action
    const foot = (hint, action, disabled = false, back = "回酒馆") =>
      `<button class="ghost-btn" id="run-home">${A.icon("return")}${back}</button><p id="run-selection" aria-live="polite">${hint}</p>${action ? `<button class="gold-btn" id="run-confirm" ${disabled ? "disabled" : ""}>${action} ${A.icon("arrow")}</button>` : ""}`;
    const pick = `<span class="run-pick" aria-hidden="true">${A.icon("check")}</span>`;
    const cardBox = (id, extra = "") => `<div class="run-card" data-card="${id}">${cardHTML(D.byId[id])}${extra}</div>`;
    // pick one of several buttons, then confirm
    function choice(selector, attr, label, onConfirm) {
      let picked = null;
      document.querySelectorAll(selector).forEach((b) => (b.onclick = () => {
        picked = b.dataset[attr];
        document.querySelectorAll(selector).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        $("run-selection").textContent = "已选择 · " + label(picked);
        $("run-confirm").disabled = false;
      }));
      $("run-confirm").onclick = () => picked != null && onConfirm(picked);
    }
    const tile = (cls, data, art, copy) =>
      `<button class="run-option lg-group ${cls}" ${data} aria-pressed="false"><span class="run-art">${art}</span><span class="run-copy">${pick}${copy}</span></button>`;

    // ---------------------------------------------------------------- choices (ways past, aftermaths, events)
    const FLAGS = { ledger: "那本没有字的册子" };
    /** what a choice asks and gives, as short tags under its label */
    function tags(c) {
      const out = [], n = c.needs || {};
      const need = (t) => out.push(`<em class="run-tag need">${escape(t)}</em>`), gain = (t, cls = "") => out.push(`<em class="run-tag ${cls}">${escape(t)}</em>`);
      if (n.hero) need("仅" + D.heroes.find((h) => h.id === n.hero).name);
      if (n.flag) need("需要：" + (FLAGS[n.flag] || n.flag));
      if (n.gold) need(`需要 ${n.gold} 马克`);
      if (n.embers) need(`至少 ${n.embers} 格火种`);
      if (n.pawned) need("当铺里有你的琥珀");
      for (const e of c.effects) {
        const [k] = Object.keys(e), v = e[k];
        if (k === "gold") gain(`${v > 0 ? "＋" : "－"}${Math.abs(v)} 马克`, v > 0 ? "" : "cost");
        else if (k === "ember") gain(`火种 ${v > 0 ? "＋" : "－"}${Math.abs(v)}`, v > 0 ? "warm" : "cost");
        else if (k === "card") gain(`获得「${D.byId[v].name}」`);
        else if (k === "cards") gain(`获得 ${v.count} 张${RARITY[v.rarity]}琥珀`);
        else if (k === "trophy") gain(`获得其琥珀「${D.byId[c.trophy].name}」`);
        else if (k === "relic") gain(v === "random" ? "一件信物" : `信物「${D.relics.find((r) => r.id === v).name}」`);
        else if (k === "boon") gain(`下一战：${D.relics.find((r) => r.id === v).name}`, "warm");
        else if (k === "forget") gain(`放下至多 ${v} 张牌`);
        else if (k === "copy") gain(`再封一张牌`);
        else if (k === "redeem") gain(`赎回 ${v} 张牌`);
        else if (k === "page") gain("手札一页");
        else if (k === "gamble") gain(`押 ${v.stake} · 赢得 ${v.prize}`);
      }
      return out.join("");
    }
    /** the step's choices as buttons; `trophy`: the opponent's own amber, for the tags */
    function choiceList(run, onPick) {
      const trophy = run.foe ? R.telling(D, run).trophy : null;
      const list = R.choices(D, run);
      const html = list.map((c) =>
        `<button class="run-choice lg-group" data-choice="${c.index}" ${c.open ? "" : "disabled"}><strong>${escape(c.label)}</strong><span class="run-tags">${tags({ ...c, trophy })}</span></button>`).join("");
      return {
        html: list.length ? `<div class="run-choices" role="group" aria-label="选择">${html}</div>` : "",
        bind: () => document.querySelectorAll("#modal [data-choice]").forEach((b) => (b.onclick = () => onPick(+b.dataset.choice))),
      };
    }
    const portrait = (face, cls = "") =>
      `<figure class="run-portrait ${cls}"><img src="${face.image}" alt="${escape(face.who.name)}" draggable="false" style="object-position:50% ${face.focus}%"></figure>`;
    const picture = (src, alt = "") => `<figure class="run-picture"><img src="${src}" alt="${escape(alt)}" draggable="false"></figure>`;

    // ---------------------------------------------------------------- the acts
    function intro(run) {
      const t = tale(run), hero = heroOf(run), first = run.act === 0, again = (run.epilogue && t.again) || {};
      // the shaft's speaking tube: Natan, to this bearer — or, once the root has been sealed, only the knocking
      const natan = D.bosses.find((b) => b.id === "dragon");
      const tube = again.voice
        ? `<blockquote class="run-vow run-voice run-voice-mute"><p>${escape(again.voice)}</p><cite>井壁上的铜管</cite></blockquote>`
        : !run.epilogue && t.voice && natan
          ? `<blockquote class="run-vow run-voice"><img src="${A.character(natan)}" alt="" draggable="false"><p>${[t.voice.all, t.voice[hero.id]].filter(Boolean).map(escape).join("<br>")}</p><cite>井壁上的铜管 · ${escape(natan.title)}</cite></blockquote>`
          : "";
      const words = first && ((run.epilogue && S.heroes[hero.id]?.again) || S.heroes[hero.id]?.vow);
      const vow = words ? `<blockquote class="run-vow"><img src="${A.character(hero)}" alt="" draggable="false"><p>${escape(words)}</p><cite>${escape(hero.name)}</cite></blockquote>` : "";
      page({
        run, step: "intro", art: scene(actOf(run).scene), eyebrow: escape(t.depth), title: `${escape(t.no)} · ${escape(t.name)}`,
        body: `<div class="run-intro"><div class="run-act-no">${escape(t.no)}</div><h3 class="run-act-name">${escape(t.name)}</h3><div class="run-prose">${prose(again.intro || t.intro)}</div>${tube}${vow}</div>`,
        footer: foot("", first ? "下井" : "继续向下"),
      });
      $("run-confirm").onclick = () => { const next = apply(R.begin(D, run)); if (next) show(next); };
    }
    /** the act's map: its places row by row, the ways between them, where the bearer stands and may go */
    function map(run) {
      const t = tale(run), rows = run.map.rows, open = R.ways(run), nextRow = run.at ? run.at.row + 1 : 0;
      // the places that can still be reached from here
      const reach = rows.map(() => new Set());
      open.forEach((c) => reach[nextRow].add(c));
      for (let r = nextRow; r < rows.length - 1; r++) for (const c of reach[r]) rows[r][c].next.forEach((n) => reach[r + 1].add(n));
      const state = (r, c) => run.path[r] === c ? (run.at.row === r ? "here" : "done") : r === nextRow && open.includes(c) ? "open" : reach[r]?.has(c) ? "ahead" : "closed";
      const X = (r, c) => ((c + 0.5) / rows[r].length) * 100, Y = (r) => ((r + 0.5) / rows.length) * 100;
      const lines = rows.map((row, r) => row.map((n, c) => n.next.map((b) => {
        const walked = run.path[r] === c && run.path[r + 1] === b, live = state(r, c) === "here" && open.includes(b);
        const cls = walked ? "walked" : live ? "live" : (reach[r].has(c) || state(r, c) === "here") && reach[r + 1].has(b) ? "ahead" : "closed";
        return `<line class="${cls}" x1="${X(r, c)}" y1="${Y(r)}" x2="${X(r + 1, b)}" y2="${Y(r + 1)}" vector-effect="non-scaling-stroke"/>`;
      }).join("")).join("")).join("");
      const nodes = rows.map((row, r) => row.map((n, c) => {
        const battle = !!n.foe, face = battle ? faceOf(run, n.foe, actOf(run).rows[r].tier) : null, st = state(r, c);
        const name = battle && n.kind !== "fight" ? face.who.name : n.kind === "event" ? S.places.event.name : S.places[n.kind].name;
        return `<button class="run-node kind-${n.kind} is-${st}" data-row="${r}" data-col="${c}" data-kind="${n.kind}"${n.foe ? ` data-foe="${n.foe}"` : ""} style="--x:${X(r, c)}%;--y:${Y(r)}%" aria-label="${escape(S.places[n.kind].name)}${battle ? " · " + escape(face.who.name) : ""}${st === "open" ? "，可前往" : st === "here" ? "，你在这里" : st === "done" ? "，已走过" : ""}" aria-pressed="false"><span class="run-node-disc">${battle ? `<img src="${face.image}" alt="" draggable="false" style="object-position:50% ${face.focus}%">` : glyph(n.kind)}</span><span class="run-node-name">${escape(name)}</span></button>`;
      }).join("")).join("");
      page({
        run, step: "map", art: scene(actOf(run).scene), eyebrow: `${escape(t.no)} · ${escape(t.depth)}`, title: escape(t.name),
        body: `<div class="run-map-wrap"><div class="run-map" style="--rows:${rows.length}"><svg class="run-ways" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div><aside class="run-node-info lg-sheet" aria-live="polite"></aside></div>`,
        footer: foot("选一处地方", "前往", true),
      });
      const info = document.querySelector("#modal .run-node-info"), buttons = [...document.querySelectorAll("#modal .run-node")];
      let picked = null;
      const describe = (r, c) => {
        const n = rows[r][c], P = S.places[n.kind];
        if (!n.foe) {
          const name = n.kind === "event" ? R.eventOf(D, run, n.event).title : P.name;
          return `<div class="run-info-kind kind-${n.kind}">${escape(P.name)}</div><h3>${escape(name)}</h3><p>${escape(P.hint)}</p>`;
        }
        const tier = actOf(run).rows[r].tier, f = faceOf(run, n.foe, tier), G = D.dungeon.gold;
        const prize = G.base + G.perTier * tier + (n.kind === "boss" ? G.boss : n.kind !== "fight" && f.boss ? G.elite : 0);
        return `<div class="run-info-kind kind-${n.kind}">${escape(P.name)}</div><div class="run-info-face"><img src="${f.image}" alt="" draggable="false" style="object-position:50% ${f.focus}%"><div><h3>${escape(f.who.name)}</h3><small>${escape(f.boss ? f.boss.title : f.foe.title)}</small></div></div><span class="run-foe-stats"><span>生命 <b>${f.foe.hp}</b></span><span>牌库 <b>${f.foe.deck.length}</b></span><span>赏金 <b>${prize}</b></span></span><p><strong>${escape(f.who.power)}</strong> · ${escape(f.who.powerText)}</p>${f.boss ? `<p class="run-phase">${escape(f.boss.phaseText)}</p>` : ""}<p class="run-info-hint">${escape(P.hint)}</p>`;
      };
      const select = (b) => {
        const r = +b.dataset.row, c = +b.dataset.col, can = r === nextRow && open.includes(c);
        buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        info.innerHTML = describe(r, c);
        picked = can ? c : null;
        $("run-confirm").disabled = !can;
        $("run-selection").textContent = can ? "已选择 · " + (b.querySelector(".run-node-name").textContent) : b.classList.contains("is-done") || b.classList.contains("is-here") ? "已经走过的地方" : "现在还走不到那里";
      };
      buttons.forEach((b) => {
        b.onclick = () => select(b);
        b.ondblclick = () => { select(b); if (picked != null) $("run-confirm").click(); };
      });
      $("run-confirm").onclick = () => { if (picked == null) return; const next = apply(R.travel(D, run, picked)); if (next) show(next); };
      const first = buttons.find((b) => b.classList.contains("is-open"));
      if (open.length === 1 && first) select(first);
      else info.innerHTML = `<div class="run-info-kind">${escape(t.no)}</div><h3>${escape(t.name)}</h3><p>${run.at ? "选一处亮着的地方，继续往下。" : "从最上面一排里，选一处开始。"}</p><ul class="run-legend">${["fight", "elite", "event", "chapel", "shop", "cache"].filter((k) => rows.flat().some((n) => n.kind === k)).map((k) => `<li><b>${escape(S.places[k].name)}</b>${escape(S.places[k].hint)}</li>`).join("")}</ul>`;
    }

    // ---------------------------------------------------------------- the people
    function encounter(run) {
      const f = faceOf(run), tell = R.telling(D, run), t = tale(run), kind = R.place(run).kind;
      const fell = run.fell
        ? `<div class="run-fell"><blockquote class="run-quote">${escape(tell.taunt || tell.fall)}</blockquote><p>神之琥珀烫了一下，把你拽了回来。火种熄了一格。${escape(f.who.name)}还站在原地。</p></div>`
        : `<div class="run-prose">${prose(tell.setup)}</div>${tell.start && !/^（/.test(tell.start) ? `<blockquote class="run-quote">${escape(tell.start)}</blockquote>` : ""}`;
      const ways = choiceList(run, (i) => { const next = apply(R.engage(D, run, i)); if (next) show(next); });
      page({
        run, step: "encounter", art: scene(actOf(run).scene), eyebrow: `${escape(t.name)} · ${escape(tell.place || S.places[kind].name)}`, title: escape(f.who.name), sub: escape(f.boss ? f.boss.title : f.foe.title),
        body: `<div class="run-scene">${portrait(f)}<div class="run-story"><div class="run-info-kind kind-${kind}">${escape(S.places[kind].name)}</div>${fell}<div class="run-rules lg-group"><span class="run-foe-stats"><span>生命 <b>${f.foe.hp}</b></span><span>牌库 <b>${f.foe.deck.length}</b></span></span><p><strong>${escape(f.who.power)}</strong> · ${escape(f.who.powerText)}</p>${f.boss ? `<p class="run-phase">${escape(f.boss.phaseText)}</p>` : ""}</div>${ways.html}</div></div>`,
        footer: foot(run.embers === 1 ? "最后一格火种：这一战输了，就会被拉回地面" : "战斗开始时生命全满", run.fell ? "再战" : "迎战"),
      });
      ways.bind();
      $("run-confirm").onclick = () => { const next = apply(R.engage(D, run)); if (next) { closeModal(false); startRunBattle(next); } };
    }
    /** what just happened: the words, and what was gained or given */
    function note(run) {
      const n = run.note, from = n.from || {}, t = tale(run);
      const f = from.foe ? faceOf(run, from.foe) : null, ev = from.event ? R.eventOf(D, run, from.event) : null;
      const relic = (id) => D.relics.find((r) => r.id === id);
      const gains = n.gains.map((g) =>
        g.kind === "gold" ? `<li class="gain-gold ${g.n < 0 ? "cost" : ""}">${A.icon("gem")}<b>${g.n > 0 ? "＋" : "－"}${Math.abs(g.n)}</b> 马克</li>`
        : g.kind === "ember" ? `<li class="gain-ember ${g.n < 0 ? "cost" : ""}">${flame}<b>火种 ${g.n > 0 ? "＋" : "－"}${Math.abs(g.n)}</b></li>`
        : g.kind === "page" ? `<li class="gain-page"><b>手札新增一页</b>《${escape(S.pages.find((p) => p.id === g.id).title)}》</li>`
        : g.kind === "relic" || g.kind === "boon" ? `<li class="gain-relic"><img src="${A.relic(g.id)}" alt=""><span><b>${g.kind === "boon" ? "祝福 · " : "信物 · "}${escape(relic(g.id).name)}</b>${escape(relic(g.id).text)}${g.kind === "boon" ? "（仅下一场战斗）" : ""}</span></li>`
        : "").join("");
      const cards = n.gains.filter((g) => g.kind === "card").map((g) => cardBox(g.id)).join("");
      page({
        run, step: "note", art: scene(from.place === "chapel" ? "chapel" : actOf(run).scene),
        eyebrow: escape(f ? (n.fallen ? "战斗胜利" : f.who.name) : ev ? "见闻" : from.place === "chapel" ? S.chapel.title : t.name),
        title: escape(f ? (n.fallen ? `${f.who.name}倒下了` : f.who.name) : ev ? ev.title : "歇脚"),
        body: `<div class="run-scene run-scene-note">${f ? portrait(f, n.fallen ? "fallen" : "") : ev ? picture(EmberStoryArt.events[ev.art], ev.title) : picture(scene("chapel"))}<div class="run-story">${n.fallen ? `<blockquote class="run-quote">${escape(n.say)}</blockquote>` : `<div class="run-prose run-say">${prose(n.say)}</div>`}${gains ? `<ul class="run-gains">${gains}</ul>` : ""}${cards ? `<div class="run-gain-cards">${cards}</div>` : ""}</div></div>`,
        footer: foot("", "继续"),
      });
      $("run-confirm").onclick = () => { const next = apply(R.ack(D, run)); if (next) show(next); };
    }
    function aftermath(run) {
      const f = faceOf(run), list = choiceList(run, (i) => { const next = apply(R.choose(D, run, i)); if (next) show(next); });
      page({
        run, step: "aftermath", art: scene(actOf(run).scene), eyebrow: "战后", title: `如何对待${escape(f.who.name)}`, sub: "拿走，还是放手。",
        body: `<div class="run-scene">${portrait(f, "fallen")}<div class="run-story"><div class="run-prose"><p>${escape(f.who.name)}看着你，等你做一个决定。</p></div>${list.html}</div></div>`,
        footer: foot("选一种做法", ""),
      });
      list.bind();
    }
    function event(run) {
      const ev = R.eventOf(D, run), list = choiceList(run, (i) => { const next = apply(R.choose(D, run, i)); if (next) show(next); });
      page({
        run, step: "event", art: scene(actOf(run).scene), eyebrow: `${escape(tale(run).name)} · 见闻`, title: escape(ev.title),
        body: `<div class="run-scene">${picture(EmberStoryArt.events[ev.art], ev.title)}<div class="run-story"><div class="run-prose">${prose(ev.text)}</div>${list.html}</div></div>`,
        footer: foot("选一种做法", ""),
      });
      list.bind();
    }
    function chapel(run) {
      const C = S.chapel, full = run.embers >= D.dungeon.embers;
      const option = (id, extra = "") => `<button class="run-choice lg-group" data-rest="${id}" ${id === "kindle" && full ? "disabled" : ""}><strong>${escape(C[id].label)}</strong><span class="run-tags"><em class="run-tag ${id === "kindle" ? "warm" : ""}">${escape(C[id].text)}${extra}</em></span></button>`;
      page({
        run, step: "chapel", art: scene("chapel"), eyebrow: `${escape(tale(run).name)} · 歇脚`, title: escape(C.title),
        body: `<div class="run-scene">${picture(scene("chapel"), C.title)}<div class="run-story"><div class="run-prose">${prose(C.text)}</div><div class="run-choices" role="group" aria-label="歇脚的方式">${option("kindle", full ? "（火种已满）" : "")}${option("forget")}${option("vigil")}</div></div></div>`,
        footer: foot("只能选一样", ""),
      });
      document.querySelectorAll("#modal [data-rest]").forEach((b) => (b.onclick = () => { const next = apply(R.rest(D, run, b.dataset.rest)); if (next) show(next); }));
    }
    /** Amara's basket: three cards, a keepsake, and a card struck for a price */
    function shop(run) {
      const wares = run.offer.cards.map((w, i) => `<div class="run-ware${w.sold ? " sold" : ""}">${cardBox(w.id)}<button class="ghost-btn run-buy" data-buy="${i}" ${w.sold || run.gold < w.price ? "disabled" : ""}>${w.sold ? "已售出" : `${A.icon("gem")}${w.price}`}</button></div>`).join("");
      const k = run.offer.relic, kr = k && D.relics.find((r) => r.id === k.id);
      const keepsake = k ? `<section class="run-keepsake lg-group${k.sold ? " sold" : ""}"><img src="${A.relic(k.id)}" alt=""><div><h3>${escape(kr.name)}</h3><p>${escape(kr.text)}</p></div><button class="ghost-btn run-buy" id="run-buy-relic" ${k.sold || run.gold < k.price ? "disabled" : ""}>${k.sold ? "已售出" : `${A.icon("gem")}${k.price}`}</button></section>` : "";
      const counts = {};
      for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
      const options = Object.keys(counts).sort((a, b) => D.byId[a].cost - D.byId[b].cost).map((id) => `<option value="${id}">${D.byId[id].cost}费 · ${escape(D.byId[id].name)}${counts[id] > 1 ? " ×" + counts[id] : ""}</option>`).join("");
      const letter = S.shop.notes[actOf(run).id];
      page({
        run, step: "shop", art: scene("basket"), eyebrow: `${escape(tale(run).name)} · 补给`, title: escape(S.shop.title), sub: escape(S.shop.text[0]),
        body: `<div class="run-tavern">${letter ? `<blockquote class="run-letter lg-group"><img src="${A.character({ portraitId: "amara" })}" alt="" draggable="false"><p>${escape(letter)}</p></blockquote>` : ""}<section class="run-shelf" aria-label="出售的卡牌"><h3>篮子里的琥珀</h3><div class="run-wares">${wares}</div></section><div class="run-shop-side">${keepsake}<section class="run-remove lg-group"><h3>放下一张牌</h3><p>牌组越精简，关键牌来得越快。每放下一次，价钱涨一点。</p><select id="run-remove-card" class="library-search" aria-label="要放下的牌">${options}</select><button class="ghost-btn" id="run-remove" ${run.gold < run.offer.removePrice || run.deck.length <= 5 ? "disabled" : ""}>放下 · ${A.icon("gem")}${run.offer.removePrice}</button></section></div></div>`,
        footer: foot("", "把篮子送回去"),
      });
      document.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => { const next = apply(R.buy(D, run, +b.dataset.buy)); if (next) shop(next); }));
      if ($("run-buy-relic")) $("run-buy-relic").onclick = () => { const next = apply(R.buyRelic(D, run)); if (next) shop(next); };
      $("run-remove").onclick = () => { const next = apply(R.remove(D, run, $("run-remove-card").value)); if (next) shop(next); };
      $("run-confirm").onclick = () => { const next = apply(R.leave(D, run)); if (next) show(next); };
    }
    /** pick a card: to put down, to seal a second time, or to take back from the pawnbroker */
    function pickCard(run) {
      const mode = run.offer.mode, list = mode === "redeem" ? run.pawned : run.deck, counts = {};
      for (const id of list) counts[id] = (counts[id] || 0) + 1;
      const ids = Object.keys(counts).sort((a, b) => D.byId[a].cost - D.byId[b].cost || D.byId[a].name.localeCompare(D.byId[b].name));
      const T = { forget: ["放手", "放下哪一块琥珀", `还可以放下 ${run.offer.count} 张。被放下的牌离开牌组，不再回来。`, "到此为止"], copy: ["再封一层", "把哪一块琥珀再封一次", "选一张牌，牌组里会多出一张一样的。", "不封了"], redeem: ["当铺的托盘", "赎回哪一块", "选一张上一次丢在井下的牌，它回到你的牌组。", "都不要了"] }[mode];
      page({
        run, step: "pick", art: scene(actOf(run).scene), eyebrow: T[0], title: T[1], sub: T[2],
        body: `<div class="run-picks" role="group" aria-label="${T[1]}">${ids.map((id) => `<button class="run-pick-card" data-pick-card="${id}" aria-label="${escape(D.byId[id].name)}">${cardBox(id)}${counts[id] > 1 ? `<span class="run-pick-count">×${counts[id]}</span>` : ""}</button>`).join("")}</div>`,
        footer: foot("点一张牌", T[3], false),
      });
      document.querySelectorAll("[data-pick-card]").forEach((b) => (b.onclick = () => { const next = apply(R.pickCard(D, run, b.dataset.pickCard)); if (next) show(next); }));
      $("run-confirm").onclick = () => { const next = apply(R.pickCard(D, run, null)); if (next) show(next); };
    }

    // ---------------------------------------------------------------- spoils
    function treasure(run) {
      const options = run.offer.treasures.map((t, i) => {
        if (t.kind === "relic") {
          const r = D.relics.find((x) => x.id === t.id);
          return tile("run-treasure run-relic-tile", `data-pick="${i}"`, `<img src="${A.relic(r.id)}" alt="${escape(r.name)}">`,
            `<span class="run-kind">信物</span><h3>${escape(r.name)}</h3><p>${escape(r.text)}</p>`);
        }
        const c = D.byId[t.id], contract = t.kind === "contract";
        return tile("run-treasure run-card-tile", `data-pick="${i}"`, cardBox(c.id),
          `<span class="run-kind${contract ? " run-kind-god" : ""}">${contract ? "神契" : "宝物牌"}</span><h3>${escape(c.name)}</h3><p>${contract ? "加入契约栏，献祭进度在整趟下井中累积。" + escape(EmberContracts.describe(c)) : "加入牌组。" + escape(c.text || "")}</p>`);
      }).join("");
      const cache = R.place(run).kind === "cache", words = S.cache.text[actOf(run).id];
      page({
        run, step: "treasure", art: scene(actOf(run).scene), eyebrow: cache ? `${escape(tale(run).name)} · 遗藏` : "守关者留下的", title: cache ? escape(S.cache.title) : "选一件带走", sub: escape(cache && words ? words[0] : "根战的器物、神的契约，或一块远古英雄的琥珀。"),
        body: `<div class="run-options run-treasures" style="--n:${run.offer.treasures.length}" role="group" aria-label="可选宝物">${options}</div>`,
        footer: foot("先选一件", "收下", true),
      });
      choice("[data-pick]", "pick", (i) => { const t = run.offer.treasures[i]; return t.kind === "relic" ? D.relics.find((x) => x.id === t.id).name : D.byId[t.id].name; }, (i) => { const next = apply(R.takeTreasure(D, run, +i)); if (next) show(next); });
    }
    function bundle(run) {
      const line = (id) => {
        const c = D.byId[id];
        return `<li><span class="run-deck-cost">${c.cost}</span><b>${escape(c.name)}</b><small>${TYPE[c.type] || ""}${c.type === "minion" || c.type === "weapon" ? ` ${c.atk}/${c.hp}` : ""}</small></li>`;
      };
      const options = run.offer.bundles.map((b, i) =>
        tile("run-bundle", `data-pick="${i}"`, `<span class="run-bundle-cards">${b.cards.map((id) => cardBox(id)).join("")}</span>`,
          `<h3>${escape(b.name)}</h3><p>${escape(b.text)}</p><ul class="run-bundle-names">${b.cards.map(line).join("")}</ul>`)).join("");
      page({
        run, step: "bundle", art: scene(actOf(run).scene), eyebrow: "缴获的琥珀", title: "选一组带走", sub: "三张同主题的牌一起加入牌组。也可以一张都不拿——牌组越精，越听话。",
        body: `<div class="run-options run-bundles" style="--n:${run.offer.bundles.length}" role="group" aria-label="可选卡包">${options}</div>`,
        footer: `<button class="ghost-btn" id="run-home">${A.icon("return")}回酒馆</button><p id="run-selection" aria-live="polite">先选一组</p><button class="ghost-btn" id="run-skip">都不拿</button><button class="gold-btn" id="run-confirm" disabled>加入牌组 ${A.icon("arrow")}</button>`,
      });
      choice("[data-pick]", "pick", (i) => run.offer.bundles[i].name, (i) => { const next = apply(R.takeBundle(D, run, +i)); if (next) show(next); });
      $("run-skip").onclick = () => { const next = apply(R.takeBundle(D, run, -1)); if (next) show(next); };
    }

    // ---------------------------------------------------------------- the end, the tavern, the notebook
    function end(run) {
      const won = run.step === "won", beyond = won && actOf(run).epilogue, E = S.endings, hero = heroOf(run);
      const before = context.chronicle(), after = Chron.close(before, run, D);
      const found = [...new Set([...run.pages, ...after.pages.filter((id) => !before.pages.includes(id))])];
      context.saveChronicle(after);
      clearRun();
      const text = beyond ? [...E.mirror.text, E.mirror.hero?.[hero.id], E.mirror.coda]
        : won ? [...E.seal.text, ...(run.flags.includes("promise") ? [E.seal.promise] : []), E.seal.hero[hero.id]] : E.lost.text;
      const fallen = !won && run.foe ? faceOf(run) : null;
      page({
        run, step: won ? "won" : "lost", art: scene(beyond ? "act5" : won ? "act4" : "tavern"),
        eyebrow: won ? (beyond ? "第九层 · 黑玉之界" : "终幕 · 根海") : `倒在${escape(tale(run).name)}${fallen ? " · " + escape(fallen.who.name) + "面前" : ""}`,
        title: escape(beyond ? E.mirror.title : won ? E.seal.title : E.lost.title),
        body: `<div class="run-ending"><div class="run-prose">${prose(text)}</div><div class="result-stats run-summary lg-group"><div><strong>${run.wins}</strong><span>胜场</span></div><div><strong>${run.deck.length}</strong><span>牌组</span></div><div><strong>${run.relics.length + run.contracts.length}</strong><span>信物与神契</span></div><div><strong>${found.length}</strong><span>手札</span></div></div>${!won && run.left.length ? `<p class="run-left">留在井下的琥珀：${run.left.map((id) => "「" + escape(D.byId[id].name) + "」").join("")}。典当人会替你“收着”。</p>` : ""}</div>`,
        footer: foot("", "回到铜壶酒馆", false, "回主页"),
      });
      $("run-confirm").onclick = () => hub();
    }
    const amara = () => portrait({ image: A.character({ portraitId: "amara" }), who: { name: "阿玛拉" }, focus: EmberPortraits.amara.focus });
    /** a bearer sets out: Amara's words at the counter (what she says depends on how the last descent ended), then
     *  the first act. Shown once, when the run is made; a reload goes straight to the act. */
    function sendoff(run) {
      const hero = heroOf(run);
      keep(run);
      page({
        run, step: "hub", art: scene("tavern"), eyebrow: "竖井镇 · 铜壶酒馆", title: `${escape(hero.name)}，下井`, sub: "大竖井边上的最后一盏灯",
        body: `<div class="run-scene run-hub">${amara()}<div class="run-story"><div class="run-info-kind">阿玛拉 · 老板娘</div><div class="run-prose run-say">${prose(Chron.greeting(context.chronicle(), D))}</div>${run.pawned.length ? `<p class="run-left">典当人手里有你上次丢下的琥珀：${run.pawned.map((id) => "「" + escape(D.byId[id].name) + "」").join("")}。</p>` : ""}</div></div>`,
        footer: foot("", "走向升降笼"),
      });
      $("run-confirm").onclick = () => show(run);
    }
    /** the Copper Kettle: Amara, and the way down */
    function hub() {
      const c = context.chronicle(), run = context.activeRun(), lines = run ? [S.amara.resume] : Chron.greeting(c, D);
      const clears = Chron.total(c);
      page({
        step: "hub", art: scene("tavern"), eyebrow: "竖井镇", title: "铜壶酒馆", sub: c.runs ? `下井 ${c.runs} 次 · 封根 ${clears} 次 · 手札 ${c.pages.length} / ${S.pages.length} 页` : "大竖井边上的最后一盏灯",
        body: `<div class="run-scene run-hub">${amara()}<div class="run-story"><div class="run-info-kind">阿玛拉 · 老板娘</div><div class="run-prose run-say">${prose(lines)}</div><div class="run-choices">${run ? `<button class="run-choice lg-group" id="hub-resume"><strong>继续往下</strong><span class="run-tags"><em class="run-tag warm">${escape(heroOf(run).name)} · ${escape(tale(run).name)}</em></span></button><button class="run-choice lg-group" id="hub-new"><strong>换一个人下井</strong><span class="run-tags"><em class="run-tag cost">放弃这一趟的进度</em></span></button>` : `<button class="run-choice lg-group" id="hub-new"><strong>选一位持珀者，下井</strong><span class="run-tags"><em class="run-tag">四块神之琥珀，四条路</em></span></button>`}<button class="run-choice lg-group" id="hub-notebook"><strong>翻看《根海手札》</strong><span class="run-tags"><em class="run-tag">${c.pages.length} / ${S.pages.length} 页</em></span></button></div></div></div>`,
        footer: foot("", "", false, "回主页"), free: true,
      });
      if ($("hub-resume")) $("hub-resume").onclick = () => context.resumeRun(run);
      $("hub-new").onclick = () => (run ? context.showConfirm("换一个人下井", "当前这一趟的进度会被放弃，带下去的琥珀不会留给典当人。手札和收藏不受影响。", () => showHeroes("campaign"), "选择持珀者") : showHeroes("campaign"));
      $("hub-notebook").onclick = () => notebook();
    }
    /** the Root-Sea Notebook: the pages found so far */
    function notebook() {
      const c = context.chronicle(), have = new Set(c.pages);
      const list = S.pages.map((p, i) => `<li><button class="run-page-tab" data-page="${i}" ${have.has(p.id) ? "" : "disabled"} aria-pressed="false"><small>${String(i + 1).padStart(2, "0")}</small>${have.has(p.id) ? escape(p.title) : "尚未找到"}</button></li>`).join("");
      page({
        step: "notebook", art: scene("tavern"), eyebrow: "阿玛拉替你收着的", title: "根海手札", sub: `已找到 ${c.pages.length} / ${S.pages.length} 页。每一趟下井，无论走到哪里，找到的页都会留下。`,
        body: `<div class="run-notebook"><ol class="run-pages" aria-label="手札页">${list}</ol><article class="run-page lg-sheet" aria-live="polite"><h3></h3><p></p></article></div>`,
        footer: foot("", "回柜台", false, "回主页"), free: true,
      });
      const tabs = [...document.querySelectorAll("#modal .run-page-tab")], pane = document.querySelector("#modal .run-page");
      const open = (i) => {
        tabs.forEach((t) => t.setAttribute("aria-pressed", String(+t.dataset.page === i)));
        pane.querySelector("h3").textContent = S.pages[i].title;
        pane.querySelector("p").textContent = S.pages[i].text;
      };
      tabs.forEach((t) => (t.onclick = () => open(+t.dataset.page)));
      const first = S.pages.findIndex((p) => have.has(p.id));
      if (first >= 0) open(first);
      else { pane.querySelector("h3").textContent = "空白的手札"; pane.querySelector("p").textContent = "下井去。找到的每一页，阿玛拉都会替你收在这里。"; }
      $("run-confirm").onclick = () => hub();
    }

    /** the screen for where the run stands (a battle in progress is the controller's) */
    function show(run) {
      // (the last opponent's last words are read before the ending)
      if (run.step === "lost") return end(run);
      if (run.note) return note(run);
      if (run.step === "won") return end(run);
      const screens = { intro, map, encounter, aftermath, event, chapel, shop, pick: pickCard, treasure, bundle };
      screens[run.step]?.(run);
    }
    /** a battle of the run is over: the run takes its result (once) and moves on */
    function afterBattle(run, s) {
      const settled = run.step === "battle" && s.mode === "run" && s.run.foe === run.foe && s.run.level === run.tier ? apply(R.resolve(D, run, s.winner, s.p.devotion)) : run;
      if (settled) show(settled);
    }
    return Object.freeze({ show, afterBattle, sendoff, hub, notebook });
  }
  return Object.freeze({ create });
})();
