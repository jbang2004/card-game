const { chromium } = require("@playwright/test");
const fs = require("fs");

const BASE = process.env.SHOT_BASE || "http://127.0.0.1:8010/";
const OUT = "artifacts/aesthetic-review";

function inter(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return Math.round(x * y);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const report = {};

  const rectFn = `(el) => { if(!el) return null; const r = el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}; }`;

  for (const s of [
    { name: "1600", w: 1600, h: 940, mobile: false },
    { name: "1280", w: 1280, h: 800, mobile: false },
    { name: "390", w: 390, h: 844, mobile: true },
    { name: "844", w: 844, h: 390, mobile: true },
    { name: "320", w: 320, h: 568, mobile: true },
  ]) {
    const page = await browser.newPage({
      viewport: { width: s.w, height: s.h },
      isMobile: s.mobile,
      hasTouch: s.mobile,
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(20000);
    await page.goto(BASE + "?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.waitForTimeout(900);

    const openMenu = async (key) => {
      await page.locator("#touch-menu").click();
      await page.locator(`[data-touch-menu="${key}"]`).click();
    };

    // ---------- dialogs first (lobby is visible) ----------
    const dialogMetrics = async (label) => {
      return page.evaluate(
        ({ rectFn, label }) => {
          const rect = eval(rectFn);
          const box = document.querySelector("#modal .modal-box");
          if (!box) return null;
          const br = rect(box);
          const children = [...box.querySelectorAll("*")].filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") return false;
            const r = el.getBoundingClientRect();
            return r.width > 1 && r.height > 1;
          });
          let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
          for (const el of children) {
            const r = el.getBoundingClientRect();
            minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.height);
            minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.width);
          }
          const scrollables = [...box.querySelectorAll("*")].filter((el) => {
            const cs = getComputedStyle(el);
            return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2;
          }).map((el) => ({
            cls: String(el.className).slice(0, 60),
            clientH: el.clientHeight,
            scrollH: el.scrollHeight,
          }));
          return {
            label,
            box: br,
            content: {
              x: Math.round(minX), y: Math.round(minY),
              w: Math.round(maxX - minX), h: Math.round(maxY - minY),
            },
            deadTop: Math.round(minY - br.y),
            deadBottom: Math.round(br.y + br.h - maxY),
            deadLeft: Math.round(minX - br.x),
            deadRight: Math.round(br.x + br.w - maxX),
            scrollables,
          };
        },
        { rectFn, label },
      );
    };

    report[s.name] = {};

    // settings
    if (s.mobile) await openMenu("settings");
    else await page.locator("#settings-btn").click();
    await page.waitForTimeout(500);
    report[s.name].settings = await dialogMetrics("settings");
    await page.locator(".modal-close").click();
    await page.waitForTimeout(300);

    // map
    if (s.mobile) await openMenu("map");
    else await page.locator("#adventure-nav").click();
    await page.waitForTimeout(500);
    report[s.name].map = await dialogMetrics("map");
    await page.locator(".modal-close").click();
    await page.waitForTimeout(300);

    // library
    if (s.mobile) await openMenu("cards");
    else await page.locator("#collection-nav").click();
    await page.waitForTimeout(600);
    report[s.name].library = await dialogMetrics("library");
    report[s.name].library.deckList = await page.evaluate(({ rectFn }) => {
      const rect = eval(rectFn);
      const list = document.querySelector("#modal .deck-list, #modal .deck-cards, #modal [class*='deck']");
      const box = document.querySelector("#modal .modal-box");
      if (!list || !box) return null;
      const lr = rect(list);
      const br = rect(box);
      const last = list.lastElementChild ? rect(list.lastElementChild) : null;
      return {
        list: lr,
        box: br,
        lastItem: last,
        lastClippedByBoxBottom: last ? Math.round(last.y + last.h - (br.y + br.h)) : null,
        clientH: list.clientHeight,
        scrollH: list.scrollHeight,
      };
    }, { rectFn });
    await page.locator(".modal-close").click();
    await page.waitForTimeout(300);

    // heroes (open, measure, close)
    await page.locator("#start-btn").click();
    await page.waitForTimeout(600);
    report[s.name].heroes = await dialogMetrics("heroes");
    await page.locator(".modal-close").click();
    await page.waitForTimeout(400);

    // ---------- battle ----------
    await page.locator("#start-btn").click();
    await page.waitForTimeout(400);
    await page.locator("#hero-confirm").click();
    await page.waitForTimeout(400);
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.waitForTimeout(900);

    const battle = await page.evaluate(
      ({ rectFn }) => {
        const rect = eval(rectFn);
        const sel = {
          topbar: ".topbar",
          matchChip: "#touch-match-chip",
          targetBar: "#touch-target-bar",
          contract: "#contract-open",
          enemyHero: "#enemy-hero",
          enemyMana: ".enemy-mana",
          campaign: ".campaign-panel",
          arena: "#arena",
          turnControls: ".turn-controls",
          endTurn: "#end-turn",
          manaPanel: ".mana-panel",
          handLabel: ".hand-label",
          hand: "#hand",
          battleBottom: ".battle-bottom",
          playerHero: "#player-hero",
          powerBtn: "#power-btn",
          weaponSlot: "#weapon-slot",
          playerDeck: ".player-deck",
          enemyDeck: ".enemy-deck",
          boardCenter: ".board-center",
        };
        const R = {};
        for (const [k, q] of Object.entries(sel)) {
          const el = document.querySelector(q);
          R[k] = el && getComputedStyle(el).display !== "none"
            ? rect(el)
            : null;
        }
        const cards = [...document.querySelectorAll("#hand .card")].map((c) => {
          const cr = rect(c);
          const text = rect(c.querySelector(".card-text"));
          const title = rect(c.querySelector(".card-title"));
          const atk = rect(c.querySelector(".stat.atk"));
          const hp = rect(c.querySelector(".stat.hp"));
          const type = rect(c.querySelector(".card-type"));
          return { cr, text, title, atk, hp, type };
        });
        const hiddenBelow = cards
          .map((c) => Math.round(c.cr.y + c.cr.h - innerHeight))
          .filter((v) => v > 0);
        const textOverAtk = cards
          .map((c) =>
            c.text && c.atk
              ? { card: c.cr, over: Math.max(0, Math.min(c.text.y + c.text.h, c.atk.y + c.atk.h) - Math.max(c.text.y, c.atk.y)) * Math.max(0, Math.min(c.text.x + c.text.w, c.atk.x + c.atk.w) - Math.max(c.text.x, c.atk.x)) }
              : null,
          )
          .filter(Boolean);
        return {
          viewport: { w: innerWidth, h: innerHeight },
          rects: R,
          handCards: cards.length,
          handCardRects: cards.map((c) => c.cr),
          hiddenBelowViewport: hiddenBelow,
          textOverAtkPx: textOverAtk.map((o) => Math.round(o.over)),
        };
      },
      { rectFn },
    );

    // overlap pairs of interest
    const pairs = [
      ["matchChip", "contract"],
      ["contract", "enemyHero"],
      ["enemyHero", "enemyMana"],
      ["contract", "enemyMana"],
      ["handLabel", "manaPanel"],
      ["handLabel", "hand"],
      ["manaPanel", "hand"],
      ["playerHero", "powerBtn"],
      ["powerBtn", "manaPanel"],
      ["endTurn", "manaPanel"],
      ["hand", "battleBottom"],
      ["playerHero", "manaPanel"],
      ["contract", "matchChip"],
      ["enemyHero", "matchChip"],
    ];
    battle.overlaps = {};
    for (const [a, b] of pairs) {
      if (battle.rects[a] && battle.rects[b]) {
        const px = inter(battle.rects[a], battle.rects[b]);
        if (px > 0) battle.overlaps[`${a}∩${b}`] = px;
      }
    }
    report[s.name].battle = battle;


    await page.close();
  }

  fs.writeFileSync(
    `${OUT}/audit-report.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log("done");
})();
