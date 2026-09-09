/* Dialogs use viewport CSS pixels. One vertical scroll model owns overflow;
 * resizing and content changes preserve nodes, handlers, selections and focus. */
const EmberDialogs = (() => {
  let cleanup = () => {};
  const dialogSize = Object.freeze({
    confirm: "confirm",
    inspect: "detail",
    "library-card": "detail",
    "touch-card": "detail",
    "touch-hero": "detail",
    "touch-hand": "hand",
    contracts: "covenant",
    settings: "settings",
    result: "result",
    "touch-menu": "menu",
    "touch-log": "journal",
    library: "library",
    heroes: "heroes",
    map: "route",
    discover: "discover",
    mulligan: "mulligan",
    rewards: "choice",
    help: "help",
    atelier: "atelier",
  });
  // These are the only two authored exceptions to the default flow layout.
  // Every dialog still owns one vertical scrolling surface on desktop and
  // touch layouts alike.
  const dialogLayoutMode = Object.freeze({
    settings: "fit",
    "touch-menu": "fit",
    // Hero selection is one complete decision surface. Keep the four choices
    // and every preparation control on the same scrollable sheet.
    heroes: "fit",
    // These views are decisions or inspections. Let their frame follow the
    // authored content and add a scroll rail only when content needs one.
    contracts: "compact",
    mulligan: "compact",
    discover: "compact",
    result: "compact",
    rewards: "compact",
    "touch-hand": "compact",
    "touch-log": "compact",
    "touch-card": "compact",
    "touch-hero": "compact",
    "library-card": "compact",
  });
  function mount(box, type) {
    cleanup();
    const modal = document.getElementById("modal");
    document.body.append(modal);
    modal.classList.add("folio-host");
    box.classList.add("folio-dialog", "framed-dialog");
    box.dataset.dialogSize = dialogSize[type] || "workspace";
    const layoutMode = dialogLayoutMode[type];
    if (layoutMode) box.dataset.layoutMode = layoutMode;
    else delete box.dataset.layoutMode;
    // Set the first-frame compact state before ResizeObserver/requestAnimationFrame
    // can run. Otherwise short touch dialogs briefly render their workspace
    // geometry and then switch to the compact layout while controls are
    // already being measured or focused.
    box.dataset.compact = String(modal.clientHeight < 520);
    // Keep commit actions outside the scroll surface so they remain reachable
    // while the content above them scrolls. Moving the same live node keeps
    // listeners, state and accessibility metadata intact.
    const anchoredActions = [...box.querySelectorAll("[data-dialog-action]")];
    if (anchoredActions.length) {
      const footer = document.createElement("div");
      footer.className = "folio-actions modal-footer";
      footer.setAttribute("aria-label", "主要操作");
      if (type === "contracts") {
        footer.classList.add("covenant-actions");
        footer.setAttribute("aria-label", "契约操作");
      }
      footer.append(...anchoredActions);
      box.append(footer);
    }
    const panes = [];
    let nameInput, nameHost, nameSlot;
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    function pane(content, mode = "flow", label = "内容") {
      const shell = document.createElement("div");
      shell.className = "folio-pane";
      content.before(shell);
      const viewport = document.createElement("div");
      viewport.className = "folio-viewport";
      const hint = document.createElement("div");
      hint.className = "folio-scroll-hint";
      hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = `<span>${label} · 继续下滑</span><b>⌄</b>`;
      shell.append(viewport, hint);
      viewport.append(content);
      content.classList.add(mode === "grid" ? "folio-grid" : "folio-flow");
      const p = {
        shell,
        viewport,
        content,
      };
      panes.push(p);
      const refreshHint = () => {
        const maxScroll = Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        );
        shell.classList.toggle("has-scroll", maxScroll > 6);
        shell.classList.toggle(
          "at-scroll-end",
          maxScroll <= 6 || viewport.scrollTop >= maxScroll - 8,
        );
      };
      p.refreshHint = refreshHint;
      viewport.addEventListener("focusin", (e) => {
        const r = e.target.getBoundingClientRect(),
          v = viewport.getBoundingClientRect();
        if (r.top < v.top + 8 || r.bottom > v.bottom - 8) {
          viewport.scrollBy({
            top:
              r.top < v.top + 8
                ? r.top - v.top - 12
                : r.bottom - v.bottom + 12,
            behavior: "smooth",
          });
        }
      });
      viewport.addEventListener("scroll", refreshHint, { passive: true });
      refreshHint();
      return p;
    }
    function layout() {
      frame = 0;
      if (!box.isConnected) return;
      // Compact mode responds to a genuinely shallow viewport, not to a
      // deliberately smaller dialog such as a confirmation or card detail.
      const compact = modal.clientHeight < 520;
      box.dataset.compact = String(compact);
      if (nameInput) {
        const inHeader =
          compact &&
          (!box.querySelector(".touch-library-tabs").offsetHeight ||
            box.classList.contains("touch-show-deck"));
        const target = inHeader ? nameSlot : nameHost;
        if (nameInput.parentElement !== target) target.append(nameInput);
        if (nameSlot.hidden === inHeader) nameSlot.hidden = !inHeader;
        if (box.classList.contains("folio-name-in-header") !== inHeader)
          box.classList.toggle("folio-name-in-header", inHeader);
      }
      for (const p of panes) {
        if (!p.viewport.clientWidth || !p.viewport.clientHeight) continue;
        p.refreshHint();
      }
    }
    if (type === "library") {
      // Tabs follow available dialog width, not the device's touch classification.
      if (!box.querySelector(".touch-library-tabs")) {
        const tabs = document.createElement("div");
        tabs.className = "touch-library-tabs";
        tabs.innerHTML =
          '<button id="touch-card-tab" role="tab" aria-selected="true">全部卡牌</button><button id="touch-deck-tab" role="tab" aria-selected="false">我的牌组</button>';
        box.querySelector(".library-heading").after(tabs);
        tabs.querySelectorAll("button").forEach(
          (b, i) =>
            (b.onclick = () => {
              box.classList.toggle("touch-show-deck", !!i);
              tabs
                .querySelectorAll("button")
                .forEach((x, j) =>
                  x.setAttribute("aria-selected", String(i === j)),
                );
              schedule();
            }),
        );
      }
      nameInput = box.querySelector("#deck-name");
      nameHost = nameInput.parentElement;
      nameSlot = document.createElement("label");
      nameSlot.className = "folio-deck-name";
      nameSlot.textContent = "牌组";
      box.querySelector(".library-heading").append(nameSlot);
      const bar = box.querySelector("#filter-bar");
      const selects = document.createElement("div");
      selects.className = "folio-filters";
      for (const [key, label] of [
        ["type", "类型"],
        ["mana", "费用"],
      ]) {
        const wrap = document.createElement("label");
        wrap.textContent = label;
        const select = document.createElement("select");
        select.setAttribute("aria-label", "筛选" + label);
        for (const b of bar.querySelectorAll(`[data-${key}]`)) {
          const opt = new Option(b.textContent, b.dataset[key]);
          select.add(opt);
        }
        select.onchange = () =>
          bar.querySelector(`[data-${key}="${select.value}"]`).click();
        wrap.append(select);
        selects.append(wrap);
      }
      bar.after(selects);
      const libraryPane = pane(box.querySelector("#library-grid"), "grid", "卡牌");
      // The collection is a vertical browsing surface at every size. Keep
      // the same shell for resize handling and give each pane its own hint.
      libraryPane.shell.classList.add("folio-scroll-pane");
      const deckPane = pane(box.querySelector("#deck-list"), "grid", "牌组");
      deckPane.shell.classList.add("folio-scroll-pane");
      pane(box.querySelector(".deck-tools-body"), "flow", "套牌配置");
    } else {
      let content = box.querySelector(":scope > .modal-scroll");
      if (!content) {
        content = document.createElement("div");
        content.className = "modal-scroll";
        const foot = box.querySelector(
          ":scope > .modal-footer,:scope > .reward-footer,:scope > .atelier-foot",
        );
        for (const el of [...box.children])
          if (
            !el.matches(
              ".modal-close,.modal-heading,.covenant-heading,.modal-footer,.reward-footer,.atelier-foot,.atlas-corners",
            )
          )
            content.append(el);
        if (foot) box.insertBefore(content, foot);
        else box.append(content);
      }
      pane(content, "flow");
      if (type === "heroes") {
        content.classList.add("hero-single-sheet");
      }
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(box);
    for (const p of panes) resize.observe(p.viewport);
    const changes = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            r.type === "childList" ||
            ["open", "hidden", "class"].includes(r.attributeName),
        )
      )
        schedule();
    });
    changes.observe(box, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "class"],
    });
    box.addEventListener("load", schedule, true);
    box.addEventListener("toggle", schedule, true);
    schedule();
    cleanup = () => {
      resize.disconnect();
      changes.disconnect();
      cancelAnimationFrame(frame);
      box.removeEventListener("load", schedule, true);
      box.removeEventListener("toggle", schedule, true);
    };
  }
  return Object.freeze({
    mount,
    // A dialog-specific presentation may own observers or animation frames.
    // Dispose them on close AND when another dialog replaces this one.
    onClose(dispose) {
      const previous = cleanup;
      cleanup = () => { previous(); dispose(); };
    },
    close: () => {
      cleanup();
    },
  });
})();
