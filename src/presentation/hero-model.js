/* A persistent, presentation-only miniature renderer. WebGL renders into a
 * small shared buffer; the two DOM canvases retain the existing hero targeting,
 * pose compositor, modal stacking and accessibility semantics. */
const EmberHeroModel = (() => {
  // Reviewed Tripo mesh / Mixamo rig with original battle animation clips.
  const MODEL_URL = "asset:models/alia.glb";
  const views = new Map();
  const stats = {
    status: MODEL_URL ? "idle" : "disabled",
    loads: 0,
    renderers: 0,
    frames: 0,
    error: null,
    calls: 0,
    triangles: 0,
    frameMs: 0,
    maxFrameMs: 0,
    clips: [],
    meshes: 0,
    model: MODEL_URL ? "art/models/alia.glb" : null,
    lastCue: null,
    materials: 0,
    geometries: 0,
    textures: 0,
    dpr: 1,
    postPasses: 0,
    shadowMaps: 0,
  };
  let renderer,
    asset,
    loading,
    raf = 0,
    last = 0,
    dirty = true,
    matchToken;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () =>
    reducedQuery.matches || document.body.classList.contains("reduced-motion");
  const visible = () =>
    !document.hidden &&
    !!document.getElementById("battle")?.getClientRects().length;

  function disposeAsset(gltf) {
    if (!gltf) return;
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set(),
      images = new Set();
    gltf.scene.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of node.material
        ? Array.isArray(node.material)
          ? node.material
          : [node.material]
        : []) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) {
      if (texture.image) images.add(texture.image);
      texture.dispose();
    }
    for (const image of images) image.close?.();
  }
  function contextLost(event) {
    event.preventDefault();
    fail("WebGL context lost");
  }
  function fail(error) {
    if (stats.status === "fallback") return;
    stats.status = "fallback";
    stats.error = String(error?.message || error);
    cancelAnimationFrame(raf);
    raf = 0;
    for (const view of views.values()) {
      view.el?.classList.remove("hero-model-ready");
      view.mixer?.stopAllAction();
      view.scene?.traverse((node) => node.skeleton?.dispose());
      view.scene = null;
      view.model = null;
      view.pose = null;
      view.mixer = null;
      view.actions = null;
      view.idle = null;
      view.idleAction = null;
      view.activeAction = null;
      view.camera = null;
      view.bones = null;
      view.painted = false;
      view.canvas.width = 1;
      view.canvas.height = 1;
      view.magic.width = view.magic.height = 1;
    }
    EmberViewport.resize();
    disposeAsset(asset);
    asset = null;
    if (renderer) {
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
    // One diagnostic, no repeated retries or interruption of the playable game.
    console.warn(
      "Mage miniature unavailable; using the hero portrait.",
      stats.error,
    );
  }
  function ensureAsset() {
    if (loading) return loading;
    stats.status = "loading";
    loading = (async () => {
      const T = EmberHeroThree;
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      stats.renderers++;
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.info.autoReset = false;
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      stats.loads++;
      const loaded = await new T.GLTFLoader()
        .setMeshoptDecoder(T.MeshoptDecoder)
        .loadAsync(MODEL_URL);
      // A context loss while the download was pending must not resurrect a
      // failed renderer or leak the eventual image bitmaps / mesh resources.
      if (stats.status === "fallback") {
        disposeAsset(loaded);
        return;
      }
      asset = loaded;
      stats.clips = asset.animations.map((clip) => clip.name);
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      asset.scene.traverse((node) => {
        if (!node.isMesh) return;
        stats.meshes++;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value?.isTexture) {
              textures.add(value);
              value.anisotropy = Math.min(
                4,
                renderer.capabilities.getMaxAnisotropy(),
              );
            }
        }
      });
      if (!stats.meshes) throw new Error("The GLB has no visible meshes");
      stats.materials = materials.size;
      stats.geometries = geometries.size;
      stats.textures = textures.size;
      stats.status = "ready";
      for (const view of views.values()) createScene(view);
      wake();
    })().catch(fail);
    return loading;
  }
  function createScene(view) {
    if (view.scene || !asset) return;
    const T = EmberHeroThree,
      scene = new T.Scene(),
      pose = new T.Group();
    const model = T.cloneSkeleton(asset.scene);
    const bounds = new T.Box3().setFromObject(model),
      size = bounds.getSize(new T.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0)
      throw new Error("Invalid hero model bounds");
    const scale = 2 / size.y;
    model.scale.multiplyScalar(scale);
    const center = bounds.getCenter(new T.Vector3());
    model.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    );
    pose.add(model);
    scene.add(pose);
    scene.add(new T.HemisphereLight(0xcbdcff, 0x75614d, 2.4));
    const key = new T.DirectionalLight(0xffe6c6, 3.2);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new T.DirectionalLight(0x9cbfff, 2.6);
    rim.position.set(3, 3, -3);
    scene.add(rim);
    const fill = new T.DirectionalLight(0xc9d9ff, 0.7);
    fill.position.set(3, 2, 5);
    scene.add(fill);
    const camera = new T.OrthographicCamera(-1, 1, 2.3, 0, 0.1, 30);
    // A modest elevated view makes the two battlefield directions legible.
    camera.position.set(0, 3.8, 8);
    camera.lookAt(0, 1, 0);
    const mixer = new T.AnimationMixer(model);
    const idle = asset.animations.find((clip) =>
      /idle|breath|stand/i.test(clip.name),
    );
    const idleAction = idle ? mixer.clipAction(idle).play() : null;
    // Sample the natural first pose even when reduced motion or freeze means
    // there will be no subsequent animation update.
    mixer.update(0);
    const bones = [];
    model.traverse((node) => {
      if (node.isBone) bones.push(node);
    });
    const actions = {};
    for (const [kind, pattern] of [
      ["cast", /cast|magic|spell|attack/i],
      ["hit", /hit|hurt|damage|reaction/i],
    ]) {
      const clip = asset.animations.find((item) => pattern.test(item.name));
      if (clip) {
        actions[kind] = mixer.clipAction(clip);
        actions[kind].setLoop(T.LoopOnce, 1);
        actions[kind].clampWhenFinished = true;
      }
    }
    mixer.addEventListener("finished", ({ action }) => {
      if (idleAction && action === view.activeAction) {
        idleAction
          .reset()
          .setEffectiveWeight(1)
          .play()
          .crossFadeFrom(action, 0.16, false);
        view.activeAction = idleAction;
      }
    });
    Object.assign(view, {
      scene,
      pose,
      model,
      camera,
      mixer,
      idle,
      idleAction,
      actions,
      activeAction: idleAction,
      bones,
      poseBones: Object.fromEntries(
        [
          ["hips", /Hips$/],
          ["chest", /Spine2$/],
          ["head", /Head$/],
          ["leftHip", /LeftUpLeg$/],
          ["leftKnee", /LeftLeg$/],
          ["leftFoot", /LeftFoot$/],
          ["rightHip", /RightUpLeg$/],
          ["rightKnee", /RightLeg$/],
          ["rightFoot", /RightFoot$/],
        ].map(([name, pattern]) => [
          name,
          bones.find((candidate) => pattern.test(candidate.name)),
        ]),
      ),
      poseVectors: Object.fromEntries(
        [
          "hips",
          "chest",
          "head",
          "leftHip",
          "leftKnee",
          "leftFoot",
          "rightHip",
          "rightKnee",
          "rightFoot",
        ].map((name) => [name, new T.Vector3()]),
      ),
      angleA: new T.Vector3(),
      angleB: new T.Vector3(),
      hands: {
        left:
          bones.find((b) => /LeftHandMiddle1$/.test(b.name)) ||
          bones.find((b) => /LeftHand$/.test(b.name)),
        right:
          bones.find((b) => /RightHandMiddle1$/.test(b.name)) ||
          bones.find((b) => /RightHand$/.test(b.name)),
      },
      handVector: new T.Vector3(),
      aspect: Math.max(0.52, Math.max(size.x, size.z) / size.y),
      // Source forward is +X. Both heroes enter the board from its left
      // edge: ours presents a readable right-facing profile, theirs an
      // inward three-quarter view. Keep both away from a front-facing pose.
      turn: view.side === "p" ? -0.25 : -0.78,
    });
  }
  function attach(side, el) {
    let view = views.get(side);
    if (!view) {
      const canvas = document.createElement("canvas");
      canvas.className = "hero-model-canvas";
      canvas.setAttribute("aria-hidden", "true");
      const magic = document.createElement("canvas");
      magic.className = "hero-magic-canvas";
      magic.setAttribute("aria-hidden", "true");
      const ground = document.createElement("span");
      ground.className = "hero-model-ground";
      ground.setAttribute("aria-hidden", "true");
      view = {
        side,
        canvas,
        magic,
        magicContext: magic.getContext("2d"),
        trail: [],
        ground,
        context: canvas.getContext("2d"),
        el,
        scene: null,
        lastHp: null,
        powerUsed: null,
        cueAt: -10000,
        cue: null,
        width: 0,
        height: 0,
        painted: false,
      };
      views.set(side, view);
    }
    view.el = el;
    el.dataset.heroModel = "alia";
    const frame = el.querySelector(".portrait-frame");
    if (frame && view.canvas.parentElement !== frame)
      frame.append(view.ground, view.canvas, view.magic);
    el.classList.toggle(
      "hero-model-ready",
      view.painted && stats.status === "ready",
    );
    if (asset) createScene(view);
    return view;
  }
  function sync(state, token) {
    if (!MODEL_URL) return;
    if (token !== matchToken) {
      matchToken = token;
      stats.lastCue = null;
      for (const view of views.values()) {
        view.lastHp = null;
        view.powerUsed = null;
        view.cue = null;
        view.cueAt = -10000;
        view.mixer?.stopAllAction();
        view.idleAction?.reset().stopFading().setEffectiveWeight(1).play();
        view.lastCast = null;
        view.trail.length = 0;
        view.mixer?.update(0);
        view.activeAction = view.idleAction || null;
      }
    }
    for (const side of ["p", "e"]) {
      const el = document.getElementById(
        side === "p" ? "player-hero" : "enemy-hero",
      );
      if (!el) continue;
      const id =
        side === "p"
          ? state.heroId
          : state.mode === "practice"
            ? state.opponentHero
            : null;
      if (id !== "mage") {
        el.classList.remove("hero-model-ready");
        delete el.dataset.heroModel;
        const old = views.get(side);
        if (old) {
          old.el = null;
          old.canvas.remove();
          old.magic.remove();
          old.ground.remove();
        }
        continue;
      }
      const view = attach(side, el),
        player = state[side];
      if (view.lastHp !== null && player.hp < view.lastHp) cue(side, "hit");
      // Cast cues come only from the presentation timeline, never twice from
      // both the power-used snapshot and its scheduled launch beat.
      view.lastHp = player.hp;
      view.powerUsed = player.powerUsed;
      view.frozen = !!player.frozen;
    }
    EmberViewport.resize();
    if ([...views.values()].some((view) => view.el)) ensureAsset();
    dirty = true;
    wake();
  }
  function cue(side, kind, options = {}) {
    const view = views.get(side);
    if (!view) return;
    view.cue = kind;
    view.cueAt = performance.now();
    stats.lastCue = { side, kind, at: view.cueAt };
    if (kind === "cast") {
      view.lastCast = {
        startedAt: performance.now(),
        releaseAt: null,
        projectileAt: null,
        windupMs: options.windupMs ?? 550,
        school: options.school || "arcane",
      };
      view.trail.length = 0;
    }
    const action = view.actions?.[kind];
    if (action && !calm() && !view.frozen) {
      const previous = view.activeAction;
      action.reset().stopFading().stopWarping().setEffectiveWeight(1);
      action.setEffectiveTimeScale(
        kind === "cast" ? 550 / Math.max(80, options.windupMs ?? 550) : 1,
      );
      action.play();
      if (previous && previous !== action)
        action.crossFadeFrom(previous, 0.1, false);
      view.activeAction = action;
    }
    dirty = true;
    wake();
  }
  function updateHands(view) {
    if (!view.hands || !view.camera) return;
    view.scene.updateMatrixWorld(true);
    const rect = view.canvas.getBoundingClientRect();
    view.screenHands = {};
    for (const side of ["left", "right"]) {
      const bone = view.hands[side];
      if (!bone) continue;
      bone.getWorldPosition(view.handVector).project(view.camera);
      view.screenHands[side] = {
        x: rect.left + ((view.handVector.x + 1) * rect.width) / 2,
        y: rect.top + ((1 - view.handVector.y) * rect.height) / 2,
      };
    }
    view.screenPose = {};
    for (const [name, bone] of Object.entries(view.poseBones || {})) {
      if (!bone) continue;
      const world = view.poseVectors[name];
      bone.getWorldPosition(world);
      if (!["leftHip", "rightHip"].includes(name)) {
        view.handVector.copy(world).project(view.camera);
        view.screenPose[name] = {
          x: rect.left + ((view.handVector.x + 1) * rect.width) / 2,
          y: rect.top + ((1 - view.handVector.y) * rect.height) / 2,
        };
      }
    }
    const angle = (side) => {
      const hip = view.poseVectors[`${side}Hip`],
        knee = view.poseVectors[`${side}Knee`],
        foot = view.poseVectors[`${side}Foot`];
      if (!hip || !knee || !foot) return null;
      return (
        (view.angleA
          .subVectors(hip, knee)
          .angleTo(view.angleB.subVectors(foot, knee)) *
          180) /
        Math.PI
      );
    };
    view.kneeAngles = { left: angle("left"), right: angle("right") };
  }
  function release(side) {
    const view = views.get(side);
    if (!view?.lastCast || !view.actions?.cast) return;
    // Sample the authored release exactly before the projectile asks for its
    // origin; frame-rate quantisation must not move it back to the chest.
    if (!calm() && !view.frozen && view.activeAction === view.actions.cast) {
      view.activeAction.time = 0.55;
      view.mixer.update(0);
      updateHands(view);
    }
    view.lastCast.releaseAt = performance.now();
    view.lastCast.projectileAt = view.lastCast.releaseAt;
    dirty = true;
    wake();
  }
  function anchor(side) {
    const view = views.get(side);
    if (!view?.painted || stats.status !== "ready") return null;
    updateHands(view);
    const hand = view.screenHands?.right;
    if (!hand) return null;
    const radius = 6;
    return {
      x: hand.x - radius,
      y: hand.y - radius,
      width: radius * 2,
      height: radius * 2,
      left: hand.x - radius,
      top: hand.y - radius,
      right: hand.x + radius,
      bottom: hand.y + radius,
      cx: hand.x,
      cy: hand.y,
    };
  }
  function paintMagic(view, now, quiet) {
    const canvas = view.magic,
      ctx = view.magicContext,
      base = view.canvas;
    if (!ctx) return;
    const rect = base.getBoundingClientRect(),
      ratio = base.width / rect.width,
      // The casting palm reaches the edge of the narrow portrait/compact
      // camera. Give only the transparent VFX surface an overdraw gutter so
      // the astrolabe glow can finish outside the model canvas without making
      // the hero smaller or changing its battlefield position.
      gutterCss = Math.max(18, base.offsetWidth * 0.28),
      gutter = Math.ceil(gutterCss * ratio),
      width = base.width + gutter * 2,
      height = base.height + gutter * 2;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    Object.assign(canvas.style, {
      left: base.offsetLeft - gutterCss + "px",
      top: base.offsetTop - gutterCss + "px",
      width: base.offsetWidth + gutterCss * 2 + "px",
      height: base.offsetHeight + gutterCss * 2 + "px",
    });
    ctx.clearRect(0, 0, width, height);
    if (quiet || !view.screenHands?.right) {
      view.trail.length = 0;
      return;
    }
    const local = (p) => ({
      x: (p.x - rect.left) * ratio + gutter,
      y: (p.y - rect.top) * ratio + gutter,
    });
    const right = local(view.screenHands.right);
    const time = now / 1000,
      action = view.activeAction?.getClip().name;
    const casting = action === "cast",
      progress = view.activeAction?.time || 0;
    const charge = casting
      ? Math.min(1, progress / 0.5) * Math.max(0, 1 - (progress - 0.55) / 0.55)
      : 0;
    const flash = view.lastCast?.releaseAt
      ? Math.max(0, 1 - (now - view.lastCast.releaseAt) / 220)
      : 0;
    const fire = /fire|flame/.test(view.lastCast?.school || "");
    const color = casting && fire ? "255,167,66" : "131,204,255";
    const size = Math.max(3, base.height * 0.025),
      orb = size * (0.72 + charge * 1.9 + flash * 0.65);
    // Alia casts one-handed: charge, orbit, trail and release all remain bound
    // to the leading palm instead of implying that both hands cradle the spell.
    const center = right;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (casting) {
      view.trail.push({ ...right, at: now });
      while (
        view.trail.length > 12 ||
        (view.trail[0] && now - view.trail[0].at > 240)
      )
        view.trail.shift();
      for (let i = 1; i < view.trail.length; i++) {
        ctx.strokeStyle = `rgba(${color},${(i / view.trail.length) * 0.45 * charge})`;
        ctx.lineWidth = (size * 0.3 * i) / view.trail.length;
        ctx.beginPath();
        ctx.moveTo(view.trail[i - 1].x, view.trail[i - 1].y);
        ctx.lineTo(view.trail[i].x, view.trail[i].y);
        ctx.stroke();
      }
    } else view.trail.length = 0;
    const glow = ctx.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      orb * 2.4,
    );
    glow.addColorStop(0, `rgba(242,248,255,${0.55 + charge * 0.35})`);
    glow.addColorStop(0.2, `rgba(${color},${0.36 + charge * 0.32})`);
    glow.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, orb * 2.4, 0, Math.PI * 2);
    ctx.fill();
    // Two tilted orbit arcs and three distinct sparks read as an astrolabe,
    // echoing the original oracle portrait without covering the silhouette.
    const radius = orb * (1.25 + 0.12 * Math.sin(time * 2));
    ctx.strokeStyle = `rgba(${color},${0.48 + charge * 0.35})`;
    ctx.lineWidth = Math.max(0.65, ratio * 0.65);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(
        center.x,
        center.y,
        radius,
        radius * 0.42,
        time * 0.8 + i * 1.45,
        0,
        Math.PI * 1.65,
      );
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const a = time * 1.6 + (i * Math.PI * 2) / 3,
        x = center.x + Math.cos(a) * radius,
        y = center.y + Math.sin(a) * radius * 0.7;
      const r = Math.max(0.8, size * 0.23);
      ctx.fillStyle = "rgba(223,243,255,.92)";
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y - r * 1.8);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 1.8);
      ctx.closePath();
      ctx.fill();
    }
    if (flash > 0) {
      ctx.strokeStyle = `rgba(${color},${flash * 0.8})`;
      ctx.lineWidth = size * 0.2;
      ctx.beginPath();
      ctx.arc(right.x, right.y, size * (2 + (1 - flash) * 6), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function draw(view, now, delta) {
    if (!view.el?.isConnected || !view.scene) return;
    view.el.classList.add("hero-model-ready");
    const canvas = view.canvas,
      rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !view.context) return;
    const mobile = document.body.classList.contains("touch-layout");
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
    stats.dpr = dpr;
    const width = Math.max(1, Math.round(rect.width * dpr)),
      height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (
      renderer.domElement.width !== width ||
      renderer.domElement.height !== height
    )
      renderer.setSize(width, height, false);
    // Fit the entire authored silhouette, including staff and trailing cloth.
    const aspect = width / height,
      span = Math.max(2.38, (view.aspect * 2.2) / aspect);
    // Both inward-facing casts extend to screen-right. Give the hand
    // room without shrinking the standing figure in the narrow phone slot.
    const framingX = 0.16;
    view.camera.left = (-span * aspect) / 2 + framingX;
    view.camera.right = (span * aspect) / 2 + framingX;
    view.camera.top = span / 2;
    view.camera.bottom = -span / 2;
    view.camera.updateProjectionMatrix();
    const quiet = calm() || view.frozen;
    const t = now / 1000,
      age = (now - view.cueAt) / 1000;
    const hit =
      !quiet && !view.actions?.hit && view.cue === "hit" && age < 0.55
        ? Math.sin((age / 0.55) * Math.PI)
        : 0;
    const cast =
      !quiet && !view.actions?.cast && view.cue === "cast" && age < 0.9
        ? Math.sin((age / 0.9) * Math.PI)
        : 0;
    view.pose.rotation.set(
      -hit * 0.065,
      view.turn + (quiet ? 0 : Math.sin(t * 0.65) * 0.028) + cast * 0.1,
      hit * 0.045,
    );
    view.pose.position.y = quiet || view.idle ? 0 : Math.sin(t * 1.45) * 0.009;
    if (!quiet) view.mixer.update(delta);
    renderer.render(view.scene, view.camera);
    view.context.clearRect(0, 0, width, height);
    view.context.drawImage(renderer.domElement, 0, 0);
    updateHands(view);
    paintMagic(view, now, quiet);
    if (!view.painted) {
      // Do not replace a readable portrait with a successfully loaded but
      // completely blank render (bad camera bounds / unsupported material).
      const pixels = view.context.getImageData(0, 0, width, height).data;
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) opaque++;
      if (!opaque) throw new Error("The hero model rendered no visible pixels");
      view.firstPaintPixels = opaque;
    }
    const firstPaint = !view.painted;
    view.painted = true;
    view.el.classList.add("hero-model-ready");
    if (firstPaint && view.side === "p") EmberViewport.resize();
  }
  function tick(now) {
    raf = 0;
    if (
      !visible() ||
      stats.status !== "ready" ||
      ![...views.values()].some((view) => view.el?.isConnected)
    )
      return;
    if (now - last >= 1000 / 30 || dirty) {
      const start = performance.now(),
        delta = Math.min(0.08, (now - last) / 1000);
      last = now;
      dirty = false;
      renderer.info.reset();
      try {
        for (const view of views.values()) draw(view, now, delta);
      } catch (error) {
        fail(error);
        return;
      }
      stats.frames++;
      stats.calls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
      stats.frameMs = performance.now() - start;
      stats.maxFrameMs = Math.max(stats.maxFrameMs, stats.frameMs);
    }
    if (!calm()) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (!raf && visible() && stats.status === "ready")
      raf = requestAnimationFrame(tick);
  }
  const invalidate = () => {
    dirty = true;
    wake();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else invalidate();
  });
  window.addEventListener("resize", invalidate, { passive: true });
  reducedQuery.addEventListener("change", invalidate);
  new MutationObserver(invalidate).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const battle = document.getElementById("battle");
  if (battle)
    new MutationObserver(invalidate).observe(battle, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  return Object.freeze({
    sync,
    cue,
    release,
    anchor,
    diagnostics: () => ({
      ...stats,
      clips: [...stats.clips],
      activeViews: [...views.values()].filter((view) => view.el?.isConnected)
        .length,
      views: [...views.values()]
        .filter((view) => view.el?.isConnected)
        .map((view) => ({
          side: view.side,
          painted: view.painted,
          frozen: view.frozen,
          firstPaintPixels: view.firstPaintPixels || 0,
          nativeActions: Object.keys(view.actions || {}),
          idleClip: view.idle?.name || null,
          activeClip: view.activeAction?.getClip().name || null,
          actionTime: view.activeAction?.time || 0,
          actionRunning: view.activeAction?.isRunning() || false,
          idleTime: view.idleAction?.time || 0,
          screenHands: view.screenHands
            ? {
                left: { ...view.screenHands.left },
                right: { ...view.screenHands.right },
              }
            : null,
          screenPose: view.screenPose
            ? Object.fromEntries(
                Object.entries(view.screenPose).map(([name, point]) => [
                  name,
                  { ...point },
                ]),
              )
            : null,
          kneeAngles: view.kneeAngles ? { ...view.kneeAngles } : null,
          lastCast: view.lastCast ? { ...view.lastCast } : null,
          bonePose:
            view.bones?.reduce(
              (sum, bone, index) =>
                sum +
                (index + 1) *
                  (bone.quaternion.x +
                    2 * bone.quaternion.y +
                    3 * bone.quaternion.z +
                    4 * bone.quaternion.w),
              0,
            ) || 0,
          cue: view.cue,
          cueAt: view.cueAt,
          rotation: view.pose?.rotation.toArray().slice(0, 3),
          y: view.pose?.position.y,
          width: view.canvas.width,
          height: view.canvas.height,
        })),
      running: !!raf,
      visible: visible(),
      reduced: calm(),
    }),
  });
})();
