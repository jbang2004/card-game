/* Bounded, texture-backed combat VFX. Rendered by EmberFX's existing Canvas
 * clock. No gameplay DOM mutations, timers, rule state, remote requests, or independent RAF loop. */
const EmberVFX = (() => {
  const palette = {
    steel: ["#fff7de", "#c7c9bb", "#64584b"],
    fire: ["#fff0ac", "#ffad37", "#ae3717"],
    frost: ["#edffff", "#7adcf5", "#337dba"],
    arcane: ["#fff1ff", "#c497ff", "#7342b8"],
    nature: ["#f0ffaf", "#99d47a", "#386443"],
    holy: ["#fffbd2", "#f4d575", "#ae7930"],
    shadow: ["#eddcff", "#a476d7", "#38294e"],
    blood: ["#ffceb7", "#e37c79", "#833847"],
  };
  const images = new Map(),
    tinted = new Map(),
    failed = new Set();
  let items = [],
    reduced = false,
    low = false,
    promise = null,
    frameTint = null;
  const stats = {
    peak: 0,
    draws: 0,
    maxDraws: 0,
    frameMs: 0,
    maxFrameMs: 0,
    frames: 0,
    totalMs: 0,
    spawned: {},
  };
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const ease = (t) => 1 - (1 - clamp(t)) ** 3;
  const mix = (a, b, t) => a + (b - a) * t;
  const scale = () => EmberViewport.effectScale;
  const limit = () => (low ? 24 : EmberViewport.mobile ? 48 : 96);
  function prepare() {
    if (reduced) return Promise.resolve();
    if (promise) return promise;
    promise = Promise.all(
      Object.entries(EmberVfxAssets).map(async ([key, entry]) => {
        const img = new Image();
        img.src = entry.src;
        try {
          await img.decode();
          images.set(key, img);
        } catch {
          failed.add(key);
        }
      }),
    );
    return promise;
  }
  function texture(key, color) {
    const image = images.get(key);
    if (!image) return null;
    if (!color || EmberVfxAssets[key].frames > 1) return image;
    const id = key + color;
    if (tinted.has(id)) return tinted.get(id);
    // Eight schools × the small shared masks; never tint full animation atlases.
    if (tinted.size >= 48) return image;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const c = canvas.getContext("2d");
    c.drawImage(image, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    tinted.set(id, canvas);
    return canvas;
  }
  function emit(kind, data, duration = 500, delay = 0) {
    if (reduced) return;
    // Keep each affected unit's core cue when a full-board spell hits the cap.
    // Decorative debris yields first, so leftmost targets do not lose their hit.
    if (items.length >= limit()) {
      const expendable = items.findIndex(
        (e) => e.kind === "shard" || e.kind === "orbit",
      );
      if (["shard", "orbit"].includes(kind)) return;
      items.splice(expendable < 0 ? 0 : expendable, 1);
    }
    items.push({
      kind,
      ...data,
      duration,
      start: performance.now() + delay,
    });
    stats.peak = Math.max(stats.peak, items.length);
    stats.spawned[kind] = (stats.spawned[kind] || 0) + 1;
  }
  function sprite(asset, p, size, school, options = {}) {
    emit(
      "sprite",
      { asset, x: p.x, y: p.y, size: size * scale(), school, ...options },
      options.duration || 500,
      options.delay || 0,
    );
  }
  function dust(p, school, size = 100) {
    sprite("smoke-ring", p, size, school, {
      duration: 520,
      expand: 1.45,
      flat: 0.5,
      opacity: 0.42,
      color: palette[school][2],
      blend: "source-over",
    });
  }
  function shards(p, school, n = 8, strength = 1, delay = 0) {
    const count = low
      ? Math.ceil(n / 3)
      : EmberViewport.mobile
        ? Math.ceil(n / 2)
        : n;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + 0.3,
        reach = (35 + (i % 3) * 19) * strength * scale();
      emit(
        "shard",
        {
          x: p.x,
          y: p.y,
          angle,
          reach,
          school,
          size: (5 + (i % 3) * 3) * scale(),
          gravity: 25 * scale(),
        },
        340 + (i % 3) * 50,
        delay,
      );
    }
  }
  function spell(kind, from, to, targets, school, duration = 500) {
    if (reduced) return;
    const points = targets?.length ? targets : [to];
    const color = palette[school] || palette.arcane;
    // Casting form and trajectory carry meaning even in monochrome.
    if (["meteor", "firestorm", "cataclysm"].includes(kind)) {
      const meteorTargets = kind === "meteor" ? [to] : points;
      for (const [i, target] of meteorTargets.entries()) {
        emit(
          "reticle",
          {
            x: target.x,
            y: target.y,
            school,
            radius: (kind === "meteor" ? 48 : 60) * scale(),
          },
          duration,
        );
        const start = duration * (0.32 + (i % 3) * 0.065);
        emit(
          "comet",
          {
            from: { x: target.x - 155 * scale(), y: target.y - 330 * scale() },
            to: target,
            school: "fire",
            size: (kind === "meteor" ? 74 : 85) * scale(),
          },
          duration - start,
          start,
        );
      }
    } else if (["blizzard", "ice-lance"].includes(kind)) {
      if (kind === "ice-lance")
        emit("lance", { from, to, school, size: 24 * scale() }, duration);
      else {
        const center = {
          x: points.reduce((n, p) => n + p.x, 0) / points.length,
          y: points.reduce((n, p) => n + p.y, 0) / points.length,
        };
        emit(
          "frost-field",
          {
            ...center,
            school,
            radius: Math.max(
              115 * scale(),
              ...points.map((p) => Math.abs(p.x - center.x) + 55 * scale()),
            ),
          },
          duration,
        );
        for (const p of points)
          emit(
            "reticle",
            { x: p.x, y: p.y, school, radius: 45 * scale() },
            duration,
          );
      }
    } else if (
      ["void-collapse", "dispel", "metamorphosis", "mirror"].includes(kind)
    ) {
      const target = ["mirror"].includes(kind) ? from : to;
      emit(
        "void",
        {
          ...target,
          school,
          radius: (kind === "void-collapse" ? 102 : 67) * scale(),
          implode: kind === "void-collapse",
        },
        duration,
      );
      sprite("vortex", target, kind === "void-collapse" ? 230 : 150, school, {
        duration,
        rotate: 2,
        expand: -0.48,
        color: color[1],
        opacity: 0.8,
      });
    } else if (kind === "siphon") {
      emit(
        "beam",
        { from, to, school: "blood", size: 22 * scale(), siphon: true },
        duration,
      );
    } else if (
      ["sunrise", "benediction", "aegis", "forge", "aether"].includes(kind)
    ) {
      for (const p of points)
        emit(
          "consecrate",
          {
            ...p,
            school,
            radius: (kind === "sunrise" ? 85 : 58) * scale(),
          },
          duration,
        );
    } else if (["starwell", "wildgate", "bloom", "warcry"].includes(kind)) {
      emit(
        "sigil",
        {
          ...from,
          school,
          radius: 82 * scale(),
        },
        duration,
      );
      for (let i = 0; i < (low ? 3 : 6); i++)
        emit(
          "orbit",
          {
            ...from,
            school,
            radius: (45 + i * 5) * scale(),
            angle: (i * Math.PI) / 3,
          },
          duration,
        );
    } else if (["dragon-breath", "breath"].includes(kind)) {
      for (const p of points)
        emit("beam", { from, to: p, school, size: 72 * scale() }, duration);
    } else if (kind === "shatter") {
      sprite("claw", to, 130, "steel", {
        duration,
        angle: -0.7,
        color: palette.steel[0],
      });
    } else {
      emit(
        kind === "arrow" || kind === "spear" ? "arrow" : "bolt",
        {
          from,
          to,
          school,
          size: (kind === "spear" ? 35 : 22) * scale(),
        },
        duration,
      );
    }
  }
  function attack(kind, from, to, school, duration) {
    if (["arrow", "spear", "bolt", "breath"].includes(kind))
      spell(kind, from, to, [to], school, duration);
    else
      emit("anticipation", { ...from, school, radius: 38 * scale() }, duration);
  }
  // Only the assets needed by this contact can trigger its vector fallback.
  // A failed holy column must not disable fire, melee or geometry-only nature.
  const hitAssets = Object.freeze({
    blade: ["slash-blade", "flame-slash"],
    claw: ["claw"],
    slam: ["smoke-ring", "debris"],
    arrow: ["glint"],
    spear: ["glint"],
    fire: ["fire-burst", "fire", "smoke-ring"],
    frost: ["energy-ring"],
    arcane: ["cross-burst", "energy-ring"],
    holy: ["storm-column"],
    nature: [],
    shadow: ["energy-burst"],
    blood: ["energy-burst"],
    steel: ["glint"],
  });
  function hit(p, school = "steel", strength = 1, kind = "element", from) {
    if (reduced) return true;
    const required = hitAssets[kind] || hitAssets[school] || hitAssets.steel;
    if (!required.every((key) => images.has(key))) return false;
    const colors = palette[school] || palette.steel,
      size = 135 * clamp(strength, 0.7, 1.8);
    if (kind === "blade") {
      sprite("slash-blade", p, size * 1.28, school, {
        angle: from ? Math.atan2(p.y - from.y, p.x - from.x) - 0.7 : -0.7,
        duration: 260,
        color: colors[0],
      });
      sprite("flame-slash", p, size, school, {
        duration: 350,
        angle: 0.5,
        opacity: school === "fire" ? 0.85 : 0.3,
        color: school === "fire" ? undefined : colors[0],
      });
      shards(p, school, 6, strength);
    } else if (kind === "claw") {
      sprite("claw", p, size, school, {
        angle: -0.5,
        duration: 290,
        color: colors[0],
      });
      shards(p, school, 5, strength);
    } else if (kind === "slam") {
      dust(p, school, size * 1.6);
      emit("fracture", { ...p, school, radius: size * 0.65 * scale() }, 480);
      sprite("debris", p, size * 1.1, school, {
        duration: 400,
        expand: 0.65,
        color: colors[2],
        blend: "source-over",
        opacity: 0.8,
      });
      shards(p, school, 9, strength);
    } else if (kind === "arrow" || kind === "spear") {
      sprite("glint", p, size * 0.65, school, {
        duration: 170,
        color: colors[0],
      });
      shards(p, school, 4, strength * 0.7);
    } else if (school === "fire") {
      sprite("fire-burst", p, size * 1.7, school, {
        duration: 500,
        opacity: 0.95,
      });
      sprite("fire", p, size, school, {
        duration: 450,
        expand: 0.5,
        color: colors[1],
        opacity: 0.72,
      });
      dust(p, school, size * 1.65);
      shards(p, school, 9, strength);
    } else if (school === "frost") {
      sprite("energy-ring", p, size, school, {
        duration: 230,
        color: colors[1],
        expand: 0.7,
        flat: 0.7,
        opacity: 0.55,
      });
      shards(p, school, 9, strength);
    } else if (school === "arcane") {
      sprite("cross-burst", p, size * 1.6, school, { duration: 440 });
      sprite("energy-ring", p, size * 1.4, school, {
        duration: 420,
        expand: 0.4,
        color: colors[1],
        opacity: 0.65,
      });
    } else if (school === "holy") {
      sprite("storm-column", p, size * 1.65, school, {
        duration: 440,
        color: colors[1],
      });
      emit("consecrate", { ...p, school, radius: size * 0.65 * scale() }, 420);
    } else if (school === "nature") {
      emit("roots", { ...p, school, radius: size * 0.6 * scale() }, 480);
      shards(p, school, 7, strength);
    } else if (school === "shadow" || school === "blood") {
      sprite("energy-burst", p, size * 1.5, school, { duration: 420 });
      emit(
        "void",
        { ...p, school, radius: size * 0.65 * scale(), implode: true },
        410,
      );
    } else {
      sprite("glint", p, size * 0.8, school, {
        duration: 160,
        color: colors[0],
      });
      shards(p, school, 7, strength);
    }
    return true;
  }
  function arrival(kind, p, school) {
    if (!kind || reduced) return;
    emit(kind, { ...p, school, radius: 135 * scale() }, 860);
    sprite("energy-ring", { x: p.x, y: p.y + p.h * 0.3 }, 280, school, {
      duration: 720,
      flat: 0.43,
      expand: 0.6,
      color: palette[school][1],
    });
    dust({ x: p.x, y: p.y + p.h * 0.4 }, school, 230);
  }
  function interrupt(p, school = "arcane") {
    emit("void", { ...p, school, radius: 80 * scale(), implode: true }, 300);
    sprite("energy-burst", p, 150, school, { duration: 300 });
  }
  function paintSprite(ctx, e, t) {
    const asset = EmberVfxAssets[e.asset];
    let image = texture(e.asset, e.color);
    if (!asset || !image) return;
    const frames = asset.frames || 1,
      cols = asset.cols || 1;
    const fw = asset.frameWidth || image.width / cols,
      fh = asset.frameHeight || image.height / (asset.rows || 1);
    const frame = Math.min(frames - 1, Math.floor(t * frames));
    let sx = (frame % cols) * fw,
      sy = Math.floor(frame / cols) * fh;
    // Tint just the current 128px cell. Holy columns and steel blades must not
    // inherit the source atlas's blue/orange school or allocate a full copy.
    if (frames > 1 && e.color) {
      if (!frameTint) {
        frameTint = document.createElement("canvas");
        frameTint.width = fw;
        frameTint.height = fh;
      }
      const tint = frameTint.getContext("2d");
      tint.globalCompositeOperation = "source-over";
      tint.clearRect(0, 0, fw, fh);
      tint.drawImage(image, sx, sy, fw, fh, 0, 0, fw, fh);
      tint.globalCompositeOperation = "source-in";
      tint.fillStyle = e.color;
      tint.fillRect(0, 0, fw, fh);
      image = frameTint;
      sx = sy = 0;
      stats.draws += 2;
    }
    const size = e.size * (1 + (e.expand || 0) * ease(t));
    ctx.translate(e.x, e.y);
    ctx.rotate((e.angle || 0) + (e.rotate || 0) * t);
    ctx.scale(1, e.flat || 1);
    ctx.globalCompositeOperation = e.blend || "lighter";
    ctx.globalAlpha =
      (e.opacity ?? 1) *
      (frames > 1
        ? Math.min(1, (1 - t) * 7)
        : Math.min(1, t * 16) * (1 - t) ** 0.7);
    ctx.drawImage(
      image,
      sx,
      sy,
      fw,
      fh,
      -size * (asset.anchor?.[0] ?? 0.5),
      -size * (asset.anchor?.[1] ?? 0.5),
      size,
      size,
    );
    stats.draws++;
  }
  function stroke(ctx, points, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
    );
    ctx.stroke();
    stats.draws++;
  }
  function disk(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.fill();
    stats.draws++;
  }
  function renderItem(ctx, e, t) {
    const colors = palette[e.school] || palette.arcane,
      s = scale(),
      fade = Math.min(1, t * 12, (1 - t) * 5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade;
    if (e.kind === "sprite") paintSprite(ctx, e, t);
    else if (["comet", "bolt", "arrow", "lance"].includes(e.kind)) {
      const k = e.kind === "comet" ? t * t : t,
        x = mix(e.from.x, e.to.x, k),
        y = mix(e.from.y, e.to.y, k);
      const angle = Math.atan2(e.to.y - e.from.y, e.to.x - e.from.x);
      ctx.translate(x, y);
      ctx.rotate(angle);
      // A tapered, fading wake reads as velocity instead of stacked capsules.
      const length = (e.kind === "comet" ? 158 : 74) * s;
      const wake = ctx.createLinearGradient(-length, 0, e.size * 0.2, 0);
      wake.addColorStop(0, colors[2] + "00");
      wake.addColorStop(0.58, colors[1] + "65");
      wake.addColorStop(1, colors[0] + "db");
      ctx.fillStyle = wake;
      ctx.globalAlpha = Math.min(1, t * 12) * 0.85;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.bezierCurveTo(
        -length * 0.48,
        -e.size * 0.12,
        -e.size * 0.3,
        -e.size * 0.35,
        e.size * 0.2,
        0,
      );
      ctx.bezierCurveTo(
        -e.size * 0.3,
        e.size * 0.35,
        -length * 0.48,
        e.size * 0.12,
        -length,
        0,
      );
      ctx.fill();
      ctx.globalAlpha = Math.min(1, t * 12) * 0.9;
      if (e.kind === "arrow") {
        stroke(
          ctx,
          [
            [-38 * s, 0],
            [14 * s, 0],
          ],
          colors[0],
          2 * s,
        );
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.moveTo(24 * s, 0);
        ctx.lineTo(5 * s, -6 * s);
        ctx.lineTo(8 * s, 0);
        ctx.lineTo(5 * s, 6 * s);
        ctx.fill();
        stroke(
          ctx,
          [
            [-32 * s, -6 * s],
            [-23 * s, 0],
            [-32 * s, 6 * s],
          ],
          colors[0],
          2 * s,
        );
      } else if (e.kind === "lance") {
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.moveTo(25 * s, 0);
        ctx.lineTo(-12 * s, -10 * s);
        ctx.lineTo(-35 * s, 0);
        ctx.lineTo(-12 * s, 10 * s);
        ctx.closePath();
        ctx.fill();
        stroke(
          ctx,
          [
            [-35 * s, 0],
            [25 * s, 0],
            [-12 * s, -10 * s],
          ],
          colors[0],
          1.5 * s,
        );
      } else {
        const fire = texture("fire", colors[1]);
        if (fire) {
          ctx.drawImage(
            fire,
            -e.size * 0.85,
            -e.size * 0.65,
            e.size * 1.4,
            e.size * 1.3,
          );
          stats.draws++;
        }
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, e.size * 0.32);
        core.addColorStop(0, colors[0]);
        core.addColorStop(0.2, colors[0] + "df");
        core.addColorStop(0.55, colors[1] + "80");
        core.addColorStop(1, colors[1] + "00");
        disk(ctx, 0, 0, e.size * 0.32, core);
      }
    } else if (e.kind === "beam") {
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * e.size * 0.13 * Math.sin(Math.PI * t),
          points = [];
        for (let j = 0; j <= 16; j++) {
          const k = j / 16;
          points.push([
            mix(e.from.x, e.to.x, k),
            mix(e.from.y, e.to.y, k) + Math.sin(k * 10 - t * 12 + i) * off,
          ]);
        }
        ctx.globalAlpha = fade * (i === 2 ? 0.8 : 0.3);
        stroke(
          ctx,
          points,
          colors[i === 2 ? 0 : 1],
          Math.max(1, e.size * (i === 2 ? 0.075 : 0.15)),
        );
      }
      const fire = texture(e.siphon ? "glint" : "fire", colors[1]);
      if (fire)
        for (let i = 0; i < 7; i++) {
          const k = (t * 2 + i / 7) % 1,
            x = mix(e.from.x, e.to.x, k),
            y = mix(e.from.y, e.to.y, k),
            r = e.size * (0.25 + k * 0.6);
          ctx.globalAlpha = fade * 0.65;
          ctx.drawImage(fire, x - r / 2, y - r / 2, r, r);
          stats.draws++;
        }
    } else if (e.kind === "shard") {
      const travel = ease(t) * e.reach,
        x = e.x + Math.cos(e.angle) * travel,
        y = e.y + Math.sin(e.angle) * travel + t * t * e.gravity;
      ctx.translate(x, y);
      ctx.rotate(e.angle + t * 2);
      ctx.fillStyle = colors[1];
      ctx.globalAlpha = (1 - t) ** 1.4;
      ctx.beginPath();
      ctx.moveTo(e.size * 1.6, 0);
      ctx.lineTo(0, -e.size * 0.42);
      ctx.lineTo(-e.size, 0);
      ctx.lineTo(0, e.size * 0.42);
      ctx.closePath();
      ctx.fill();
      stroke(
        ctx,
        [
          [e.size * 1.6, 0],
          [-e.size, 0],
        ],
        colors[0],
        0.8 * s,
      );
    } else {
      ctx.translate(e.x, e.y);
      const r = e.radius || 70 * s;
      if (["reticle", "anticipation"].includes(e.kind)) {
        ctx.scale(1, 0.55);
        ctx.rotate(t * 0.4);
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1 - t * 0.15), 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          stroke(
            ctx,
            [
              [r + 8 * s, 0],
              [r - 7 * s, 0],
            ],
            colors[0],
            2 * s,
          );
        }
      } else if (["frost-field", "frost-throne"].includes(e.kind)) {
        ctx.scale(1, 0.68);
        const count = e.kind === "frost-throne" ? 9 : 12;
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 1.5 * s;
        for (let i = 0; i < count; i++) {
          ctx.save();
          ctx.rotate((i / count) * Math.PI * 2);
          const grow = ease(clamp(t * 1.8 - (i % 3) * 0.08));
          stroke(
            ctx,
            [
              [r * 0.15, 0],
              [r * grow, 0],
            ],
            colors[1],
            2 * s,
          );
          for (let j = 0; j < 3; j++) {
            const x = r * (0.3 + j * 0.19) * grow;
            stroke(
              ctx,
              [
                [x - r * 0.12, -r * 0.09],
                [x, 0],
                [x - r * 0.12, r * 0.09],
              ],
              colors[0],
              1 * s,
            );
          }
          ctx.restore();
        }
        const ring = texture("energy-ring", colors[1]);
        if (ring) {
          ctx.globalAlpha = fade * 0.5;
          ctx.drawImage(ring, -r, -r, r * 2, r * 2);
          stats.draws++;
        }
      } else if (["void", "astral-gate"].includes(e.kind)) {
        const rr =
          r *
          (e.implode ? 1 - 0.78 * ease(t) : 0.65 + 0.3 * Math.sin(Math.PI * t));
        ctx.globalCompositeOperation = "source-over";
        const gradient = ctx.createRadialGradient(0, 0, rr * 0.1, 0, 0, rr);
        gradient.addColorStop(
          0,
          e.kind === "astral-gate" ? "#100c2420" : "#100c24dc",
        );
        gradient.addColorStop(
          0.65,
          e.kind === "astral-gate" ? "#3d245c55" : "#3d245c99",
        );
        gradient.addColorStop(1, "#38234f00");
        ctx.fillStyle = gradient;
        ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
        ctx.globalCompositeOperation = "lighter";
        ctx.rotate(t * 2);
        for (let i = 0; i < 7; i++) {
          ctx.rotate((Math.PI * 2) / 7);
          stroke(
            ctx,
            [
              [rr * 0.15, -rr * 0.1],
              [rr * 0.48, -rr * 0.45],
              [rr, 0],
            ],
            colors[1],
            ((i % 2) + 1) * s,
          );
          disk(ctx, rr, 0, 2 * s, colors[0]);
        }
      } else if (["sigil", "consecrate", "solar-crown"].includes(e.kind)) {
        if (e.kind === "sigil") ctx.scale(1, 0.55);
        const rr = r * (0.75 + 0.25 * ease(t));
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 1.5 * s;
        for (const radius of [rr, rr * 0.77]) {
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        const n = e.kind === "solar-crown" ? 12 : 8;
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * Math.PI * 2 + t * 0.22);
          stroke(
            ctx,
            [
              [rr * 0.84, -4 * s],
              [rr * 1.05, 0],
              [rr * 0.84, 4 * s],
            ],
            colors[0],
            2 * s,
          );
          if (e.kind === "solar-crown")
            stroke(
              ctx,
              [
                [rr * 1.12, 0],
                [rr * (1.5 + 0.3 * Math.sin(t * 5)), 0],
              ],
              colors[1],
              3 * s,
            );
          ctx.restore();
        }
        if (e.kind === "consecrate") {
          ctx.globalAlpha = fade * 0.28;
          const g = ctx.createLinearGradient(0, -r * 2, 0, r * 0.4);
          g.addColorStop(0, "#fffac000");
          g.addColorStop(1, colors[1]);
          ctx.fillStyle = g;
          ctx.fillRect(-r * 0.3, -r * 2, r * 0.6, r * 2.5);
        }
      } else if (e.kind === "orbit") {
        const a = e.angle + t * 4;
        disk(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.55, 3 * s, colors[0]);
      } else if (["fracture", "roots", "dragon-wake"].includes(e.kind)) {
        const n = e.kind === "roots" ? 7 : 9;
        ctx.globalCompositeOperation =
          e.kind === "fracture" ? "source-over" : "lighter";
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * Math.PI * 2);
          const rr = r * ease(t);
          stroke(
            ctx,
            [
              [12 * s, 0],
              [rr * 0.4, -rr * 0.12],
              [rr * 0.7, rr * 0.08],
              [rr, 0],
            ],
            e.kind === "fracture" ? "#5c3d2d" : colors[1],
            (e.kind === "dragon-wake" ? 4 : 2) * s,
          );
          if (e.kind === "roots")
            stroke(
              ctx,
              [
                [rr * 0.4, -rr * 0.12],
                [rr * 0.55, -rr * 0.3],
              ],
              colors[0],
              1.5 * s,
            );
          ctx.restore();
        }
        if (e.kind === "dragon-wake")
          for (const sign of [-1, 1]) {
            ctx.save();
            ctx.scale(sign, 1);
            ctx.globalAlpha = fade * 0.45;
            const wing = ctx.createLinearGradient(0, -r, 0, r * 0.2);
            wing.addColorStop(0, colors[1] + "da");
            wing.addColorStop(1, colors[2] + "00");
            ctx.fillStyle = wing;
            ctx.beginPath();
            ctx.moveTo(10 * s, -25 * s);
            ctx.bezierCurveTo(
              r * 0.8,
              -r * 1.1,
              r * 1.2,
              -r * 0.6,
              r * 1.45,
              -r * 0.2,
            );
            ctx.lineTo(r * 0.85, -r * 0.25);
            ctx.lineTo(r * 0.73, r * 0.04);
            ctx.lineTo(r * 0.5, -r * 0.08);
            ctx.lineTo(r * 0.3, r * 0.15);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = colors[1];
            ctx.lineWidth = s;
            ctx.stroke();
            ctx.restore();
          }
      }
    }
    ctx.restore();
  }
  function draw(ctx, time) {
    const start = performance.now();
    stats.draws = 0;
    items = items.filter((e) => time < e.start + e.duration);
    if (!reduced)
      for (const e of items)
        if (time >= e.start)
          renderItem(ctx, e, clamp((time - e.start) / e.duration));
    stats.frameMs = performance.now() - start;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, stats.frameMs);
    stats.maxDraws = Math.max(stats.maxDraws, stats.draws);
    if (items.length) {
      stats.frames++;
      stats.totalMs += stats.frameMs;
    }
  }
  return Object.freeze({
    prepare,
    spell,
    attack,
    hit,
    arrival,
    interrupt,
    draw,
    clear() {
      items = [];
    },
    configure(r, l) {
      reduced = !!r;
      low = !!l;
      if (reduced) items = [];
      else prepare();
    },
    get active() {
      return items.length;
    },
    get ready() {
      return promise || Promise.resolve();
    },
    get diagnostics() {
      return {
        ...stats,
        spawned: { ...stats.spawned },
        active: items.length,
        limit: limit(),
        loaded: [...images.keys()],
        failed: [...failed],
        tints: tinted.size,
        decodedBytes: [...images.values(), ...tinted.values()].reduce(
          (n, i) => n + i.width * i.height * 4,
          frameTint ? frameTint.width * frameTint.height * 4 : 0,
        ),
        meanFrameMs: stats.frames ? stats.totalMs / stats.frames : 0,
      };
    },
  });
})();
