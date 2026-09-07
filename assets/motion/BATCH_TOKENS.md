# 衍生随从动态素材记录

日期：2026-09-08。范围：`pup`、`spiritwolf`、`skeleton`、`stone`、`sheep`、`recruit`、`thorn`。

全部素材使用内置 `image_gen`，逐张以自己的 `assets/anime/{id}.webp` 为身份与构图参考生成；已确认的静态 WebP 没有修改。图像工具不能稳定返回真透明 atlas，故最终采用纯品红技术底并进行确定性 chroma→alpha 转换。原始生成图保存在 `sources/{id}-atlas-chroma.png`，最终带真 alpha 的可打包输入保存在 `sources/{id}-atlas-alpha.png`。

## 共同生成提示词

以下为每次请求的共同正文；每个角色使用下节对应的角色段落替换方括号内容。

> Use case: background-extraction / identity-preserve  
> Asset type: Emberfall game character animation two-panel atlas prepared for chroma extraction  
> Input image: Image 1 is the approved static card illustration and identity/composition reference.  
> Create ONE landscape PNG with exactly TWO side-by-side portrait panels, no gutter, borders, labels, text or watermark. Both panels preserve the exact camera, scale and framing of Image 1.  
> Left panel: [scene], with [subject] completely removed and hidden scenery naturally filled; fully opaque.  
> Right panel: ONLY the COMPLETE intact [subject] as one connected full subject, [required parts], positioned as in Image 1. Behind it use one perfectly flat uniform opaque chroma magenta background RGB #FF00FF, edge to edge; no checkerboard, gradient, texture, shadow, [scene elements].  
> Preserve [identity invariants]. [continuity constraints] No extra limbs, recrop or pose change. Polished painted anime fantasy style matching Image 1. Total canvas about 3:2; full bleed. Keep magenta out of the subject.

## 逐角色原始提示词变量

- `pup`：scene = “the moonlit ruined forest, flowers, rock, moon, butterflies and sky”；subject = “the ghost wolf cub”；required parts = “including head, both ears, neck, torso, all four legs/paws, tail and attached cyan spectral flames”；identity invariants = “the exact cute white-gray wolf face, huge bright blue eyes, small black nose, turquoise forehead marks, compact puppy proportions, fluffy fur, upward gaze, stance, cyan rim glow and spectral tail”；continuity = “Head, neck and torso naturally connected with fur overlap; no cut neck or detached head.”
- `spiritwolf`：scene = “the bright castle garden, sunlit trees, leafy foreground and distant stone castle”；subject = “the spirit wolf”；required parts = “including both ears, head, neck, torso, all four legs and paws, tail, mint-green spectral mane/flames and its attached flowing green aura ring”；identity invariants = “the exact long gray-white wolf face, turquoise eyes and forehead mark, athletic proportions, leaping pose, dark claws, blue-gray fur and mint spectral glow”；continuity = “Head, neck and torso must be naturally connected; no detached head, cut neck or missing paw.”
- `skeleton`：scene = “the fiery stone fortress hall, arch, torches, banner, sparks, rubble and warm lighting”；subject = “the skeleton warrior, sword, shield and cape”；required parts = “including skull, glowing amber eye sockets, jaw, neck vertebrae, ribcage, pelvis, both complete arms/hands, both legs/feet, tattered red cape, raised rusty sword and round wooden shield”；identity invariants = “the exact cute large cracked skull, comic expression, amber eyes, slim bones, red cape, sword and wood-and-metal shield”；continuity = “Do not detach skull or cut joints; no missing bones.”
- `stone`：scene = “the sunlit ivy-covered castle courtyard, arch, towers, blue sun banners and foliage”；subject = “the stone guardian”；required parts = “including rocky head, neck, huge torso, both complete arms and fists, legs where visible, vines growing across its body, all cyan runes, glowing eyes and central blue crystal”；identity invariants = “the exact squat massive boulder proportions, blocky jaw, cyan rectangular eyes, cracked beige-gray stone, ivy, left shoulder rune and diamond chest crystal”；continuity = “Head and torso must stay naturally joined; no detached stones or missing fist.”
- `sheep`：scene = “the sunny alpine village meadow, daisies, fence, houses, church, windmill, mountains, clouds and trees”；subject = “the sheep and its collar bell”；required parts = “including ears, head, neck, entire woolly body, all four legs/hooves, leather collar and gold bell”；identity invariants = “the exact round cream-white fluffy body, layered curls, gentle brown eyes, small smiling muzzle, pink inner ears, dark hooves, brown collar and bell”；continuity = “Do not remove white highlights or crop legs.”
- `recruit`：scene = “the bright castle parade courtyard, sun banners, distant guards, towers, blue sky and falling golden leaves”；subject = “the recruit, spear, shield and cape”；required parts = “including helmeted head, brown hair, expressive face, neck, armored torso, both complete arms/hands, lower body where visible, blue cape, full spear and sun-emblem shield”；identity invariants = “the exact youthful cheerful face, open-mouth smile, green-brown eyes, dark steel helmet and plate armor with gold trim, blue scarf/cape, upright spear and large silver shield with gold sun”；continuity = “Keep all joints naturally connected and weapon grips intact; no missing hand or detached head.”
- `thorn`：scene = “the warm sun-dappled ancient forest, trunks, canopy, vines, leaves and white flowers”；subject = “the thorn tree spirit”；required parts = “including wooden head, glowing green eyes, bark torso, both complete branch arms/hands, lower trunk/body where visible, all attached thorns, vines, green leaves and white blossoms”；identity invariants = “the exact fierce angular wooden face, bright lime eyes, long pointed bark nose, massive thorny branch arms, warm brown bark, dense green leaves and small white flowers”；continuity = “Head and torso must stay naturally joined; no detached branches or missing claw.”

`pup` 的第一次请求要求透明输出，但工具返回绘制棋盘；对应失败图集与 AI mask 已移到 `artifacts/qa/characters/debug/`，没有作为正式素材使用。之后统一使用纯品红底，避免白毛、高光与背景一起被抹掉。

## 确定性 alpha 转换与打包

通用工具：`tools/chroma_motion_atlas.cjs`。它检测右侧纯品红面板起点，只在右面板执行 FFmpeg `colorkey=0xff00ff:0.42:0.06`，左侧背景保持完全不透明。若主体或武器碰到顶边导致自动检测失败，可用已目测确认的 `--split`。

```bash
node tools/chroma_motion_atlas.cjs \
  --input assets/motion/sources/pup-atlas-chroma.png \
  --output assets/motion/sources/pup-atlas-alpha.png \
  --split 729 \
  --similarity 0.42 \
  --blend 0.06
node tools/pack_motion_assets.cjs --manifest assets/motion/batch-tokens.json
```

本批七张已验收 alpha atlas 使用历史参数 `--similarity 0.42 --blend 0.06`；命令显式记录这些值，避免工具默认值变化后无法按原参数重建。helper 当前默认值为较保守的 `0.18 / 0.06`。若主体本身包含大面积紫红、洋红或肤色边缘，应改用生成时就与主体反差明显的绿色底并传 `--color 0x00ff00`，或先用更小 similarity 做合成审图；不要为了清掉色边盲目扩大范围而抹穿主体。

实测 cuts：`pup [0,729,1536]`、`spiritwolf [0,766,1536]`、`skeleton [0,770,1536]`、`stone [0,769,1536]`、`sheep [0,769,1536]`、`recruit [0,768,1536]`、`thorn [0,768,1536]`。不能假设生成器严格遵守等宽面板。

## 美术审核记录

七张均采用 `whole-subject`，没有空 accent。逐张检查了最终 subject WebP 的 alpha，并将 background 与 subject 合成到 `artifacts/qa/characters/{id}-composite.png`；总览在 `artifacts/qa/characters/batch-tokens-contact.png`。

- `pup`：完整头颈身和四肢连续，蓝焰尾完整；脚掌落在石面，白毛高光保留，无棋盘块和品红边。轻微幽灵浮动，`lift 0.012`。
- `spiritwolf`：头颈身连续，跃扑四肢与绿色灵焰环完整；适合略快的漂浮呼吸，`lift 0.014`。
- `skeleton`：骷髅头、脊柱、四肢、剑盾和披风同层保持连接；快速小幅晃动不会拉断关节。
- `stone`：巨拳、盾、胸晶与头部完整；使用全批次最慢、最小的重心移动，避免石像漂浮感。
- `sheep`：白色卷毛、高光、耳朵、四蹄和铃铛完整；脚下草地对齐，`lift 0.005`，只表现轻呼吸。
- `recruit`：脸、盔甲、握枪手、长枪、盾与披风完整；`lift 0.004`，避免站立角色离地。
- `thorn`：头身、双臂、枝刺、叶片和白花完整；整株缓慢侧倾，避免拆枝造成断裂。

合成图在 384×512 层尺寸检查通过；运行时循环、冻结/解冻与手机旋转由主清单合并后的统一浏览器回归验证。

## 合并后的正式入口

本批素材已合入 `assets/characters.json`，临时批次 JSON 已删除。上文参数记录制作过程，最终动作幅度以正式清单为准。重打包使用 `node tools/pack_motion_assets.cjs --card ID`；不要重新维护一份批次配置。
