/* Collection and deck editing own their local filters and draft deck.
 * Application navigation and persistence are injected; no battle state access. */
const EmberLibrary = (() => {
  function create({
    data: D,
    readStore,
    writeStore,
    validateDeck,
    showModal,
    toast,
    preview,
    hidePreview,
    onStart,
  }) {
    const $ = (id) => document.getElementById(id),
      DECK = "emberfall.deck.v1";
    const { escape, cardHTML } = EmberCards;
    let editDeck = [],
      filterType = "all",
      filterCost = "all",
      filterSearch = "",
      deckHero = "mage";
    function showLibrary() {
      editDeck = readStore(DECK) || [
        ...D.heroes.find((h) => h.id === deckHero).deck,
      ];
      filterType = "all";
      filterCost = "all";
      filterSearch = "";
      renderLibrary();
    }
    function renderLibrary() {
      showModal(
        `<section class="modal-box library-box"><div class="library-heading"><div><h2>万象秘典</h2><p>THE COLLECTION · 48 张原创卡牌全部可用</p></div><input id="library-search" class="library-search" placeholder="搜索名称、关键词或效果…" aria-label="搜索卡牌" value="${escape(filterSearch)}"></div><div class="library-layout"><div class="library-main"><div class="filter-bar" id="filter-bar"><button class="filter-btn active" data-type="all">全部</button><button class="filter-btn" data-type="minion">随从</button><button class="filter-btn" data-type="spell">法术</button><button class="filter-btn" data-type="weapon">武器</button><span class="spacer"></span><button class="filter-btn mana active" data-mana="all">费用</button>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<button class="filter-btn mana" data-mana="${i}">${i === 7 ? "7+" : i}</button>`).join("")}</div><div class="library-grid" id="library-grid"></div><div class="library-foot" id="library-foot">点击卡牌加入牌组 · 右侧点击移除 · 同名最多 2 张，传说最多 1 张</div></div><aside class="deck-editor"><h3>你的牌组 <span class="deck-total" id="deck-total"></span></h3><p class="deck-intro">配置恰好 30 张卡牌。应用后用于新战役，<br>不会修改当前战斗的牌库。</p><div style="display:flex;gap:8px;align-items:center;margin-top:12px"><select class="library-search" id="deck-preset" aria-label="预设职业" style="width:160px;padding:7px">${D.heroes.map((h) => `<option value="${h.id}" ${deckHero === h.id ? "selected" : ""}>${h.name}预设</option>`).join("")}</select><button class="text-btn" id="deck-reset">套用</button><button class="text-btn" id="deck-clear">清空</button></div><div class="deck-list" id="deck-list"></div><div class="deck-curve" id="deck-curve"></div><div class="deck-actions"><button class="gold-btn small-btn" id="deck-save">应用牌组</button><button class="ghost-btn small-btn" id="deck-play">选择英雄</button></div></aside></div></section>`,
        "library",
      );
      $("library-search").oninput = (e) => {
        filterSearch = e.target.value;
        renderLibraryCards();
      };
      $("filter-bar")
        .querySelectorAll("[data-type]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              filterType = b.dataset.type;
              renderLibraryCards();
            }),
        );
      $("filter-bar")
        .querySelectorAll("[data-mana]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              filterCost = b.dataset.mana;
              renderLibraryCards();
            }),
        );
      $("deck-preset").onchange = (e) => (deckHero = e.target.value);
      $("deck-reset").onclick = () => {
        editDeck = [...D.heroes.find((h) => h.id === deckHero).deck];
        renderDeck();
        renderLibraryCards();
      };
      $("deck-clear").onclick = () => {
        editDeck = [];
        renderDeck();
        renderLibraryCards();
      };
      $("deck-save").onclick = () => {
        if (validateDeck(editDeck) && writeStore(DECK, editDeck))
          toast("30 张卡组已应用，将用于下一段新战役。");
      };
      $("deck-play").onclick = () => {
        if (!validateDeck(editDeck)) {
          toast("请先完成 30 张卡组，或关闭图鉴使用英雄预设。");
          return;
        }
        writeStore(DECK, editDeck);
        onStart(deckHero);
      };
      renderLibraryCards();
      renderDeck();
    }
    function renderLibraryCards() {
      const list = D.cards
        .filter(
          (c) =>
            !c.token &&
            (filterType === "all" || c.type === filterType) &&
            (filterCost === "all" ||
              (filterCost === "7"
                ? c.cost >= 7
                : c.cost === Number(filterCost))) &&
            (!filterSearch ||
              (c.name + c.text + c.rarity)
                .toLowerCase()
                .includes(filterSearch.toLowerCase())),
        )
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "zh"));
      $("filter-bar")
        .querySelectorAll("[data-type]")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.type === filterType),
        );
      $("filter-bar")
        .querySelectorAll("[data-mana]")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.mana === filterCost),
        );
      $("library-grid").innerHTML = list.length
        ? list
            .map(
              (c) =>
                `<button class="library-item" data-add="${c.id}" title="${c.name}：${c.text}">${cardHTML(c)}<span class="add-label">+ 加入牌组</span><span class="owned-count">${editDeck.filter((id) => id === c.id).length} / ${c.rarity === "legendary" ? 1 : 2}</span></button>`,
            )
            .join("")
        : '<p style="color:#879990;font-size:12px;padding:25px;grid-column:1/-1">没有符合筛选条件的卡牌。</p>';
      $("library-foot").textContent =
        "显示 " +
        list.length +
        " / 48 张 · 点击加入，右侧点击移除 · 同名最多 2 张，传说最多 1 张";
      document.querySelectorAll("[data-add]").forEach((b) => {
        b.onclick = () => {
          hidePreview();
          const id = b.dataset.add,
            c = D.byId[id],
            max = c.rarity === "legendary" ? 1 : 2;
          if (editDeck.length >= 30) {
            toast("牌组已满。先在右侧移除卡牌。");
            return;
          }
          if (editDeck.filter((x) => x === id).length >= max) {
            toast(
              c.rarity === "legendary"
                ? "每张传说只能携带 1 张。"
                : "同名卡牌最多携带 2 张。",
            );
            return;
          }
          editDeck.push(id);
          renderDeck();
          const count = b.querySelector(".owned-count");
          count.textContent =
            editDeck.filter((x) => x === id).length + " / " + max;
          EmberAudio.fx("ui");
        };
        b.onmouseenter = () => preview(b.dataset.add, b);
        b.onmouseleave = hidePreview;
      });
    }
    function renderDeck() {
      window.EmberMobile?.syncDeck(editDeck.length);
      const counts = {};
      editDeck.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      $("deck-total").textContent = editDeck.length + "/30";
      $("deck-total").classList.toggle("full", editDeck.length === 30);
      $("deck-save").disabled = !validateDeck(editDeck);
      $("deck-list").innerHTML = Object.keys(counts)
        .sort((a, b) => D.byId[a].cost - D.byId[b].cost)
        .map((id) => {
          const c = D.byId[id];
          return `<button class="deck-row" data-remove="${id}" title="点击移除一张 ${c.name}"><span class="cost">${c.cost}</span><span>${c.name}</span><span class="count">${counts[id] > 1 ? "×" + counts[id] : c.rarity === "legendary" ? "✦" : "1"}</span></button>`;
        })
        .join("");
      const curve = Array(8).fill(0);
      editDeck.forEach((id) => curve[Math.min(7, D.byId[id].cost)]++);
      const max = Math.max(1, ...curve);
      $("deck-curve").innerHTML = curve
        .map(
          (n, i) =>
            `<div class="curve-bar" style="height:${(n / max) * 43}px" title="${i === 7 ? "7+" : i} 费：${n} 张"><small>${i === 7 ? "7+" : i}</small></div>`,
        )
        .join("");
      document.querySelectorAll("[data-remove]").forEach(
        (b) =>
          (b.onclick = () => {
            editDeck.splice(editDeck.indexOf(b.dataset.remove), 1);
            renderDeck();
            renderLibraryCards();
          }),
      );
    }
    return Object.freeze({ show: showLibrary });
  }
  return Object.freeze({ create });
})();
