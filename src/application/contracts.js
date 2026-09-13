/* Contract inspection uses public state and the same action API as cards. */
const EmberContractUI = (() => {
  function create({ game, showModal, closeModal, act }) {
    const D = EmberData,
      A = EmberArt;
    const ritualFor = (c) =>
      ({ jingchen: "stars", aurion: "dawn", fenlos: "hunt" })[c?.id] || "moon";
    const symbolFor = (kind) =>
      ({ stars: "star", dawn: "sun", hunt: "hunt", moon: "moon" })[kind];
    const rosterFocus = (c) => {
      const cardFocus = CharacterCatalog[c?.id]?.focus ?? 24;
      return `${Math.max(6, cardFocus - 14)}%`;
    };
    function show() {
      if (!game.s || EmberFX.busy) return;
      const s = game.s;
      const deity =
        s.p.contracts.map((id) => D.byId[id]).find((c) => c.contract.divine) ||
        s.e.contracts.map((id) => D.byId[id]).find((c) => c.contract.divine);
      const artwork = deity ? A.card(deity) : EmberTheme.art("backdrop");
      showModal(
        `<section class="modal-box covenant-box ${deity ? "covenant-portrait" : "covenant-panorama"}"><div class="scene-showcase" style="--scene-art:url('${artwork}')" aria-hidden="true"></div><div class="covenant-heading"><h2>诸神契约</h2></div>${[
          "p",
          "e",
        ]
          .map((side) => {
            const p = s[side];
            const moon = p.contracts.some((id) => !D.byId[id].contract.ritual);
            return `<section class="covenant-side"><h3>${side === "p" ? "你的契约" : "敌方公开契约"} <span>${moon ? `灵魂 ${p.souls.length} · 阵亡 ${p.fallen}` : "公开唤醒进度"}</span></h3>${moon ? `<p class="soul-ledger">${p.souls.map((id) => D.byId[id].name).join(" · ") || "尚无灵魂印记"} · 同名仅一枚，按获得顺序消耗。</p>` : ""}<div class="covenant-grid">${
              [...p.contracts]
                .sort(
                  (a, b) =>
                    Number(!!D.byId[b].contract.divine) -
                    Number(!!D.byId[a].contract.divine),
                )
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
                  return `<article data-deity="${id}" data-ritual="${ritualFor(c)}" class="covenant-card crafted-panel ${!reason ? "invokable" : ""} ${c.contract.divine ? "divine" : ""} ${used ? "spent" : ""}"><img src="${A.card(c)}" alt="${c.name}"><div class="covenant-copy"><div class="ritual-mark" aria-hidden="true">${A.icon(symbolFor(ritualFor(c)))}</div><small>${c.contract.divine ? "神祇契约" : "契兽契约"} · ${c.cost} 法力 · ${c.atk} 攻击 / ${c.hp} 生命</small><h4>${c.name}</h4><p>${c.text}</p>${c.contract.ritual?.kind === "spells" && p.devotion.spells.length ? `<details class="ritual-ledger"><summary>已施放 ${p.devotion.spells.length} 种法术</summary><p>${p.devotion.spells.map((id) => D.byId[id].name).join(" · ")}</p></details>` : ""}<div class="covenant-progress">${EmberContracts.progress(
                    p,
                    c,
                  )
                    .map(
                      (gate) =>
                        `<span class="ritual-gate"><span class="ritual-count">${gate.label} <b>${Math.min(gate.current, gate.required)}<small> / ${gate.required}</small></b></span><span class="ritual-stones" aria-hidden="true">${Array.from({ length: gate.required }, (_, i) => `<i class="${i < gate.current ? "lit" : ""}"></i>`).join("")}</span><meter min="0" max="${gate.required}" value="${Math.min(gate.current, gate.required)}" aria-label="${gate.label}唤醒进度"></meter></span>`,
                    )
                    .join(
                      "",
                    )}</div>${side === "p" ? `<p class="covenant-status" id="covenant-status-${side}-${id}">${used ? "契约已兑现" : reason || "条件已满足"}</p><button type="button" class="gold-btn" data-invoke="${id}" aria-describedby="covenant-status-${side}-${id}" ${used || reason ? "disabled" : ""}>${used ? c.name + " · 已兑现" : "唤醒 " + c.name}</button>` : `<p class="enemy-covenant-status">${enemyStatus}</p>`}</div></article>`;
                })
                .join("") || '<p class="deck-plan">未携带契约。</p>'
            }</div></section>`;
          })
          .join("")}</section>`,
        "contracts",
      );
      const box = document.querySelector(".covenant-box");
      const sides = [...box.querySelectorAll(".covenant-side")];
      const tabs = document.createElement("nav");
      tabs.className = "covenant-tabs";
      tabs.setAttribute("aria-label", "契约归属");
      tabs.innerHTML =
        '<button data-side="0" aria-pressed="true">我方契约</button><button data-side="1" aria-pressed="false">敌方契约</button>';
      box.querySelector(".covenant-heading").append(tabs);
      const selectSide = (index) => {
        sides.forEach((side, i) =>
          side.classList.toggle("reference-active-side", i === index),
        );
        tabs
          .querySelectorAll("button")
          .forEach((button, i) =>
            button.setAttribute("aria-pressed", String(i === index)),
          );
        const selected = sides[index].querySelector(
          ".reference-active-contract",
        );
        if (selected) updateArtwork(selected.dataset.deity);
      };
      const updateArtwork = (id) => {
        const c = D.byId[id];
        box.classList.remove("covenant-panorama");
        box.classList.add("covenant-portrait");
        box
          .querySelector(".scene-showcase")
          .style.setProperty("--scene-art", `url("${A.card(c)}")`);
      };
      sides.forEach((side, index) => {
        const cards = [...side.querySelectorAll(".covenant-card")];
        const roster = document.createElement("div");
        roster.className = "covenant-roster";
        roster.setAttribute("role", "group");
        roster.setAttribute("aria-label", index ? "敌方契约卡" : "我方契约卡");
        cards.forEach((card, i) => {
          const c = D.byId[card.dataset.deity];
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.contractSelect = c.id;
          button.setAttribute("aria-pressed", String(i === 0));
          button.setAttribute("aria-label", `查看${c.name}契约`);
          button.style.setProperty("--portrait-focus", rosterFocus(c));
          button.innerHTML = `<img src="${A.card(c)}" alt=""><strong>${c.name}</strong><span>${c.contract.divine ? "神祇" : "契兽"} · ${c.cost} 法力</span>`;
          button.onclick = () => {
            cards.forEach((item) =>
              item.classList.toggle("reference-active-contract", item === card),
            );
            roster
              .querySelectorAll("button")
              .forEach((item) =>
                item.setAttribute("aria-pressed", String(item === button)),
              );
            updateArtwork(c.id);
          };
          card.classList.toggle("reference-active-contract", i === 0);
          const mana = document.createElement("div");
          mana.className = "covenant-mana-gate";
          mana.innerHTML = `<span>当前法力 <b>${s[index ? "e" : "p"].mana} / ${c.cost}</b></span><meter min="0" max="${c.cost}" value="${Math.min(c.cost, s[index ? "e" : "p"].mana)}" aria-label="当前法力"></meter>`;
          card.querySelector(".covenant-progress").prepend(mana);
          roster.append(button);
        });
        side.append(roster);
      });
      tabs
        .querySelectorAll("button")
        .forEach(
          (button) =>
            (button.onclick = () => selectSide(Number(button.dataset.side))),
        );
      selectSide(0);
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
