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
  function mount(box, type) {
    cleanup();
    const modal = document.getElementById("modal");
    document.body.append(modal);
    modal.classList.add("folio-host");
    box.classList.add("folio-dialog", "framed-dialog");
    box.dataset.dialogSize = dialogSize[type] || "workspace";
    const title = box.querySelector("h2");
    if (title) {
      title.id ||= "dialog-title";
      modal.setAttribute("aria-labelledby", title.id);
    } else modal.removeAttribute("aria-labelledby");
    const panes = [];
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
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "卡牌收藏与牌组");
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
      const libraryPane = pane(box.querySelector("#library-grid"), "grid", "卡牌");
      // The collection is a vertical browsing surface at every size. Keep
      // the same shell for resize handling and give each pane its own hint.
      libraryPane.shell.classList.add("folio-scroll-pane");
      const editor = box.querySelector(".deck-editor");
      const deckContent = document.createElement("div");
      deckContent.className = "deck-content";
      for (const child of [...editor.children]) {
        if (!child.classList.contains("deck-actions")) deckContent.append(child);
      }
      editor.prepend(deckContent);
      const deckPane = pane(deckContent, "flow", "牌组");
      deckPane.shell.classList.add("folio-scroll-pane");
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
