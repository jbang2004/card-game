/* Contract inspection uses public state and the same action API as cards. */
const EmberContractUI = (() => {
  function create({ game, showModal, closeModal, act, cardHTML, reduced }) {
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
    /* ---------------------------------------------------------------
     * God stage: tapping the dock slot lifts the contract card out of it —
     * the battlefield blurs behind a scrim, the card flies from the slot to
     * the centre while it flips from its gold back to its full face, and a
     * compact ritual panel sits underneath.  The old covenant page stays
     * reachable from the secondary link (enemy contracts live there).
     * docs/design/BATTLE_REDESIGN_20260914.md §11.
     * ------------------------------------------------------------- */
    let stageEl = null,
      stageCtx = null;
    const V = () => EmberViewport;
    const calm = () => !!reduced?.() || EmberFX.busy;
    /* Shape of the stage (design doc §12.4 / §12.5):
     *   spread — desktop or tablet with more than one contract: three equal
     *            cards side by side, ritual typography underneath.
     *   wide   — anything not portrait with a single card: the museum-label
     *            two-column form, card left, typography right.
     *   flow   — phones: Cover flow, focused card full size with its
     *            neighbours peeking at 0.62, typography under (portrait) or
     *            beside (landscape) it.                                   */
    function stageShape(count) {
      const v = V();
      const tablet =
        !v.mobile || (v.portrait ? v.width >= 600 : v.width >= 900);
      if (tablet && count > 1) return "spread";
      if (!v.portrait && count === 1) return "wide";
      return "flow";
    }
    function stageCardWidth(shape, count) {
      const v = V();
      const base = !v.mobile
        ? 340
        : v.portrait
          ? /* Portrait stacks card over label, so the card may claim only the
             * height the ritual typography does not need — otherwise a short
             * phone (320x568) pushes the secondary link onto the screen edge.
             * 275 = the label block plus the shell gap and gutters. */
            Math.round(
              Math.min(
                300,
                Math.max(220, v.width * 0.62),
                Math.max(150, ((v.height - 275) * 5) / 7.4),
              ),
            )
          : /* Landscape reverses the width out of the height left by a single
             * row of ritual typography, so nothing has to scroll. */
            Math.round(
              Math.min(260, Math.max(120, ((v.height - 28 - 96) * 5) / 7.4)),
            );
      if (shape !== "spread") return base;
      /* Three equal cards plus two 24px gaps inside 88% of the stage. */
      const room = Math.floor((v.width * 0.88 - 48) / count);
      return Math.max(120, Math.min(base, room));
    }
    /* The conditions are derived, not authored: the rules layer only reports
     * label / current / required, so the readable sentence is built from the
     * same ritual definition the engine scores. */
    const conditionText = (c, gate) => {
      const r = c.contract.ritual;
      if (r?.kind === "spells") return `成功施放 ${r.amount} 种非衍生法术`;
      if (r?.kind === "shields") return `用护盾挡下 ${r.amount} 次敌方伤害`;
      if (r?.kind === "hunts")
        return `野兽随从攻击敌方随从 ${r.amount} 次，每回合至多 2 次`;
      return gate.label === "印记"
        ? `不同名称的非衍生随从阵亡，留下 ${gate.required} 枚印记`
        : `我方随从阵亡 ${gate.required} 个`;
    };
    /* §12.4: no panel, no border — a museum label. Eyebrow, condition line,
     * a 2px rule that runs the full width with the count right-aligned on it,
     * the cast spells as plain words with hollow dots for what is missing, one
     * solid pill and one text link. */
    function ritualHTML(p, c) {
      const gates = EmberContracts.progress(p, c);
      const used = p.usedContracts.includes(c.id);
      const reason = game.legalContract("p", c.id);
      const unmet = gates.find((g) => g.current < g.required);
      const ritual = c.contract.ritual;
      const spells =
        ritual?.kind === "spells"
          ? `<p class="god-cast" aria-label="已施放的法术">${p.devotion.spells
              .slice(0, ritual.amount)
              .map((id) => `<b>${D.byId[id]?.name || id}</b>`)
              .join('<s aria-hidden="true">·</s>')}${
              p.devotion.spells.length &&
              p.devotion.spells.length < ritual.amount
                ? '<s aria-hidden="true">·</s>'
                : ""
            }${Array.from(
              {
                length: Math.max(0, ritual.amount - p.devotion.spells.length),
              },
              () => '<i aria-hidden="true"></i>',
            ).join('<s aria-hidden="true">·</s>')}</p>`
          : "";
      const label = used
        ? "已降临"
        : unmet
          ? `还需 ${unmet.required - unmet.current} ${unmet.label}`
          : p.mana < c.cost
            ? `缺 ${c.cost - p.mana} 点法力`
            : p.board.length >= 7
              ? "战场已满"
              : `唤醒 · ${c.name}`;
      /* The eyebrow carries identity and the verdict; the pill carries the
         action. There is no separate status paragraph any more. */
      const eyebrow = `${c.contract.divine ? "神祇契约" : "契兽契约"} · ${c.cost} 法力${used ? " · 本局已兑现" : unmet ? "" : reason ? " · " + reason : " · 仪式已达成"}`;
      /* Every direct child of `.god-ritual` carries its line index: the skin
       * turns `--i` into the 60ms stagger of the entrance (design doc §13.1). */
      const lines = [
        `<p class="god-eyebrow">${eyebrow}</p>`,
        ...gates.flatMap((gate) => {
          const now = Math.min(gate.current, gate.required);
          return [
            `<p class="god-cond"><b>${gate.label}</b> · ${conditionText(c, gate)}</p>`,
            `<div class="god-track"><span class="god-rule" aria-hidden="true"><i style="width:${Math.round((now / gate.required) * 100)}%"></i></span><b>${now} / ${gate.required}</b></div>`,
          ];
        }),
        spells,
        `<button type="button" class="gold-btn god-invoke" data-god-invoke="${c.id}" ${used || reason ? "disabled" : ""}>${label}</button>`,
        `<button type="button" class="god-page-link" id="god-covenant-page">敌方公开契约</button>`,
      ].filter(Boolean);
      return `<div class="god-ritual">${lines
        .map((html, i) => html.replace(/^<(\w+)/, `<$1 style="--i:${i}"`))
        .join("")}</div>`;
    }
    /* Resting pose per card. `spread` puts three equal cards on one line and
     * only lifts the focused one; `flow` is Cover flow — the focus is full
     * size and centred, its neighbours shrink to 0.62 and hang off the sides
     * far enough to be tapped (design doc §12.5). */
    function stageLayout() {
      if (!stageCtx) return;
      const { cards, focus, shape } = stageCtx;
      const w = stageCtx.cardW,
        n = cards.length;
      cards.forEach((card, i) => {
        const d = i - focus;
        card.classList.toggle("focused", d === 0);
        card.style.zIndex = String(20 - Math.abs(d));
        /* `spread` centres the ROW (the focus only lifts); `flow` centres the
         * FOCUS and hangs its neighbours off both sides. Anything past the
         * immediate neighbour parks behind it rather than marching off the
         * screen, so three cards still read as "there are more". */
        const dd = Math.max(-1, Math.min(1, d));
        card.style.setProperty(
          "--stack",
          shape === "spread"
            ? `translate(${(i - (n - 1) / 2) * (w + 24)}px, ${d ? 0 : -12}px)`
            : `translate(${dd * w * 0.62 + (d - dd) * 10}px, 0) scale(${d ? 0.62 - (Math.abs(d) - 1) * 0.06 : 1})`,
        );
        card.style.transform = "var(--stack)";
      });
    }
    function stageFocus(index) {
      if (!stageCtx) return;
      const n = stageCtx.cards.length;
      stageCtx.focus = Math.max(0, Math.min(n - 1, index));
      /* The parallax belongs to whichever card is in front; a card that steps
       * back must not keep the tilt it had while focused. */
      stageCtx.cards.forEach((card) => {
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
      });
      stageLayout();
      const holder = stageEl.querySelector(".god-ritual-holder");
      const c = D.byId[stageCtx.ids[stageCtx.focus]];
      /* The relief face belongs to the card in front, like the tilt: it follows
       * the stage's own tilt rather than adding a second one. */
      const front = stageCtx.cards[stageCtx.focus];
      EmberCardRelief.mountCard(front.querySelector(".god-card-front .card"), {
        id: c.id,
        rarity: c.rarity,
        steer: "follow",
        tilt: false,
        anchor: front,
      });
      holder.innerHTML = ritualHTML(game.s.p, c);
      bindRitual();
    }
    function bindRitual() {
      const invoke = stageEl.querySelector("[data-god-invoke]");
      if (invoke)
        invoke.onclick = () => {
          const cid = invoke.dataset.godInvoke;
          closeStage(false);
          act(() => game.dispatch({ type: "contract", side: "p", cid }));
        };
      const link = stageEl.querySelector("#god-covenant-page");
      if (link)
        link.onclick = () => {
          closeStage(false);
          show();
        };
    }
    function closeStage(animate = true) {
      const el = stageEl,
        ctx = stageCtx;
      if (!el) return;
      stageEl = null;
      stageCtx = null;
      /* The slabs stay for the return flight (the cards turn over again); the
       * whole stage is dropped after it. */
      if (el.querySelector(".card-relief-canvas")) EmberCardRelief.release();
      document.removeEventListener("keydown", stageKey, true);
      const drop = () => el.remove();
      if (!animate) return drop();
      if (calm() || !ctx?.flight) {
        el.classList.add("instant", "closing");
        setTimeout(drop, 210);
        return;
      }
      /* One timeline (§13.1): the class starts the ritual's fade-and-sink and
       * the scrim's un-blur, and the card's flight transform is set in the same
       * frame, so nothing queues behind the card. */
      // Freeze every current pose before cancelling staggered entrance motion.
      const poses = ctx.cards.map((card) => [
        getComputedStyle(card).transform,
        getComputedStyle(card.querySelector(".god-card-inner")).transform,
      ]);
      el.classList.remove("flying");
      ctx.cards.forEach((card, i) => {
        card.style.transition = "none";
        card.style.transform = poses[i][0];
        const inner = card.querySelector(".god-card-inner");
        inner.style.transition = "none";
        inner.style.transform = poses[i][1];
      });
      void el.offsetWidth;
      el.classList.add("closing");
      ctx.cards.forEach((card) => {
        card.style.transition = "";
        card.style.transform = ctx.flight;
        const inner = card.querySelector(".god-card-inner");
        inner.style.transition = "";
        inner.style.transform = "rotateY(180deg)";
      });
      setTimeout(drop, 340);
    }
    function stageKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeStage();
      } else if (e.key === "ArrowLeft") stageFocus(stageCtx.focus - 1);
      else if (e.key === "ArrowRight") stageFocus(stageCtx.focus + 1);
    }
    function stage() {
      if (!game.s || EmberFX.busy) return;
      const s = game.s,
        ids = [...s.p.contracts].sort(
          (a, b) =>
            Number(!!D.byId[b].contract.divine) -
            Number(!!D.byId[a].contract.divine),
        );
      if (!ids.length) return show();
      closeStage(false);
      const v = V(),
        shape = stageShape(ids.length),
        width = stageCardWidth(shape, ids.length);
      const el = document.createElement("div");
      el.id = "god-stage";
      el.className = "god-stage god-stage-" + shape;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "诸神契约");
      el.style.setProperty("--god-card-w", width + "px");
      el.innerHTML = `<div class="god-scrim"></div><div class="god-shell"><div class="god-cards" data-count="${ids.length}">${ids
        .map((id) => {
          const c = D.byId[id];
          return `<div class="god-card" data-cid="${id}"><div class="god-card-inner"><div class="god-card-face god-card-front">${cardHTML(c, { cost: c.cost })}</div><div class="god-card-face god-card-back"><i class="contract-back" aria-hidden="true"></i><i class="contract-seal" aria-hidden="true"></i></div></div></div>`;
        })
        .join("")}</div><div class="god-ritual-holder"></div></div>`;
      document.getElementById("app").append(el);
      stageEl = el;
      stageCtx = {
        ids,
        cards: [...el.querySelectorAll(".god-card")],
        focus: 0,
        pinned: false,
        flight: null,
        shape,
        cardW: width,
      };
      stageFocus(0);
      /* Every card in the stack is a slab from the start: turning over in flight is
       * where the thickness shows. The back of each is seated that far behind its
       * face (card-relief.css). */
      stageCtx.cards.forEach((node) => {
        const slab = EmberCardRelief.slab(node.querySelector(".god-card-front .card"));
        if (!slab) return;
        node.style.setProperty("--relief-depth", slab.depth + "px");
        node.style.setProperty("--relief-flange", slab.flange.toFixed(2) + "px");
      });
      /* FLIP: the slot's measured rect is the take-off pose. Every `.god-card`
       * is `inset: 0` inside `.god-cards`, so they all share one untransformed
       * box. Measure that container so focus offsets cannot displace the
       * shared take-off and return destination. */
      const slot = v.pos(document.getElementById("contract-open"));
      const here = v.pos(el.querySelector(".god-cards"));
      if (slot && here && !calm()) {
        const scale = slot.w / here.w,
          dx = Math.round(slot.x - here.x),
          dy = Math.round(slot.y - here.y),
          len = Math.hypot(dx, dy) || 1,
          /* A flat line between two points reads as a slide; bending the path
           * by a fraction of its own length is what makes it read as flight. */
          bend = Math.min(90, len * 0.18),
          midScale = (1 + scale) / 2;
        stageCtx.flight = `translate(${dx}px, ${dy}px) scale(${scale.toFixed(3)})`;
        el.style.setProperty("--fly", stageCtx.flight + " rotate(-8deg)");
        el.style.setProperty(
          "--fly-mid",
          `translate(${Math.round(dx / 2 + (-dy / len) * bend)}px, ${Math.round(dy / 2 + (dx / len) * bend)}px) scale(${(midScale * 1.04).toFixed(3)}) rotate(-3deg)`,
        );
        /* The stack leaves the slot one card at a time (§12.5). */
        stageCtx.cards.forEach((node, i) =>
          node.style.setProperty("--fly-delay", i * 70 + "ms"),
        );
        el.classList.add("flying");
        setTimeout(() => el.classList.remove("flying"), 620 + (ids.length - 1) * 70);
      } else el.classList.add("instant");
      el.querySelector(".god-scrim").onclick = () => closeStage();
      document.addEventListener("keydown", stageKey, true);
      stageCtx.cards.forEach((node, i) => {
        node.addEventListener("mouseenter", () => {
          if (
            document.body.classList.contains("pointer-fine") &&
            !stageCtx?.pinned
          )
            stageFocus(i);
        });
        node.addEventListener("click", () => {
          if (!stageCtx) return;
          stageCtx.pinned = true;
          stageFocus(i);
        });
      });
      bindStageDrag(el);
      bindStageTilt(el);
      el.querySelector(".god-invoke")?.focus?.();
    }
    /* §12.3 step 4: once it has landed the card answers the pointer with a
     * ±6° parallax tilt, so the face reads as an object under a light rather
     * than a picture pasted on the scrim. */
    function bindStageTilt(el) {
      const move = (e) => {
        if (!stageCtx || calm()) return;
        const card = stageCtx.cards[stageCtx.focus];
        if (e.pointerType === "touch" && (!e.isPrimary || !card?.contains(e.target))) return;
        const r = card?.getBoundingClientRect();
        if (!r?.width) return;
        const px = (e.clientX - (r.x + r.width / 2)) / (r.width / 2),
          py = (e.clientY - (r.y + r.height / 2)) / (r.height / 2),
          clamp = (n) => Math.max(-1, Math.min(1, n));
        card.style.setProperty("--tilt-y", (clamp(px) * 6).toFixed(2) + "deg");
        card.style.setProperty("--tilt-x", (-clamp(py) * 6).toFixed(2) + "deg");
      };
      el.addEventListener("pointermove", move, { passive: true });
      for (const card of stageCtx.cards) EmberCardRelief.bindTouch(card, () => {
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
      });
      el.addEventListener(
        "pointerleave",
        () => {
          const card = stageCtx?.cards[stageCtx.focus];
          card?.style.removeProperty("--tilt-x");
          card?.style.removeProperty("--tilt-y");
          EmberCardRelief.rest();
        },
        { passive: true },
      );
    }
    /* Touch: a horizontal drag past 30px turns the stack, a downward drag past
     * 90px puts the card back in its slot. */
    function bindStageDrag(el) {
      const cards = el.querySelector(".god-cards");
      let start = null,
        consumed = false;
      cards.addEventListener(
        "pointerdown",
        (e) => {
          if (!e.isPrimary || e.button !== 0) return;
          consumed = false;
          start = { x: e.clientX, y: e.clientY, id: e.pointerId };
        },
        { passive: true },
      );
      cards.addEventListener(
        "pointermove",
        (e) => {
          if (!start || !stageCtx || e.pointerId !== start.id || consumed)
            return;
          const dx = e.clientX - start.x,
            dy = e.clientY - start.y;
          if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
            consumed = true;
            cards.setPointerCapture(e.pointerId);
            stageCtx.pinned = true;
            const next = Math.max(
              0,
              Math.min(
                stageCtx.cards.length - 1,
                stageCtx.focus + (dx < 0 ? 1 : -1),
              ),
            );
            if (next !== stageCtx.focus) stageFocus(next);
          } else if (dy > 90 && dy > Math.abs(dx)) {
            consumed = true;
            start = null;
            closeStage();
          }
        },
        { passive: true },
      );
      // A swipe must not also activate the card under the release point.
      cards.addEventListener(
        "click",
        (e) => {
          if (consumed) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true,
      );
      const drop = () => {
        start = null;
      };
      cards.addEventListener("pointerup", drop, { passive: true });
      cards.addEventListener("pointercancel", drop, { passive: true });
      cards.addEventListener("lostpointercapture", drop, { passive: true });
    }
    window.addEventListener("ember:viewport", () => closeStage(false));

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
      b.dataset.count = String(s.p.contracts.length);
      const fraction = gates.length
        ? Math.min(...gates.map((g) => Math.min(1, g.current / g.required)))
        : 0;
      b.style.setProperty("--ritual-progress", fraction * 360 + "deg");
      b.innerHTML = `<i class="contract-back" aria-hidden="true"></i><i class="contract-seal" aria-hidden="true"></i><i class="contract-sigil" aria-hidden="true">${A.icon(symbolFor(kind))}</i><span class="contract-label">神契</span><small>${ready ? ready + " 项可唤醒" : god && s.p.usedContracts.includes(god.id) ? "神祇已降临" : gates.map((gate) => gate.label + " " + Math.min(gate.current, gate.required) + "/" + gate.required).join(" · ") || "查看公开契约"}</small>`;
      /* The slot opens the god stage; the full covenant page (enemy side,
         soul ledger) is one link away inside it. §12.3 step 1: the press is
         acknowledged before the flight starts — the back rebounds past its
         resting size and flashes a gold edge. */
      b.onclick = () => {
        if (!reduced?.()) {
          b.classList.remove("lifting");
          void b.offsetWidth;
          b.classList.add("lifting");
          setTimeout(() => b.classList.remove("lifting"), 260);
        }
        return s.p.contracts.length ? stage() : show();
      };
    }
    return Object.freeze({ show, render, stage, closeStage });
  }
  return Object.freeze({ create });
})();
