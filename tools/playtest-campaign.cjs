const fs = require("fs"),
  D = require("../src/data.js"),
  { Game } = require("../src/engine.js");
const rows = [];
const seeds = Number(process.env.PLAYTEST_SEEDS || 6);
for (const a of D.archetypes) {
  let cleared = 0,
    wins = 0,
    tries = 0;
  const stages = [0, 0, 0, 0, 0];
  for (let seed = 1; seed <= seeds; seed++) {
    let relics = [];
    let finished = true;
    for (let boss = 0; boss < 5; boss++) {
      let won = false;
      for (let retry = 0; retry < 3; retry++) {
        const g = new Game();
        g.start(
          a.hero,
          boss,
          relics,
          a.deck,
          seed * 65537 + boss * 1009 + retry * 97,
        );
        g.mulligan(
          g.s.p.hand.filter((c) => D.byId[c.cid].cost > 3).map((c) => c.uid),
        );
        g.simulation = true;
        let steps = 0;
        while (g.s.phase === "battle" && steps++ < 600) {
          const side = g.s.active;
          const r = g.dispatch({
            ...g.trainingAction(side, { budget: 160 }),
            side,
          });
          if (!r.ok) throw Error(r.error);
        }
        tries++;
        if (g.s.winner === "p") {
          wins++;
          stages[boss]++;
          won = true;
          if (boss < 4) {
            const offers = g.rewardOffers();
            const priority =
              a.hero === "mage"
                ? ["lens", "ember", "banner", "feather", "heart", "crown"]
                : a.hero === "paladin"
                  ? ["banner", "ember", "feather", "heart", "crown", "lens"]
                  : ["ember", "banner", "feather", "heart", "crown", "lens"];
            relics.push(priority.find((id) => offers.includes(id)));
          }
          break;
        }
      }
      if (!won) {
        finished = false;
        break;
      }
    }
    if (finished) cleared++;
  }
  const row = { deck: a.id, runs: seeds, cleared, stages, tries, wins };
  rows.push(row);
  console.log(row);
}
fs.writeFileSync(
  "artifacts/qa/campaign-playtest.json",
  JSON.stringify(
    {
      method:
        "Same-policy automated campaign runs, at most 3 attempts per boss, class-aware relic choices. Not human completion rates.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
