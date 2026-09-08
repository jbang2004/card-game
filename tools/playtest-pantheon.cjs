/* Matched deterministic policies, explicit first-player pairing. Not human win rates. */
const fs = require("fs"),
  D = require("../src/data.js"),
  { Game } = require("../src/engine.js"),
  State = require("../src/rules/state.js");
const seeds = Number(process.env.PLAYTEST_SEEDS || 2),
  offset = Number(process.env.PLAYTEST_OFFSET || 0),
  budget = Number(process.env.PLAYTEST_BUDGET || 100);
const newer = D.archetypes.filter((a) => a.id.startsWith("pantheon_")),
  older = D.archetypes.filter((a) =>
    process.env.PLAYTEST_OPPONENTS === "pantheon"
      ? a.id.startsWith("pantheon_")
      : !a.id.startsWith("pantheon_"),
  );
const rows = [];
for (const a of newer)
  for (const b of older) {
    const games = [];
    for (let n = 1; n <= seeds; n++)
      for (const first of ["p", "e"]) {
        const g = new Game();
        g.simulation = true;
        const seed = (n + offset) * 104729;
        g.start(a.hero, 0, [], a.deck, seed, {
          opponent: b.id,
          first,
          ...(process.env.NO_CONTRACTS ? { contracts: [] } : {}),
        });
        if (process.env.NO_GOD)
          g.s.p.contracts = g.s.p.contracts.filter(
            (id) => !D.byId[id].contract.divine,
          );
        g.mulligan(
          g.s.p.hand.filter((c) => D.byId[c.cid].cost > 3).map((c) => c.uid),
        );
        let steps = 0;
        const arrivals = [];
        while (g.s.phase === "battle" && steps++ < 600) {
          const side = g.s.active;
          const action = g.trainingAction(side, { budget });
          if (action.type === "contract")
            arrivals.push({ side, cid: action.cid, turn: g.s.turn });
          const r = g.dispatch({ ...action, side });
          if (!r.ok) throw Error(JSON.stringify({ action, error: r.error }));
          if (!State.valid(g.s, D))
            throw Error(
              "Invalid state " +
                JSON.stringify({ a: a.id, b: b.id, action, turn: g.s.turn }),
            );
        }
        if (g.s.phase !== "over") throw Error("Nontermination");
        games.push({
          seed,
          first,
          winner: g.s.winner,
          turn: g.s.turn,
          arrivals,
          fallen: g.s.p.fallen,
          souls: g.s.p.souls.length,
          devotion: g.s.p.devotion,
        });
      }
    rows.push({
      deck: a.id,
      opponent: b.id,
      wins: games.filter((g) => g.winner === "p").length,
      games: games.length,
      details: games,
    });
    console.log(a.id, b.id, rows.at(-1).wins + "/" + games.length);
  }
const result = {
  method:
    "Same public-information AI, fixed node budget, paired first/second for each seed; exploratory balance screening, not human win rates.",
  seeds,
  offset,
  budget,
  noGod: !!process.env.NO_GOD,
  opponents: process.env.PLAYTEST_OPPONENTS || "existing",
  rows,
};
fs.mkdirSync("artifacts/qa", { recursive: true });
fs.writeFileSync(
  process.env.PLAYTEST_OUTPUT || "artifacts/qa/pantheon-balance.json",
  JSON.stringify(result, null, 2),
);
