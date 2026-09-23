/* EmberFx2 —— 写实特效管线的接入层（BATTLE_PRESENTATION_V2 §3.3）。
 *
 * 它是导演层（effects.js）与 EmberFx2Engine 之间唯一的接口：
 *   · 建两层 DOM：#fx-gl（WebGL 特效层，z-index 11，压在战场 DOM 之上）、
 *     #fx-cutin（切入立绘，z-index 13）。原来的 #fx-top（2D 画布，天降剑气与卡片
 *     描边）已删除：bladeCross 移进引擎，命中描边改成 impulse 的边缘闪。
 *   · 转发引擎的新接口：plan / cast / attack / contact / impulse，参数全是舞台坐标下的
 *     可见卡面包围盒 {x, y, w, h}（x/y 是中心）。
 *   · 全平台同一条管线（契约原则 7）：只有"减少动态效果"与 WebGL 失败会关掉它；
 *     低画质与高 DPR 手机只降渲染分辨率（0.5）、跳过 1/8 级 bloom。
 *   · 舞台尺寸跟着 EmberViewport 走：桌面 1600×940，手机是视口的 CSS 像素。
 *
 * 没有自己的 rAF：draw(now) 由 EmberFX 的主 tick 驱动。
 */
const EmberFx2 = (() => {
  "use strict";

  // cutin() 直接收到图片地址（而不是 cutinArt() 的返回值）时的默认取景
  const CUTIN_POS = "50% 32%";
  // 专用特技画面（assets/cutin，512×512 正方）是为切入构图画的
  const CUTIN_ART_POS = "50% 30%";
  // 完全中性的后期：用来验证空闲时整条链是恒等变换
  const NEUTRAL_POST = Object.freeze({ bloom1: 0, bloom2: 0, distort: 0, tone: 1 });
  // 同一帧里多次施法只上传一次场景（折射采样用）
  const SCENE_UPLOAD_MIN_MS = 120;

  let engine = null;
  const motionFeedback = EmberMotionFeedback.create([EmberBenchmarkFeedback, EmberRemasterFeedback]);
  const benchmarkFeedback = motionFeedback.channel("benchmark");
  const remasterFeedback = motionFeedback.channel("remaster");
  const lifecycleFeedback=typeof EmberLifecycleFeedback!=="undefined"?EmberLifecycleFeedback.create():null;
  let castGroup=0;
  let meshEngine = null, meshCanvas = null, meshError = null;
  let glCanvas = null;
  let cutinEl = null;
  let ready = false;
  let failed = false;
  let enabled = false;
  let quality = { reduced: false, low: false };
  let hostWorld = null;
  let lastUpload = -Infinity;
  // 只读诊断：哪个技能放了多少次（回归脚本判断"这张卡走了哪个技能"）
  const spawned = Object.create(null);

  function timing() {
    return EmberTiming;
  }

  function stageSize() {
    if (typeof EmberViewport !== "undefined" && EmberViewport.width > 0) {
      return { w: EmberViewport.width, h: EmberViewport.height };
    }
    return { w: EmberFx2Engine.STAGE_W, h: EmberFx2Engine.STAGE_H };
  }

  function makeCanvas(id, after) {
    const app = document.getElementById("app");
    if (!app) return null;
    const c = document.createElement("canvas");
    c.id = id;
    c.setAttribute("aria-hidden", "true");
    if (after && after.parentNode === app) app.insertBefore(c, after.nextSibling);
    else app.appendChild(c);
    return c;
  }

  function makeCutin() {
    const app = document.getElementById("app");
    if (!app) return null;
    const el = document.createElement("div");
    el.id = "fx-cutin";
    el.setAttribute("aria-hidden", "true");
    el.dataset.on = "0";
    // 裁切 + 渐变遮罩 + 速度线都在 CSS 里（battle.css）；ghost 是同一张插画的暖色残影
    el.innerHTML =
      '<div class="fx-cutin-lines"></div>' +
      '<img class="fx-cutin-ghost" alt="">' +
      '<img class="fx-cutin-art" alt="">' +
      '<div class="fx-cutin-flash"></div>';
    app.appendChild(el);
    return el;
  }

  /* ------------------------------------------------------------ 震屏 / 推镜目标
   * 震屏与推镜只作用在棋盘与特效层上：世界画布、特效画布、随从行。两张英雄卡按
   * 40% 振幅做同相位的位移（不缩放，贴着舞台边缘的卡不会被推出去）。
   * 顶栏、手牌、HUD 不在其中。ox/oy = 元素左上角在舞台坐标里的偏移，引擎用它把
   * transform-origin 换算进元素自己的盒子，所有层围绕同一个冲击点缩放。 */
  const CAMERA_IDS = ["world-canvas", "arena-gl", "fx-gl", "fx-3d", "minions"];
  const SHAKE_IDS = ["player-hero", "enemy-hero"];
  const HERO_SHAKE = 0.4;
  let cameraList = [];
  function cameraTargets() {
    cameraList = CAMERA_IDS.map((id) => ({
      el: document.getElementById(id),
      ox: 0,
      oy: 0,
    })).filter((t) => t.el);
    for (const id of SHAKE_IDS) {
      const el = document.getElementById(id);
      if (el) cameraList.push({ el, ox: 0, oy: 0, shake: HERO_SHAKE });
    }
    return cameraList;
  }
  function measureCamera() {
    const app = document.getElementById("app");
    if (!app || !cameraList.length) return;
    const base = app.getBoundingClientRect();
    const scale = base.width / stageSize().w || 1;
    for (const t of cameraList) {
      const kept = t.el.style.transform;
      if (kept) t.el.style.transform = "";
      const r = t.el.getBoundingClientRect();
      t.ox = (r.left - base.left) / scale;
      t.oy = (r.top - base.top) / scale;
      if (kept) t.el.style.transform = kept;
    }
  }

  // Return a target point in the 3D canvas's pre-camera stage coordinates.
  // Undo the shared canvas transform once, retaining the target's own recoil.
  function resolveMeshTarget(ref) {
    if (!ref || !meshCanvas) return null;
    const el = ref.uid === "hero"
      ? document.querySelector(ref.side === "p" ? "#player-hero .hero-card-inner" : "#enemy-hero .hero-card-inner")
      : document.querySelector(`#battle .minion[data-uid="${CSS.escape(String(ref.uid))}"]`);
    if (!el?.isConnected) return null;
    const b = EmberViewport.pos(el); if (!b) return null;
    const style = getComputedStyle(meshCanvas), m = new DOMMatrix(style.transform);
    const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
    const p = new DOMPoint(b.x - (ox || 0), b.y - (oy || 0)).matrixTransform(m.inverse());
    return { ...b, x: p.x + (ox || 0), y: p.y + (oy || 0) };
  }

  /**
   * 建层并初始化引擎。战斗视图进入时调一次；重复调用无副作用。
   * 返回 Promise<boolean>：false = WebGL 不可用，导演层只保留 DOM 动作与数字。
   */
  function init() {
    if (engine || failed) return Promise.resolve(ready);
    const world = document.getElementById("world-canvas");
    const battle = document.getElementById("battle");
    if (!world || !battle) {
      failed = true;
      return Promise.resolve(false);
    }
    hostWorld = world;
    // #fx-gl 插在世界画布之后；z-index 由 battle.css 给
    glCanvas = makeCanvas("fx-gl", world);
    if (typeof EmberVFX3 !== "undefined") meshCanvas = makeCanvas("fx-3d", glCanvas);
    cutinEl = makeCutin();
    if (!glCanvas) {
      failed = true;
      return Promise.resolve(false);
    }
    const stage = stageSize();
    try {
      engine = EmberFx2Engine.create({
        canvas: glCanvas,
        cameraTargets: cameraTargets(),
        stageW: stage.w,
        stageH: stage.h,
      });
    } catch (err) {
      failed = true;
      engine = null;
      if (glCanvas) glCanvas.hidden = true;
      return Promise.resolve(false);
    }
    engine.setQuality(quality);
    return engine.ready
      .then(() => {
        ready = true;
        if (typeof EmberVFX3 !== "undefined") {
          try {
            meshEngine = EmberVFX3.create(meshCanvas, { resolveTarget: resolveMeshTarget, onEmit: d => {motionFeedback.schedule(d);}, onFrame:(a,t,m)=>{motionFeedback.frame(a,t,m);lifecycleFeedback?.frame(a,t,m);}, onClear:()=>{motionFeedback.clear();lifecycleFeedback?.clear();} });
            const currentStage = stageSize();
            meshEngine.stage(currentStage.w, currentStage.h);
            // The initial quality call runs before this asynchronous creation.
            // Synchronize the actual DOM layer as well as the renderer state.
            setQuality(quality);
            meshCanvas.addEventListener("webglcontextlost", (event) => {
              event.preventDefault(); meshError = "3D WebGL context lost; reload to restore";
              lifecycleFeedback?.clear();motionFeedback.clear();
              meshEngine = null; meshCanvas.hidden = true;
            });
          } catch (error) {
            meshError = String(error.message || error);
            meshEngine?.destroy(); meshEngine = null;
            if (meshCanvas) meshCanvas.hidden = true;
            console.warn("EmberVFX3 unavailable; retaining legacy effect backend", error);
          }
        }
        return true;
      })
      .catch(() => {
        failed = true;
        ready = false;
        engine = null;
        if (glCanvas) glCanvas.hidden = true;
        return false;
      });
  }

  /** 画质门禁：只有"减少动态效果"与 WebGL 失败关掉管线；低画质只降分辨率。 */
  function setQuality(q) {
    quality = { reduced: !!(q && q.reduced), low: !!(q && q.low) };
    enabled = !quality.reduced && !failed;
    if (glCanvas) glCanvas.hidden = !enabled;
    if (engine) engine.setQuality(quality);
    meshEngine?.setQuality(quality);
    if (meshCanvas) meshCanvas.hidden = !enabled || !meshEngine;
    if (!enabled) stopCutin();
  }

  const available = () => ready && enabled && !failed;

  function syncStage() {
    if (!engine) return;
    const s = stageSize();
    engine.setStage(s.w, s.h);
    meshEngine?.stage(s.w, s.h);
  }

  /** 施法开始时把宿主世界画布上传一次，供折射采样。低画质不折射，不传。 */
  function snapshotScene(force) {
    if (!available() || !hostWorld || quality.low) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (!force && now - lastUpload < SCENE_UPLOAD_MIN_MS) return;
    lastUpload = now;
    engine.uploadScene(hostWorld);
  }

  function prepare(kind) {
    syncStage();
    snapshotScene(false);
    spawned[kind] = (spawned[kind] || 0) + 1;
  }

  /* ------------------------------------------------------------------ 切入立绘
   * 独立于技能实例的一条小时间线：入场 → 停留 → 出场，时长来自 EmberTiming.cutin
   * （70 / 190 / 80）。只给传奇与英雄（契约原则 8，调用方负责）。
   * 己方从右侧擦入，敌方镜像到左侧（立绘再 scaleX(-1)，面向场地中央）。
   * 入场是斜切擦入（--wipe 0 → 1）配一条白闪条；停留期立绘与速度线层反向漂移。 */
  const CUTIN_FLASH = 40;
  const CUTIN_PAR = 3;
  let cutin = null;

  function playCutin(art, opts) {
    if (!cutinEl) return;
    let src = art;
    let focus = CUTIN_POS;
    if (art && typeof art === "object") {
      src = art.art;
      focus = art.pos || CUTIN_POS;
    }
    if (!src) return;
    const o = opts || {};
    if (o.pos) focus = o.pos;
    const side = o.side === "e" ? "e" : "p";
    cutin = { art: src, pos: focus, side, t: 0, last: 0 };
  }

  function stopCutin() {
    cutin = null;
    applyCutin(null);
  }

  function applyCutin(frame) {
    if (!cutinEl) return;
    if (!frame || !(frame.alpha > 0.001)) {
      if (cutinEl.dataset.on !== "0") {
        cutinEl.dataset.on = "0";
        cutinEl.style.opacity = "0";
        cutinEl.style.visibility = "hidden";
        cutinEl.style.setProperty("--flash", "0");
      }
      return;
    }
    if (cutin && cutinEl.dataset.art !== cutin.art) {
      cutinEl.dataset.art = cutin.art;
      const imgs = cutinEl.querySelectorAll("img");
      for (let i = 0; i < imgs.length; i++) imgs[i].src = cutin.art;
    }
    if (cutin && cutinEl.dataset.pos !== cutin.pos) {
      cutinEl.dataset.pos = cutin.pos;
      cutinEl.style.setProperty("--cutin-x", cutin.pos);
    }
    if (cutin && cutinEl.dataset.side !== cutin.side) cutinEl.dataset.side = cutin.side;
    const dir = cutin && cutin.side === "e" ? -1 : 1;
    cutinEl.dataset.on = "1";
    cutinEl.style.visibility = "visible";
    cutinEl.style.opacity = frame.alpha.toFixed(3);
    cutinEl.style.setProperty("--wipe", frame.wipe.toFixed(4));
    cutinEl.style.setProperty("--par", (frame.par * dir).toFixed(2) + "%");
    cutinEl.style.setProperty("--flash", frame.flash.toFixed(3));
    cutinEl.style.transform = "translate3d(" + (frame.slide * dir).toFixed(2) + "%,0,0)";
  }

  const smooth = (t) => {
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    return u * u * (3 - 2 * u);
  };

  function cutinFrame(t) {
    const C = timing().cutin;
    if (t < C.in) {
      const u = t / C.in;
      return {
        alpha: Math.min(1, u * 2.4),
        wipe: smooth(u),
        par: 0,
        flash: t < CUTIN_FLASH ? Math.sin((Math.PI * t) / CUTIN_FLASH) : 0,
        slide: (1 - smooth(u)) * 5,
      };
    }
    if (t < C.in + C.hold) {
      const u = (t - C.in) / C.hold;
      return { alpha: 1, wipe: 1, par: CUTIN_PAR * smooth(u), flash: 0, slide: 0 };
    }
    const s = smooth(Math.min(1, (t - C.in - C.hold) / C.out));
    return { alpha: 1 - s * s, wipe: 1 - s, par: CUTIN_PAR, flash: 0, slide: s * 5 };
  }

  function stepCutin(now) {
    if (!cutin) return;
    const C = timing().cutin;
    const total = C.in + C.hold + C.out;
    const dt = cutin.last ? Math.min(64, now - cutin.last) : 16.7;
    cutin.last = now;
    cutin.t += dt;
    if (cutin.t >= total) stopCutin();
    else applyCutin(cutinFrame(cutin.t));
  }

  /**
   * 这个 id 的切入画面：只认专用特技画面（CutinAssets）。没有专用立绘就返回 null
   * —— 调用方（cutinPolicy 的 art 字段）据此不弹切入。卡插画是 336×448 的竖版
   * 构图，塞进 512² 的切入取景会错位，所以不做回退。
   * 返回 { art, pos } 或 null。id 对随从是卡 id，对英雄是 portraitId。
   */
  function cutinFor(cardId) {
    if (!cardId) return null;
    const dedicated = typeof CutinAssets !== "undefined" ? CutinAssets[cardId] : null;
    return dedicated ? { art: dedicated, pos: CUTIN_ART_POS } : null;
  }

  function draw(now) {
    if (!engine) return;
    stepCutin(now);
    if (!available()) return;
    syncStage();
    engine.draw(now);
    meshEngine?.draw(now);
  }

  const api = {
    init,
    setQuality,
    draw,
    snapshotScene() {
      snapshotScene(true);
    },

    get available() {
      return available();
    },
    get stats() {
      return engine ? engine.stats : null;
    },

    /** 纯函数，不需要 WebGL：导演层用它安排节拍与数字时刻。 */
    plan(kind, o) {
      return EmberFx2Engine.plan(kind, o);
    },

    beginSequence(id) {
      meshEngine?.beginSequence(id);
    },

    /** cast(kind, { from, targets, tier, tint, tintGrad, aoe, seed }) → plan 或 false */
    cast(kind, o) {
      if (!available()) return false;
      prepare(kind);
      if (meshEngine && EmberVFX3.supports(kind)) {
        const p = engine.plan ? engine.plan(kind, o) : EmberFx2Engine.plan(kind, o);
        const targets = o.targets?.length ? o.targets : (o.to ? [o.to] : (EmberRemasterArts.supports(kind)?[o.from]:[]));
        const start = Number.isFinite(o.startedAt) ? o.startedAt : performance.now();
        const groupId="r9-cast-"+(++castGroup);
        targets.forEach((to, i) => meshEngine.emit(kind, {
          ...o, to, targetRef: o.targetRefs?.[i], startedAt: start, groupId,
          tier: o.tiers?.[i] ?? o.tier,
          outcome: o.outcomes?.[i], audioPrimary: i === 0,
          audioGain: 1 / Math.sqrt(Math.max(1, targets.length)),
          contactAt: o.contactAt?.[i] ?? start + (p.hitAt[i] ?? 0),
          hitStopMs: (EmberTiming.tiers[o.tiers?.[i] ?? o.tier ?? 1]?.hitStopMs || 0) * (o.timeScale || 1),
        }));
        return p;
      }
      return engine.cast(kind, o);
    },

    /** attack(family, { from, to, tier, tint, tintGrad, ranged, seed }) → plan 或 false */
    attack(family, o) {
      if (!available()) return false;
      prepare(family);
      if (meshEngine && EmberVFX3.supports(family)) {
        const p = EmberFx2Engine.plan(family, { ...o, attack: true });
        meshEngine.emit(family, { ...o, leadMs: o.leadMs ?? p.hitAt[0] });
        return p;
      }
      return engine.attack(family, o);
    },

    lifecycle(kind,o) {
      if(!available()||!meshEngine||!EmberLifecycleArts.supports(kind))return false;
      const now=performance.now();
      return meshEngine.emit(kind,{...o,from:o.from||o.at,to:o.to||o.at,
        startedAt:now,contactAt:now,visualOnly:true,silent:true});
    },
    get lifecycleFeedback(){return lifecycleFeedback;},
    cue(kind,o) {
      if(!available()||!meshEngine||!EmberRemasterArts.supports(kind))return false;
      const now=performance.now();
      return meshEngine.emit(kind,{...o,from:o.from||o.at,to:o.to||o.at,
        startedAt:now,contactAt:now,visualOnly:true,silent:true});
    },
    /** contact({ at, tier, tint, tintGrad }) → plan 或 false */
    contact(o) {
      if (!available()) return false;
      prepare("contact");
      if (typeof EmberArena3D !== "undefined" && (o.tier || 0) >= 2) EmberArena3D.scorch(o.at);
      if(meshEngine){const now=performance.now();meshEngine.emit("contact",{...o,from:o.at,to:o.at,startedAt:now,contactAt:now,visualOnly:true,silent:true});return EmberFx2Engine.plan("contact",o);}
      return engine.contact(o);
    },

    /** impulse({ at, tier, cinematic }) → { hitStopMs, shakeMs, shakePx } 或 false */
    impulse(o) {
      if (!available()) return false;
      measureCamera();
      return engine.impulse(o);
    },

    /** 取消：丢掉所有在飞的特效与切入（导演层 cancel 时调）。 */
    clear() {
      if (engine) engine.clear();
      meshEngine?.clear();
      stopCutin();
    },

    /** cutin(art, { side })：art 是图片地址或 cutinArt() 的返回值。仅传奇与英雄。 */
    cutin(art, opts) {
      if (available()) playCutin(art, opts);
    },
    /** 解析一个 id 的切入画面，返回 { art, pos } 或 null。 */
    cutinArt(id) {
      return cutinFor(id);
    },

    get renderer3dAvailable() { return !!meshEngine && available(); },
    get mesh3d() { return meshEngine; },
    get benchmarkFeedback() { return benchmarkFeedback; },
    get remasterFeedback() { return remasterFeedback; },
    get diagnostics() {
      return {
        available: available(),
        ready,
        failed,
        enabled,
        low: quality.low,
        mesh3d: meshEngine?.stats || null,
        meshError,
        spawned: Object.assign({}, spawned),
      };
    },
  };

  // ---- 仅 ?debug=1 暴露：截图与量化脚本按毫秒定格 ----------------------------
  if (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug")) {
    let script = [];
    /**
     * 排一段调用脚本并定格到 0ms。每一项 { at, call, kind?, opts }，call 是
     * "cast" / "attack" / "contact" / "impulse"。debugSeek(ms) 从 0 固定步长重放。
     */
    api.debugScript = function (list) {
      if (!engine) return false;
      script = (list || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
      syncStage();
      snapshotScene(true);
      api.debugSeek(0);
      return true;
    };
    api.debugCast = (kind, opts) => api.debugScript([{ at: 0, call: "cast", kind, opts }]);
    api.debugAttack = (family, opts) =>
      api.debugScript([{ at: 0, call: "attack", kind: family, opts }]);
    api.debugSeek = function (ms) {
      if (!engine) return 0;
      engine.debugReset();
      for (const s of script) {
        if ((s.at || 0) > ms) break;
        engine.debugSeek(s.at || 0);
        if (s.call === "cast") engine.cast(s.kind, s.opts);
        else if (s.call === "attack") engine.attack(s.kind, s.opts);
        else if (s.call === "contact") engine.contact(s.opts);
        else if (s.call === "impulse") {
          measureCamera();
          engine.impulse(s.opts);
        }
      }
      return engine.debugSeek(ms);
    };
    api.debugPixels = () => (engine ? engine.debugPixels() : null);
    Object.defineProperty(api, "debugLayer", {
      get: () => (engine ? engine.debugLayer : null),
      set: (v) => { if (engine) engine.debugLayer = v; },
    });
    Object.defineProperty(api, "trace", {
      get: () => (engine ? engine.trace : null),
      set: (v) => { if (engine) engine.trace = v; },
    });
    /**
     * 逐像素比对：无特效时 #fx-gl 必须完全透明（屏幕上留下的就是底下的战场）。
     * 返回 { maxDelta, meanDelta, worst }；maxDelta 0 表示这一层什么都没写。
     */
    api.debugSceneDelta = function (override) {
      if (!engine || !hostWorld) return null;
      engine.uploadScene(hostWorld);
      const shot = engine.debugScenePixels(override === undefined ? NEUTRAL_POST : override);
      let maxDelta = 0;
      let sum = 0;
      let worst = null;
      const h = shot.height;
      for (let y = 0; y < h; y++) {
        const gy = h - 1 - y;
        for (let x = 0; x < shot.width; x++) {
          const base = (gy * shot.width + x) * 4;
          for (let c = 0; c < 4; c++) {
            const d = shot.data[base + c];
            sum += d;
            if (d > maxDelta) {
              maxDelta = d;
              worst = { x, y, channel: c, got: d, want: 0 };
            }
          }
        }
      }
      return {
        maxDelta,
        meanDelta: sum / (shot.width * h * 4),
        worst,
        note: "overlay: 0 = 完全透明 = 屏幕上逐像素就是底下的战场",
      };
    };
    api.debugReset = function () {
      script = [];
      if (engine) engine.debugReset();
    };
    api.debugResume = function () {
      if (engine) engine.debugResume();
    };
    api.engine = () => engine;
  }

  return api;
})();
if (typeof module !== "undefined") module.exports = EmberFx2;
