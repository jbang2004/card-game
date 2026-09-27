/* Page-owned presentation and actions, injected by the application controller.
 * No theme colors or asset file names belong in this module. */
const EmberCampaignScreens = (() => {
  function create(context) {
    const {
      game,
      clearSelection,
      showModal,
      closeModal,
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
      EmberCardRelief.attend(
        [...document.querySelectorAll("[data-discover]")],
        (b) => ({
          id: b.dataset.discover,
          rarity: D.byId[b.dataset.discover].rarity,
        }),
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
        `<section class="modal-box result-box" data-outcome="${win ? "win" : "loss"}"><div class="result-sigil">${A.icon(win ? "victory" : "defeat")}</div><div class="result-sub">${win ? (last ? "THE LAST EMBER BURNS" : "ENCOUNTER CLEARED") : s.winner === "draw" ? "A SHARED FATE" : "THE FLAME WILL RISE AGAIN"}</div><h2 class="result-title">${win ? (last ? "余火不灭" : "战役告捷") : s.winner === "draw" ? "同归于尽" : "火种未熄"}</h2><p class="boss-quote">${win ? (last ? "最后一颗星辰，因你重新燃起。" : "「" + D.bosses[s.bossIndex].name + "」已被击败。") : "每一次陨落，都是下一次重燃的序章。"}</p><div class="result-stats"><div><strong>${s.turn}</strong><span>战斗回合</span></div><div><strong>${s.stats.played}</strong><span>打出卡牌</span></div><div><strong>${s.stats.damage}</strong><span>造成伤害</span></div></div><div class="modal-footer"><button class="ghost-btn" id="result-home">返回营地</button><button class="gold-btn" id="result-next">${context.isDemo ? "开启正式旅程" : win ? "新的旅程" : "重试本关"} ${A.icon("arrow")}</button></div></section>`,
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
          "调整卡组或更换对手，再试一次。远征存档未被覆盖。";
        $("result-next").textContent = "再选一局";
      }
      // an expedition battle: the run takes the result (a win moves on to the spoils; a loss ends the run)
      if (s.mode === "run") {
        const foe = EmberRun.foe(D, s.run.level, s.run.foe);
        $("modal").querySelector(".result-title").textContent = win
          ? s.run.level >= D.dungeon.levels
            ? "余火不灭"
            : "战斗胜利"
          : s.winner === "draw"
            ? "同归于尽"
            : "远征终结";
        $("modal").querySelector(".boss-quote").textContent = win
          ? `远征第 ${s.run.level} 层 · 「${foe.name}」已被击败。`
          : "每一次陨落，都是下一次重燃的序章。";
        $("result-next").innerHTML =
          (win && s.run.level < D.dungeon.levels ? "领取战利品" : "查看远征结算") + " " + A.icon("arrow");
        $("result-next").onclick = () => context.runAfterBattle();
        $("result-home").onclick = home;
        return;
      }
      // the demo, a practice duel or a single boss battle (the expedition's spoils are EmberRunScreens')
      $("result-home").onclick = home;
      $("result-next").onclick = () => {
        if (context.isDemo || s.mode === "practice") {
          closeModal(false);
          openHeroes(context.isDemo ? "campaign" : "practice");
        } else if (win) {
          home();
          openHeroes("campaign");
        } else {
          closeModal(false);
          startGame(s.heroId, s.bossIndex, s.relics, s.customDeck, {
            contracts: s.p.contracts,
          });
        }
      };
    }
    return Object.freeze({ showDiscover, showResult });
  }
  return Object.freeze({ create });
})();
