/* 圣光裁决者 · 模型演示 — her Tripo model (EmberModelFigures) run by the battlefield's own behaviour (EmberVoxelArena:
 * assemble, idle, the melee dash on the director's timeline, contact burst, victim glow and hitstop, the shatter
 * death), facing a second copy of herself. The director numbers mirror src/presentation/timing.js (as the voxel
 * gallery does). A virtual clock drives everything, so the page can play at ½× and ¼×: performance.now() is scaled
 * here (the arena stamps its cues with it) and the director's beats are scheduled on the same clock. */
(() => {
  const THREE = EmberVesperThree, A = EmberVoxelArena, C = EmberVoxelClips, SFX = EmberGallerySfx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = (s) => document.querySelector(s);
  const TIMING = { stop: [0, 0, 50, 90], lift: 110, lunge: 150, recover: 200, deathDelay: 120, recoil: 90, speed: 1800, flightMin: 90, flightMax: 220 };
  const FOE_ID = "squire";              // a plain sword: a light column would hide the hurt
  const M_ = (name) => ({ name, atk: "攻击", heavy: "重击" }), C_ = (name) => ({ name, atk: "施法", heavy: "强力施法" });
  const WHO = {
    paladin: { name: "圣光裁决者", atk: "圣光裁决", heavy: "天剑裁决", atkNote: "蓄力 → 旋身跃起 → 劈落裂地 → 单膝落地 → 起身归位。", heavyNote: "第三档：天剑同时从天而降，更大的裂地与更长定帧。" }, squire: { name: "晨曦侍从", atk: "晨曦斩", heavy: "晨曦重斩", atkNote: "盾后蓄势，一记干净的下劈，刀身映着晨光。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, solaris: { name: "逐日者·索拉", atk: "逐日十字斩", heavy: "烈阳十字斩", atkNote: "两段斩击冲上前，第二刀带火，在敌人身上留下日炎十字。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, frostking: { name: "白霜之王", atk: "凛冬斩", heavy: "极寒冰葬", atkNote: "剑身凝霜后横斩一击：地面冻结，冰刺破土。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, guard: { name: "铁誓卫士", atk: "铁誓突刺", heavy: "铁誓重刺", atkNote: "稳步突刺，钢光一闪，受击时举盾格挡。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" },
    huntress: { name: "荒野之矛", atk: "穿林突刺", heavy: "疾风穿刺", atkNote: "冲锋突刺，长矛贯穿带出风痕与落叶。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, skeleton: { name: "骸骨", atk: "骸骨突刺", heavy: "骸骨重刺", atkNote: "跌撞着一刺，墓光与骨屑飞散。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, assassin: { name: "夜幕刺客", atk: "影袭", heavy: "夜影袭杀", atkNote: "隐入烟影、蓄势，一闪而至，留下一道血线。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, reaper: { name: "黯月收割者", atk: "月蚀收割", heavy: "血月收割", atkNote: "低身横扫留下暗月印记，魂火被抽回自身（吸血）。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, leech: { name: "血月行者", atk: "血月汲取", heavy: "血月盛宴", atkNote: "一道血月光，伤口的生命化作红色魂丝回到她身上。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" },
    wisp: { name: "暮光精灵", atk: "暮光花雨", heavy: "暮光花潮", atkNote: "空中旋身，身边花光环绕，送出暮光，落点绽开花瓣。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, spark: { name: "引火学徒", atk: "火花弹", heavy: "烈焰弹", atkNote: "把火球喂到咆哮再掷出，落点爆燃灼地。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, necromancer: { name: "亡者织梦师", atk: "亡魂之手", heavy: "万魂噬地", atkNote: "右手提灯不动、灯火转绿变亮；空着的左手向下召唤，敌人脚下裂开冥环，亡魂成柱涌出。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, soulguide: { name: "渡魂引路人", atk: "渡魂之光", heavy: "万魂引渡", atkNote: "左手提灯不动、越来越亮，空着的右手把魂光送出。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, oracle: { name: "星界观测者", atk: "星轨", heavy: "星轨坠落", atkNote: "星盘划过天空，摘下一颗星送出，落点亮起星印。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" },
    nyx: { name: "星陨女王·妮克丝", atk: "星陨", heavy: "群星陨落", atkNote: "举起权杖，敌人脚下展开星印，三颗星辰依次坠落。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, cleric: { name: "曙光祭司", atk: "曙光圣击", heavy: "曙光审判", atkNote: "双手捧起祷光送出，落点降下圣光与光羽。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, berserker: { name: "赤岩狂战士", atk: "狂怒劈斩", heavy: "狂怒崩山", atkNote: "怒吼举斧砸下，岩石炽红开裂、碎石飞起。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, recruit: { name: "曙光新兵", atk: "新兵劈砍", heavy: "全力劈砍", atkNote: "新兵的全力一劈，闪过一点曙光。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, 
    golem: { name: "符文石像", atk: "符文横扫", heavy: "符文崩击", atkNote: "石上符文依次亮起，横扫一击，地面蓝光裂开。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, treant: { name: "古木守护者", atk: "古木鞭挞", heavy: "万木鞭挞", atkNote: "枝臂后拉再抽出，根须裂地、荆棘破土、落叶纷飞。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, titan: { name: "玄铁泰坦", atk: "玄铁重拳", heavy: "玄铁崩拳", atkNote: "蓄力一记直拳，火花四溅、冲击回荡。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, colossus: { name: "远古山岳", atk: "山崩", heavy: "地裂山崩", atkNote: "下蹲、腾空、双拳砸地：岩刺破土、碎石飞溅、尘浪滚开。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, sentinel: { name: "烬翼斥候", atk: "烬翼飞踢", heavy: "烬翼重踢", atkNote: "腾空飞踢拖着余烬，落点爆出火焰。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, moonguard: { name: "守灯巨兽", atk: "星盾镇击", heavy: "星陨镇击", atkNote: "盾后聚起星光，重剑劈下，星印刻进地面。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" },
    wolf: { name: "月影幼狼", atk: "扑咬", heavy: "强力扑咬" }, moonfox: { name: "银灯灵狐", atk: "飞扑", heavy: "强力飞扑" }, duskstag: { name: "暮角契鹿", atk: "角撞", heavy: "强力角撞" },
    dragon: { name: "烬喉幼龙", atk: "吐息", heavy: "强力吐息" }, spider: { name: "幽谷蛛后", atk: "突袭", heavy: "强力突袭" },
    selmyra: { name: "冥月神·瑟弥拉", atk: "月蚀坍缩", heavy: "永夜坍缩", atkNote: "三弯新月绕身，敌人面前撕开裂隙，黑洞在其中涨起、吞噬光线；神双手推出，黑洞坍缩为一点再爆开。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, jingchen: { name: "星焰神·烬辰", atk: "焚天炎柱", heavy: "陨星焚天", atkNote: "敌人脚下出现范围圈并逐渐填满，神托火上举，火焰旋涡柱破地而起把敌人挑飞，地面熔裂。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, aurion: { name: "曙日神·奥瑞恩", atk: "日轮万剑", heavy: "日轮天裁", atkNote: "身后展开日轮剑阵，光剑依次转向敌人；神以剑指之，万剑平射贯穿，最后一剑落成十字审判。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, fenlos: { name: "荒猎神·芬洛斯", atk: "荒猎神矛", heavy: "万荆狩猎", atkNote: "神不追猎：原地横矛，一支荒野灵矛自矛尖飞出贯穿猎物，荆棘破土、根须裂地。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" }, vesper: { name: "薇丝珀", atk: "逐风之矢", heavy: "穿林之矢", atkNote: "拉弓聚风，一箭贯穿，落叶翻飞。", heavyNote: "第三档：更长定帧、更大的印记与震屏。" },
  };
  let ID = new URLSearchParams(location.search).get("who") || "paladin";

  // ------------------------------------------------------------------ the clock
  const real = performance.now.bind(performance);
  let speed = 1, vt = real(), lastReal = real();
  performance.now = () => { const r = real(); vt += (r - lastReal) * speed; lastReal = r; return vt; };
  const jobs = [];
  const later = (ms, fn) => jobs.push({ at: performance.now() + ms, fn });
  const runJobs = (now) => { for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].at <= now) { const j = jobs.splice(i, 1)[0]; j.fn(); } };

  // ------------------------------------------------------------------ room and renderers
  const canvas = $("#stage");
  const roomCanvas = document.createElement("canvas"); roomCanvas.id = "room"; canvas.before(roomCanvas);
  const roomRenderer = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  for (const r of [roomRenderer, renderer]) { r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; }
  renderer.setClearColor(0, 0);
  const pass = EmberPixelPass.create(renderer, { up: true });
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  const scene = new THREE.Scene(), room = new THREE.Scene();
  const quad = (fs, extra = {}) => new THREE.ShaderMaterial({ vertexShader: "varying vec3 p; varying vec2 u; void main(){ p = position; u = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }", fragmentShader: fs, depthWrite: false, ...extra });
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), quad("varying vec3 p; void main(){ vec3 d = normalize(p); float y = d.y; vec3 lo = vec3(0.075,0.068,0.07), hz = vec3(0.22,0.14,0.11), hi = vec3(0.045,0.05,0.075); vec3 c = mix(lo, hz, smoothstep(-0.1, 0.0, y)); c = mix(c, hi, smoothstep(0.0, 0.32, y)); float g = exp(-pow(atan(d.x, -d.z) * 0.9, 2.0)) * exp(-abs(y) * 8.0); c += vec3(0.5, 0.25, 0.11) * g * 0.3; gl_FragColor = vec4(c, 1.); }", { side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 120), quad("varying vec2 u; float h(vec2 p){ return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.5); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ float d = length(u); float s = n(u * 2.6) * 0.55 + n(u * 9.0) * 0.3 + n(u * 31.0) * 0.15; vec2 g = abs(fract(u * 1.25) - 0.5); float seam = smoothstep(0.47, 0.5, max(g.x, g.y)); vec3 c = mix(vec3(0.12,0.11,0.115), vec3(0.23,0.21,0.2), s); c *= 1.0 - 0.28 * seam; c *= 1.2 - 0.95 * smoothstep(1.2, 7.0, d); gl_FragColor = vec4(c, 1.); }"));
    floor.rotation.x = -Math.PI / 2;
    room.add(sky, floor);
  }
  // the stage dimmed round a god's blow: a vignette over the room, under the figures' canvas
  const dimmer = document.createElement("div");
  dimmer.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 55%, rgba(4,2,8,0.6) 0%, rgba(4,2,8,0.85) 55%, rgba(2,1,4,0.97) 100%);";
  roomCanvas.after(dimmer);
  const shadowMat = quad("varying vec2 u; void main(){ float d = length(u); gl_FragColor = vec4(0.,0.,0., 0.5 * (1. - smoothstep(0.1, 1., d))); }", { transparent: true });

  // ------------------------------------------------------------------ the arena
  const HERO = { side: "p", uid: "hero" }, FOE = { side: "e", uid: "foe" };
  const POS = new Map([[A.key("p", "hero"), V3(-0.55, 0, 0.45)], [A.key("e", "foe"), V3(0.55, 0, -0.45)]]);
  const arena = A.create(scene, {
    size: 1, pixelRatio: dpr, fxLayer: 2, shots: true,             // the page flies spell bolts itself (the battle leaves them to EmberFx2)
    where: (ref) => POS.get(A.key(ref.side, ref.uid)) || null,
    base: () => ({ r: 0.34, state: {} }),                         // the battlefield's stone pedestal
  });
  const shadows = new Map();
  const unit = (r) => arena.unit(r.side, r.uid);

  // ------------------------------------------------------------------ camera
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 200);
  const VIEWS = {
    ours: { yaw: 0, pitch: 30, dist: 5.8, tx: 0, ty: 0.45, tz: 0 },            // the battle camera: her back
    theirs: { yaw: -150, pitch: 16, dist: 5.4, tx: -0.1, ty: 0.5, tz: 0 },     // from behind her foe's shoulder: her face
    side: { yaw: -90, pitch: 12, dist: 5.4, tx: 0, ty: 0.5, tz: 0 },
    close: { yaw: -160, pitch: 10, dist: 2.7, tx: -0.55, ty: 0.55, tz: 0.45 },
  };
  let viewName = "theirs";
  const view = { ...VIEWS.theirs, want: null, spin: false };
  function placeCam() {
    // a narrow (portrait) screen pulls the camera back so both figures stay in frame
    const y = (view.yaw * Math.PI) / 180, p = (view.pitch * Math.PI) / 180, d = view.dist * Math.max(1, 1.1 / Math.max(0.3, cam.aspect));
    cam.position.set(view.tx + d * Math.sin(y) * Math.cos(p), view.ty + d * Math.sin(p), view.tz + d * Math.cos(y) * Math.cos(p));
    cam.lookAt(view.tx, view.ty, view.tz);
  }
  function setView(name) {
    viewName = name; view.want = { ...VIEWS[name] };
    if (Math.abs(view.want.yaw - view.yaw) > 180) view.yaw += 360 * Math.sign(view.want.yaw - view.yaw);
    for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
  }
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); view.want = null; });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; view.yaw = drag.yaw - (e.clientX - drag.x) * 0.35; view.pitch = Math.max(-2, Math.min(60, drag.pitch + (e.clientY - drag.y) * 0.25)); });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); view.dist = Math.max(1.4, Math.min(12, view.dist * Math.exp(e.deltaY * 0.001))); view.want = null; }, { passive: false });
  canvas.addEventListener("dblclick", () => setView(viewName));

  // ------------------------------------------------------------------ what plays
  // the caption: shows what plays, then fades out of the way
  const nowCard = $("#now");
  let sayTimer = 0;
  function say(name, note) {
    nowCard.querySelector(".name").textContent = name; nowCard.querySelector(".note").textContent = note;
    nowCard.classList.add("show"); clearTimeout(sayTimer); sayTimer = setTimeout(() => nowCard.classList.remove("show"), 4200);
  }
  const s1 = (ms) => (ms / 1000).toFixed(2) + " s";
  let busyUntil = 0;
  const free = () => performance.now() >= busyUntil;
  /** an attack as effects.js + combat.js plan it — melee: lift → lunge → contact (hit-stop) → release → recover;
   *  ranged: recoil + wind-up → the bolt's flight → contact */
  function attack(from, to, tier, lethal) {
    const u = unit(from);
    if (!u || u.state !== "live") return false;
    const m = u.spec.moves?.attack || {}, ranged = !!m.ranged, stop = TIMING.stop[tier];
    let lift, contact;
    if (ranged) {
      const a = POS.get(A.key(from.side, from.uid)), b = POS.get(A.key(to.side, to.uid));
      lift = TIMING.recoil + (u.fig?.spell?.windup ?? m.windup ?? 260);
      contact = lift + Math.max(TIMING.flightMin, Math.min(TIMING.flightMax, ((a.distanceTo(b) * 150) / TIMING.speed) * 1000));
    } else { lift = TIMING.lift + (u.fig?.sig?.windup ?? 0); contact = lift + TIMING.lunge; }     // a signature coils longer
    const release = contact + stop, duration = release + (ranged ? 0 : TIMING.recover);
    arena.cue(from.side, from.uid, "attack", { toward: to, planned: true, ranged, tier, liftMs: lift, contactMs: contact, releaseMs: release, durationMs: duration });
    if (ranged) SFX.play(m.style === "bolt" ? "zap" : "twang", lift / 1000 / speed);
    else SFX.play(tier >= 3 ? "swingHeavy" : "swing", Math.max(0, contact - 190) / 1000 / speed);
    const sig = u.fig?.sig;
    if (sig) SFX.play("charge", 0, { len: (lift * 0.9) / 1000 / speed });
    later(contact, () => {
      arena.contact(to, { tier, from, direction: "outgoing" }); SFX.play(tier >= 3 ? "hitHeavy" : "hit");
      if (sig) SFX.play("elem", 0, { kind: sig.fx?.pal, heavy: tier >= 3 });
      else if (unit(to)?.fig?.sig) SFX.play("block");
    });
    busyUntil = performance.now() + Math.max(duration, (C.timing(u.fig).length || 1) * 1000) + 200;
    if (lethal) {
      later(release + TIMING.deathDelay, () => { if (arena.cue(to.side, to.uid, "death")) SFX.play("shatter", 0.15 / speed); });
      later(release + TIMING.deathDelay + 1300, () => enter(to));
      busyUntil = performance.now() + release + TIMING.deathDelay + 2400;
    }
    return true;
  }
  function enter(r) { arena.set(r.side, r.uid, r === HERO ? ID : FOE_ID); SFX.play("assemble", 0.05, { len: 0.55 / speed }); }
  const T = () => { const u = unit(HERO); return u?.fig ? C.timing(u.fig) : { hit: 0.4, length: 1.3 }; };
  const caster = () => unit(HERO)?.spec?.moves?.attack?.ranged;
  // captions stay short: the name of the move and one line on what to watch
  const ACTS = {
    attack: () => attack(HERO, FOE, 2, false) && say(WHO[ID]?.atk || "攻击", (sigOn && WHO[ID]?.atkNote) || "命中帧对齐战斗节奏；对手闪白、后仰。"),
    heavy: () => attack(HERO, FOE, 3, false) && say(WHO[ID]?.heavy || "重击", (sigOn && WHO[ID]?.heavyNote) || `第三档：定帧 ${s1(TIMING.stop[3])}，冷色爆星和更多火花。`),
    kill: () => attack(HERO, FOE, 3, true) && say("致命一击", "对手碎成方块，随后重新拼合。"),
    victory: () => { const u = unit(HERO); if (!u || u.state !== "live") return; arena.cue("p", "hero", "victory"); busyUntil = performance.now() + 1400; say("胜利", ""); },
    hurt: () => attack(FOE, HERO, 1, false) && say("受击", "被对手击中：闪白、后仰，再回到待机。"),
    hurt3: () => attack(FOE, HERO, 3, false) && say("重创", "第三档受击：更长定帧、更亮闪光。"),
    die: () => attack(FOE, HERO, 3, true) && say("碎裂", "碎成带贴图颜色的方块，随后原地拼合。"),
    enter: () => { if (!free()) return; arena.drop("p", "hero", false); later(30, () => enter(HERO)); busyUntil = performance.now() + 900; say("登场", "方块从四周飞回、拼成模型。"); },
  };
  const SHOW = ["enter", "attack", "heavy", "hurt", "hurt3", "victory", "kill", "die"];
  let show = null, pending = null, touched = false;
  function playAll() {
    show = { i: 0, next: performance.now() };
    say("连播", "登场、出手、受击、胜利、碎裂依次播放。");
  }
  function stepShow(now) {
    if (!show || now < show.next || !free()) return;
    if (show.i >= SHOW.length) { show = null; say("待机", ""); return; }
    ACTS[SHOW[show.i++]]();
    show.next = Math.max(busyUntil, performance.now()) + 700;
  }

  // ------------------------------------------------------------------ controls
  $(".dock").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    touched = true;
    if (b.dataset.act === "all") { playAll(); return; }
    show = null; pending = b.dataset.act;            // plays as soon as the current action has finished
  });
  for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => setView(b.dataset.view));
  const pick = (sel, attr, fn) => $(sel).addEventListener("click", (e) => {
    const b = e.target.closest(`[data-${attr}]`); if (!b) return;
    for (const x of $(sel).querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
    fn(b.dataset[attr]);
  });
  pick("#speed", "speed", (v) => { speed = +v; });
  let pixel = false;
  pick("#look", "look", (v) => { pixel = v === "pixel"; });
  pick("#spin", "spin", (v) => { view.spin = v === "1"; });
  pick("#shade", "shade", (v) => EmberModelFigures.setShade?.(+v));
  pick("#mocap", "mocap", (v) => EmberModelFigures.setMocap?.(v === "1"));
  let sigOn = true;
  pick("#sig", "sig", (v) => { sigOn = v === "1"; EmberModelFigures.setSig?.(sigOn); });   // the signature rebuild against what it replaced
  const snd = $("#sound");
  snd.addEventListener("click", () => { SFX.enable(!SFX.on); snd.setAttribute("aria-pressed", String(SFX.on)); snd.querySelector("span").textContent = SFX.on ? "开" : "关"; });
  // the two pop-overs: the character picker (the name) and the viewing options (the gear); one open at a time,
  // closed by a click on the stage or Esc
  const pops = [[$("#pick"), $("#picker")], [$("#gear"), $("#panel")]];
  const openPop = (which) => pops.forEach(([btn, pop]) => { const on = pop === which && pop.hidden; pop.hidden = !on; btn.setAttribute("aria-expanded", String(on)); });
  for (const [btn, pop] of pops) btn.addEventListener("click", () => openPop(pop));
  canvas.addEventListener("pointerdown", () => openPop(null));
  addEventListener("keydown", (e) => { if (e.key === "Escape") openPop(null); });
  function showStats() {
    const M = EmberModelArt[ID], kb = Math.round((M.tex.length * 3) / 4 / 1024 + (M.bin.length * 3) / 4 / 1024), u = unit(HERO), t = u?.fig ? C.timing(u.fig) : { hit: 0, length: 0 };
    $("#stats").innerHTML = [["三角面", M.tris.toLocaleString("en-US")], ["骨骼", M.joints.length], ["贴图", "2048 px"], ["体积", (kb / 1024).toFixed(1) + " MB"], [caster() ? "出手" : "命中帧", s1(t.hit * 1000)], ["动作全长", s1(t.length * 1000)]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }
  function choose(id) {
    ID = id; touched = true; show = null; pending = null;
    $("#who-name").textContent = WHO[id]?.name || id;
    $("#act-attack").textContent = WHO[id]?.atk || "攻击"; $("#act-heavy").textContent = WHO[id]?.heavy || "重击";
    for (const b of document.querySelectorAll("[data-who]")) b.setAttribute("aria-pressed", String(b.dataset.who === id));
    openPop(null);
    arena.drop("p", "hero", false); later(30, () => { enter(HERO); later(200, showStats); });
    busyUntil = performance.now() + 900;
    say(WHO[id]?.name || id, "");
  }
  // the picker: humanoids (those playing motion capture tagged), then beasts
  const have = Object.keys(WHO).filter((v) => typeof EmberModelArt !== "undefined" && EmberModelArt[v]);
  const tag = (id) => (EmberModelFigures.mocap?.(id) ? '<span class="tag">动捕</span>' : "");
  const btns = (ids) => ids.map((id) => `<button type="button" data-who="${id}" aria-pressed="${id === ID}">${WHO[id]?.name || id}${tag(id)}</button>`).join("");
  const beast = (id) => !!EmberModelArt[id].beast;
  $("#who").innerHTML = btns(have.filter((id) => !beast(id)).sort((a, b) => Number(!!EmberModelFigures.mocap?.(b)) - Number(!!EmberModelFigures.mocap?.(a))));
  $("#who-beast").innerHTML = btns(have.filter(beast));
  $("#picker").addEventListener("click", (e) => { const b = e.target.closest("[data-who]"); if (b && b.dataset.who !== ID) choose(b.dataset.who); });

  // ------------------------------------------------------------------ frames
  let last = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (roomCanvas.width !== Math.round(w * dpr()) || roomCanvas.height !== Math.round(h * dpr())) {
      for (const r of [roomRenderer, renderer]) { r.setPixelRatio(dpr()); r.setSize(w, h, false); }
      cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
    }
    runJobs(now);
    stepShow(now);
    if (pending && free()) { const k = pending; pending = null; ACTS[k](); }
    if (view.want) {
      const k = 1 - Math.exp(-dt * 5 / Math.max(0.25, speed));
      for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz"]) view[key] += (view.want[key] - view[key]) * k;
      if (Math.abs(view.want.dist - view.dist) < 0.01 && Math.abs(view.want.yaw - view.yaw) < 0.05) view.want = null;
    }
    if (view.spin && !drag) view.yaw += (dt / Math.max(0.25, speed)) * 14;
    // a god's blow: the camera punches in toward it and the stage dims round it
    const pn = arena.punch(now), dm = arena.dim(now);
    if (pn > 1e-4) { const d0 = view.dist; view.dist = d0 * (1 - pn); placeCam(); view.dist = d0; } else placeCam();
    dimmer.style.opacity = dm.toFixed(3);
    // the blows' camera shake: a quick damped jolt (world units)
    const sh = arena.shake(now);
    if (sh > 1e-4) { cam.position.x += sh * Math.sin(now * 0.093); cam.position.y += sh * 0.8 * Math.cos(now * 0.121); }
    arena.step(now, cam, dt);
    arena.each((u) => {
      if (u.fig?.model) u.fig.mesh.layers.set(pixel ? 0 : EmberSpriteFigures.LAYER);
      let s = shadows.get(u.k);
      if (!s) { s = new THREE.Mesh(new THREE.CircleGeometry(1, 32), shadowMat); s.rotation.x = -Math.PI / 2; room.add(s); shadows.set(u.k, s); }
      const p = POS.get(u.k); s.position.set(p.x, 0.004, p.z); s.scale.setScalar(0.42);
    });
    roomRenderer.render(room, cam);
    pass.render(scene, cam, [EmberSpriteFigures.LAYER, 2]);
  }
  cam.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  if (!EmberModelFigures.has(ID)) say("模型未就绪", "模型贴图还在解码，请稍候。");
  // her model decodes its texture on load: stand both figures once it is ready, then play everything once
  (function wait() {
    if (!EmberModelFigures.has(ID) || !EmberModelFigures.has(FOE_ID)) { setTimeout(wait, 50); return; }
    enter(HERO); enter(FOE); later(300, showStats);
    $("#who-name").textContent = WHO[ID]?.name || ID; $("#act-attack").textContent = WHO[ID]?.atk || "攻击"; $("#act-heavy").textContent = WHO[ID]?.heavy || "重击";
    say("登场", "点角色名换角色，右上角调视角与光影。");
    later(1600, () => { if (!touched) playAll(); });                    // unless the viewer already chose something
  })();
  requestAnimationFrame(frame);
  window.Demo = { arena, ACTS, setView, get speed() { return speed; } };
})();
