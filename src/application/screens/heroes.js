/* Page-owned presentation and actions, injected by the application controller.
 * No theme colors or asset file names belong in this module. */
const EmberHeroScreens = (() => {
  function create(context) {
    const {
      game,
      deckStore,
      library,
      showModal,
      closeModal,
      toast,
      startGame,
    } = context;
    const D = EmberData,
      A = EmberArt,
      $ = (id) => document.getElementById(id);
    const { escape, cardHTML, artStyleForHero } = EmberCards;
    let mulliganSet = new Set();
    function showHeroes() {
      const loaded = deckStore.load();
      const collection = loaded.ok
        ? loaded.collection
        : { decks: [], activeId: null };
      const customs = collection.decks.filter(
        (d) =>
          d.heroId === context.chosenHero &&
          game.validateDeck(d.cards, context.chosenHero),
      );
      const presets = D.archetypes.filter(
        (a) => a.classId === EmberDeckRules.classFor(D, context.chosenHero),
      );
      const hero = D.heroes.find((h) => h.id === context.chosenHero);
      const heroOptionPower = (h) =>
        h.id === "morla"
          ? "2 法力：献祭一个友方随从，触发亡语并抽 1 张牌。"
          : h.powerText;
      showModal(
        `<section class="modal-box hero-chooser"><div class="scene-showcase" data-theme-art="${EmberTheme.hasArt(hero.id) ? hero.id : "backdrop"}" aria-hidden="true"></div><div class="modal-heading"><div class="eyebrow">准备出发</div><h2>选择你的英雄</h2><p>选择英雄、套牌与对战方式。</p></div><div class="hero-roster"><div class="hero-roster-heading"><span>英雄名册</span></div><div class="hero-options">${D.heroes.map((h) => `<button class="hero-option hero-${h.id} ${h.id === context.chosenHero ? "selected" : ""}" data-hero="${h.id}" aria-pressed="${h.id === context.chosenHero}"><img src="${A.character(h)}" alt="${h.name}" draggable="false" style="${artStyleForHero(h, "option")}"><div class="hero-option-text"><small>${h.sub}</small><h3>${h.name}</h3><em>${heroOptionPower(h)}</em></div>${h.id === context.chosenHero ? '<span class="selected-check" aria-hidden="true">' + A.icon("check") + "</span>" : ""}</button>`).join("")}</div></div><div class="hero-configuration"><header class="hero-profile-heading"><small>${escape(hero.sub)}</small><h3>${escape(hero.name)}</h3></header><section class="hero-skill"><span class="theme-orbit" aria-hidden="true">${A.icon("star")}</span><div><strong>英雄技能</strong><p>${escape(heroOptionPower(hero))}</p></div></section><div class="hero-config-intro"><span class="config-kicker">出发准备</span><p class="hero-deck-note">${escape(loaded.ok ? (customs.length ? "可选用已保存的英雄牌组。" : "请选择职业套牌，或到收藏中建立命名牌组。") : loaded.error)} · 战役共 ${D.bosses.length} 场，关卡之间恢复全部生命。</p></div><label class="archetype-picker hero-config-deck">套牌 <select class="library-search" id="hero-archetype">${customs.map((d) => `<option value="saved:${d.id}" ${d.id === collection.activeId ? "selected" : ""}>${escape(d.name)}</option>`).join("")}${presets
          .map(
            (a) =>
              `<option value="${a.id}" ${!customs.length && a.id === D.heroes.find((h) => h.id === context.chosenHero).defaultDeckId ? "selected" : ""}>${a.name}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="archetype-picker hero-config-mode">玩法 <select id="game-mode" class="library-search"><option value="campaign">${D.bosses.length} 关战役 · 遗物与整备</option><option value="practice">练习对战 · 不覆盖战役存档</option></select></label><section class="hero-composition hero-config-composition" id="hero-composition" aria-label="牌组构成"></section><details class="contract-setup hero-config-contract"><summary>契约栏 · 最多三张，一位神祇</summary><p>契约不占主卡组，无需抽取；战斗中可查看召唤进度。</p>${
          D.cards
            .filter(
              (c) =>
                c.contract &&
                c.class === EmberDeckRules.classFor(D, context.chosenHero),
            )
            .map(
              (c) =>
                `<label><input type="checkbox" data-contract="${c.id}" checked><strong>${c.name}</strong><span>${EmberContracts.describe(c)}</span></label>`,
            )
            .join("") || "该职业尚无契约。"
        }</details><div class="hero-config-plan"><p id="hero-plan" class="deck-plan"></p><label class="archetype-picker" id="opponent-picker" hidden>对手 <select id="practice-opponent" class="library-search">${D.archetypes.map((a) => `<option value="${a.id}">${D.classNames[a.classId]} · ${a.name}</option>`).join("")}</select></label></div></div><div class="modal-footer"><button class="ghost-btn" id="hero-deck-btn">先去组牌</button><button class="gold-btn" id="hero-confirm">踏入余火之门 ${A.icon("arrow")}</button></div></section>`,
        "heroes",
      );
      document.querySelectorAll("[data-hero]").forEach(
        (b) =>
          (b.onclick = () => {
            const scrollTop =
              document.querySelector("#modal .folio-viewport")?.scrollTop || 0;
            const restoreFocus = document.activeElement === b;
            context.chosenHero = b.dataset.hero;
            EmberAudio.fx("ui");
            showHeroes();
            const scroll = document.querySelector("#modal .folio-viewport");
            if (scroll) scroll.scrollTop = scrollTop;
            if (restoreFocus)
              document
                .querySelector(`#modal [data-hero="${context.chosenHero}"]`)
                ?.focus({ preventScroll: true });
          }),
      );
      const compositionHTML = (cards) => {
        const list = (cards || []).map((id) => D.byId[id]).filter(Boolean);
        if (!list.length) return "";
        const counts = { minion: 0, spell: 0, weapon: 0 };
        const curve = Array(8).fill(0);
        for (const c of list) {
          if (counts[c.type] !== undefined) counts[c.type] += 1;
          curve[Math.min(7, c.cost || 0)] += 1;
        }
        const peak = Math.max(1, ...curve);
        const bars = curve
          .map(
            (n, i) =>
              `<i style="--fill:${Math.round((n / peak) * 100)}%" title="${i === 7 ? "7+" : i} 费 · ${n} 张"><b>${i === 7 ? "7+" : i}</b><s>${n || ""}</s></i>`,
          )
          .join("");
        return `<div class="comp-head"><h4>牌组构成</h4><span>${list.length} / ${D.deckRules.size} 张</span></div><div class="comp-counts"><span>随从 <b>${counts.minion}</b></span><span>法术 <b>${counts.spell}</b></span><span>武器 <b>${counts.weapon}</b></span></div><div class="comp-curve-title">费用分布</div><div class="comp-curve" aria-hidden="true">${bars}</div>`;
      };
      const plan = () => {
        const value = $("hero-archetype").value;
        const loadout =
          customs.find((d) => "saved:" + d.id === value)?.contracts ??
          D.heroes.find((h) => h.id === context.chosenHero).defaultContracts ??
          [];
        document
          .querySelectorAll("[data-contract]")
          .forEach(
            (el) => (el.checked = loadout.includes(el.dataset.contract)),
          );
        $("hero-plan").textContent =
          D.archetypes.find((a) => a.id === value)?.plan ||
          `使用已保存的 ${D.deckRules.size} 张英雄牌组。`;
        const cards = value.startsWith("saved:")
          ? customs.find((d) => "saved:" + d.id === value)?.cards
          : presets.find((a) => a.id === value)?.deck;
        $("hero-composition").innerHTML = compositionHTML(cards);
      };
      $("hero-archetype").onchange = plan;
      plan();
      $("game-mode").onchange = () => {
        $("opponent-picker").hidden = $("game-mode").value !== "practice";
        $("hero-confirm").textContent =
          $("game-mode").value === "practice" ? "开始练习对战" : "踏入余火之门";
      };
      $("hero-confirm").onclick = () => {
        const id = $("hero-archetype").value;
        const selected = id.startsWith("saved:")
          ? customs.find((d) => d.id === id.slice(6))?.cards
          : presets.find((a) => a.id === id)?.deck;
        if (!selected) {
          toast("请选择可用牌组");
          return;
        }
        startGame(
          context.chosenHero,
          0,
          [],
          selected,
          $("game-mode").value === "practice"
            ? {
                opponent: $("practice-opponent").value,
                contracts: [
                  ...document.querySelectorAll("[data-contract]:checked"),
                ].map((el) => el.dataset.contract),
              }
            : {
                contracts: [
                  ...document.querySelectorAll("[data-contract]:checked"),
                ].map((el) => el.dataset.contract),
              },
        );
      };
      $("hero-deck-btn").onclick = () => {
        library.show(context.chosenHero);
      };
    }
    function showMulligan() {
      mulliganSet = new Set();
      renderMulligan();
    }
    function renderMulligan() {
      showModal(
        `<section class="modal-box mulligan-box"><div class="modal-heading"><div class="eyebrow">YOUR OPENING HAND</div><h2>命运的第一手</h2><p>点击不想保留的卡牌进行替换。优先留下低费随从，建立你的战场。</p></div><div class="mulligan-cards">${game.s.p.hand.map((c) => `<button class="mulligan-card ${mulliganSet.has(c.uid) ? "replace" : ""}" data-mulligan="${c.uid}" aria-label="${D.byId[c.cid].name}，点击${mulliganSet.has(c.uid) ? "保留" : "替换"}">${cardHTML(D.byId[c.cid])}</button>`).join("")}</div><div class="modal-footer"><button class="gold-btn" id="mulligan-confirm">${mulliganSet.size ? "替换 " + mulliganSet.size + " 张并开始" : "保留手牌，开始战斗"} ${A.icon("arrow")}</button></div><p class="hero-deck-note">${game.s.first === "e" ? "你后手，换牌后获得硬币。" : "你先手。"}每个回合开始时，抽一张牌。</p></section>`,
        "mulligan",
        true,
      );
      document.querySelectorAll("[data-mulligan]").forEach(
        (b) =>
          (b.onclick = () => {
            const id = b.dataset.mulligan;
            mulliganSet.has(id) ? mulliganSet.delete(id) : mulliganSet.add(id);
            renderMulligan();
          }),
      );
      $("mulligan-confirm").onclick = () => {
        const ids = [...mulliganSet];
        closeModal(false);
        game.dispatch({ type: "mulligan", ids });
      };
    }
    return Object.freeze({ showHeroes, showMulligan });
  }
  return Object.freeze({ create });
})();
