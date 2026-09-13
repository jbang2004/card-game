async function inspectVisualDiscipline(page) {
  return page.evaluate(() => {
    const failures = [];
    const rect = (e) => e.getBoundingClientRect();
    const texts = (e) => {
      const nodes = [],
        walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      while (walk.nextNode())
        if (walk.currentNode.textContent.trim()) {
          const r = document.createRange();
          r.selectNodeContents(walk.currentNode);
          nodes.push(...r.getClientRects());
        }
      return nodes.filter((r) => r.width && r.height);
    };
    const gap = (a, b) =>
      Math.max(
        b.left - a.right,
        a.left - b.right,
        b.top - a.bottom,
        a.top - b.bottom,
      );
    for (const button of document.querySelectorAll(
      "#modal .modal-footer button,#modal .reward-footer button,#modal .deck-actions button",
    )) {
      if (!button.checkVisibility()) continue;
      const b = rect(button),
        label = texts(button),
        icons = [...button.querySelectorAll(":scope > svg")]
          .filter((e) => e.checkVisibility())
          .map(rect)
          .filter((r) => r.width && r.height);
      for (const r of [...label, ...icons])
        if (
          r.left < b.left + 10 ||
          r.right > b.right - 10 ||
          r.top < b.top + 6 ||
          r.bottom > b.bottom - 6
        )
          failures.push(`${button.id}: content lacks breathing room`);
      for (const t of label)
        for (const i of icons)
          if (gap(t, i) < 5)
            failures.push(`${button.id}: text/icon gap below 5px`);
    }
    const close = document.querySelector("#modal .modal-close");
    if (close?.checkVisibility())
      for (const e of document.querySelectorAll(
        "#modal .reference-page-brand,#modal .modal-heading h2",
      ))
        if (e.checkVisibility())
          for (const t of texts(e))
            if (gap(t, rect(close)) < 12)
              failures.push("heading/brand too close to close control");
    const diagram = document.querySelector(".help-card-anatomy");
    if (diagram?.checkVisibility()) {
      const art = diagram.querySelector(".card");
      for (const label of diagram.querySelectorAll(":scope > h3,:scope > p"))
        for (const t of texts(label))
          for (const part of [art, art?.querySelector(".card-cost")].filter(
            Boolean,
          ))
            if (gap(t, rect(part)) < 12)
              failures.push("help card artwork crowds heading or introduction");
    }
    const hero = document.querySelector(".hero-chooser");
    if (hero) {
      const preview = hero.querySelector(".contract-slot-preview"),
        copy = hero.querySelector(".hero-config-contract summary small");
      if (
        preview?.checkVisibility() &&
        copy?.checkVisibility() &&
        gap(rect(preview), rect(copy)) < 10
      )
        failures.push("contract ornament and copy overlap");
      const a = hero.querySelector("#hero-deck-btn"),
        b = hero.querySelector("#hero-confirm");
      if (
        a?.checkVisibility() &&
        b?.checkVisibility() &&
        (Math.abs(rect(a).width - rect(b).width) > 1 ||
          Math.abs(rect(a).height - rect(b).height) > 1)
      )
        failures.push("hero actions unequal dimensions");
      for (const check of hero.querySelectorAll(".selected-check"))
        if (check.checkVisibility()) {
          const portrait = check.closest("button").querySelector("img");
          if (gap(rect(check), rect(portrait)) < 8)
            failures.push("hero selected mark overlaps portrait");
        }
    }
    return [...new Set(failures)];
  });
}
module.exports = { inspectVisualDiscipline };
