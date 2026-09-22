/* One owner for sampled combat poses. Families contribute values, never capture
 * another family's transient transform as their baseline. Rules stay untouched. */
const EmberMotionFeedback = (() => {
  function create(banks) {
    const owned = new Map(), audioSeen = new Set(), disabled = new Set();
    const matches = (bank, d) => !d.visualOnly && bank.supports(d);
    const element = (ref) => !ref ? null : ref.uid === "hero"
      ? document.querySelector(ref.side === "p" ? "#player-hero .hero-card-inner" : "#enemy-hero .hero-card-inner")
      : document.querySelector(`#battle .minion[data-uid="${CSS.escape(String(ref.uid))}"][data-side="${ref.side}"]`);
    function release(el, baseline) {
      if (el.isConnected) {
        el.style.transform = baseline.transform;
        el.style.filter = baseline.filter;
      }
      owned.delete(el);
    }
    function clear() {
      for (const [el, baseline] of owned) release(el, baseline);
      audioSeen.clear();
    }
    function sound(bank, d, cue, options = {}) {
      if (disabled.has(bank.name) || document.hidden || typeof EmberAudio === "undefined") return;
      const key = `${bank.name}:${d.id}:${cue.id}`;
      if (audioSeen.has(key)) return;
      if (EmberAudio.fx(bank.type(d, cue), {
        gain: cue.gain ?? 1,
        pan: (d.to.x / (typeof EmberViewport !== "undefined" ? EmberViewport.width : 1600) - .5) * .8,
        ...options,
      })) audioSeen.add(key);
    }
    function schedule(d, selected = banks) {
      for (const bank of selected) if (matches(bank, d))
        for (const cue of bank.events(d))
          if (performance.now() - cue.at <= 160) sound(bank, d, cue, { atMs: cue.at });
    }
    function play(d, prev, next, selected = banks) {
      for (const bank of selected) if (matches(bank, d))
        for (const cue of bank.events(d))
          if (cue.at > prev && cue.at <= next && next - cue.at < 180) sound(bank, d, cue);
    }
    function frame(instances, now, manual = false) {
      const values = new Map(), sources = new Set();
      for (const d of instances) for (const bank of banks) {
        if (!matches(bank, d)) continue;
        const p = bank.reaction(d, (now - d.start) / 1000);
        const fade = d.retireAt == null ? 1 : Math.max(0, 1 - (now - d.retireAt) / 140);
        for (const [ref, pose, light, target] of [
          [d.sourceRef, p.source, p.sourceLight, false],
          [d.targetRef, p.target, p.targetLight, true],
        ]) {
          if (!ref) continue;
          if (!target) {
            const key = `${d.groupId || d.id}:${ref.side}:${ref.uid}`;
            if (sources.has(key)) continue;
            sources.add(key);
          }
          const el = element(ref);
          if (!el) continue;
          const v = values.get(el) || { x: 0, y: 0, angle: 0, light: 0, target: false, targetMax: 0, angleMax: 0, banks: new Set() };
          v.x += pose[0] * fade; v.y += pose[1] * fade; v.angle += pose[2] * fade;
          v.light = Math.max(v.light, light * fade); v.target ||= target; v.banks.add(bank.name);
          v.targetMax = Math.max(v.targetMax, bank.targetMax ?? 14);
          v.angleMax = Math.max(v.angleMax, bank.angleMax ?? 3.4);
          values.set(el, v);
        }
        if (!manual) schedule(d, [bank]);
      }
      for (const [el, baseline] of owned) if (!values.has(el)) release(el, baseline);
      for (const [el, v] of values) {
        if (!owned.has(el)) owned.set(el, { transform: el.style.transform, filter: el.style.filter });
        const baseline = owned.get(el), length = Math.hypot(v.x, v.y), max = v.target ? v.targetMax : 18;
        baseline.banks = v.banks;
        if (length > max) { v.x *= max / length; v.y *= max / length; }
        v.angle = Math.max(-v.angleMax, Math.min(v.angleMax, v.angle));
        el.style.transform = `${baseline.transform || ""} translate(${v.x.toFixed(3)}px,${v.y.toFixed(3)}px) rotate(${v.angle.toFixed(3)}deg)`;
        el.style.filter = `${baseline.filter && baseline.filter !== "none" ? baseline.filter : ""} brightness(${(1 + v.light).toFixed(3)})`;
      }
    }
    function channel(name) {
      const selected = banks.filter(bank => bank.name === name);
      return { schedule: d => schedule(d, selected), play: (d, p, n) => play(d, p, n, selected),
        resetAudio() { for (const key of audioSeen) if (key.startsWith(name + ":")) audioSeen.delete(key); },
        setEnabled(v) { v ? disabled.delete(name) : disabled.add(name); },
        get active() { return [...owned.values()].filter(v => v.banks?.has(name)).length; } };
    }
    return { frame, clear, schedule, play, channel, get active() { return owned.size; } };
  }
  return Object.freeze({ create });
})();
if (typeof module !== "undefined") module.exports = EmberMotionFeedback;
