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
      const relics = run.relics.map((id) => D.relics.find((r) => r.id === id)).map((r) => `<span class="run-relic" title="${escape(r.name)}：${escape(r.text)}">${A.icon(r.icon)}</span>`).join("");
      const contracts = run.contracts.map((id) => `<span class="run-contract">${escape(D.byId[id].name)}</span>`).join("");
      return `<div class="run-status" aria-label="远征状态"><span class="run-hero">${escape(heroOf(run).name)}</span><span class="run-level">第 ${Math.min(run.level, D.dungeon.levels)} / ${D.dungeon.levels} 层</span><span class="run-gold" title="金币">${A.icon("gem")}<strong>${run.gold}</strong></span>${relics ? `<span class="run-relics">${relics}</span>` : ""}${contracts ? `<span class="run-contracts">${contracts}</span>` : ""}<details class="run-deck"><summary>牌组 <strong>${run.deck.length}</strong></summary><ul>${deckList}</ul></details></div>`;
    }
    // the map of the eight levels: done, here, ahead
    function track(run) {
      return `<ol class="run-track" aria-label="远征进度">${Array.from({ length: D.dungeon.levels }, (_, i) => {
        const n = i + 1, st = n < run.level || run.step === "won" ? "done" : n === run.level ? "current" : "ahead";
        const mark = n === D.dungeon.levels ? "终战" : D.dungeon.treasureAfter.includes(n) ? "宝物" : D.dungeon.tavernAfter.includes(n) ? "酒馆" : "";
        return `<li class="run-step ${st}${n === D.dungeon.levels ? " final" : ""}"><span>${n}</span>${mark ? `<small>${mark}</small>` : ""}</li>`;
      }).join("")}</ol>`;
    }
    function page(run, eyebrow, title, sub, body, footer) {
      showModal(
        `<section class="modal-box rewards-box run-box" data-run-step="${run.step}"><div class="modal-heading"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${sub}</p></div>${status(run)}${track(run)}${body}<div class="reward-footer">${footer}</div></section>`,
        "rewards",
        true,
      );
      const back = $("run-home");
      if (back) back.onclick = () => { closeModal(false); home(); };
    }
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
    function route(run) {
      const cards = run.offer.foes.map((id) => {
        const f = R.foe(D, run.level, id), boss = f.kind === "boss" ? D.bosses[f.bossIndex] : null, hero = boss ? null : D.heroes.find((h) => h.id === f.hero);
        const face = boss || hero, power = boss ? boss.power : hero.power, powerText = boss ? boss.powerText : hero.powerText;
        return `<button class="relic-choice crafted-panel lg-group run-foe run-foe-${f.kind}" data-foe="${id}" aria-pressed="false"><span class="relic-art run-portrait"><img src="${A.character(face)}" alt="${escape(face.name)}" draggable="false"></span><span class="run-kind">${boss ? "首领" : "劲敌"}</span><h3>${escape(f.name)}</h3><small class="run-foe-title">${escape(f.title)}</small><p class="run-foe-stats">生命 ${f.hp} · 牌库 ${f.deck.length} 张</p><p><strong>${escape(power)}</strong>${powerText ? " · " + escape(powerText) : ""}</p>${boss ? `<p class="run-phase">半血觉醒：${escape(boss.phaseText)}</p>` : ""}<span class="relic-pick-label">选择此对手</span></button>`;
      }).join("");
      page(run, "地下城远征 · 第 " + run.level + " 层", run.offer.foes.length > 1 ? "选择你的对手" : "最终之战", run.offer.foes.length > 1 ? "两条路，选一个对手迎战。战斗开始时生命全满；失败一次，远征即告终结。" : "穿过最后的门，终焉在此等候。",
        `<div class="relic-options run-foes" role="group" aria-label="可选对手">${cards}</div>`,
        `<div><button class="ghost-btn" id="run-home">返回营地</button><p id="run-selection" aria-live="polite">${run.offer.foes.length > 1 ? "先选择一个对手" : "准备好了就出发"}</p></div><button class="gold-btn" id="run-confirm" ${run.offer.foes.length > 1 ? "disabled" : ""}>出发迎战 ${A.icon("arrow")}</button>`);
      if (run.offer.foes.length === 1) $("run-confirm").onclick = () => fight(run, run.offer.foes[0]);
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
          return `<button class="relic-choice crafted-panel lg-group run-treasure" data-pick="${i}" aria-pressed="false"><span class="relic-art"><img src="${A.relic(r.id)}" alt="${escape(r.name)}"></span><span class="run-kind">遗物</span><h3>${escape(r.name)}</h3><p>${escape(r.text)}</p><span class="relic-pick-label">选择此宝物</span></button>`;
        }
        const c = D.byId[t.id];
        return `<button class="relic-choice crafted-panel lg-group run-treasure" data-pick="${i}" aria-pressed="false">${cardBox(c.id)}<span class="run-kind">${t.kind === "contract" ? "神契" : "宝物牌"}</span><h3>${escape(c.name)}</h3><p>${t.kind === "contract" ? "加入契约栏：献祭进度在整场远征中累积。" + escape(EmberContracts.describe(c)) : "加入牌组。"}</p><span class="relic-pick-label">选择此宝物</span></button>`;
      }).join("");
      page(run, "宝物 · 第 " + run.level + " 层之后", "选择一件宝物", "强大的遗物、神明的契约，或一张传奇之牌。",
        `<div class="relic-options run-treasures" role="group" aria-label="可选宝物">${options}</div>`,
        `<div><button class="ghost-btn" id="run-home">返回营地</button><p id="run-selection" aria-live="polite">先选择一件宝物</p></div><button class="gold-btn" id="run-confirm" disabled>收下宝物 ${A.icon("arrow")}</button>`);
      choice("[data-pick]", "pick", (i) => { const t = run.offer.treasures[i]; return t.kind === "relic" ? D.relics.find((x) => x.id === t.id).name : D.byId[t.id].name; }, (i) => { const next = apply(R.takeTreasure(D, run, +i)); if (next) show(next); });
    }
    function bundle(run) {
      const options = run.offer.bundles.map((b, i) => `<button class="relic-choice crafted-panel lg-group run-bundle" data-pick="${i}" aria-pressed="false"><span class="run-kind">${escape(b.name)}</span><p>${escape(b.text)}</p><span class="run-bundle-cards">${b.cards.map((id) => cardBox(id)).join("")}</span><span class="run-bundle-names">${b.cards.map((id) => `<span><span class="run-deck-cost">${D.byId[id].cost}</span>${escape(D.byId[id].name)}</span>`).join("")}</span><span class="relic-pick-label">选择这组卡牌</span></button>`).join("");
      page(run, "战利品 · 第 " + run.level + " 层之后", "选择一组卡牌", "三张同主题的牌一起加入牌组。",
        `<div class="relic-options run-bundles" role="group" aria-label="可选卡包">${options}</div>`,
        `<div><button class="ghost-btn" id="run-home">返回营地</button><p id="run-selection" aria-live="polite">先选择一组卡牌</p></div><button class="gold-btn" id="run-confirm" disabled>加入牌组 ${A.icon("arrow")}</button>`);
      choice("[data-pick]", "pick", (i) => run.offer.bundles[i].name, (i) => { const next = apply(R.takeBundle(D, run, +i)); if (next) show(next); });
    }
    function tavern(run) {
      const wares = run.offer.cards.map((w, i) => `<div class="run-ware${w.sold ? " sold" : ""}">${cardBox(w.id)}<button class="ghost-btn run-buy" data-buy="${i}" ${w.sold || run.gold < w.price ? "disabled" : ""}>${w.sold ? "已售出" : `购买 · ${w.price} 金`}</button></div>`).join("");
      const counts = {};
      for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
      const options = Object.keys(counts).sort((a, b) => D.byId[a].cost - D.byId[b].cost).map((id) => `<option value="${id}">${D.byId[id].cost}费 · ${escape(D.byId[id].name)}${counts[id] > 1 ? " ×" + counts[id] : ""}</option>`).join("");
      page(run, "鎏金酒馆 · 第 " + run.level + " 层之后", "在酒馆整备", "用赢来的金币买牌，或从牌组里删去一张。",
        `<div class="run-tavern"><div class="run-wares" aria-label="出售的卡牌">${wares}</div><div class="run-remove crafted-panel lg-group"><h3>删去一张牌</h3><p>牌组越精简，关键牌来得越快。每删一次，价格上涨。</p><label><select id="run-remove-card" class="library-search" aria-label="要删去的牌">${options}</select></label><button class="ghost-btn" id="run-remove" ${run.gold < run.offer.removePrice || run.deck.length <= 5 ? "disabled" : ""}>删去 · ${run.offer.removePrice} 金</button></div></div>`,
        `<div><button class="ghost-btn" id="run-home">返回营地</button><p id="run-selection" aria-live="polite">金币 ${run.gold}</p></div><button class="gold-btn" id="run-confirm">离开酒馆 ${A.icon("arrow")}</button>`);
      document.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => { const next = apply(R.buy(D, run, +b.dataset.buy)); if (next) tavern(next); }));
      $("run-remove").onclick = () => { const next = apply(R.remove(D, run, $("run-remove-card").value)); if (next) tavern(next); };
      $("run-confirm").onclick = () => { const next = apply(R.leave(D, run)); if (next) show(next); };
    }
    function end(run) {
      const won = run.step === "won";
      clearRun();
      page(run, won ? "远征完成" : "远征终结", won ? "余火不灭" : "火种未熄", won ? "八层之门尽数洞开，终焉在你面前熄灭。" : `你在第 ${run.level} 层倒下。每一次陨落，都是下一次重燃的序章。`,
        `<div class="result-stats run-summary lg-group"><div><strong>${run.wins}</strong><span>胜场</span></div><div><strong>${run.deck.length}</strong><span>牌组</span></div><div><strong>${run.relics.length + run.contracts.length}</strong><span>宝物</span></div></div>`,
        `<div><button class="ghost-btn" id="run-home">返回营地</button><p id="run-selection"></p></div><button class="gold-btn" id="run-confirm">新的远征 ${A.icon("arrow")}</button>`);
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
