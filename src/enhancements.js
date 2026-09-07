/* Edition II: contextual inspection, combat forecasts and a non-destructive VFX lab. */
(() => {
  "use strict";
  const E = window.Emberfall,
    D = EmberData,
    A = EmberArt,
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
  const labData = {
    steel: ["钢铁斩击", "STEEL", "回撤蓄力 → 弧形剑光 → 金属火花与撞击震动"],
    fire: ["陨火冲击", "EMBER", "燃烧弹道 → 火核爆裂 → 烟尘、余烬与灼痕"],
    frost: ["寒霜棱镜", "FROST", "冰晶穿刺 → 放射冰刺 → 碎晶与低温雾气"],
    arcane: ["星界脉冲", "ARCANE", "螺旋光束 → 星芒爆发 → 双层旋转法阵"],
    nature: ["生命绽放", "NATURE", "藤蔓轨迹 → 七瓣光纹 → 落叶与生命回流"],
    holy: ["黎明裁决", "LIGHT", "圣光汇聚 → 垂直光柱 → 金色符印与余辉"],
    shadow: ["虚空湮灭", "VOID", "暗影光核 → 内缩漩涡 → 破碎符文与暗雾"],
  };
  let selected = "fire",
    selectedVariant = "element",
    labInterval = null;
  const labVariants = [
    ["element", "元素基础"],
    ["attack:blade", "攻击 · 刀剑斩击"],
    ["attack:claw", "攻击 · 利爪撕裂"],
    ["attack:slam", "攻击 · 重击震地"],
    ["attack:arrow", "攻击 · 弓箭飞行"],
    ["attack:breath", "攻击 · 巨龙吐息"],
    ["fireball", "大法术 · 陨火"],
    ["storm", "大法术 · 火焰风暴"],
    ["nova", "大法术 · 冰霜新星"],
    ["execute", "大法术 · 虚空坍缩"],
    ["solaris", "传说 · 日曜王冠"],
    ["nyx", "传说 · 星界之门"],
    ["ashdragon", "传说 · 灰烬龙翼"],
    ["frostking", "传说 · 冰霜王座"],
  ];
  function showFXLab() {
    if (F.busy) return;
    E.showModal(
      `<section class="modal-box lab-box"><div class="modal-heading"><div class="eyebrow">THE ART OF COMBAT</div><h2>余火演武场</h2><p>切换武器、元素法术与传说登场，体验实战中的施放、命中和收势。演示不会消耗卡牌或修改存档。</p></div><div class="lab-grid"><div class="lab-controls">${Object.entries(
        labData,
      )
        .map(
          ([k, v]) =>
            `<button class="lab-effect ${k === selected ? "active" : ""}" style="--school:${F.colors[k][1]}" data-school="${k}"><i></i>${v[0]}<small>${v[1]}</small></button>`,
        )
        .join(
          "",
        )}</div><div class="lab-stage"><div class="lab-token source"><img src="${A.card(D.byId.nyx)}" alt="施法者"></div><div class="lab-token target"><img src="${A.card(D.byId.titan)}" alt="训练傀儡"></div><div class="lab-mark">CASTER &nbsp; / &nbsp; THE PROVING GROUND &nbsp; / &nbsp; TARGET</div></div></div><div class="lab-details" id="lab-details"></div><div class="lab-footer"><span>点击左侧元素切换 · ESC 返回${E.settings.reduced ? " · 当前为减弱动态模式" : ""}</span><label class="lab-variant">演出类型<select id="lab-variant">${labVariants.map(([id, name]) => `<option value="${id}" ${id === selectedVariant ? "selected" : ""}>${name}</option>`).join("")}</select></label><button class="gold-btn" id="lab-replay">再次施放 ${A.icon("refresh")}</button></div></section>`,
      "lab",
    );
    F.setLab(true);
    function refresh() {
      const card = D.byId[selectedVariant];
      if (card) selected = EmberFXProfiles.school(card);
      const d = labData[selected];
      const source = document.querySelector(".lab-token.source img");
      source.src = A.card(card || D.byId.nyx);
      source.alt = card?.name || "施法者";
      $("lab-details").innerHTML =
        `<strong>${card?.name || d[0]}</strong>${card ? "蓄力预告 → 专属演出 → 余辉消散，与实战共用同一套特效。" : d[2]}`;
      document
        .querySelectorAll("[data-school]")
        .forEach((el) =>
          el.classList.toggle("active", el.dataset.school === selected),
        );
    }
    function play() {
      if (E.modal !== "lab" || F.busy) return;
      const from = F.pos(document.querySelector(".lab-token.source")),
        to = F.pos(document.querySelector(".lab-token.target"));
      if (from && to) F.preview(selected, from, to, selectedVariant);
    }
    document.querySelectorAll("[data-school]").forEach(
      (el) =>
        (el.onclick = () => {
          if (F.busy) return;
          selected = el.dataset.school;
          selectedVariant = "element";
          $("lab-variant").value = selectedVariant;
          refresh();
          play();
        }),
    );
    $("lab-replay").onclick = play;
    $("lab-variant").onchange = () => {
      selectedVariant = $("lab-variant").value;
      refresh();
      play();
    };
    refresh();
    clearInterval(labInterval);
    labInterval = setInterval(() => {
      if (E.modal !== "lab") {
        clearInterval(labInterval);
        labInterval = null;
        return;
      }
      if ($("lab-replay")) $("lab-replay").disabled = F.busy;
      if ($("lab-variant")) $("lab-variant").disabled = F.busy;
      document
        .querySelectorAll("[data-school]")
        .forEach((el) => (el.disabled = F.busy));
    }, 90);
    setTimeout(() => {
      if (E.modal === "lab") play();
    }, 350);
  }
  E.showFXLab = showFXLab;
  $("fx-showcase-btn").onclick = showFXLab;
  const modalWatch = new MutationObserver(() => {
    if (E.modal !== "lab" && labInterval) {
      clearInterval(labInterval);
      labInterval = null;
    }
  });
  modalWatch.observe($("modal"), {
    attributes: true,
    attributeFilter: ["style"],
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
