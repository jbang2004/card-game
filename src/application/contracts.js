/* Contract inspection uses public state and the same action API as cards. */
const EmberContractUI = (() => {
  function create({ game, showModal, closeModal, act }) {
    const D = EmberData,
      A = EmberArt;
    function show() {
      if (!game.s || EmberFX.busy) return;
      const s = game.s;
      showModal(
        `<section class="modal-box covenant-box"><div class="covenant-heading"><small>THE MOON REMEMBERS</small><h2>月影契约</h2><p>每次非衍生随从死亡留下印记；同名只保留一枚。消耗最早取得的印记，不触发亡语。每张契约每局一次。</p></div>${[
          "p",
          "e",
        ]
          .map((side) => {
            const p = s[side];
            return `<section class="covenant-side"><h3>${side === "p" ? "你的契约" : "敌方公开契约"} <span>灵魂 ${p.souls.length} · 阵亡 ${p.fallen}</span></h3><p class="soul-ledger">${p.souls.map((id) => D.byId[id].name).join(" · ") || "尚无灵魂印记"}</p><div class="covenant-grid">${
              p.contracts
                .map((id) => {
                  const c = D.byId[id],
                    used = p.usedContracts.includes(id),
                    reason = game.legalContract(side, id);
                  return `<article class="covenant-card ${c.contract.divine ? "divine" : ""} ${used ? "spent" : ""}"><img src="${A.card(c)}" alt="${c.name}"><div class="covenant-copy"><small>${c.contract.divine ? "神祇契约" : "契兽契约"} · ${c.cost} 法力 · ${c.atk} 攻击 / ${c.hp} 生命</small><h4>${c.name}</h4><p>${c.text}</p><div class="covenant-progress"><span>印记 ${Math.min(p.souls.length, c.contract.souls)}/${c.contract.souls}</span><span>阵亡 ${Math.min(p.fallen, c.contract.deaths)}/${c.contract.deaths}</span></div>${side === "p" ? `<button class="gold-btn" data-invoke="${id}" ${reason ? "disabled" : ""}>${used ? "契约已兑现" : reason || "唤醒契约"}</button>` : `<p class="enemy-covenant-status">${used ? "已使用" : reason || "已可召唤"}</p>`}</div></article>`;
                })
                .join("") || '<p class="deck-plan">未携带契约。</p>'
            }</div></section>`;
          })
          .join("")}</section>`,
        "contracts",
      );
      document.querySelectorAll("[data-invoke]").forEach(
        (b) =>
          (b.onclick = () => {
            const cid = b.dataset.invoke;
            closeModal(false);
            act(() => game.dispatch({ type: "contract", side: "p", cid }));
          }),
      );
    }
    function render(s) {
      const b = document.getElementById("contract-open");
      b.hidden = !s.p.contracts.length && !s.e.contracts.length;
      const ready = s.p.contracts.filter(
        (id) => !game.legalContract("p", id),
      ).length;
      b.classList.toggle("ready", !!ready);
      b.innerHTML = `<span>☾ 月影契约</span><small>${ready ? ready + " 项可唤醒" : "灵魂 " + s.p.souls.length + " · 阵亡 " + s.p.fallen}</small>`;
      b.onclick = show;
    }
    return Object.freeze({ show, render });
  }
  return Object.freeze({ create });
})();
