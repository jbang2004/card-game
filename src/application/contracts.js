/* Contract inspection uses public state and the same action API as cards. */
const EmberContractUI = (() => {
  function create({ game, showModal, closeModal, act }) {
    const D = EmberData,
      A = EmberArt;
    const ritualFor = (c) =>
      ({ jingchen: "stars", aurion: "dawn", fenlos: "hunt" })[c?.id] || "moon";
    const symbolFor = (kind) =>
      ({ stars: "star", dawn: "sun", hunt: "hunt", moon: "moon" })[kind];
    function show() {
      if (!game.s || EmberFX.busy) return;
      const s = game.s;
      showModal(
        `<section class="modal-box covenant-box"><div class="covenant-heading"><small>COVENANTS OF THE DIVINE</small><h2>诸神契约</h2><p>星火、誓光、狩猎与灵魂，各有唤醒之路。双方进度公开，每张契约每局一次；神祇降临当回合不能攻击英雄。</p></div>${[
          "p",
          "e",
        ]
          .map((side) => {
            const p = s[side];
            const moon = p.contracts.some((id) => !D.byId[id].contract.ritual);
            return `<section class="covenant-side"><h3>${side === "p" ? "你的契约" : "敌方公开契约"} <span>${moon ? `灵魂 ${p.souls.length} · 阵亡 ${p.fallen}` : "公开唤醒进度"}</span></h3>${moon ? `<p class="soul-ledger">${p.souls.map((id) => D.byId[id].name).join(" · ") || "尚无灵魂印记"} · 同名仅一枚，按获得顺序消耗。</p>` : ""}<div class="covenant-grid">${
              p.contracts
                .map((id) => {
                  const c = D.byId[id],
                    used = p.usedContracts.includes(id),
                    reason = game.legalContract(side, id),
                    unmet = EmberContracts.progress(p, c).find(
                      (gate) => gate.current < gate.required,
                    ),
                    enemyStatus = used
                      ? "已使用"
                      : unmet
                        ? `${unmet.label}尚差 ${unmet.required - unmet.current}`
                        : p.mana < c.cost
                          ? "仪式已达成 · 等待法力"
                          : p.board.length >= 7
                            ? "仪式已达成 · 等待空位"
                            : "条件已满足 · 敌方回合可唤醒";
                  return `<article data-deity="${id}" data-ritual="${ritualFor(c)}" class="covenant-card ${!reason ? "invokable" : ""} ${c.contract.divine ? "divine" : ""} ${used ? "spent" : ""}"><img src="${A.card(c)}" alt="${c.name}"><div class="covenant-copy"><div class="ritual-mark" aria-hidden="true">${A.icon(symbolFor(ritualFor(c)))}</div><small>${c.contract.divine ? "神祇契约" : "契兽契约"} · ${c.cost} 法力 · ${c.atk} 攻击 / ${c.hp} 生命</small><h4>${c.name}</h4><p>${c.text}</p>${c.contract.ritual?.kind === "spells" && p.devotion.spells.length ? `<details class="ritual-ledger"><summary>已施放 ${p.devotion.spells.length} 种法术</summary><p>${p.devotion.spells.map((id) => D.byId[id].name).join(" · ")}</p></details>` : ""}<div class="covenant-progress">${EmberContracts.progress(
                    p,
                    c,
                  )
                    .map(
                      (gate) =>
                        `<span class="ritual-gate"><span class="ritual-count">${gate.label} <b>${Math.min(gate.current, gate.required)}<small> / ${gate.required}</small></b></span><span class="ritual-stones" aria-hidden="true">${Array.from({ length: gate.required }, (_, i) => `<i class="${i < gate.current ? "lit" : ""}"></i>`).join("")}</span><meter min="0" max="${gate.required}" value="${Math.min(gate.current, gate.required)}" aria-label="${gate.label}唤醒进度"></meter></span>`,
                    )
                    .join(
                      "",
                    )}</div>${side === "p" ? `<button class="gold-btn" data-invoke="${id}" data-dialog-action aria-label="${c.name}：${used ? "契约已兑现" : reason || "唤醒契约"}" title="${used ? "契约已兑现" : reason || "条件已满足"}" ${reason ? "disabled" : ""}>${used ? c.name + " · 已兑现" : reason ? c.name + " · 暂不可用" : "唤醒 " + c.name}</button>` : `<p class="enemy-covenant-status">${enemyStatus}</p>`}</div></article>`;
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
      const god = s.p.contracts
        .map((id) => D.byId[id])
        .find((c) => c.contract.divine);
      const gates = god ? EmberContracts.progress(s.p, god) : [];
      const kind = ritualFor(god);
      b.dataset.ritual = kind;
      b.classList.toggle("spent", !!god && s.p.usedContracts.includes(god.id));
      const fraction = gates.length
        ? Math.min(...gates.map((g) => Math.min(1, g.current / g.required)))
        : 0;
      b.style.setProperty("--ritual-progress", fraction * 360 + "deg");
      b.innerHTML = `<i class="contract-sigil" aria-hidden="true">${A.icon(symbolFor(kind))}</i><span class="contract-label">诸神契约</span><small>${ready ? ready + " 项可唤醒" : god && s.p.usedContracts.includes(god.id) ? "神祇已降临" : gates.map((gate) => gate.label + " " + Math.min(gate.current, gate.required) + "/" + gate.required).join(" · ") || "查看公开契约"}</small>`;
      b.onclick = show;
    }
    return Object.freeze({ show, render });
  }
  return Object.freeze({ create });
})();
