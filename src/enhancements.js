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
    E.showModal(
      `<section class="modal-box" style="width:650px"><div class="modal-heading"><div class="eyebrow">THE ARCHIVE · ${c.rarity.toUpperCase()}</div><h2>${c.name}</h2><p>${c.type === "spell" ? "法术" : c.type === "weapon" ? "武器" : "随从"} · ${c.cost} 法力</p></div><div style="display:flex;align-items:center;gap:34px"><div class="discover-card">${E.cardHTML(c)}</div><div style="font-size:13px;line-height:2;color:#785936;max-width:260px"><p>${c.text || "一位等待你指挥的随从。"}</p><p style="font-size:10px;color:#a17e50;margin-top:22px">ESC 关闭查看。<br>本操作不会打出卡牌或消耗法力。</p></div></div></section>`,
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
