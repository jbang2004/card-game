/* What an opponent of the descent says during its battle (the words are EmberStory's, told as this hero hears
 * them): its first line when the battle opens, another at half health. A line is a small bubble by the enemy hero —
 * presentation only, it never touches the match. */
const EmberBarks = (() => {
  let key = "", told = new Set(), timer = 0;
  const bubble = () => {
    let el = document.getElementById("bark");
    if (!el) {
      el = document.createElement("div");
      el.id = "bark";
      el.setAttribute("role", "status");
      el.innerHTML = "<b></b><p></p>";
      document.body.append(el);
    }
    return el;
  };
  function hide() {
    clearTimeout(timer);
    document.getElementById("bark")?.classList.remove("visible");
  }
  function say(name, text) {
    const hero = document.getElementById("enemy-hero"), el = bubble();
    if (!hero || !text) return;
    el.querySelector("b").textContent = name;
    el.querySelector("p").textContent = text;
    // beside the enemy hero, on the side that has room; never off the screen
    const r = hero.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    el.classList.add("visible");
    const w = el.offsetWidth, h = el.offsetHeight;
    const below = r.top < h + 24, left = Math.min(vw - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    el.style.left = left + "px";
    el.style.top = Math.min(vh - h - 12, Math.max(12, below ? r.bottom + 12 : r.top - h - 12)) + "px";
    el.dataset.tail = below ? "up" : "down";
    el.style.setProperty("--tail", Math.min(w - 24, Math.max(24, r.left + r.width / 2 - left)) + "px");
    clearTimeout(timer);
    timer = setTimeout(hide, Math.min(9000, 2600 + text.length * 110));
  }
  /** called with every state the battle shows; getRun: the stored run (read only when a line is due), which knows
   *  whether this descent is the bearer's second (the opponent's `again` lines) */
  function update(s, getRun = null) {
    if (!s || s.mode !== "run" || s.phase === "over") { if (key) { key = ""; told = new Set(); hide(); } return; }
    const k = s.run.foe + ":" + s.run.level + ":" + s.heroId;
    if (k !== key && s.phase === "mulligan") { key = k; told = new Set(); hide(); }
    if (s.phase !== "battle") return;
    key ||= k;
    if (s.turn > 1) told.add("start");
    if (told.has("start") && (!s.phase2 || told.has("half"))) return;
    const tell = EmberRun.telling(EmberData, { heroId: s.heroId, foe: s.run.foe, epilogue: !!getRun?.()?.epilogue }), name = EmberRun.foe(EmberData, s.run.level, s.run.foe).name;
    const line = (id, text) => { if (!told.has(id)) { told.add(id); if (text) setTimeout(() => say(name, text), id === "start" ? 900 : 1400); } };
    if (s.turn <= 1) line("start", tell.start || tell.setup?.[tell.setup.length - 1]);
    if (s.phase2) line("half", tell.half);
  }
  return Object.freeze({ update, hide });
})();
