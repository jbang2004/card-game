/* Page-owned presentation and actions, injected by the application controller.
 * No theme colors or asset file names belong in this module. */
const EmberPreferenceScreens = (() => {
  function create(context) {
    const {
      game,
      showModal,
      closeModal,
      startGame,
      home,
      demo,
      showConfirm,
      applySettings,
      writeStore,
      settings,
      defaults,
      keywords,
    } = context;
    const D = EmberData,
      A = EmberArt,
      $ = (id) => document.getElementById(id);

    const SETTINGS = "emberfall.settings.v1";
    function showSettings() {
      const options = [
        ["sound", "开启声音", "卡牌、战斗音效与酒馆底声"],
        ["reduced", "减弱动态效果", "减少粒子与镜头震动，保留战斗提示"],
        ["low", "轻量画质", "降低画面负担，适合节能游玩"],
        ["fast", "加速敌方行动", "缩短 AI 每次行动之间的间隔"],
      ];
      const levels = [
        ["volume", "总音量"],
        ["sfxVolume", "战斗与操作"],
        ["ambienceVolume", "酒馆氛围"],
      ];
      const percentage = (key) =>
        Math.round(
          (Number.isFinite(settings[key])
            ? Math.max(0, Math.min(1, settings[key]))
            : defaults[key]) * 100,
        );
      showModal(
        `<section class="modal-box settings-box"><div class="modal-heading"><div class="eyebrow">游戏设置</div><h2>旅途设置</h2><p>声音、画面与战斗节奏，随时可调。</p></div><section class="settings-section settings-options-section"><div class="settings-section-heading"><span>旅途体验</span><small>即时生效</small></div><div class="settings-options">${options
          .map(
            ([k, n, d]) =>
              `<div class="setting-row"><div class="setting-copy"><h3>${n}</h3><p>${d}</p></div><button class="toggle ${settings[k] ? "on" : ""}" data-setting="${k}" role="switch" aria-checked="${settings[k]}" aria-label="${n}"><span class="toggle-state">${settings[k] ? "开启" : "关闭"}</span></button></div>`,
          )
          .join(
            "",
          )}</div></section><section class="settings-section settings-audio-section"><div class="settings-section-heading"><span>声音混音</span><small>分别控制三类声音</small></div><div class="audio-sliders">${levels
          .map(
            ([k, label]) =>
              `<label class="audio-level" for="audio-${k}"><span>${label}</span><input id="audio-${k}" data-audio-level="${k}" type="range" min="0" max="100" step="5" value="${percentage(k)}"><output for="audio-${k}">${percentage(k)}%</output></label>`,
          )
          .join(
            "",
          )}</div></section><div class="modal-footer">${context.inBattle ? '<button class="ghost-btn small-btn" id="settings-home">返回营地</button><button class="ghost-btn small-btn" id="restart-battle">重试本关</button>' : '<button class="ghost-btn small-btn" id="settings-how">游戏玩法</button>'}<button class="gold-btn small-btn" id="settings-done">完成</button></div><p class="hero-deck-note">进度会自动保存在当前浏览器。</p></section>`,
        "settings",
      );
      document.querySelectorAll("[data-setting]").forEach(
        (b) =>
          (b.onclick = () => {
            const k = b.dataset.setting;
            settings[k] = !settings[k];
            const enabled = settings[k];
            b.classList.toggle("on", enabled);
            b.setAttribute("aria-checked", String(enabled));
            const state = b.querySelector(".toggle-state");
            if (state) state.textContent = enabled ? "开启" : "关闭";
            writeStore(SETTINGS, settings);
            applySettings();
          }),
      );
      document.querySelectorAll("[data-audio-level]").forEach((input) => {
        input.oninput = () => {
          settings[input.dataset.audioLevel] = Number(input.value) / 100;
          input.nextElementSibling.textContent = input.value + "%";
          EmberAudio.configure(settings);
          writeStore(SETTINGS, settings);
        };
        input.onchange = () => EmberAudio.fx("ui");
      });
      $("settings-done").onclick = () => closeModal();
      if (context.inBattle) {
        $("settings-home").onclick = home;
        $("restart-battle").onclick = () =>
          showConfirm(
            "重新点燃火种",
            "当前这场战斗将从头开始。已获得的遗物与之前的关卡进度不会丢失。",
            () => {
              const s = game.s;
              context.isDemo
                ? demo()
                : startGame(s.heroId, s.bossIndex, s.relics, s.customDeck, {
                    contracts: s.p.contracts,
                    ...(s.mode === "practice" ? { opponent: s.opponent } : {}),
                  });
            },
            "重试本关",
          );
      } else $("settings-how").onclick = showHelp;
    }
    function showHelp() {
      showModal(
        `<section class="modal-box help-box"><div class="modal-heading"><div class="eyebrow">玩法与规则</div><h2>旅人手册</h2><p>回合流程、构筑规则与关键词速查。</p></div><div class="help-columns"><div><section class="help-section"><h3>01 · 一场战斗如何获胜</h3><p>将敌方英雄生命降至 <b>0</b>。你有 <b>30 点基础生命、${D.deckRules.size} 张牌库</b>，双方最多拥有 <b>7 个随从、10 张手牌</b>。战役中你先手；练习对战随机先后手。先手起始三张、后手四张并在换牌后获得硬币。每个回合增加一枚法力水晶，上限 10，并补满法力、抽一张牌。</p></section><section class="help-section"><h3>02 · 出牌与攻击</h3><p><b>把手牌拖到战场</b>松手即可打出；需要目标时，拖向或点击目标确认，<b>右键或 Esc</b> 取消。也可以直接点击手牌：不需要目标的牌再点战场空位确认，需要目标的牌进入瞄准。<br><b>桌面悬停</b>在左侧查看卡牌大图；触控设备长按或右键卡牌查看详情，点击空白处收起。<br><b>点击己方随从 → 点击敌人</b>即可攻击。新召唤的随从通常需要等待一回合。双方随从同时对彼此造成攻击力数值的伤害。装备武器后，点击自己的英雄攻击。<br>按按钮标示的法力费用使用英雄技能，每回合一次。空格结束回合，Esc 取消选择，M 静音。</p></section><section class="help-section"><h3>03 · 构筑与冒险</h3><p>图鉴中 ${D.cards.filter((c) => !c.token).length} 张卡全部开放，构筑使用所选职业与中立牌。${D.archetypes.length} 套预设分别提供打法说明。<b>${EmberDeckRules.summary(D)}</b>。${D.bosses.length} 位首领均在半血时进入第二阶段。每次胜利可更换一张牌并选择遗物，下一关生命完全恢复。练习对战可挑战 ${D.archetypes.length} 套牌，随机先后手、双方三十血，不覆盖战役进度。进度自动保存在当前浏览器。<br>牌库耗尽后，每次抽牌依次受到 <b>1、2、3…</b> 点疲劳伤害。第 51 个玩家回合开始时判为平局。</p></section></div><div><section class="help-section"><h3>04 · 关键词速查</h3><div class="key-table">${Object.entries(
          keywords,
        )
          .map(([k, v]) => `<div><b>${D.kw[k]}</b>${v}</div>`)
          .join(
            "",
          )}<div><b>战吼 / 亡语</b>分别在从手牌打出或契约召唤随从时、随从死亡后触发。</div><div><b>冻结 / 沉默</b>冻结阻止攻击，直到自己的回合结束。沉默移除关键词、亡语和增益。</div><div><b>奥秘</b>隐藏的触发式法术。镜像伏击会用嘲讽镜卫拦截一次对英雄的攻击。</div><div><b>契约 / 神祇</b>开局可额外携带三张同职业契约、至多一位神祇，不占主牌组。己方非衍生随从死亡积累阵亡数和同名唯一的灵魂印记。星焰神需施放不同名称的非衍生法术（被反制不计）；曙日神需圣盾被敌方伤害击破；荒猎神需野兽主动攻击敌方随从（每回合最多计两次）。打开「诸神契约」查看双方进度，按各自条件支付法力或灵魂印记唤醒，每张每局一次。神祇无法复生，降临当回合不能攻击英雄。</div><div><b>发现</b>从三个随机法术中选一张加入手牌。</div></div></section></div></div><div class="modal-footer"><button class="gold-btn small-btn" id="help-done">让冒险开始 ${A.icon("arrow")}</button></div></section>`,
        "help",
      );
      const chapters = [...$("modal").querySelectorAll(".help-section")];
      const contents = document.createElement("nav");
      contents.className = "help-toc";
      contents.setAttribute("aria-label", "手册章节");
      for (const chapter of chapters) {
        const button = document.createElement("button");
        button.className = "ghost-btn";
        button.textContent = chapter.querySelector("h3").textContent;
        button.onclick = () => chapter.scrollIntoView({ block: "start" });
        contents.append(button);
      }
      $("modal").querySelector(".help-columns").before(contents);
      $("help-done").onclick = () => closeModal();
    }
    return Object.freeze({ showSettings, showHelp });
  }
  return Object.freeze({ create });
})();
