/* EmberGallerySfx — live synthesised sounds for the voxel gallery, after Voxel Musou's audio
 * (github.com/mike007jd/voxel-musou, src/audio · MIT License, Copyright (c) 2026 BubuAi): no sample files, every
 * sound is noise, oscillators, filters and envelopes on a live AudioContext (the hit-feel demo renders the same
 * voices offline). The whoosh peaks on the contact, impacts are layered (click, crack, thwack, thump, crunch; the
 * finisher adds a sub boom and a ring), every impact ducks the whooshes for ≈ 80 ms, and a gentle compressor and a
 * soft-clip ceiling sit on the master. play(kind, delaySec, opts) · enable() must run inside a click. */
const EmberGallerySfx = (() => {
  let ctx = null, buses = null, noise = null, on = false;
  const R = (() => { let a = 20260924; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const r = (a, b) => a + (b - a) * R();

  function boot() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const SR = ctx.sampleRate;
    noise = ctx.createBuffer(1, SR * 2, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
    const ir = ctx.createBuffer(2, Math.floor(SR * 1.1), SR);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { const u = i / d.length; lp += (0.7 - 0.55 * u) * ((R() * 2 - 1) - lp); d[i] = lp * Math.exp(-4.2 * u) * (i < SR * 0.01 ? i / (SR * 0.01) : 1); } }
    const master = ctx.createGain(); master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 2.5; comp.attack.value = 0.025; comp.release.value = 0.15;
    const clip = ctx.createWaveShaper(); { const c = new Float32Array(2048); for (let i = 0; i < c.length; i++) { const x = i / (c.length - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.12 * Math.tanh((a - 0.7) / 0.12)); } clip.curve = c; }
    master.connect(comp).connect(clip).connect(ctx.destination);
    const sfx = ctx.createGain(); sfx.connect(master);
    const under = ctx.createGain(); under.connect(master);
    const verb = ctx.createConvolver(); verb.buffer = ir; const verbOut = ctx.createGain(); verbOut.gain.value = 0.45; verb.connect(verbOut).connect(master);
    buses = { master, sfx, under, verb };
    return true;
  }
  // ---- node helpers (t = absolute context time)
  const src = (t, len, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; s.start(t, r(0, 1.5)); s.stop(t + len + 0.05); return s; };
  const osc = (type, t, len, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + len + 0.05); return o; };
  const filt = (type, f, q = 0.707) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const perc = (t, a, tau, peak) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, tau); return g; };
  const pan = (p) => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
  const send = (node, bus, rev = 0) => { node.connect(bus); if (rev) { const g = ctx.createGain(); g.gain.value = rev; node.connect(g).connect(buses.verb); } };
  const duck = (t, depth = 0.4, hold = 0.08) => { const g = buses.under.gain; g.setTargetAtTime(1 - depth, t, 0.004); g.setTargetAtTime(1, t + hold, 0.06); };

  function whoosh(t, heavy) {
    const len = heavy ? 0.3 : 0.22, peak = heavy ? 0.66 : 0.7;
    const n = src(t, len, heavy ? 0.8 : 1), bp = filt("bandpass", 500, 1.3), hp = filt("highpass", heavy ? 160 : 260);
    bp.frequency.setValueAtTime(heavy ? 380 : 520, t); bp.frequency.exponentialRampToValueAtTime(heavy ? 1500 : 2300, t + len * peak); bp.frequency.exponentialRampToValueAtTime(heavy ? 500 : 800, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(heavy ? 0.55 : 0.42, t + len * peak); g.gain.linearRampToValueAtTime(0, t + len);
    const p = pan(-0.35); p.pan.linearRampToValueAtTime(0.35, t + len);
    n.connect(bp).connect(hp).connect(g).connect(p); send(p, buses.under);
    if (heavy) { const o = osc("sine", t, len, 120); o.frequency.exponentialRampToValueAtTime(62, t + len); const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.22, t + len * peak); og.gain.linearRampToValueAtTime(0, t + len); o.connect(og); send(og, buses.under); }
  }
  function impact(t, heavy) {
    const k = heavy ? 1.25 : 1, rev = heavy ? 0.3 : 0.14;
    { const n = src(t, 0.01, 1.3), hp = filt("highpass", 3200), g = perc(t, 0.0008, 0.0025, 0.55 * k); n.connect(hp).connect(g); send(g, buses.sfx, rev); }
    { const n = src(t, 0.06), bp = filt("bandpass", heavy ? 2100 : 2600, 1.1), g = perc(t, 0.001, 0.012, 0.75 * k); n.connect(bp).connect(g); send(g, buses.sfx, rev); }
    { const o = osc("triangle", t, 0.2, heavy ? 190 : 240); o.frequency.exponentialRampToValueAtTime(heavy ? 70 : 95, t + 0.07);
      const sh = ctx.createWaveShaper(), c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; c[i] = Math.tanh(x * 2.2); } sh.curve = c;
      const g = perc(t, 0.002, heavy ? 0.06 : 0.045, 0.7 * k); o.connect(sh).connect(g); send(g, buses.sfx, rev); }
    { const o = osc("sine", t, 0.5, heavy ? 70 : 82); o.frequency.exponentialRampToValueAtTime(heavy ? 40 : 50, t + (heavy ? 0.2 : 0.12)); const g = perc(t, 0.003, heavy ? 0.08 : 0.05, 0.85 * k); o.connect(g); send(g, buses.sfx); }
    for (let i = 0; i < (heavy ? 10 : 7); i++) {
      const tt = t + r(0.004, heavy ? 0.08 : 0.055), n = src(tt, 0.02), bp = filt("bandpass", r(1200, 3400), 3), g = perc(tt, 0.0008, r(0.003, 0.006), r(0.12, 0.3) * k);
      const p = pan(r(-0.3, 0.3)); n.connect(bp).connect(g).connect(p); send(p, buses.sfx, rev * 0.5);
    }
    if (heavy) {
      { const o = osc("sine", t, 0.7, 52); o.frequency.exponentialRampToValueAtTime(36, t + 0.35); const g = perc(t, 0.004, 0.13, 0.75); o.connect(g); send(g, buses.sfx); }
      for (const [f, a] of [[1180, 0.06], [2927, 0.045], [4310, 0.03], [1770, 0.035]]) { const o = osc("sine", t, 1.2, f * r(0.995, 1.005)), g = perc(t, 0.002, 0.22, a); o.connect(g); send(g, buses.sfx, 0.45); }
    }
    duck(t, heavy ? 0.55 : 0.4, heavy ? 0.12 : 0.08);
  }
  function shatter(t) {
    { const o = osc("sine", t, 0.4, 92), g = perc(t, 0.003, 0.07, 0.6); o.frequency.exponentialRampToValueAtTime(55, t + 0.12); o.connect(g); send(g, buses.sfx); }
    for (let i = 0; i < 60; i++) {
      const tt = t + 0.9 * Math.pow(R(), 2.2), o = osc("sine", tt, 0.08, r(1400, 4300)), g = perc(tt, 0.0005, r(0.01, 0.022), r(0.035, 0.12) * (1 - (tt - t) * 0.8));
      const p = pan(r(-0.6, 0.7)); o.connect(g).connect(p); send(p, buses.sfx, 0.18);
    }
    for (let i = 0; i < 12; i++) {
      const tt = t + 0.05 + 0.7 * Math.pow(R(), 1.6), o = osc("triangle", tt, 0.1, r(420, 880)), g = perc(tt, 0.001, r(0.018, 0.03), r(0.06, 0.14));
      const p = pan(r(-0.4, 0.6)); o.connect(g).connect(p); send(p, buses.sfx, 0.18);
    }
    duck(t, 0.35, 0.1);
  }
  function assemble(t, len) {
    for (let i = 0; i < 40; i++) {
      const u = Math.pow(R(), 0.6), tt = t + u * len, o = osc("sine", tt, 0.06, 900 + 2400 * u + r(-120, 120)), g = perc(tt, 0.0006, 0.012, 0.03 + 0.05 * u);
      const p = pan(r(-0.3, 0.5)); o.connect(g).connect(p); send(p, buses.sfx, 0.3);
    }
    const tp = t + len, o = osc("sine", tp, 0.2, 320), g = perc(tp, 0.002, 0.05, 0.22); o.frequency.exponentialRampToValueAtTime(180, tp + 0.08); o.connect(g); send(g, buses.sfx, 0.2);
  }
  function zap(t, fire) {                                   // a bolt or breath leaving: a bright hiss rising, a low whump under fire
    const len = fire ? 0.45 : 0.22, n = src(t, len, fire ? 0.7 : 1.4), bp = filt("bandpass", fire ? 700 : 1800, fire ? 0.8 : 2);
    bp.frequency.setValueAtTime(fire ? 500 : 1400, t); bp.frequency.exponentialRampToValueAtTime(fire ? 1400 : 4200, t + len * 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(fire ? 0.4 : 0.22, t + len * 0.25); g.gain.linearRampToValueAtTime(0, t + len);
    n.connect(bp).connect(g); send(g, buses.under, 0.2);
    if (fire) { const o = osc("sine", t, len, 90); o.frequency.exponentialRampToValueAtTime(50, t + len); const og = perc(t, 0.02, 0.12, 0.35); o.connect(og); send(og, buses.under); }
  }
  function twang(t) {                                       // bowstring release
    const o = osc("triangle", t, 0.25, 180), g = perc(t, 0.001, 0.06, 0.35); o.frequency.exponentialRampToValueAtTime(120, t + 0.12); o.connect(g); send(g, buses.sfx, 0.15);
    const n = src(t, 0.12, 1.6), hp = filt("highpass", 2600), g2 = perc(t, 0.001, 0.03, 0.2); n.connect(hp).connect(g2); send(g2, buses.under);
  }

  return {
    get on() { return on; },
    enable(v = true) {
      if (v && !ctx && !boot()) return false;
      on = v;
      if (ctx && v && ctx.state === "suspended") ctx.resume();
      return on;
    },
    /** kind: swing | swingHeavy | hit | hitHeavy | shatter | assemble | zap | breath | twang; delay in seconds */
    play(kind, delay = 0, opts = {}) {
      if (!on || !ctx) return;
      const t = ctx.currentTime + Math.max(0, delay) + 0.01;
      if (kind === "swing") whoosh(t, false);
      else if (kind === "swingHeavy") whoosh(t, true);
      else if (kind === "hit") impact(t, false);
      else if (kind === "hitHeavy") impact(t, true);
      else if (kind === "shatter") shatter(t);
      else if (kind === "assemble") assemble(t, opts.len || 0.55);
      else if (kind === "zap") zap(t, false);
      else if (kind === "breath") zap(t, true);
      else if (kind === "twang") twang(t);
    },
  };
})();
