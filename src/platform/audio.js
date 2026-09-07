/* Event-synchronous mixer. All samples are bundled locally; decoding never
 * delays a combat beat. Each cue owns bounded, cancellable nodes and tails. */
const EmberAudio = (() => {
  let ctx, master, compressor, convolver, noiseBuffer, room;
  let enabled = true,
    started = false,
    currentVoice = null,
    scene = "lobby";
  const buses = {},
    buffers = new Map(),
    voices = new Set(),
    recent = new Map();
  const played = {},
    history = [],
    failed = new Set();
  const levels = { volume: 0.75, sfxVolume: 0.85, ambienceVolume: 0.35 };
  let peakVoices = 0,
    dropped = 0,
    runtimeErrors = 0,
    ready = Promise.resolve();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const bank = () =>
    typeof EmberSoundBank === "undefined" ? {} : EmberSoundBank;
  function ramp(param, value, time = 0.025) {
    param.cancelScheduledValues(ctx.currentTime);
    param.setTargetAtTime(value, ctx.currentTime, time);
  }
  function mix() {
    if (!ctx) return;
    ramp(master.gain, enabled ? levels.volume : 0);
    ramp(buses.sfx.gain, levels.sfxVolume);
    ramp(buses.ui.gain, levels.sfxVolume * 0.62);
    ramp(
      buses.ambience.gain,
      levels.ambienceVolume * (scene === "battle" ? 0.55 : 1),
      0.12,
    );
  }
  function dispose(voice) {
    if (!voices.delete(voice)) return;
    clearTimeout(voice.timer);
    for (const source of voice.sources) {
      try {
        source.stop();
      } catch {}
    }
    for (const node of voice.nodes) {
      try {
        node.disconnect();
      } catch {}
    }
  }
  function stop() {
    for (const voice of [...voices]) dispose(voice);
    recent.clear();
  }
  async function preload() {
    await Promise.all(
      Object.entries(bank()).map(async ([id, entry]) => {
        try {
          const response = await fetch(entry.src);
          if (!response.ok) throw Error("audio response");
          buffers.set(
            id,
            await ctx.decodeAudioData(await response.arrayBuffer()),
          );
        } catch {
          failed.add(id);
        }
      }),
    );
  }
  function init() {
    if (started) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C({ latencyHint: "interactive" });
      master = ctx.createGain();
      master.gain.value = 0;
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -8;
      compressor.knee.value = 6;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.14;
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 36;
      master.connect(highpass).connect(compressor).connect(ctx.destination);
      for (const name of ["sfx", "ui", "ambience"]) {
        buses[name] = ctx.createGain();
        buses[name].connect(master);
      }
      convolver = ctx.createConvolver();
      const ir = ctx.createBuffer(
        2,
        Math.floor(ctx.sampleRate * 0.48),
        ctx.sampleRate,
      );
      for (let ch = 0; ch < 2; ch++) {
        const a = ir.getChannelData(ch);
        for (let i = 0; i < a.length; i++)
          a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 4) * 0.3;
      }
      convolver.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.09;
      convolver.connect(wet).connect(buses.sfx);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const a = noiseBuffer.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      // A quiet, unpitched room bed leaves speech-like and magical cues clear.
      room = ctx.createBufferSource();
      room.buffer = noiseBuffer;
      room.loop = true;
      const filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      filter.type = "lowpass";
      filter.frequency.value = 230;
      gain.gain.value = 0.035;
      room.connect(filter).connect(gain).connect(buses.ambience);
      room.start();
      started = true;
      mix();
      ready = preload();
    } catch {
      ctx?.close().catch(() => {});
      ctx = null;
    }
  }
  function unlock() {
    if (!enabled || document.hidden) return;
    init();
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  }
  function connect(node, tail = true) {
    node.connect(currentVoice.input);
    if (tail) node.connect(currentVoice.send);
  }
  function track(source, nodes, end) {
    const voice = currentVoice;
    voice.sources.push(source);
    voice.nodes.push(...nodes);
    voice.end = Math.max(voice.end, end);
  }
  function tone(f, end = f, d = 0.35, v = 0.1, type = "sine", delay = 0) {
    const t = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    const variation = currentVoice.pitch;
    o.frequency.setValueAtTime(Math.max(22, f * variation), t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(22, end * variation),
      t + d,
    );
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, v),
      t + Math.min(0.008, d * 0.12),
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    connect(g);
    track(o, [o, g], t + d + 0.025);
    o.start(t);
    o.stop(t + d + 0.025);
  }
  function noise(
    d = 0.25,
    v = 0.14,
    f = 1800,
    end = 200,
    type = "bandpass",
    delay = 0,
  ) {
    const t = ctx.currentTime + delay,
      s = ctx.createBufferSource(),
      g = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    s.buffer = noiseBuffer;
    filter.type = type;
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(f, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(filter).connect(g);
    connect(g, false);
    track(s, [s, filter, g], t + d + 0.01);
    s.start(t, Math.random() * 0.5, d + 0.01);
  }
  function sample(id, gain = 0.3) {
    const buffer = buffers.get(id);
    if (!buffer) return false;
    const source = ctx.createBufferSource(),
      level = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = currentVoice.pitch;
    level.gain.value = gain * (bank()[id]?.gain || 1);
    source.connect(level);
    connect(level, false);
    track(
      source,
      [source, level],
      ctx.currentTime + buffer.duration / currentVoice.pitch,
    );
    source.start();
    return true;
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
  function synth(type) {
    if (type.startsWith("cast-")) return cast(type.slice(5));
    if (type.startsWith("impact-")) return impact(type.slice(7));
    switch (type) {
      case "swing":
        noise(0.16, 0.12, 600, 4100);
        break;
      case "attack":
        impact("steel");
        break;
      case "damage":
        tone(78, 38, 0.17, 0.12);
        noise(0.09, 0.1, 1800, 420);
        break;
      case "equip":
        impact("steel");
        tone(523, 780, 0.38, 0.04);
        break;
      case "select":
      case "play":
      case "draw":
        noise(0.09, 0.12, 3200, 850);
        noise(0.07, 0.045, 900, 1900, "bandpass", 0.06);
        break;
      case "land":
        tone(110, 56, 0.13, 0.15);
        noise(0.06, 0.11, 1300, 220);
        break;
      case "summon":
        tone(100, 64, 0.22, 0.14);
        noise(0.08, 0.14, 800, 160);
        break;
      case "legendary":
        tone(82, 41, 0.6, 0.16);
        [196, 293.66, 392].forEach((f, i) =>
          tone(f, f, 0.75, 0.04, "triangle", i * 0.045),
        );
        break;
      case "power":
        cast("arcane");
        break;
      case "turn":
        [261.63, 392, 523.25].forEach((f, i) =>
          tone(f, f, 0.58, 0.06, "sine", i * 0.09),
        );
        break;
      case "turn-enemy":
        noise(0.1, 0.09, 900, 230);
        tone(196, 147, 0.2, 0.055, "triangle");
        break;
      case "victory":
      case "over":
        [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
          tone(f, f, 1.25, 0.065, "triangle", i * 0.12),
        );
        break;
      case "defeat":
        [196, 185, 146.83, 98].forEach((f, i) =>
          tone(f, f * 0.98, 0.9, 0.07, "triangle", i * 0.18),
        );
        break;
      case "draw-result":
        [261.63, 392, 261.63].forEach((f, i) =>
          tone(f, f, 0.6, 0.05, "sine", i * 0.18),
        );
        break;
      case "phase":
        tone(78, 32, 1.2, 0.13, "triangle");
        noise(0.85, 0.17, 2100, 90, "lowpass");
        break;
      case "shield":
        [1320, 1760, 2340].forEach((f, i) =>
          tone(f, f * 0.85, 0.27, 0.045, "sine", i * 0.018),
        );
        noise(0.12, 0.12, 6200, 2200, "highpass");
        break;
      case "armor":
        tone(640, 390, 0.16, 0.07, "triangle");
        noise(0.09, 0.12, 2700, 900);
        break;
      case "death":
      case "weapon-break":
        noise(0.38, 0.19, 1800, 120, "lowpass");
        tone(105, 35, 0.3, 0.1);
        break;
      case "burn":
        noise(0.45, 0.12, 3200, 350);
        break;
      case "heal":
        cast("nature");
        break;
      case "freeze":
        tone(1760, 2200, 0.22, 0.035);
        noise(0.16, 0.05, 6500, 2600, "highpass");
        break;
      case "buff":
        [392, 587.33].forEach((f, i) =>
          tone(f, f, 0.32, 0.038, "sine", i * 0.08),
        );
        break;
      case "silence":
        noise(0.18, 0.08, 2400, 110);
        break;
      case "error":
        tone(185, 155, 0.1, 0.055, "triangle");
        tone(155, 130, 0.12, 0.04, "triangle", 0.11);
        break;
      default:
        noise(0.035, 0.04, 1800, 950);
        tone(640, 420, 0.045, 0.028);
    }
  }
  function fx(type, options = {}) {
    if (!enabled || !started || document.hidden || ctx.state !== "running")
      return false;
    const ui = ["ui", "select", "error"].includes(type),
      now = ctx.currentTime;
    const key = type;
    if (now - (recent.get(key) ?? -100) < (ui ? 0.065 : 0.035)) {
      dropped++;
      return false;
    }
    recent.set(key, now);
    const priority = ui
      ? 0
      : /victory|defeat|phase|legendary/.test(type)
        ? 3
        : 1;
    if (voices.size >= 20) {
      const victim = [...voices].find((v) => v.priority <= priority);
      if (!victim) {
        dropped++;
        return false;
      }
      dispose(victim);
    }
    const input = ctx.createGain(),
      send = ctx.createGain(),
      pan = ctx.createStereoPanner();
    const intensity = clamp(
      Number.isFinite(options.strength) ? options.strength : 1,
      0.5,
      1.55,
    );
    input.gain.value =
      intensity *
      (Number.isFinite(options.gain) ? clamp(options.gain, 0, 1.5) : 1);
    send.gain.value = input.gain.value * 0.45;
    pan.pan.value = clamp(
      Number.isFinite(options.pan) ? options.pan : 0,
      -0.65,
      0.65,
    );
    input.connect(pan).connect(buses[ui ? "ui" : "sfx"]);
    send.connect(convolver);
    const voice = {
      input,
      send,
      nodes: [input, send, pan],
      sources: [],
      end: now,
      priority,
      pitch: /turn|victory|defeat|draw-result/.test(type)
        ? 1
        : 0.97 + Math.random() * 0.06,
    };
    voices.add(voice);
    currentVoice = voice;
    try {
      let id = type;
      if (type.startsWith("impact-"))
        id = options.heavy ? "impact-heavy" : "impact-light";
      if (type === "summon" || type === "land") id = "table-thump";
      if (type === "select") id = "card-pickup";
      if (type === "play")
        id = (played.play || 0) % 2 ? "card-play-alt" : "card-play";
      if (type === "draw") id = "card-draw";
      id =
        {
          death: "death-debris",
          shield: "shield-crack",
          turn: "turn-bell",
          equip: "equip-latch",
          "weapon-break": "death-debris",
        }[id] || id;
      const sampled = sample(
        id,
        ui ? 0.18 : type.startsWith("impact-") ? 0.23 : 0.3,
      );
      // Elemental magic and weight remain responsive, even before decoding.
      if (
        !sampled ||
        type.startsWith("impact-") ||
        ["legendary", "death", "turn", "equip", "summon"].includes(type)
      )
        synth(type);
      played[type] = (played[type] || 0) + 1;
      history.push({
        type,
        at: performance.now(),
        sampled,
        pan: pan.pan.value,
        strength: intensity,
      });
      if (history.length > 96) history.shift();
      peakVoices = Math.max(peakVoices, voices.size);
      voice.timer = setTimeout(
        () => dispose(voice),
        Math.max(20, (voice.end - now) * 1000 + 60),
      );
      if (!ui) {
        ramp(buses.ambience.gain, levels.ambienceVolume * 0.16, 0.035);
        buses.ambience.gain.setTargetAtTime(
          levels.ambienceVolume * (scene === "battle" ? 0.55 : 1),
          now + 0.28,
          0.25,
        );
      }
      return true;
    } catch {
      runtimeErrors++;
      dispose(voice);
      return false;
    } finally {
      currentVoice = null;
    }
  }
  function configure(values = {}) {
    for (const key of Object.keys(levels))
      if (Number.isFinite(values[key])) levels[key] = clamp(values[key], 0, 1);
    mix();
  }
  function toggle(value) {
    enabled = !!value;
    if (!enabled) stop();
    else if (started || navigator.userActivation?.isActive) unlock();
    mix();
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      stop();
      ctx.suspend().catch(() => {});
    } else if (enabled) ctx.resume().catch(() => {});
  });
  return Object.freeze({
    unlock,
    fx,
    toggle,
    configure,
    stop,
    played,
    setScene(value) {
      scene = value;
      mix();
    },
    get ready() {
      return ready;
    },
    get started() {
      return started;
    },
    get state() {
      return ctx?.state || "not-started";
    },
    get diagnostics() {
      return {
        activeVoices: voices.size,
        peakVoices,
        dropped,
        runtimeErrors,
        loaded: [...buffers.keys()],
        failed: [...failed],
        levels: { ...levels },
        enabled,
        history: history.map((e) => ({ ...e })),
      };
    },
  });
})();
