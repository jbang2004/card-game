/* Edition II: contextual inspection and combat forecasts. */
(() => {
  "use strict";
  const E = window.Emberfall,
    D = EmberData,
    F = EmberFX,
    $ = (id) => document.getElementById(id),
    app = $("app");
  function togglePanel(type) {
    const v = app.classList.toggle(type + "-open");
    $(type === "log" ? "log-toggle" : "intel-toggle").setAttribute(
      "aria-expanded",
      String(v),
    );
  }
  $("log-toggle").onclick = () => togglePanel("log");
  $("intel-toggle").onclick = () => togglePanel("intel");
  $("lobby-library-btn").onclick = () => E.showLibrary();
  document.addEventListener("keydown", (ev) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || E.modal)
      return;
    if (ev.key.toLowerCase() === "l" && E.inBattle) togglePanel("log");
    if (ev.key.toLowerCase() === "i" && E.inBattle) togglePanel("intel");
  });
  // A side-by-side combat forecast is informational only and deliberately omits
  // hidden information, secret identities and random outcomes.
  function forecast(el) {
    if (!el.classList.contains("valid-target")) return null;
    const r = E.game.preview(E.selection, {
      side: el.dataset.side,
      uid: el.dataset.uid,
    });
    if (!r) return null;
    const esc = E.formatText;
    if (r.kind === "uncertain") return `<span>${esc(r.text)}</span>`;
    if (r.kind === "message")
      return `<span>${esc(r.text)}</span><small>${esc(r.detail)}</small>`;
    const result = (x) =>
      x.blocked ? "圣盾抵挡" : x.dead ? "本次伤害致死" : `余 ${x.hp} 生命`;
    return `<span>${r.amount} 点伤害${r.frozen ? " · 冻结" : ""}</span><small>${result(r.target)}${r.self ? " · 我方" + result(r.self) : ""}</small>`;
  }
  document.addEventListener(
    "pointermove",
    (e) => {
      if (EmberViewport.mobile) return;
      const target = e.target.closest?.(".hero,.minion"),
        box = $("combat-preview");
      if (!E.modal && !F.busy && target && E.selection) {
        const text = forecast(target),
          p = F.pos(target);
        if (text && p) {
          box.innerHTML = text;
          box.style.display = "block";
          box.style.left =
            Math.max(259, Math.min(1185, p.top < 190 ? p.x - 285 : p.x - 83)) +
            "px";
          box.style.top =
            (p.top < 190 ? p.y - 40 : Math.max(92, p.top - 84)) + "px";
        } else box.style.display = "none";
      } else box.style.display = "none";
      const card = e.target.closest?.(".hand-card,.library-item");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty(
          "--mx",
          ((e.clientX - r.x) / r.width - 0.5).toFixed(3),
        );
      }
    },
    { passive: true },
  );
  document.addEventListener("contextmenu", (e) => {
    if (EmberViewport.mobile) return;
    const el = e.target.closest("[data-cardid]");
    if (!el || E.modal || F.busy) return;
    e.preventDefault();
    const c = D.byId[el.dataset.cardid];
    if (!c) return;
    const side = el.dataset.side,
      unit = E.game.s?.[side]?.board.find((m) => m.uid === el.dataset.uid),
      hand = E.game.s?.p.hand.find((v) => v.uid === el.dataset.uid),
      opts = unit ? { atk: unit.atk, hp: unit.hp } : hand ? { cost: E.game.cost(hand) } : {},
      rarity = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" }[c.rarity],
      status = unit
        ? `${unit.atk} 攻击 / ${unit.hp} 生命${unit.frozen ? " · 冻结" : ""}${unit.silenced ? " · 已沉默" : ""}`
        : `${opts.cost ?? c.cost} 法力`,
      tags = unit ? unit.tags : c.tags || [];
    E.showModal(
      `<section class="modal-box"><div class="modal-heading"><h2>${E.formatText(c.name)}</h2></div><div class="card-detail-layout"><div class="card-detail-art">${E.cardHTML(c, opts)}</div><div class="card-detail-copy"><small>${rarity} · ${c.type === "spell" ? "法术" : c.type === "weapon" ? "武器" : "随从"}</small><p class="touch-live-stat">${status}</p>${tags.length ? `<p>${tags.map((k) => E.formatText(D.kw[k] || k)).join(" · ")}</p>` : ""}</div></div></section>`,
      "inspect",
    );
  });
  // Navigation stays available visually, but cannot interrupt a half-finished
  // combat animation; home cancels safely, and audio controls always remain usable.
  for (const id of [
    "collection-nav",
    "guide-nav",
    "settings-btn",
    "adventure-nav",
  ]) {
    const old = $(id).onclick;
    $(id).onclick = function (e) {
      if (F.busy) return;
      return old?.call(this, e);
    };
  }
  document.addEventListener("pointerdown", () => EmberAudio.unlock(), {
    once: true,
  });
})();
