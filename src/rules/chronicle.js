/* What a bearer's descents leave behind (pure; the controller stores it): the pages of the Root-Sea Notebook that
 * have been found, the opponents that have been met, who sealed the root and how often, the cards the last lost run
 * left down the shaft, and how the last run ended — which is what Amara speaks of when the next one sets out.
 *
 * A chronicle: { version, runs, clears: { heroId: n }, mirror (times the other side was reached and settled),
 *   pages: [id], met: [foe id], pawned: [card id], last: { seed, heroId, outcome: "won" | "lost", act, foe, wins } } */
const EmberChronicle = (() => {
  const VERSION = 1;
  const clone = (x) => structuredClone(x);
  const fresh = () => ({ version: VERSION, runs: 0, clears: {}, mirror: 0, pages: [], met: [], pawned: [], last: null });
  const total = (c) => Object.values(c.clears).reduce((n, x) => n + x, 0);
  function valid(c, data) {
    try {
      if (!c || c.version !== VERSION || !Number.isInteger(c.runs) || !Number.isInteger(c.mirror)) return false;
      if (!Array.isArray(c.pages) || !Array.isArray(c.met) || !Array.isArray(c.pawned)) return false;
      if (!c.pages.every((id) => data.story.pages.some((p) => p.id === id)) || !c.pawned.every((id) => data.byId[id])) return false;
      if (typeof c.clears !== "object" || !Object.entries(c.clears).every(([h, n]) => data.heroes.some((x) => x.id === h) && Number.isInteger(n))) return false;
      if (c.last !== null && !(data.heroes.some((h) => h.id === c.last.heroId) && ["won", "lost"].includes(c.last.outcome) && data.story.acts[c.last.act])) return false;
      return true;
    } catch {
      return false;
    }
  }
  /** what a new run takes from the past: the pawned cards, and — for a bearer who has sealed the root — the way on
   *  past the root sea (the seal does not hold: that bearer's next descent is told as its `again`) */
  const carry = (c, heroId) => ({ pawned: [...c.pawned], epilogue: (c.clears[heroId] || 0) > 0 });
  /** the pages of this run the notebook does not have yet */
  const news = (c, run) => run.pages.filter((id) => !c.pages.includes(id));
  /** fold a run in as it goes: its pages, the opponents it met, what is still at the pawnbroker's */
  function absorb(c0, run) {
    const c = clone(c0);
    for (const id of run.pages) if (!c.pages.includes(id)) c.pages.push(id);
    for (const id of run.seen) if (!id.startsWith("rival:") && !c.met.includes(id)) c.met.push(id);
    if (run.step !== "lost") c.pawned = [...run.pawned];
    return c;
  }
  /** a run has ended (won or lost): counted once, by its seed */
  function close(c0, run, data) {
    if (run.step !== "won" && run.step !== "lost") return c0;
    const c = absorb(c0, run);
    if (c.last?.seed === run.seed) return c;
    const won = run.step === "won", act = data.dungeon.acts[run.act];
    c.runs += 1;
    c.last = { seed: run.seed, heroId: run.heroId, outcome: won ? "won" : "lost", act: act.id, foe: run.foe, wins: run.wins };
    if (won) {
      c.clears[run.heroId] = (c.clears[run.heroId] || 0) + 1;
      if (act.epilogue) c.mirror += 1;
      for (const id of ["p_end_" + run.heroId, ...(total(c) >= 2 || act.epilogue ? ["p_amara"] : [])])
        if (data.story.pages.some((p) => p.id === id) && !c.pages.includes(id)) c.pages.push(id);
    } else c.pawned = [...run.left];
    return c;
  }
  /** what Amara says when a bearer comes to the counter */
  function greeting(c, data) {
    const A = data.story.amara;
    if (!c.runs || !c.last) return [...A.first];
    const lines = [];
    if (c.last.outcome === "lost") {
      const boss = data.bosses.find((b) => b.id === c.last.foe), rival = c.last.foe?.startsWith("rival:") && data.archetypes.find((a) => a.id === c.last.foe.slice(6));
      lines.push(A.lost[c.last.act].replace("{foe}", boss?.name ?? rival?.person ?? "那个人"));
    } else {
      lines.push(c.last.act === "otherside" ? A.lost.otherside : A.won);
      if (c.pages.includes("p_amara")) lines.push(A.truth);
      else if (!c.mirror) lines.push(A.epilogue);
    }
    lines.push(A.again);
    return lines;
  }
  return Object.freeze({ VERSION, fresh, valid, carry, news, absorb, close, greeting, total });
})();
if (typeof module !== "undefined") module.exports = EmberChronicle;
