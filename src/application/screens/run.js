/* The expedition's screens (EmberRun, rules/run.js): the choice of opponent at each level, the treasures, the card
 * bundles, the tavern, the end of a run. Page-owned presentation and actions, injected by the application
 * controller; every change goes through EmberRun and is saved at once (context.saveRun). No theme colors or asset
 * file names belong in this module. */
const EmberRunScreens = (() => {
  function create(context) {
    const { showModal, closeModal, toast, home, startRunBattle, saveRun, clearRun, showHeroes } = context;
    const D = EmberData,
      A = EmberArt,
      R = EmberRun,
      $ = (id) => document.getElementById(id);
    const { escape, cardHTML } = EmberCards;
    const heroOf = (run) => D.heroes.find((h) => h.id === run.heroId);

    // ---------------------------------------------------------------- the run at a glance (every screen's header)
    function status(run) {
      const counts = {};
      for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
      const deckList = Object.keys(counts)
        .sort((a, b) => D.byId[a].cost - D.byId[b].cost || D.byId[a].name.localeCompare(D.byId[b].name))
        .map((id) => `<li><span class="run-deck-cost">${D.byId[id].cost}</span>${escape(D.byId[id].name)}${counts[id] > 1 ? ` <em>×${counts[id]}</em>` : ""}</li>`)
        .join("");
      const hero = heroOf(run);
      const relics = run.relics.map((id) => D.relics.find((r) => r.id === id)).map((r) => `<span class="run-relic" title="${escape(r.name)}：${escape(r.text)}">${A.icon(r.icon)}</span>`).join("");
      const contracts = run.contracts.map((id) => `<span class="run-contract">${escape(D.byId[id].name)}</span>`).join("");
      return `<div class="run-status" aria-label="远征状态"><span class="run-hero"><img src="${A.character(hero)}" alt="" draggable="false">${escape(hero.name)}</span><span class="run-gold" title="金币">${A.icon("gem")}<strong>${run.gold}</strong></span>${relics ? `<span class="run-relics" aria-label="遗物"><small>遗物</small>${relics}</span>` : ""}${contracts ? `<span class="run-contracts"><small>神契</small>${contracts}</span>` : ""}<details class="run-deck"><summary>牌组 <strong>${run.deck.length}</strong>${A.icon("chevron")}</summary><ul>${deckList}</ul></details></div>`;
    }
    // the path of the eight levels, and the stop after each (its treasure or its tavern; every stop also offers a
    // bundle): done, here, ahead (or, when a run is lost, the level it fell at). Between battles the player stands on the stop after the level just won.
    function track(run) {
      const L = D.dungeon.levels, won = run.step === "won", resting = ["treasure", "bundle", "tavern"].includes(run.step);
      const where = (n, stop) => won || n < run.level || (resting && n === run.level && !stop) ? "done"
        : n === run.level && !stop && run.step === "lost" ? "fell" : n === run.level && (stop ? resting : !resting) ? "current" : "ahead";
      const items = [];
      for (let n = 1; n <= L; n++) {
        const st = where(n, false), final = n === L;
        items.push(`<li class="run-step ${st}${final ? " final" : ""}" aria-label="第 ${n} 层${final ? " · 终战" : ""}${st === "done" ? " · 已通过" : st === "current" ? " · 当前" : st === "fell" ? " · 倒下之处" : ""}"><span>${n}</span>${final ? "<small>终战</small>" : ""}</li>`);
        if (n < L) {
          const kind = D.dungeon.treasureAfter.includes(n) ? "treasure" : D.dungeon.tavernAfter.includes(n) ? "tavern" : "";
          items.push(`<li class="run-stop ${kind} ${where(n, true)}" aria-hidden="true">${kind ? `<small>${kind === "treasure" ? "宝物" : "酒馆"}</small>` : "<i></i>"}</li>`);
        }
      }
      return `<ol class="run-track" aria-label="远征进度">${items.join("")}</ol>`;
    }
    function page(run, eyebrow, title, sub, body, footer) {
      showModal(
        `<section class="modal-box run-box" data-run-step="${run.step}"><div class="modal-heading run-heading"><div class="run-title"><div class="run-eyebrow">${eyebrow}</div><h2>${title}</h2><p class="run-sub">${sub}</p></div>${status(run)}${track(run)}</div>${body}<div class="modal-footer run-footer">${footer}</div></section>`,
        "run",
        true,
      );
      const back = $("run-home");
      if (back) back.onclick = () => { closeModal(false); home(); };
    }
    // the footer every step shares: back to the lobby, what is chosen, the step's action
    const foot = (hint, action, disabled = false) =>
      `<button class="ghost-btn" id="run-home">${A.icon("return")}返回营地</button><p id="run-selection" aria-live="polite">${hint}</p><button class="gold-btn" id="run-confirm" ${disabled ? "disabled" : ""}>${action} ${A.icon("arrow")}</button>`;
    // a tile's "picked" mark: an empty ring, a filled check once pressed
    const pick = `<span class="run-pick" aria-hidden="true">${A.icon("check")}</span>`;
    const TYPE = { minion: "随从", spell: "法术", weapon: "武器" };
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
    function apply(result) {
      if (result.error) { toast(result.error); return null; }
      saveRun(result);
      return result;
    }

    // ---------------------------------------------------------------- the steps
    // Every option is one tile: a picture well, then its words with the pick mark at their top right. The whole tile is
    // the button; the choice is confirmed in the footer.
    const tile = (cls, data, art, copy) =>
      `<button class="run-option lg-group ${cls}" ${data} aria-pressed="false"><span class="run-art">${art}</span><span class="run-copy">${pick}${copy}</span></button>`;
    function route(run) {
      const cards = run.offer.foes.map((id) => {
        const f = R.foe(D, run.level, id), boss = f.kind === "boss" ? D.bosses[f.bossIndex] : null, hero = boss ? null : D.heroes.find((h) => h.id === f.hero);
        const face = boss || hero, power = boss ? boss.power : hero.power, powerText = boss ? boss.powerText : hero.powerText;
        return tile(`run-foe run-foe-${f.kind}`, `data-foe="${id}"`, `<img src="${A.character(face)}" alt="${escape(face.name)}" draggable="false">`,
          `<span class="run-kind">${boss ? "首领" : "劲敌"}</span><h3>${escape(f.name)}</h3><small class="run-foe-title">${escape(f.title)}</small><span class="run-foe-stats"><span>生命 <b>${f.hp}</b></span><span>牌库 <b>${f.deck.length}</b> 张</span></span><p><strong>${escape(power)}</strong>${powerText ? " · " + escape(powerText) : ""}</p>${boss ? `<p class="run-phase">半血觉醒：${escape(boss.phaseText)}</p>` : ""}`);
      }).join("");
      const many = run.offer.foes.length > 1;
      page(run, `地下城远征 · 第 ${run.level} / ${D.dungeon.levels} 层`, many ? "选择你的对手" : "最终之战", many ? "两条路，选一个对手迎战。战斗开始时生命全满；失败一次，远征即告终结。" : "穿过最后的门，终焉在此等候。",
        `<div class="run-options run-foes" style="--n:${run.offer.foes.length}" role="group" aria-label="可选对手">${cards}</div>`,
        foot(many ? "先选择一个对手" : "准备好了就出发", "出发迎战", many));
      if (!many) $("run-confirm").onclick = () => fight(run, run.offer.foes[0]);
      else choice("[data-foe]", "foe", (id) => R.foe(D, run.level, id).name, (id) => fight(run, id));
    }
    function fight(run, id) {
      const next = apply(R.choose(D, run, id));
      if (next) { closeModal(false); startRunBattle(next); }
    }
    function treasure(run) {
      const options = run.offer.treasures.map((t, i) => {
        if (t.kind === "relic") {
          const r = D.relics.find((x) => x.id === t.id);
          return tile("run-treasure run-relic-tile", `data-pick="${i}"`, `<img src="${A.relic(r.id)}" alt="${escape(r.name)}">`,
            `<span class="run-kind">遗物</span><h3>${escape(r.name)}</h3><p>${escape(r.text)}</p>`);
        }
        const c = D.byId[t.id], contract = t.kind === "contract";
        return tile("run-treasure run-card-tile", `data-pick="${i}"`, cardBox(c.id),
          `<span class="run-kind${contract ? " run-kind-god" : ""}">${contract ? "神契" : "宝物牌"}</span><h3>${escape(c.name)}</h3><p>${contract ? "加入契约栏，献祭进度在整场远征中累积。" + escape(EmberContracts.describe(c)) : "加入牌组。" + escape(c.text || "")}</p>`);
      }).join("");
      page(run, `宝物 · 第 ${run.level} 层之后`, "选择一件宝物", "强大的遗物、神明的契约，或一张传奇之牌。",
        `<div class="run-options run-treasures" style="--n:${run.offer.treasures.length}" role="group" aria-label="可选宝物">${options}</div>`,
        foot("先选择一件宝物", "收下宝物", true));
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
      page(run, `战利品 · 第 ${run.level} 层之后`, "选择一组卡牌", "三张同主题的牌一起加入牌组。",
        `<div class="run-options run-bundles" style="--n:${run.offer.bundles.length}" role="group" aria-label="可选卡包">${options}</div>`,
        foot("先选择一组卡牌", "加入牌组", true));
      choice("[data-pick]", "pick", (i) => run.offer.bundles[i].name, (i) => { const next = apply(R.takeBundle(D, run, +i)); if (next) show(next); });
    }
    function tavern(run) {
      const wares = run.offer.cards.map((w, i) => `<div class="run-ware${w.sold ? " sold" : ""}">${cardBox(w.id)}<button class="ghost-btn run-buy" data-buy="${i}" ${w.sold || run.gold < w.price ? "disabled" : ""}>${w.sold ? "已售出" : `${A.icon("gem")}${w.price}`}</button></div>`).join("");
      const counts = {};
      for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
      const options = Object.keys(counts).sort((a, b) => D.byId[a].cost - D.byId[b].cost).map((id) => `<option value="${id}">${D.byId[id].cost}费 · ${escape(D.byId[id].name)}${counts[id] > 1 ? " ×" + counts[id] : ""}</option>`).join("");
      page(run, `鎏金酒馆 · 第 ${run.level} 层之后`, "在酒馆整备", "用赢来的金币买牌，或从牌组里删去一张。",
        `<div class="run-tavern"><section class="run-shelf" aria-label="出售的卡牌"><h3>货架</h3><div class="run-wares">${wares}</div></section><section class="run-remove lg-group"><h3>删去一张牌</h3><p>牌组越精简，关键牌来得越快。每删一次，价格上涨。</p><select id="run-remove-card" class="library-search" aria-label="要删去的牌">${options}</select><button class="ghost-btn" id="run-remove" ${run.gold < run.offer.removePrice || run.deck.length <= 5 ? "disabled" : ""}>删去 · ${A.icon("gem")}${run.offer.removePrice}</button></section></div>`,
        foot("", "离开酒馆"));
      document.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => { const next = apply(R.buy(D, run, +b.dataset.buy)); if (next) tavern(next); }));
      $("run-remove").onclick = () => { const next = apply(R.remove(D, run, $("run-remove-card").value)); if (next) tavern(next); };
      $("run-confirm").onclick = () => { const next = apply(R.leave(D, run)); if (next) show(next); };
    }
    function end(run) {
      const won = run.step === "won";
      clearRun();
      page(run, won ? "远征完成" : "远征终结", won ? "余火不灭" : "火种未熄", won ? "八层之门尽数洞开，终焉在你面前熄灭。" : `你在第 ${run.level} 层倒下。每一次陨落，都是下一次重燃的序章。`,
        `<div class="result-stats run-summary lg-group"><div><strong>${run.wins}</strong><span>胜场</span></div><div><strong>${run.deck.length}</strong><span>牌组</span></div><div><strong>${run.relics.length + run.contracts.length}</strong><span>宝物</span></div></div>`,
        foot("", "新的远征"));
      $("run-confirm").onclick = () => { closeModal(false); showHeroes("campaign"); };
    }
    /** the screen for where the run stands (a battle in progress is the controller's) */
    function show(run) {
      if (run.step === "route") route(run);
      else if (run.step === "treasure") treasure(run);
      else if (run.step === "bundle") bundle(run);
      else if (run.step === "tavern") tavern(run);
      else if (run.step === "won" || run.step === "lost") end(run);
    }
    /** a battle of the run is over: the run takes its result (once) and moves on */
    function afterBattle(run, s) {
      const settled = run.step === "battle" && s.mode === "run" && s.run.foe === run.foe && s.run.level === run.level ? apply(R.resolve(D, run, s.winner, s.p.devotion)) : run;
      if (settled) show(settled);
    }
    return Object.freeze({ show, afterBattle });
  }
  return Object.freeze({ create });
})();
