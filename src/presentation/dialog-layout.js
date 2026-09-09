/* Dialogs use viewport CSS pixels. One measured page model owns overflow;
 * resizing and content changes preserve nodes, handlers, selections and focus. */
const EmberDialogs = (() => {
  let cleanup = () => {};
  let previousType = null,
    previousPanes = [];
  const positionsByType = new Map();
  function mount(box, type) {
    if (previousType)
      positionsByType.set(
        previousType,
        previousPanes.map((p) => p.page),
      );
    const positions = positionsByType.get(type) || [];
    cleanup();
    const modal = document.getElementById("modal");
    document.body.append(modal);
    modal.classList.add("folio-host");
    box.classList.add("folio-dialog", "framed-dialog");
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
      const nav = document.createElement("nav");
      nav.className = "folio-pager";
      nav.setAttribute("aria-label", label + "分页");
      nav.innerHTML =
        '<button type="button" aria-label="上一页" disabled>‹</button><span aria-live="polite"></span><button type="button" aria-label="下一页" disabled>›</button>';
      shell.append(viewport, nav);
      viewport.append(content);
      content.classList.add(mode === "grid" ? "folio-grid" : "folio-flow");
      const tail = document.createElement("i");
      tail.className = "folio-tail";
      tail.setAttribute("aria-hidden", "true");
      viewport.append(tail);
      const p = {
        shell,
        viewport,
        content,
        nav,
        tail,
        mode,
        page: positions[panes.length] || 0,
        pages: 1,
        step: 0,
      };
      panes.push(p);
      const buttons = nav.querySelectorAll("button");
      buttons[0].onclick = () => go(p, p.page - 1);
      buttons[1].onclick = () => go(p, p.page + 1);
      viewport.addEventListener("focusin", (e) => {
        const r = e.target.getBoundingClientRect(),
          v = viewport.getBoundingClientRect();
        if (r.left < v.left - 1 || r.right > v.right + 1) {
          go(p, Math.floor((r.left - v.left + viewport.scrollLeft) / p.step));
        }
      });
      viewport.addEventListener(
        "scroll",
        () => {
          const next = Math.max(
            0,
            Math.min(p.pages - 1, Math.round(viewport.scrollLeft / p.step)),
          );
          if (next !== p.page) {
            p.page = next;
            update(p);
          }
          if (Math.abs(viewport.scrollLeft - p.page * p.step) > 1)
            viewport.scrollLeft = p.page * p.step;
        },
        { passive: true },
      );
      return p;
    }
    function update(p) {
      p.page = Math.max(0, Math.min(p.pages - 1, p.page));
      p.nav.querySelector("span").textContent = `${p.page + 1} / ${p.pages}`;
      const bs = p.nav.querySelectorAll("button");
      bs[0].disabled = p.page === 0;
      bs[1].disabled = p.page >= p.pages - 1;
      p.nav.dataset.single = String(p.pages === 1);
    }
    function go(p, page) {
      p.page = Math.max(0, Math.min(p.pages - 1, page));
      p.viewport.scrollLeft = p.page * p.step;
      update(p);
    }
    function layout() {
      frame = 0;
      if (!box.isConnected) return;
      const compact = box.clientHeight < 520;
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
        const w = p.viewport.clientWidth,
          h = p.viewport.clientHeight;
        if (!w || !h) continue;
        p.step = w + 24;
        p.content.style.columnFill = "auto";
        p.content.style.setProperty("--page-width", w + "px");
        p.content.style.setProperty(
          "--flow-columns",
          Math.max(1, Math.min(2, Math.floor(w / 380))),
        );
        p.content.style.setProperty("--page-height", h + "px");
        if (p.mode === "grid") {
          const deck = p.content.id === "deck-list";
          const columns = deck ? 1 : Math.max(1, Math.floor((w + 16) / 160));
          const rows = deck
            ? Math.max(1, Math.floor((h + 16) / 60))
            : Math.max(1, Math.floor((h + 16) / 240));
          p.content.style.setProperty("--page-columns", columns);
          p.content.style.setProperty("--page-rows", rows);
          p.content.style.setProperty(
            "--tile-width",
            (w - (columns - 1) * 16) / columns + "px",
          );
          p.content.style.setProperty(
            "--tile-height",
            (h - (rows - 1) * 16) / rows + "px",
          );
          p.content.dataset.density =
            (h - (rows - 1) * 16) / rows < 290 ? "compact" : "full";
          // Pad each page with its own 24px gap; grid columns use a uniform gap.
          p.step = w + 16;
        }
        p.pages = Math.max(
          1,
          Math.ceil((p.content.scrollWidth + 22) / (w + 24)),
        );
        if (type !== "heroes" && p.mode === "flow" && p.pages === 1)
          p.content.style.columnFill = "balance";
        if (p.mode === "grid") {
          const cols = Number(
            p.content.style.getPropertyValue("--page-columns"),
          );
          const rows = Number(p.content.style.getPropertyValue("--page-rows"));
          p.pages = Math.max(
            1,
            Math.ceil(p.content.children.length / (cols * rows)),
          );
        }
        p.tail.style.left =
          p.pages * p.step - (p.mode === "grid" ? 16 : 24) - 1 + "px";
        go(p, p.page);
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
      pane(box.querySelector("#library-grid"), "grid", "卡牌");
      pane(box.querySelector("#deck-list"), "grid", "牌组");
      pane(box.querySelector(".deck-tools-body"), "flow", "套牌配置");
    } else {
      let content = box.querySelector(":scope > .modal-scroll");
      if (!content) {
        content = document.createElement("div");
        content.className = "modal-scroll";
        const foot = box.querySelector(
          ":scope > .modal-footer,:scope > .reward-footer,:scope > .lab-footer,:scope > .atelier-foot",
        );
        for (const el of [...box.children])
          if (
            !el.matches(
              ".modal-close,.modal-heading,.covenant-heading,.modal-footer,.reward-footer,.lab-footer,.atelier-foot",
            )
          )
            content.append(el);
        if (foot) box.insertBefore(content, foot);
        else box.append(content);
      }
      const bodyPane = pane(content, "flow");
      if (type === "lab") {
        bodyPane.nav.hidden = true;
        const schools = box.querySelector(".lab-controls");
        const select = document.createElement("select");
        select.className = "folio-lab-school";
        select.setAttribute("aria-label", "元素学派");
        for (const b of schools.querySelectorAll("[data-school]"))
          select.add(
            new Option(
              b.childNodes[1]?.textContent || b.textContent,
              b.dataset.school,
              false,
              b.classList.contains("active"),
            ),
          );
        select.onchange = () =>
          schools.querySelector(`[data-school="${select.value}"]`).click();
        schools.before(select);
      }
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(box);
    for (const p of panes) resize.observe(p.viewport);
    const changes = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            !r.target.closest?.(".folio-pager") &&
            (r.type === "childList" ||
              ["open", "hidden", "class"].includes(r.attributeName)),
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
    previousType = type;
    previousPanes = panes;
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
    close: () => {
      cleanup();
      previousType = null;
      previousPanes = [];
      positionsByType.clear();
    },
  });
})();
