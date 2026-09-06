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
    labInterval = null;
  function showFXLab() {
    if (F.busy) return;
    E.showModal(
      `<section class="modal-box lab-box"><div class="modal-heading"><div class="eyebrow">THE ART OF COMBAT</div><h2>余火演武场</h2><p>七种力量，七种完全不同的战斗语言。此处不会消耗卡牌或修改战役存档。</p></div><div class="lab-grid"><div class="lab-controls">${Object.entries(
        labData,
      )
        .map(
          ([k, v]) =>
            `<button class="lab-effect ${k === selected ? "active" : ""}" style="--school:${F.colors[k][1]}" data-school="${k}"><i></i>${v[0]}<small>${v[1]}</small></button>`,
        )
        .join(
          "",
        )}</div><div class="lab-stage"><div class="lab-token source"><img src="${A.url("mage", "arcane", "nyx")}" alt="施法者"></div><div class="lab-token target"><img src="${A.url("knight", "steel", "titan")}" alt="训练傀儡"></div><div class="lab-mark">CASTER &nbsp; / &nbsp; THE PROVING GROUND &nbsp; / &nbsp; TARGET</div></div></div><div class="lab-details" id="lab-details"></div><div class="lab-footer"><span>点击左侧元素切换 · ESC 返回${E.settings.reduced ? " · 当前为减弱动态模式" : ""}</span><button class="gold-btn" id="lab-replay">再次施放 ${A.icon("refresh")}</button></div></section>`,
      "lab",
    );
    F.setLab(true);
    function refresh() {
      const d = labData[selected];
      $("lab-details").innerHTML = `<strong>${d[0]}</strong>${d[2]}`;
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
      if (from && to) F.preview(selected, from, to);
    }
    document.querySelectorAll("[data-school]").forEach(
      (el) =>
        (el.onclick = () => {
          if (F.busy) return;
          selected = el.dataset.school;
          refresh();
          play();
        }),
    );
    $("lab-replay").onclick = play;
    refresh();
    clearInterval(labInterval);
    labInterval = setInterval(() => {
      if (E.modal !== "lab") {
        clearInterval(labInterval);
        labInterval = null;
        return;
      }
      if ($("lab-replay")) $("lab-replay").disabled = F.busy;
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
  function damageResult(side, uid, n, poison = false) {
    const g = E.game,
      t = g.getTarget({ side, uid });
    if (!t) return null;
    let actual = n,
      blocked = n > 0 && uid !== "hero" && t.tags.includes("shield");
    if (blocked) actual = 0;
    let loss = uid === "hero" ? Math.max(0, actual - t.armor) : actual;
    let dead = loss >= t.hp || (poison && actual > 0 && uid !== "hero");
    return { hp: Math.max(0, t.hp - loss), dead, blocked };
  }
  function forecast(el) {
    const sel = E.selection,
      g = E.game,
      s = g.s;
    if (!sel || !s || !el.classList.contains("valid-target")) return null;
    const side = el.dataset.side,
      uid = el.dataset.uid,
      t = g.getTarget({ side, uid });
    if (!t) return null;
    if (sel.type === "attack") {
      const source = g.getTarget({ side: "p", uid: sel.uid }),
        atk = sel.uid === "hero" ? s.p.weapon?.atk || 0 : source.atk,
        ret = uid === "hero" ? 0 : t.atk;
      const target = damageResult(
          side,
          uid,
          atk,
          source.tags?.includes("poison"),
        ),
        self = damageResult("p", sel.uid, ret, t.tags?.includes("poison"));
      return `<span>${target.blocked ? "击破圣盾" : `${atk} 点伤害`}</span><small><span class="${target.dead ? "kill" : "survive"}">${target.dead ? "目标被消灭" : `目标余 ${target.hp} 生命`}</span> · <span class="${self?.dead ? "kill" : "survive"}">${self?.dead ? "我方也将阵亡" : self?.blocked ? "我方圣盾抵挡" : `我方余 ${self?.hp ?? source.hp}`}</span></small>`;
    }
    const c = sel.type === "card" ? D.byId[sel.cid] : null;
    let n =
      sel.type === "power"
        ? 1
        : c && ["damage", "frost", "drain"].includes(c.effect)
          ? c.value + g.spellBonus("p")
          : 0;
    if (n) {
      const target = damageResult(side, uid, n);
      return `<span>${target.blocked ? "圣盾抵挡伤害" : `${n} 点伤害`}</span><small class="${target.dead ? "kill" : "survive"}">${target.dead ? "致命伤害" : `目标余 ${target.hp} 生命`}${c?.effect === "frost" ? " · 附加冻结" : ""}</small>`;
    }
    if (c?.effect === "destroy")
      return '<span>消灭目标</span><small class="kill">无视当前生命值</small>';
    if (c?.effect === "transform")
      return "<span>变形为绵羊</span><small>1 攻击 / 1 生命 · 移除原有能力</small>";
    if (c?.effect === "buff")
      return `<span>获得 +${c.value}/+${c.value}</span><small class="survive">${t.atk + c.value} 攻击 / ${t.hp + c.value} 生命</small>`;
    if (c?.effect === "shield")
      return "<span>获得圣盾</span><small>抵挡下一次伤害</small>";
    if (c?.effect === "silence")
      return "<span>施加沉默</span><small>移除关键词、亡语和增益</small>";
    if (c?.effect === "tempBuff")
      return `<span>本回合 +${c.value} 攻击</span><small>${t.atk + c.value} 攻击力</small>`;
    return null;
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
