/* Deterministic headless policy playtests. Not human win-rate estimates. */
const fs = require("fs"),
  D = require("../src/data.js"),
  { Game } = require("../src/engine.js");
const seeds = Number(process.env.PLAYTEST_SEEDS || 4),
  rows = [];
function run(a, b, seed, practice) {
  const g = new Game();
  g.start(
    a.hero,
    practice ? 0 : b,
    [],
    a.deck,
    seed,
    practice ? { opponent: b.id, first: seed % 2 ? "p" : "e" } : {},
  );
  g.mulligan(
    g.s.p.hand.filter((c) => D.byId[c.cid].cost > 3).map((c) => c.uid),
  );
  g.simulation = true;
  let steps = 0,
    maxMs = 0;
  while (g.s.phase === "battle" && steps++ < 600) {
    const side = g.s.active,
      t = performance.now(),
      action = g.trainingAction(side, { budget: 160 });
    maxMs = Math.max(maxMs, performance.now() - t);
    const r = g.dispatch({ ...action, side });
    if (!r.ok)
      throw Error(JSON.stringify({ a: a.id, b, action, error: r.error }));
    for (const s of ["p", "e"])
      if (g.s[s].board.length > 7 || g.s[s].hand.length > 10 || g.s[s].mana < 0)
        throw Error("Invariant failed");
  }
  if (g.s.phase !== "over") throw Error("Nonterminating match");
  return { win: g.s.winner, turn: g.s.turn, steps, maxMs };
}
for (const a of D.archetypes) {
  for (const b of D.archetypes) {
    const games = [];
    for (let seed = 1; seed <= seeds; seed++)
      games.push(run(a, b, seed * 104729, true));
    rows.push({
      mode: "practice",
      deck: a.id,
      opponent: b.id,
      wins: games.filter((g) => g.win === "p").length,
      draws: games.filter((g) => g.win === "draw").length,
      games: seeds,
      meanTurns: games.reduce((n, g) => n + g.turn, 0) / seeds,
      maxDecisionMs: Math.round(Math.max(...games.map((g) => g.maxMs))),
    });
  }
  console.log("Finished practice", a.id);
}
for (const a of D.archetypes) {
  for (let boss = 0; boss < 5; boss++) {
    const games = [];
    for (let seed = 1; seed <= seeds; seed++)
      games.push(run(a, boss, seed * 65537, false));
    rows.push({
      mode: "boss-no-relics",
      deck: a.id,
      opponent: D.bosses[boss].id,
      wins: games.filter((g) => g.win === "p").length,
      draws: games.filter((g) => g.win === "draw").length,
      games: seeds,
      meanTurns: games.reduce((n, g) => n + g.turn, 0) / seeds,
      maxDecisionMs: Math.round(Math.max(...games.map((g) => g.maxMs))),
    });
  }
  console.log("Finished bosses", a.id);
}
const result = {
  seeds,
  totalGames: rows.reduce((n, r) => n + r.games, 0),
  method:
    "Deterministic same-policy bots; alternating first player in practice; boss tests use no relics. This is smoke/balance screening, not human win rates.",
  rows,
};
fs.mkdirSync("artifacts/qa", { recursive: true });
fs.writeFileSync(
  process.env.PLAYTEST_OUTPUT || "artifacts/qa/balance.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log("Complete", result.totalGames);
