/* Page-owned presentation and actions, injected by the application controller.
 * No theme colors or asset file names belong in this module. */
const EmberCampaignScreens = (() => {
  function create(context) {
    const {
      game,
      clearSelection,
      showModal,
      closeModal,
      save,
      startGame,
      home,
      showHeroes: openHeroes,
    } = context;
    const D = EmberData,
      A = EmberArt,
      $ = (id) => document.getElementById(id);
    const { cardHTML } = EmberCards;
    function showDiscover() {
      const choice = game.s.choice;
      if (!choice || choice.side !== "p") return;
      showModal(
        `<section class="modal-box"><div class="modal-heading"><div class="eyebrow">A GLIMPSE BEYOND</div><h2>虚空中的启示</h2><p>选择一张法术牌加入你的手牌。</p></div><div class="discover-options">${choice.cards.map((id) => `<button class="discover-card" data-discover="${id}" aria-label="发现 ${D.byId[id].name}">${cardHTML(D.byId[id])}</button>`).join("")}</div></section>`,
        "discover",
        true,
      );
      document.querySelectorAll("[data-discover]").forEach(
        (b) =>
          (b.onclick = () => {
            const id = b.dataset.discover;
            closeModal(false);
            game.dispatch({ type: "choose", cid: id });
          }),
      );
    }
    function showResult() {
      if (!context.inBattle || game.s.phase !== "over") return;
      const s = game.s,
        win = s.winner === "p",
        last = s.bossIndex === D.bosses.length - 1 || s.mode === "practice";
      clearSelection();
      showModal(
        `<section class="modal-box result-box" data-outcome="${win ? "win" : "loss"}"><div class="result-sigil">${A.icon(win ? "fire" : "skull")}</div><div class="result-sub">${win ? (last ? "THE LAST EMBER BURNS" : "ENCOUNTER CLEARED") : s.winner === "draw" ? "A SHARED FATE" : "THE FLAME WILL RISE AGAIN"}</div><h2 class="result-title">${win ? (last ? "余火不灭" : "战役告捷") : s.winner === "draw" ? "同归于尽" : "火种未熄"}</h2><p class="boss-quote">${win ? (last ? "最后一颗星辰，因你重新燃起。" : "「" + D.bosses[s.bossIndex].name + "」已被击败。") : "每一次陨落，都是下一次重燃的序章。"}</p><div class="result-stats"><div><strong>${s.turn}</strong><span>战斗回合</span></div><div><strong>${s.stats.played}</strong><span>打出卡牌</span></div><div><strong>${s.stats.damage}</strong><span>造成伤害</span></div></div><div class="modal-footer"><button class="ghost-btn" id="result-home">返回营地</button><button class="gold-btn" id="result-next">${context.isDemo ? "开启正式旅程" : win ? (last ? "新的旅程" : "选择遗物") : "重试本关"} ${A.icon("arrow")}</button></div></section>`,
        "result",
        true,
      );
      if (s.mode === "practice") {
        $("modal").querySelector(".result-title").textContent = win
          ? "对战胜利"
          : s.winner === "draw"
            ? "平局"
            : "对战落败";
        $("modal").querySelector(".boss-quote").textContent =
          "调整卡组或更换对手，再试一次。战役存档未被覆盖。";
        $("result-next").textContent = "再选一局";
      }
      $("result-home").onclick = home;
      $("result-next").onclick = () => {
        if (context.isDemo || s.mode === "practice") {
          closeModal(false);
          openHeroes();
        } else if (win && !last) showRewards();
        else if (win) {
          home();
          openHeroes();
        } else {
          closeModal(false);
          startGame(s.heroId, s.bossIndex, s.relics, s.customDeck, {
            contracts: s.p.contracts,
            ...(s.mode === "practice" ? { opponent: s.opponent } : {}),
          });
        }
      };
    }
    function showRewards() {
      const s = game.s;
      game.rewardOffers();
      save();
      let selected = null;
      showModal(
        `<section class="modal-box rewards-box"><div class="modal-heading"><div class="eyebrow">战役奖励</div><h2>选择你的遗物</h2><p>${s.rewardOffers.length ? "获得一件永久加持，带着它继续冒险。" : "已收集全部遗物，可整备牌组后继续冒险。"}</p></div><div class="relic-options" role="group" aria-label="可选遗物">${s.rewardOffers
          .map((id) => {
            const r = D.relics.find((r) => r.id === id);
            return `<button class="relic-choice" data-relic="${id}" aria-pressed="false"><span class="relic-art"><img src="${A.relic(r.id)}" alt="${r.name}"></span><h3>${r.name}</h3><p>${r.text}</p><span class="relic-pick-label">选择此遗物</span></button>`;
          })
          .join(
            "",
          )}</div><details class="campaign-refit"><summary>酒馆整备 <span>可选 · 更换一张牌</span></summary><div class="refit-fields"><label>移除卡牌<select id="refit-remove" class="library-search"><option value="">保留原牌组</option>${[...new Set(s.customDeck || D.heroes.find((h) => h.id === s.heroId).deck)].map((id) => `<option value="${id}">${D.byId[id].name}</option>`).join("")}</select></label><label>加入卡牌<select id="refit-add" class="library-search" aria-label="补给卡牌">${D.cards
          .filter((c) => EmberDeckRules.canInclude(D, c, s.heroId))
          .map(
            (c) => `<option value="${c.id}">${c.cost}费 · ${c.name}</option>`,
          )
          .join(
            "",
          )}</select></label></div><p id="refit-status" role="status">${EmberDeckRules.summary(D)}。</p></details><div class="reward-footer"><div><span class="reward-next">下一站 · ${D.bosses[s.bossIndex + 1].title}</span><p id="reward-selection" aria-live="polite">${s.rewardOffers.length ? "先选择一件遗物" : "遗物已集齐"}</p></div><button class="gold-btn" id="reward-confirm" ${s.rewardOffers.length ? "disabled" : ""}>继续冒险</button></div></section>`,
        "rewards",
        true,
      );
      document.querySelectorAll("[data-relic]").forEach(
        (b) =>
          (b.onclick = () => {
            selected = b.dataset.relic;
            document
              .querySelectorAll("[data-relic]")
              .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            $("reward-selection").textContent =
              "已选择 · " + D.relics.find((r) => r.id === selected).name;
            $("reward-confirm").disabled = false;
          }),
      );
      $("reward-confirm").onclick = () => {
        if (!selected && s.rewardOffers.length) return;
        const deck = [
          ...(s.customDeck || D.heroes.find((h) => h.id === s.heroId).deck),
        ];
        const remove = $("refit-remove").value,
          add = $("refit-add").value;
        if (remove) deck[deck.indexOf(remove)] = add;
        if (!game.validateDeck(deck, s.heroId)) {
          document.querySelector(".campaign-refit").open = true;
          $("refit-status").textContent = EmberDeckRules.check(
            D,
            deck,
            s.heroId,
          ).errors.join("；");
          $("refit-add").focus();
          return;
        }
        startGame(
          s.heroId,
          s.bossIndex + 1,
          selected ? [...s.relics, selected] : [...s.relics],
          deck,
          { contracts: s.p.contracts },
        );
      };
    }
    return Object.freeze({ showDiscover, showResult, showRewards });
  }
  return Object.freeze({ create });
})();
