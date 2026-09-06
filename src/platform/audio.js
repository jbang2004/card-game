/* Procedural layered audio: transient, body and tail have separate envelopes.
 * A shared convolution send keeps nodes bounded. Audio starts on user gesture,
 * never on loading the page. Volume is deliberately restrained. */
const EmberAudio = (() => {
  let ctx,
    master,
    dry,
    wet,
    convolver,
    noiseBuffer,
    enabled = true,
    started = false;
  const played = {};
  function init() {
    if (started) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.38 : 0;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -15;
      limiter.knee.value = 18;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      dry = ctx.createGain();
      dry.gain.value = 1;
      dry.connect(master);
      wet = ctx.createGain();
      wet.gain.value = 0.16;
      convolver = ctx.createConvolver();
      const ir = ctx.createBuffer(
        2,
        Math.floor(ctx.sampleRate * 1.5),
        ctx.sampleRate,
      );
      for (let ch = 0; ch < 2; ch++) {
        const a = ir.getChannelData(ch);
        for (let i = 0; i < a.length; i++)
          a[i] =
            (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3.7) * 0.55;
      }
      convolver.buffer = ir;
      convolver.connect(wet);
      wet.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const a = noiseBuffer.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      const ambience = ctx.createGain();
      ambience.gain.value = 0.026;
      ambience.connect(dry);
      for (const [i, f] of [55, 82.407, 110, 164.814].entries()) {
        const o = ctx.createOscillator(),
          g = ctx.createGain(),
          filter = ctx.createBiquadFilter();
        o.type = "triangle";
        o.frequency.value = f;
        o.detune.value = i % 2 ? 2.4 : -2.4;
        g.gain.value = 0.18;
        filter.type = "lowpass";
        filter.frequency.value = 240;
        o.connect(filter);
        filter.connect(g);
        g.connect(ambience);
        o.start();
      }
      started = true;
    } catch (e) {
      enabled = false;
    }
  }
  function unlock() {
    if (!enabled) return;
    init();
    ctx?.resume().catch(() => {});
  }
  function connect(node, tail = true) {
    node.connect(dry);
    if (tail) node.connect(convolver);
  }
  function tone(f, end = f, d = 0.35, v = 0.1, type = "sine", delay = 0) {
    if (!started || !enabled) return;
    const t = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(22, f), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(22, end), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, v),
      t + Math.min(0.025, d * 0.15),
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    connect(g);
    o.start(t);
    o.stop(t + d + 0.025);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  function noise(
    d = 0.25,
    v = 0.14,
    f = 1800,
    end = 200,
    type = "bandpass",
    delay = 0,
  ) {
    if (!started || !enabled) return;
    const t = ctx.currentTime + delay,
      s = ctx.createBufferSource(),
      g = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    s.buffer = noiseBuffer;
    filter.type = type;
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(f, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(filter);
    filter.connect(g);
    connect(g, false);
    s.start(t, Math.random() * 0.5, d + 0.01);
    s.onended = () => {
      s.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  function cast(s) {
    switch (s) {
      case "fire":
        noise(0.47, 0.2, 400, 3500, "bandpass");
        tone(75, 170, 0.34, 0.08, "triangle");
        break;
      case "frost":
        noise(0.46, 0.12, 5000, 2100, "highpass");
        [1100, 1650, 2200].forEach((f, i) =>
          tone(f, f * 1.25, 0.38, 0.045, "sine", i * 0.05),
        );
        break;
      case "arcane":
        [220, 330, 440].forEach((f, i) =>
          tone(f, f * 2, 0.5, 0.055, "sine", i * 0.035),
        );
        tone(120, 190, 0.4, 0.08, "triangle");
        break;
      case "nature":
        noise(0.48, 0.18, 600, 2200);
        [196, 261.63, 392].forEach((f, i) =>
          tone(f, f * 0.98, 0.2, 0.065, "triangle", i * 0.09),
        );
        break;
      case "holy":
        [392, 523.25, 783.99].forEach((f, i) =>
          tone(f, f, 0.8, 0.055, "sine", i * 0.055),
        );
        break;
      case "shadow":
      case "blood":
        tone(175, 43, 0.62, 0.13, "triangle");
        tone(180, 58, 0.68, 0.05);
        noise(0.58, 0.12, 1200, 180, "lowpass");
        break;
      default:
        noise(0.32, 0.19, 800, 4200, "bandpass");
        tone(130, 95, 0.18, 0.065, "triangle");
    }
  }
  function impact(s) {
    switch (s) {
      case "fire":
        noise(0.64, 0.3, 2600, 100, "lowpass");
        tone(105, 32, 0.55, 0.25, "sine");
        noise(0.22, 0.09, 5200, 2500, "highpass", 0.1);
        break;
      case "frost":
        noise(0.18, 0.19, 6700, 3800, "highpass");
        [1760, 2370, 3150, 4220].forEach((f, i) =>
          tone(f, f * 0.88, 0.32 + i * 0.05, 0.045, "sine", i * 0.025),
        );
        tone(74, 43, 0.25, 0.1);
        break;
      case "arcane":
        tone(86, 44, 0.38, 0.18);
        [440, 659.25, 880].forEach((f, i) =>
          tone(f, f * 0.72, 0.55, 0.068, "sine", i * 0.045),
        );
        noise(0.14, 0.1, 3400, 800);
        break;
      case "nature":
        noise(0.37, 0.21, 1900, 250, "bandpass");
        tone(145, 58, 0.25, 0.15, "triangle");
        [392, 523.25].forEach((f, i) =>
          tone(f, f, 0.65, 0.05, "sine", i * 0.08),
        );
        break;
      case "holy":
        tone(130.81, 65.4, 0.3, 0.16);
        [523.25, 783.99, 1046.5, 1567.98].forEach((f, i) =>
          tone(f, f, 1.1, 0.058, "sine", i * 0.025),
        );
        noise(0.2, 0.06, 2500, 700);
        break;
      case "shadow":
      case "blood":
        tone(90, 27, 0.8, 0.24, "triangle");
        tone(133, 47, 0.65, 0.09);
        noise(0.65, 0.18, 1600, 100, "lowpass");
        break;
      default:
        noise(0.12, 0.3, 3600, 400);
        tone(82, 39, 0.24, 0.19);
        [710, 1140, 1830].forEach((f, i) =>
          tone(f, f * 0.96, 0.32, 0.045, "sine", i * 0.008),
        );
    }
  }
  function fx(type) {
    if (!enabled || !started) return;
    played[type] = (played[type] || 0) + 1;
    if (type.startsWith("cast-")) {
      cast(type.slice(5));
      return;
    }
    if (type.startsWith("impact-")) {
      impact(type.slice(7));
      return;
    }
    switch (type) {
      case "swing":
        noise(0.2, 0.19, 700, 3700);
        break;
      case "attack":
        impact("steel");
        break;
      case "damage":
        tone(70, 40, 0.18, 0.1);
        break;
      case "equip":
        impact("steel");
        tone(523, 780, 0.65, 0.06);
        break;
      case "play":
        noise(0.12, 0.07, 2600, 900);
        tone(329, 493, 0.2, 0.04);
        break;
      case "summon":
        tone(90, 130, 0.4, 0.09, "triangle");
        tone(261, 392, 0.6, 0.04);
        break;
      case "power":
        cast("arcane");
        break;
      case "turn":
        [261.63, 392, 523.25].forEach((f, i) =>
          tone(f, f, 0.95, 0.058, "sine", i * 0.095),
        );
        break;
      case "over":
        [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
          tone(f, f, 1.7, 0.075, "sine", i * 0.13),
        );
        break;
      case "phase":
        tone(78, 32, 1.8, 0.17, "triangle");
        tone(117, 43, 1.6, 0.065);
        noise(1.4, 0.18, 2100, 90, "lowpass");
        break;
      case "shield":
        [1320, 1760, 2340].forEach((f, i) =>
          tone(f, f * 0.85, 0.4, 0.05, "sine", i * 0.025),
        );
        break;
      case "heal":
        cast("nature");
        break;
      default:
        tone(520, 580, 0.08, 0.035);
    }
  }
  function toggle(v) {
    enabled = !!v;
    if (ctx) {
      if (v) ctx.resume().catch(() => {});
      master.gain.setTargetAtTime(v ? 0.38 : 0, ctx.currentTime, 0.08);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (enabled) ctx.resume().catch(() => {});
  });
  return {
    unlock,
    fx,
    toggle,
    played,
    get started() {
      return started;
    },
    get state() {
      return ctx?.state || "not-started";
    },
  };
})();
