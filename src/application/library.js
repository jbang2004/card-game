/* Collection and deck editing own their local filters and draft deck.
 * Application navigation and persistence are injected; no battle state access. */
const EmberLibrary = (() => {
  function create({
    data: D,
    deckStore,
    showModal,
    toast,
    preview,
    hidePreview,
    onStart,
  }) {
    const $ = (id) => document.getElementById(id),
      rules = EmberDeckRules;
    let collection = { decks: [], activeId: null },
      currentId = null,
      deckName = "",
      storageError = "",
      toolsOpen = false;
    const presets = () =>
      D.archetypes.filter((a) => a.classId === rules.classFor(D, deckHero));
    function loadRecord(record) {
      currentId = record.id;
      editContracts = [...record.contracts];
      deckName = record.name;
      editDeck = [...record.cards];
      if (D.heroes.some((h) => h.id === record.heroId))
        deckHero = record.heroId;
      presetId = D.heroes.find((h) => h.id === deckHero).defaultDeckId;
    }
    function newDeck() {
      currentId = null;
      const hero = D.heroes.find((h) => h.id === deckHero);
      presetId = hero.defaultDeckId;
      editDeck = [...hero.deck];
      editContracts = [...(hero.defaultContracts || [])];
      deckName = D.archetypes.find((a) => a.id === presetId).name;
    }
    function saveDeck(copy = false) {
      const result = deckStore.save({
        id: copy ? null : currentId,
        name: deckName,
        heroId: deckHero,
        cards: editDeck,
        contracts: editContracts,
      });
      if (!result.ok) {
        toast(result.error);
        return false;
      }
      collection = result.collection;
      loadRecord(result.record);
      renderLibrary();
      toast(`「${result.record.name}」已保存，将用于新的对局。`);
      return true;
    }
    const { escape, cardHTML } = EmberCards;
    let editDeck = [],
      editContracts = [],
      filterType = "all",
      filterCost = "all",
      filterSearch = "",
      deckHero = D.heroes[0].id,
      presetId = D.heroes[0].defaultDeckId;
    function showLibrary(hero) {
      if (hero && D.heroes.some((h) => h.id === hero)) deckHero = hero;
      const loaded = deckStore.load();
      storageError = loaded.ok ? "" : loaded.error;
      collection = loaded.ok
        ? loaded.collection
        : { decks: [], activeId: null };
      const saved =
        collection.decks.find(
          (d) => d.id === collection.activeId && (!hero || d.heroId === hero),
        ) || collection.decks.find((d) => d.heroId === deckHero);
      if (saved) loadRecord(saved);
      else newDeck();
      filterType = "all";
      filterCost = "all";
      filterSearch = "";
      renderLibrary();
    }
    function renderLibrary() {
      const oldTools = document.getElementById("deck-tools");
      if (oldTools) toolsOpen = oldTools.open;
      const showingDeck = !!document.querySelector(
        ".library-box.touch-show-deck",
      );
      showModal(
        `<section class="modal-box library-box"><div class="library-heading"><div><h2>万象秘典</h2><p>${D.cards.filter((c) => !c.token).length} 张卡牌 · 诸神同辉</p></div><input id="library-search" class="library-search" placeholder="搜索名称、关键词或效果…" aria-label="搜索卡牌" value="${escape(filterSearch)}"></div><div class="library-layout"><div class="library-main"><div class="filter-bar" id="filter-bar"><button class="filter-btn active" data-type="all">全部</button><button class="filter-btn" data-type="minion">随从</button><button class="filter-btn" data-type="spell">法术</button><button class="filter-btn" data-type="weapon">武器</button><span class="spacer"></span><button class="filter-btn mana active" data-mana="all">费用</button>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<button class="filter-btn mana" data-mana="${i}">${i === 7 ? "7+" : i}</button>`).join("")}</div><div class="library-grid" id="library-grid"></div><div class="library-foot" id="library-foot">点击卡牌加入牌组 · 右侧点击移除 · ${rules.summary(D)}</div></div><aside class="deck-editor${storageError ? " has-storage-error" : ""}"><div class="deck-identity"><img src="${EmberArt.character(D.heroes.find((h) => h.id === deckHero))}" alt=""><div><small>${D.classNames[rules.classFor(D, deckHero)]} · 你的牌组</small><input id="deck-name" class="deck-title-input" aria-label="牌组名称" maxlength="40" value="${escape(deckName)}"></div><span class="deck-total" id="deck-total"></span></div><details id="deck-tools" class="deck-tools" ${toolsOpen ? "open" : ""}><summary><b class="deck-tools-title">${toolsOpen ? "完成调整，返回牌组" : "调整套牌"}</b><span>英雄 · 预设 · 契约</span></summary><div class="deck-tools-body"><div class="saved-deck-controls"><label>已保存牌组<select id="deck-saved" class="library-search"><option value="">新牌组草稿</option>${collection.decks.map((d) => `<option value="${d.id}" ${d.id === currentId ? "selected" : ""}>${escape(d.name)} · ${escape(D.heroes.find((h) => h.id === d.heroId)?.name || "待调整")}</option>`).join("")}</select></label></div><label>英雄 <select id="deck-class" class="library-search">${D.heroes.map((h) => `<option value="${h.id}" ${h.id === deckHero ? "selected" : ""}>${h.name} · ${D.classNames[h.classId]}</option>`).join("")}</select></label><div class="deck-presets"><select class="library-search" id="deck-preset" aria-label="预设职业" style="width:160px;padding:7px">${presets()
          .map(
            (a) =>
              `<option value="${a.id}" ${a.id === presetId ? "selected" : ""}>${a.name}</option>`,
          )
          .join(
            "",
          )}</select><button class="text-btn" id="deck-reset">套用</button><button class="text-btn" id="deck-clear">清空</button></div><details class="contract-setup" id="deck-contracts" ${D.cards.some((c) => c.contract && c.class === rules.classFor(D, deckHero)) ? "" : "hidden"}><summary>契约栏 · ${editContracts.length}/3</summary>${
          D.cards
            .filter(
              (c) => c.contract && c.class === rules.classFor(D, deckHero),
            )
            .map(
              (c) =>
                `<label><input type="checkbox" data-deck-contract="${c.id}" ${editContracts.includes(c.id) ? "checked" : ""}><strong>${c.name}</strong><span>${EmberContracts.describe(c)}</span></label>`,
            )
            .join("") || "该职业尚无契约。"
        }</details><p class="deck-plan" id="deck-plan"></p></div></details><div role="status" id="deck-warning"></div>${storageError ? '<button class="ghost-btn" id="deck-rebuild">重建测试卡组收藏</button>' : ""}<div class="deck-list" id="deck-list"></div><div class="deck-curve" id="deck-curve"></div><div class="deck-actions"><button class="gold-btn small-btn" id="deck-save">保存牌组</button><button class="ghost-btn small-btn" id="deck-copy">另存为新牌组</button><button class="ghost-btn small-btn" id="deck-play">选择英雄</button></div></aside></div></section>`,
        "library",
      );
      if (showingDeck) $("touch-deck-tab")?.click();
      const toolsPanel = $("deck-tools");
      toolsPanel.ontoggle = () => {
        if (toolsPanel.isConnected) {
          toolsOpen = toolsPanel.open;
          toolsPanel.querySelector(".deck-tools-title").textContent = toolsOpen
            ? "完成调整，返回牌组"
            : "调整套牌";
        }
      };
      if ($("deck-rebuild"))
        $("deck-rebuild").onclick = () => {
          const result = deckStore.reset();
          if (!result.ok) {
            toast(result.error);
            return;
          }
          showLibrary(deckHero);
          toast("已重建卡组收藏，请保存新的牌组。");
        };
      document.querySelectorAll("[data-deck-contract]").forEach(
        (el) =>
          (el.onchange = () => {
            editContracts = [
              ...document.querySelectorAll("[data-deck-contract]:checked"),
            ].map((x) => x.dataset.deckContract);
            $("deck-contracts").querySelector("summary").textContent =
              `契约栏 · ${editContracts.length}/3`;
          }),
      );
      $("deck-saved").onchange = (e) => {
        const record = collection.decks.find((d) => d.id === e.target.value);
        if (record) loadRecord(record);
        else newDeck();
        renderLibrary();
      };
      $("deck-name").oninput = (e) => {
        deckName = e.target.value;
        renderDeck();
      };
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
      $("deck-class").onchange = (e) => {
        deckHero = e.target.value;
        editContracts = [
          ...(D.heroes.find((h) => h.id === deckHero).defaultContracts || []),
        ];
        presetId = D.heroes.find((h) => h.id === deckHero).defaultDeckId;
        renderLibrary();
      };
      $("deck-preset").onchange = (e) => {
        presetId = e.target.value;
        renderDeck();
      };
      $("deck-reset").onclick = () => {
        const preset = D.archetypes.find((a) => a.id === presetId);
        editDeck = [...preset.deck];
        if (!currentId) {
          deckName = preset.name;
          $("deck-name").value = deckName;
        }
        renderDeck();
        renderLibraryCards();
      };
      $("deck-clear").onclick = () => {
        editDeck = [];
        renderDeck();
        renderLibraryCards();
      };
      $("deck-save").onclick = () => saveDeck();
      $("deck-copy").onclick = () => saveDeck(true);
      $("deck-play").onclick = () => {
        if (saveDeck()) onStart(deckHero);
      };
      renderLibraryCards();
      renderDeck();
    }
    function renderLibraryCards() {
      const list = D.cards
        .filter(
          (c) =>
            !c.token &&
            rules.canInclude(D, c, deckHero) &&
            (filterType === "all" || c.type === filterType) &&
            (filterCost === "all" ||
              (filterCost === "7"
                ? c.cost >= 7
                : c.cost === Number(filterCost))) &&
            (!filterSearch ||
              (
                c.name +
                c.text +
                c.rarity +
                (D.tribeNames[c.tribe] || "") +
                D.classNames[c.class]
              )
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
                `<button class="library-item" data-add="${c.id}" title="${c.name}：${c.text}">${cardHTML(c)}<span class="add-label">+ 加入牌组</span><span class="owned-count">${editDeck.filter((id) => id === c.id).length} / ${rules.copyLimit(D, c)}</span></button>`,
            )
            .join("")
        : '<p class="library-empty">没有符合筛选条件的卡牌。<br>试试其他关键词或费用。</p>';
      $("library-foot").textContent =
        "显示 " + list.length + ` 张可用职业与中立牌 · ${rules.summary(D)}`;
      document.querySelectorAll("[data-add]").forEach((b) => {
        b.onclick = () => {
          hidePreview();
          const id = b.dataset.add,
            c = D.byId[id],
            max = rules.copyLimit(D, c);
          if (editDeck.length >= D.deckRules.size) {
            toast("牌组已满。先在右侧移除卡牌。");
            return;
          }
          if (editDeck.filter((x) => x === id).length >= max) {
            toast(`${c.name}最多携带 ${max} 张。`);
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
      const validation = rules.check(D, editDeck, deckHero);
      const issues = [...new Set(validation.errors)];
      $("deck-warning").innerHTML = storageError
        ? escape(storageError)
        : issues.length
          ? `<details class="deck-issues"><summary>牌组待调整 · ${issues.length} 项问题</summary><p>${issues.map(escape).join("；")}</p></details>`
          : "";
      $("deck-plan").textContent = D.archetypes.find(
        (a) => a.id === presetId,
      ).plan;
      const counts = Object.create(null);
      editDeck.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      $("deck-total").textContent = editDeck.length + "/" + D.deckRules.size;
      $("deck-total").classList.toggle(
        "full",
        editDeck.length === D.deckRules.size,
      );
      for (const id of ["deck-save", "deck-copy", "deck-play"])
        $(id).disabled = !!storageError || !validation.ok || !deckName.trim();
      $("deck-list").innerHTML = Object.keys(counts)
        .sort((a, b) => (D.byId[a]?.cost ?? 0) - (D.byId[b]?.cost ?? 0))
        .map((id) => {
          const c = D.byId[id] || { cost: "?", name: `未知卡牌 ${id}` };
          return `<button class="deck-row" data-remove="${escape(id)}" title="点击移除一张 ${escape(c.name)}"><span class="cost">${c.cost}</span>${D.byId[id] ? `<img class="deck-row-art" src="${EmberArt.card(c)}" alt="">` : ""}<span class="deck-row-name">${escape(c.name)}</span><span class="count">${counts[id] > 1 ? "×" + counts[id] : c.rarity === "legendary" ? "✦" : "1"}</span></button>`;
        })
        .join("");
      const curve = Array(8).fill(0);
      editDeck.forEach((id) => curve[Math.min(7, D.byId[id]?.cost || 0)]++);
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
