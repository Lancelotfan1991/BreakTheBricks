# 破砖深渊 · Break the Brick — 全局项目记录

> **本文是什么**：接手这个仓库时最先读的一份总览 + 后续改动的操作手册。分系统细节见 [`docs/relics.md`](./relics.md) 与 [`docs/talents.md`](./talents.md)，本文只做索引与交叉引用，不重复。
>
> **行号快照**：所有 `文件:行号` 取自 **2026-11-20** 的工作区（`HEAD 4e778de` + 当时未提交的「深度定价 / 移除下一层按钮 / HUD 血条 / 存档清洗」改动；`npm test` 189/189 全绿）。当时各文件行数：`game.js` 2375 · `ui.js` 1739 · `index.html` 180 · `styles.css` 853 · `zh-CN.js` 893 · `game.test.mjs` 3207。项目正在高频迭代，行号会漂移——**先用标识符搜索，再核对行号**。本文对易漂移的位置同时给出常量名/函数名，那是更稳的定位锚。
>
> **路径缩写**：`game.js` = `public/src/game.js`，`ui.js` = `public/src/ui.js`，`zh-CN.js` = `public/src/locales/zh-CN.js`，`styles.css` = `public/styles.css`，`index.html` = `public/index.html`，`i18n.js` = `public/src/i18n.js`。

---

## 0. 30 秒速览

| 问题 | 答案 |
| --- | --- |
| 这是什么 | 竖屏手机浏览器游戏：**扫雷 × Roguelite 地牢**。30 层、3 个区域、每 10 层一个 Boss，一层就是一个 7×9 的扫雷盘。 |
| 技术栈 | 原生 JS ES Module，**无构建、无框架、无打包**。`index.html` 直接 `<script type="module" src="src/main.js">`（`index.html:172`）。 |
| 怎么跑起来 | `npm run dev` → `node tools/serve.mjs` → <http://localhost:5173>（`tools/serve.mjs:6`，`PORT` 环境变量可改）。也可用任意静态服务器直接托管 `public/`。 |
| 怎么测 | `npm test`（`node --test` 跑 4 个测试文件，194 条）；`npm run sim`（AI 自动打 600 局，看胜率/平衡）。 |
| 怎么发 | Web/PWA：`npm run deploy`（Cloudflare Pages，`wrangler.toml` 指向 `public`）。安卓：`npm run apk`（Capacitor 壳，产物在 `dist/`）。 |
| 代码怎么分层 | `game.js` 纯逻辑（无 DOM，Node 可 import）；`ui.js` 全部 DOM 与交互；`i18n.js` + `locales/` 文案；`audio.js`/`fx.js` 表现层；`styles.css` 单文件样式。 |
| 改东西最常去的三处 | 数值与规则 → `game.js` 顶部常量区与 `BAL`；界面 → `ui.js` 的 `renderHud`/`open*`；文案 → `zh-CN.js`。 |
| 一条铁律 | **`game.js` 不产出任何面向玩家的字串**，只产出 i18n key 与参数，由 `ui.js` 翻译（`i18n.test.mjs:124` 会扫描源码里的中文并失败）。 |

---

## 1. 一句话定位与版本状态

**一句话**：在 7×9 的砖面上用数字推理找出雷（威胁），把「插对的旗」换成战力，一路打穿 30 层、3 个主题区域、3 个 Boss。

| 维度 | 现状 |
| --- | --- |
| 版本 | `package.json` → `1.0.0`；存档格式 `SAVE_VERSION = 17`（`game.js:10`） |
| 形态 | 纯静态 PWA（`public/manifest.webmanifest`、`public/sw.js`）+ Capacitor 安卓壳（`capacitor.config.json`，`appId: com.lancelotfan.breakthebrick`） |
| 部署 | Cloudflare Pages：`wrangler.toml`（`pages_build_output_dir = "public"`），`npm run deploy` = `wrangler pages deploy public --project-name=break-the-brick` |
| 代码量 | `game.js` ≈ 2326 行（纯逻辑）、`ui.js` ≈ 1738 行（DOM）、`zh-CN.js` ≈ 892 行文案、`styles.css` ≈ 853 行、`index.html` ≈ 180 行 |
| 内容量 | 30 层 · 3 区域 · 3 主题 · 36 种怪（28 杂兵 + 4 守卫 + 4 首领）· 58 件遗物 · 4 个天赋 · 7 种商店条目 · 3 类事件格 · 5 类地城机关 · 7 类升级加成 |
| 测试 | 189 条 `node:test` 用例（`game.test.mjs` 164、`machines.test.mjs` 18、`i18n.test.mjs` 7），当前全绿 |
| 存档 | `localStorage`：`bbr.run`（当前局）、`bbr.meta`（跨局战绩/勋章）、`bbr.seen`（首局引导看过没）、`bbr.diff`（上次难度）、`bbr.audio`（音效开关，`audio.js:2`） |
| 依赖 | 运行时零依赖；只有 Capacitor 相关（`@capacitor/core`、`@capacitor/android`、`@capacitor/haptics` + CLI `@capacitor/cli`） |

---

## 2. 核心玩法循环

### 2.1 一层的完整流程

一层的生命周期写在 `buildFloor`（`game.js:640`）与 `tapTile`（`game.js:1446`）里，顺序固定：

| 阶段 | 触发 | 发生了什么 | 代码 |
| --- | --- | --- | --- |
| ① 规划 | 每次进入一层 | `planFloor` 按层号/难度/主题算出「本层要放多少个什么」，先只算数，不摆格 | `game.js:688` |
| ② 生成 | 玩家第一次点开任意格 | `ensureBoard(safeIndex)`：首点及其 8 邻格**永远安全**，其余内容从打乱的候选池里抽取 | `game.js:754` |
| ③ 翻格 | 点击暗格 | 空白格（邻威胁 0）连锁 `flood` 展开，遇到威胁/墙/旗就停 | `game.js:1303`、`game.js:1396` |
| ④ 数字推理 | — | 每个格子的 `n` = **周围 8 格内尚未探明的威胁数**，探明或清除后数字会变小（`hiddenThreatCount`） | `game.js:508` |
| ⑤ 插旗 / 识破 | 标记模式、长按 420ms、右键、键盘 `f` | 旗子标记已确认的威胁，占旗子预算；所有安全格翻开即自动「完全识破」 | `ui.js:92`、`game.js:1422`、`game.js:1068` |
| ⑥ 战斗 | 点到怪物（偷袭，强制战）或点已探明的怪物（可选战） | 逐击：点一次＝你砍一刀＋它还手一次；长按 220ms 只看这一刀的预演 | `game.js:1758`、`ui.js:1604` |
| ⑦ 事件 / 商店 / 祭坛 | 点开对应格 | 每层 1 个事件格（供给铺 / 遗物铺 / 神龛）、每层 1 座祭坛（第 2 层起） | `game.js:1904`、`game.js:1956` |
| ⑧ 找阶梯 + 钥匙 | 击杀钥匙守卫 | 非 Boss 层必须持钥匙才能下楼（第 1 层免钥匙）；Boss 层必须击杀龙王 | `game.js:1990` |
| ⑨ 下层 | 点阶梯格 | 结算金币/回血/遗物钩子 → 换区时先选主题 → `floor++` 并 `buildFloor` | `game.js:1997` |
| ⑩ 通关 | 第 30 层龙王倒下 | `status = 'won'`，写 meta 战绩与职业勋章 | `game.js:2063`、`game.js:2096` |

**回合的定义**：只有真正改变棋盘的操作才算一回合（`tapInner` 返回 `spent: true`）——插旗、切模式、看预演、无效点击全部免费（`game.js:1446` 附近注释）。地城时钟只按回合走（见 3.8）。

### 2.2 30 层 / 3 区域 / 3 Boss 的节奏

`actOf(f) = ceil(f / 10)`（`game.js:19`），`zoneDepth(f)` 是区内深度 1–10（`game.js:20`）。

| 层 | 区域 | 主题 | 首领 | 说明 |
| --- | --- | --- | --- | --- |
| 1–9 | act 1 | **无**（`actThemes[1]` 永远 `null`，`game.js:22` 注释） | — | 纯扫雷教学：只有杂兵、陷阱、宝箱、祭坛、事件格（石墙已暂时下线） |
| 10 | act 1 | 无 | **深渊龙王** `dragon` | 生成即亮在棋盘上，不计入邻格数字；倒下后解锁阶梯，并弹出**第二区主题二选一**（火 / 图腾） |
| 11–19 | act 2 | `inferno` 或 `totem`（玩家二选一） | — | 主题机制全开：火场 / 图腾 |
| 20 | act 2 | 同上 | **焰狱魔君** `infernoLord` 或 **图腾巨像** `totemColossus` | 倒下后弹出**第三区主题二选一**：`grave` + 第二区没选的那个 |
| 21–29 | act 3 | `grave` 或另一个 | — | 墓园（怪物半血复活）/ 火 / 图腾 |
| 30 | act 3 | 同上 | **墓园君主** `graveLord` 等 | 龙王倒下即通关（`winRun`，`game.js:2096`） |

- 跨区**必须先选主题**才允许下楼：`tryDescend` 发现 `actThemes[nextAct]` 为空就设 `pendingTheme`/`themeChoices` 并拒绝（`game.js:2003` 附近）。这是整局仅有的两次路线选择。
- 主题只由 `actThemes[2]` / `actThemes[3]` 决定，数组长度固定为 4（`game.js:22`），**首区恒为常规**。
- 怪物构成、精英、Boss 都按区域换皮：`ROSTERS` / `ELITES` / `BOSSES`（`game.js:133`–`game.js:183`）。**数值模板完全相同**，区域只换面孔（`game.js:130` 附近注释）。

### 2.3 单层内容配方（`planFloor`，`game.js:688`）

| 内容 | 公式（normal 难度） | 常量/位置 |
| --- | --- | --- |
| 杂兵 | `round(min(20, max(4, (4 + 0.85×f) × threat)) × (Boss层 ? 0.7 : 1))`；第 1 层 5 只、第 5 层 8 只（normal） | `game.js` 的 `planFloor` |
| 陷阱 | `min(6, max(1, round((1 + 0.35×f) × threat)))` | `game.js:694` |
| 宝箱 | **不按层刷**：只有「关底 Boss 击杀原位掉落」「寻宝铃 +1」「探险家翻地板 3% 发现（每层最多 1 只）」三个来源；**钥匙守卫只掉钥匙** | `game.js`，`planChestCount` / `defeatBoss` / `openTile` |
| 地板补给 | `max(2, round((1.8+0.1×f) × loot))` 格，**第一格固定药水**，其余药水:炸弹:卷轴 = 2:1:1 | `game.js`，`planFloor` / `ensureBoard` |
| 钥匙守卫 | 第 2 层起、非 Boss 层各 1 | `game.js:707` |
| 祭坛 | 第 2 层起各 1 | `game.js:708` |
| 事件格 | 每层 1（类型按权重随机，第 1 层固定供给铺） | `game.js:677` `planEvents` |
| 石墙 | **暂时下线**：`RULES.walls = false`，`planFloor` 里 `walls` 恒为 0（机制代码与测试保留，改回 `true` 即恢复） | `game.js:80`–`86`、`planFloor` |
| 火场 | 仅 `inferno` 非 Boss 层：`INFERNO_FIRE_PATCHES[区内深度-1]` 片 | `game.js:701` |
| 图腾 | 仅 `totem`：非 Boss 层按「魔法→死亡→召唤」轮换，Boss 层三座齐上 | `game.js:702` |
| 复活 | 仅 `grave`：整层怪物带半血复活 | `game.js:714` |
| 大地之门 | 全局限 1 次，落在 11–29 的非 Boss 层（由种子决定） | `game.js:715`、`game.js:484` |

实测样本（normal，不含天赋/遗物加成）：

| 层 | 杂兵 | 陷阱 | 宝箱 | 石墙 | 威胁总数（含守卫/Boss） |
| --- | --- | --- | --- | --- | --- |
| 1 | 7 | 1 | 3 | 0 | 8 |
| 5 | 13 | 3 | 4 | 0（下线前为 3） | 17 |
| 10（Boss） | 13 | 5 | 5 | 0 | 20 |
| 20（Boss） | 14 | 6 | 6 | 0 | 22 |
| 30（Boss） | 14 | 6 | 8 | 0 | 22 |

---

## 3. 关键数值总表

> 全部数值都在 `game.js` 顶部（`game.js:5`–`game.js:340`）与 `BAL`（`game.js:719`）。改数值优先动常量，**不要**在逻辑里写魔法数——测试与帮助文案都读这些常量。

### 3.1 棋盘与全局

| 常量 | 值 | 位置 | 说明 |
| --- | --- | --- | --- |
| `COLS` / `ROWS` / `SIZE` | 7 / 9 / 63 | `game.js:5`–`7` | 棋盘 63 格；`fitBoard` 按容器算 `--tile`（26–64px） |
| `MAX_FLOOR` | 30 | `game.js:8` | — |
| `BOSS_EVERY` | 10 | `game.js:9` | `isBossFloor(f) = f % 10 === 0` |
| `ACTS` | 3 | `game.js:17` | 区域数 |
| `THEMES` | `['inferno','totem','grave']` | `game.js:18` | 主题白名单，`deserialize` 也用它清洗 |
| `SAVE_VERSION` | 17 | `game.js:10` | 见第 6 节 |
| `HAZARD_TICK` | 5 | `game.js:64` | 每 5 个「花掉的操作」结算一次机关 |
| `FLAG_BONUS_CAP` | 9 | `game.js:214` | 旗子成长加成上限（难度基数另算） |

### 3.2 难度（`DIFFICULTIES`，`game.js:35`）

| id | `threat` 怪物量 | `power` 怪物强度 | `loot` 战利品 | 初始 hp | 初始 gold | 初始 potions | `flags` 旗子基数 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `easy` | 0.78 | 0.82 | 1.35 | 38 | 40 | 2 | 4 |
| `normal` | 1 | 1 | 1 | 32 | 30 | 2 | 3 |
| `hard` | 1.22 | 1.1 | 0.8 | 28 | 20 | 2 | 2 |

- 三档的初始面板共用一套：`atk 5 / def 1 / lv 1 / xp 0 / xpNext 12 / bombs 1 / scrolls 1`（`game.js:557` 的 `createRun`）。
- `flags` 是旗子预算的基数，`flagCap = 难度基数 + min(9, flagBonus)`（`flagCap`，`game.js:948`）。

### 3.3 怪物成长曲线

深度折算：`depthOf(f) = f ≤ 8 ? f : 8 + (f-8)×0.5`（`game.js:672`）——前 8 层线性，之后每两层才折一层，避免第 30 层数值爆炸。

| `BAL` 字段 | 值 | 位置 |
| --- | --- | --- |
| `mobHp` / `mobHpF` / `mobHpQ` | 10 / 3.5 / 6.0 | `game.js:722` |
| `mobAtk` / `mobAtkF` / `mobAtkQ` | 2.5 / 1.95 / 1.4 | `game.js:723` |
| `mobGold` / `mobGoldF` | 2 / 1 | `game.js:728` |
| `chestGold` / `chestGoldF` | 8 / 3 | `game.js:728` |
| `trapBase` / `trapF` | 5 / 2.8 | `game.js:726` |
| `lvXp` / `lvXpF` / `lvHp` / `lvAtk` / `lvDefEvery` | 12 / 10 / 6 / 1 / 3 | `game.js:724` |
| `potionPct` / `prayPct` / `descendPct` | 0.3 / 0.45 / 0.05 | `game.js:725` |
| `bloodCost` / `bloodAtk` | 10 / 2 | `game.js:727` |
| `shopWhet` | 1 | `game.js:728` |

`makeMob`（`game.js:731`）的实际公式，`late = max(0, depth - 8)`：

```
def  = floor(depth / 2) + b.def
hp   = round((10 + 3.5×depth + 6.0×late²) × b.hp  × power)
atk  = round((2.5 + 1.95×depth + 1.4×late²) × b.atk × power)
xp   = round((2 + 1.2×f) × (b.hp + b.atk) / 2)
gold = round((2 + 1×f) × loot)
精英：hp×1.9、atk×1.3、xp×3、gold×3.2      小 BOSS：hp×2.8、atk×1.8、xp×5、gold×5、**破甲**（玩家防御只按 30% 生效）      龙王：hp×3.4、atk×1.45、xp=120、gold=260
```

基准怪（`b.hp = b.atk = 1`）随层数的读数，用来判断「现在的强度感是否合理」：

| 层 | depth | 基准 hp | 基准 atk | 杂兵数 |
| --- | --- | --- | --- | --- |
| 1 | 1.0 | 14 | 4 | 7 |
| 5 | 5.0 | 28 | 12 | 13 |
| 10 | 9.0 | 48 | 21 | 13（Boss 层） |
| 15 | 11.5 | 124 | 42 | 20 |
| 20 | 14.0 | 275 | 80 | 14（Boss 层） |
| 25 | 16.5 | 501 | 136 | 20 |
| 30 | 19.0 | 803 | 209 | 14（Boss 层） |

怪物模板按区域分组，**四套同构**（`ROSTERS`，`game.js:133`）：每区 7 只，`min/max` 按**区内深度** 1–10 控制出场区间，所以每个区都从低阶怪起步、到高阶怪收尾。

| 区域 | 杂兵（按区内深度） | 精英 | 首领 |
| --- | --- | --- | --- |
| `base`（第 1 区） | 洞穴蝠 / 腐黏怪 / 骸骨兵 / 织网蛛 / 穴居兽人 / 石像鬼 / 深渊怨灵 | 钥匙守卫 `guardian` | 深渊龙王 `dragon` |
| `inferno` | 火绒蝠 / 熔心黏怪 / 焦骨兵 / 灰烬蛛 / 炎叉小鬼 / 黑曜魔像 / 烬火幽魂 | 熔火守卫 `emberWarden` | 焰狱魔君 `infernoLord` |
| `totem` | 祭坛蝠 / 泥胚傀儡 / 刻文骸骨 / 图腾蛛 / 图腾兽人 / 石像守卫 / 守誓幽魂 | 图腾卫兵 `totemWarden` | 图腾巨像 `totemColossus` |
| `grave` | 墓穴蝠 / 尸蜡团 / 复生骸骨 / 墓网蛛 / 食尸鬼 / 墓碑魔像 / 哀嚎幽魂 | 守墓人 `graveKeeper` | 墓园君主 `graveLord` |

### 3.4 战斗数学（确定性，无命中/暴击/浮动）

| 量 | 公式 | 位置 |
| --- | --- | --- |
| 单次伤害 | `hitDamage(atk, def) = max(1, atk - def)` | `game.js:516` |
| 整场预演 | `rounds = ceil((hp + 复活血) / (deal + 反震))`；`counters = rounds - 1`（死于反震时 +1） | `forecast`，`game.js:532` |
| 承伤 | `take = max(0, round(counters × (mobAtk - def) × takeMul) - takeFlat)` | 同上 |
| 逐击预演 | `forecastOnce`：这一刀 + 它这一口反击（含复活、反震补刀判定） | `game.js:1732` |
| 偷袭 | `max(0, round((mobAtk - def) × takeMul × ambushMul) - takeFlat)` | `ambushDamage`，`game.js:526` |
| 角斗士 | 场上已显示存活怪物恰好 1 只时 `atk × 2` | `atkOf`，`game.js:521` |
| 必死拦截 | 普通遭遇中 `lethal` 的一击被 `blocked` 拦下；偷袭战无路可退，照常结算 | `game.js:1806`、`game.js:1758` |

### 3.5 经济：金币来源与商店价格

**收入侧**（都吃 `loot` 倍率，`mint` 遗物再 ×1.5）：

| 来源 | 金额 | 位置 |
| --- | --- | --- |
| 杂兵 | `round((2 + f) × loot)` | `game.js:748` |
| 钥匙守卫 | ×3.2 | `game.js:749` |
| 龙王 | 260 | `game.js:750` |
| 宝箱 | **只出遗物**（开箱进三选一），不给金币/攻防/消耗品 | `lootChest`，`game.js` |
| 地板消耗品 | 药水 / 炸弹 / 卷轴直接摆在棋盘上：翻开后点一下即入包（`pickPotion` 按 `t.kind` 分派） | `game.js`，`ensureBoard` |
| 下楼奖励 | `(10 + 3f) × (探矿罗盘 ? 2 : 1) + (矿脉契 ? 30 : 0)` | `game.js:2021` |
| 祭坛「贪婪低语」 | 45（代价：本层借 1 防御，下楼归还） | `ALTAR_GREED_GOLD`，`game.js:1939` |
| 识破 | 每面插对的旗 4 金币（拾荒爪再 +8/陷阱旗） | `SOLVE_FLAG_GOLD`，`game.js:49` |
| 高利贷 | 下楼时 `floor(gold × 0.1)` | `game.js:2014` |

**支出侧**：单价 = `基准价 × 深度系数 × 遗物倍率`，同层内不随购买次数涨价。

| 常量 | 值 | 位置 |
| --- | --- | --- |
| `SHOP` 基准价 | potion 50 · scroll 50 · bomb 50 · whet 100 · plate 100 · elixir 100 · pouch 100 | `game.js:112` |
| `RELIC_PRICE` | common 100 / rare 150 / epic 200 | `game.js:122` |
| `SHOP_PRICE_FLOOR1` / `_STEP` / `_FULL_FLOOR` | 0.4 / 0.06 / 11 | `game.js:104`–`106` |
| `shopDepthMult(f)` | `min(1, 0.4 + 0.06×(f-1))` | `game.js:107` |
| `shopPrice` / `relicPrice` | 基准 × 深度系数 × `shopMult`，**取整到 5**、最低 5 | `game.js:1127`、`game.js:1134` |
| `shopMult` | 深口袋 ×0.75 · 贪婪之心 ×1.2 · 火把（仅炸弹）×0.5 | `game.js:1122` |

各层实际单价（无遗物）：

| 层 | 深度系数 | 药水/卷轴/炸弹 | 磨刀石/护甲/精粹/旗囊 | 普通/稀有/史诗遗物 |
| --- | --- | --- | --- | --- |
| 1 | 0.40 | 20 | 40 | 40 / 60 / 80 |
| 3 | 0.52 | 25 | 50 | 50 / 80 / 105 |
| 5 | 0.64 | 30 | 65 | 65 / 95 / 130 |
| 8 | 0.82 | 40 | 80 | 80 / 125 / 165 |
| 11+ | 1.00 | 50 | 100 | 100 / 150 / 200 |

> 遗物价格是 5 的倍数：`round(x/5)*5`，所以 150×0.64=96 → 95。

### 3.6 经验与升级

| 项 | 规则 | 位置 |
| --- | --- | --- |
| 升级所需 | `xpNext = 12 + 10 × (lv - 1)` | `game.js:1155` |
| 每级基础成长 | `maxHp +6`（并立即回 6）、`atk +1`、每 3 级 `def +1` | `gainXp`，`game.js:1148` |
| 击杀经验 | `round((2 + 1.2f) × (b.hp + b.atk) / 2)`；守卫 ×3；龙王 120 | `game.js:747` |
| 升级三选一 | 11 类奖励里抽 3 个不同属性；每张卡独立掷稀有度（升级专用曲线 `levelRarityWeights`：第 1 层 70/25/5 → 第 30 层 40/45/15）；**保底：三张全普通时把第一张升为稀有** | `LEVEL_STATS` / `LEVEL_WEIGHT`，`game.js:264` 附近；`rollLevelChoices` |
| 出现权重 | `atk`/`def`/`maxHp` 2.0 · `gold`/`heal` 1.1 · `atkFloor`/`defFloor` 1.0 · `xpFloor` 0.9 · `goldKill`/`healKill` 0.8 · `xpKill` 1.0 | `LEVEL_WEIGHT` |
| 起步品级 | `atkFloor`/`defFloor` 只出**史诗**；`xpKill` 最低**稀有**。带 `minRarity` 的项在抽样时权重还要乘上该档位概率（`levelDrawWeight`），否则「只出史诗」会变成「每批都有史诗」 | `LEVEL_STATS[].minRarity`，`game.js` |
| 三选一数值 | `atk` 1/2/3 · `def` 1/2/3 · `maxHp` 6/12/18 · `gold` 10/20/30（每层）· `heal` 10/20/30（每层）· `xpFloor` 4/8/12（每层）· `atkFloor` 1/1/1（每层，史诗）· `defFloor` 1/1/1（每层，史诗）· `goldKill` 1/2/3（每击杀）· `healKill` 1/2/3（每击杀）· `xpKill` 2/2/3（每击杀，稀有起） | `LEVEL_STATS`，`game.js` |
| 「每层」型的结算 | `atkFloor`/`defFloor` 每次下行直接把累计值加到面板上（`lv.atkFloor` / `lv.defFloor`）；靠史诗起步控制频率，不再摊薄数字 | `tryDescend`，`game.js` |
| 结算时机 | 面板型立刻生效；「每层」型在 `tryDescend` 结算；「每击杀」型在 `killMob` 结算 | 同上 |
| 重置价格 | `4 + 4 × 已重置次数` | `LEVEL_REROLL_BASE`，`game.js` |

### 3.7 遗物

| 项 | 值 | 位置 |
| --- | --- | --- |
| 池子 | 58 件：普通 25 / 稀有 20 / 史诗 13；分类 explore 13 / combat 18 / supply 21 / pact 6 | `RELICS`，`game.js:339` |
| 稀有度权重 | 普通 60 / 稀有 30 / 史诗 10，随深度漂移到 30/45/30 | `RELIC_RARITY`，`game.js:195`；`relicRarityWeights`，`game.js:330` |
| 三选一数量 | 3 | `RELIC_DRAW_COUNT`，`game.js:203` |
| 掉落节奏 | 每 2 层（非 Boss 层）的钥匙守卫掉一次；每个龙王额外一次 | `RELIC_EVERY`，`game.js:205`；`isRelicFloor`，`game.js:206` |
| 全局可抽次数 | 14 次（`RELIC_MAX_DRAWS`） | `game.js:404`（当前未被引用） |
| 重置价格 | `5 + 5 × 次数 - (典当票 ? 5 : 0)`，最低 0 | `relicRerollCost`，`game.js:2175` |
| 描述数字注入 | `RELIC_PARAMS` 把常量塞进 `{n}`/`{cap}`/`{pct}` 占位符 | `game.js:408` |

单件遗物的具体效果见 [`docs/relics.md`](./relics.md)（**注意**：该文档的「获取方式」段落已过期，见第 8 节）。机制实现集中在三处：

- 获得时的即时效果：`grantRelic`（`game.js:2202`）
- 派生/持续面板修正：`syncRelicMods`（`game.js:2107`）——`takeMul` / `takeFlat` / `thorns` / `freeKill` / `eliteAtkBonus` / `ambushMul` / `vigor` 派生攻、`midas` 派生攻防都写在这里
- 事件钩子：击杀 `killMob`（`game.js:1682`）、识破 `revealSolved`（`game.js:1068`）、下楼 `tryDescend`（`game.js:1997`）、开箱 `lootChest`（`game.js:1270`）

### 3.8 地城机关

机关是**叠加在地板上的额外层级**：不替代格子内容、不改变「数字只数威胁」的规则（`game.js:62` 附近注释）。时钟只在「花掉的操作」上走。

| 机关 | 关键常量 | 值 | 位置 | 行为 |
| --- | --- | --- | --- | --- |
| 石墙 | `WALL_MIN_FLOOR` / `WALL_MIN` / `WALL_MAX` / `RULES.walls` | 3 / 3 / 5 / **false** | `game.js:80`–`86` | **当前不生成**（玩家反馈干扰推理）；机制仍在：相邻非墙格全部揭开或插旗后才能手动拆、炸弹可强开、不是威胁、不计数字 |
| 火场 | `FIRE_BASE` / `FIRE_F` / `FIRE_CAP` / `INFERNO_FIRE_PATCHES` | 3 / 1.5 / 12 / `[1,1,2,2,3,3,3,4,4,0]` | `game.js:83`–`87` | 只有亲手踩上才灼烧（`max(2, round(3 + 1.5×depth - def/2))`），烧一次即熄灭；每 5 回合往相邻暗格爬 1 格，同层封顶 12 格，绕开阶梯/祭坛/图腾/门/墙 |
| 魔法图腾 | `TOTEM_MAGIC_CHARGES` / `_BASE` / `_F` | 6 / 3 / 1.2 | `game.js:88`–`90` | 每拍无视防御造成 `max(2, round(3 + 1.2×depth))`，6 拍后熄灭；**炸弹无效** |
| 死亡图腾 | `TOTEM_DEATH_ATK_STEP` / `_DEF_STEP` | 5 / 6 | `game.js:91`–`92` | 生成时给本层全体怪物 `atk + ceil(depth/5)`、`def + ceil(depth/6)`；炸弹炸掉后按 `mob.aura` 精确回退 |
| 召唤图腾 | `SUMMON_TOTEM_CHARGES` | 3 | `game.js:93` | 每拍在**已探明的空格**召来 1 只精锐（不参与数字、不掉钥匙/遗物），最多 3 只，炸弹可毁 |
| 图腾轮换 | `TOTEM_CYCLE` | `magic → death → summon` | `game.js:95` | 区内非 Boss 层轮换；Boss 层三座齐上 |
| 墓园复活 | `GRAVE_REVIVE_PCT` | 0.5 | `game.js:96` | 整层怪物倒下后以最大生命 50% 站起来一次；预演已把第二管血算进回合与承伤 |
| 大地之门 | `DOOR_MIN_FLOOR` / `DOOR_BACK` | 11 / 5 | `game.js:97`–`98` | 全局限 1 次，退回 5 层（避开 Boss 层）；不给下楼奖励 |
| 事件格 | `EVENT_KINDS` / `EVENT_ITEMS` / `EVENT_STOCK` | 见 3.9 | `game.js:67`–`78` | 出现即亮、非威胁、不计数字；库存随层刷新 |

时钟实现：`tickHazards`（`game.js:982`）→ `pulseMagicTotems`（`game.js:992`）→ `pulseSummonTotems`（`game.js:1016`）→ `spreadFire`（`game.js:1039`）。

### 3.9 事件格与库存（`EVENT_STOCK`，`game.js:75`）

| 事件 kind | 招牌 | 出售 | 库存 | 出现权重 |
| --- | --- | --- | --- | --- |
| `shopSupply` | 消耗品商店 | `potion` / `scroll` / `bomb` | 各 2 | `r < 0.4` |
| `shopRelic` | 遗物商店 | 3 件未拥有的遗物（生成时按当层权重掷定，购买前可见品级与价格） | 3 | `r ≥ 0.8` |
| `shrine` | 属性神龛 | `whet` / `plate` / `elixir` / `pouch`（永久属性） | 各 1 | `0.4 ≤ r < 0.8` |

第 1 层固定为 `shopSupply`（`planEvents`，`game.js:677`），保证开局买得起一件（该层单价 20）。

### 3.10 天赋（`TALENTS`，`game.js:285`）

每局开局必选一个，整局锁定；占遗物条第一格，不进入遗物池与图鉴。

| 天赋 | 轴 | 关键常量 |
| --- | --- | --- |
| `gladiator` 角斗士 | 单怪翻倍 | 场上存活怪物恰好 1 只 → `atk×2`（`atkOf`）；`addAtk` 每次永久加攻额外 +1 |
| `brawler` 格斗家 | 击杀成长 | `BRAWLER_EVERY = 5`（`game.js:316`）：hp +6 / def +1 / atk +1 / killHeal +1，四类等概率 |
| `treasureHunter` 探险家 | 宝箱 | 亲手翻地板时 3% 额外发现一只遗物宝箱（每层最多 1 只，`CHEST_FIND_CHANCE`） |
| `healer` 医者 | 药剂 | `HEALER_POTION_HEAL = 10`、`HEALER_POTION_MAXHP = 10`（`game.js:312`） |

细节与平衡快照见 [`docs/talents.md`](./talents.md)。

---

## 4. 文件地图

| 文件 | 负责什么 | 不要在这里改什么 | 想加东西该动哪里 |
| --- | --- | --- | --- |
| `public/index.html` | 页面骨架：`<defs>` 里 **51 个 SVG symbol**（`index.html:17`–`69`）、标题屏 `#screen-title`、游戏屏 `#screen-game`（顶栏/英雄面板/遗物条/龙王血条/棋盘/日志条/动作条）、`#scrim` `#sheet` `#floorCard` `#toast` `#flash` | 不要写业务数值；不要在 HTML 里写会变的文案（静态骨架用 `data-i18n`，动态内容一律 JS 生成） | 新增图标 → 加 `<symbol id="i-xxx">`；新增常驻区域 → 加结构 + `ui.js` 的 `el` 映射 + `styles.css` |
| `public/styles.css` | 全部样式：CSS 变量（`styles.css:5`–`19`）、布局骨架、棋盘/砖格、抽屉、战斗面板、5 组响应式断点 | 不要写死像素去对抗 `--tile`（棋盘尺寸由 JS 计算）；不要在这里加游戏逻辑 | 改视觉 → 变量区；改布局 → 对应区块 + 断点；新组件 → 追加到语义分区 |
| `public/src/main.js` | 单行入口：`import './ui.js';` | 不要塞逻辑 | — |
| `public/src/game.js` | **纯逻辑层**：常量、生成、战斗、经济、存档序列化。无 DOM、无 `window` | 不要 `document.`/`localStorage`/`setTimeout`；**不要产出面向玩家的字串**（只产 key 与参数） | 几乎所有规则/数值改动 |
| `public/src/ui.js` | 全部 DOM：屏幕切换、棋盘渲染、HUD、抽屉、点击分发、动效编排、meta 存档 | 不要在这里复制游戏规则（一律调 `G.*`），否则预演与实际会打架 | 交互、文案呈现、动画、LocalStorage |
| `public/src/i18n.js` | 27 行的文案解析器：`t(key, params)`、`ref(key)`（可嵌套引用）、`setLocale` | 不要在这里加文案 | 加语言 → 加 catalog 到 `CATALOGS` |
| `public/src/locales/zh-CN.js` | 唯一语言包（约 850 行、18 个命名空间） | 不要把数字写死在译文里（能注入就注入，见 5.6） | 所有面向玩家的字串 |
| `public/src/audio.js` | WebAudio 合成音效，无音频资源；`STORE='bbr.audio'`；内置环境音 | 不要加 `<audio>` 标签 | 新音效 → `play(name)` 的 switch |
| `public/src/fx.js` | canvas 粒子 / 浮字 / 飞行动画 / 震屏 / 触感（Capacitor Haptics 优先） | 不要在这里读游戏状态 | 新粒子 → `fx.xxx()` |
| `public/sw.js` | Service Worker：**网络优先**、断网回退缓存；`CACHE='bbr-v1'`，`SHELL` 列出要预缓存的资源 | 不要在 APK 里注册（`index.html:176` 已排除原生壳） | 新增顶层资源 → 加进 `SHELL` |
| `public/manifest.webmanifest` / `public/_headers` / `public/icon.svg` / `public/icons/*` | PWA 元信息、Cloudflare 缓存头、图标 | — | 换图标 → `npm run icons`（`tools/make-icons.ps1`） |
| `tests/game.test.mjs` | 164 条规则测试：棋盘、战斗、识破、遗物、事件、升级、商店定价、卷轴、存档清洗、天赋 | 不要靠改测试去「修」逻辑 bug | 新规则 → 在同文件按主题追加 `test()` |
| `tests/machines.test.mjs` | 18 条机关测试（石墙 / 火 / 三种图腾 / 墓园 / 门） | — | 新机关 → 加到这里 |
| `tests/i18n.test.mjs` | 7 条文案测试：解析器语义、目录完整性、动态键族、**源码不得含中文**、引用 key 必须存在 | 这条「源码不得含中文」是硬约束，别绕过 | 新 key 必须先加目录 |
| `tests/simulate.mjs` | AI 自动玩家（推理流 / 体魄流），跑平衡与稳定性 | 不是正式测试，不进 `npm test` | 新构筑偏好 → `RELIC_PREF` / `shopPass` |
| `tools/serve.mjs` | 28 行静态服务器，5173 端口，`no-store` | — | — |
| `tools/build-apk.mjs` | 探测 JDK17/Android SDK → `cap sync` → `gradlew assembleDebug` → 复制到 `dist/` | 不要把产物提交进 git（`dist/` 已 ignore） | — |
| `tools/make-icons.ps1` | 从 `icon.svg` 生成各尺寸 PNG | — | — |
| `docs/relics.md` / `docs/talents.md` | 分系统文档（遗物一览、职业详解与平衡快照） | 别把总表塞回本文 | 遗物/天赋改动后同步更新 |
| `package.json` / `capacitor.config.json` / `wrangler.toml` | 脚本、安卓壳、Pages 部署 | `appId` 改了就是另一个 App | 新平台 → 加 scripts |

---

## 5. 常见扩展剧本

> 每个剧本按「改哪里 → 要同步的登记表 → 坑」三段给。所有剧本的统一前置：**改完跑 `npm test`**（`i18n.test.mjs` 会抓漏掉的文案 key 与源码里的中文）。

### 5.1 新增一件遗物

| 步骤 | 动作 | 位置 |
| --- | --- | --- |
| 1 | 在 `RELICS` 里加 `{ id, icon, cat, rarity }`，`id` 全表唯一、`cat ∈ RELIC_CATS`、`rarity ∈ RELIC_RARITY` | `game.js:339` |
| 2 | 若描述里带数字：加常量 + 在 `RELIC_PARAMS` 注册注入参数 | 常量区 `game.js:214`–`256`；`game.js:408` |
| 3 | 获得瞬间生效 → `grantRelic` | `game.js:2202` |
| 4 | 持续/派生面板（承伤、反震、攻击、防御）→ `syncRelicMods`，**必须写成「重算目标值再写回差额」**，否则重复同步会越叠越多 | `game.js:2107` |
| 5 | 事件钩子：击杀 → `killMob`；识破 → `revealSolved`；下楼 → `tryDescend`；开箱 → `lootChest` | 见 3.7 |
| 6 | 若影响旗子上限 → `flagRelicNeed` + `FLAG_BONUS_CAP` | `game.js:2133` |
| 7 | 文案三件套 `relic.<id>.name/.desc/.flavor` | `zh-CN.js` |
| 8 | 图鉴自动收录（按 `RELIC_CATS` 分组），无需手写 | `ui.js:537` |

**坑**：
- 图标必须已存在于 `index.html` 的 symbol 里，否则 `<use href="#i-xxx">` 静默空白。
- `game.test.mjs:974` 断言「58 件、id 唯一」，**加/删遗物必须改这个数字**。
- 只有 3 处能改「已拥有判断」：`hasRelic` / `relicPool` / `deserialize` 的派生重建，别各写一套。
- 「拿到手也加不满」的旗子类遗物要用 `flagRelicNeed` 挡在池外，否则等于白扣一次三选一。

### 5.2 新增一个天赋

| 步骤 | 动作 | 位置 |
| --- | --- | --- |
| 1 | `TALENTS` 追加 `{ id, icon, color }` | `game.js:285` |
| 2 | 文案 `talent.<id>.name/.desc/.flavor/.tag`（`.tag` 用于卡片角标） | `zh-CN.js`；`ui.js:441` 取 `tag` |
| 3 | 效果钩子：开局 `chooseTalent`；每层 `brewPotion`；击杀 `killMob`；加攻 `addAtk`；升级 `gainXp`；宝箱 `lootChest`；下楼 `tryDescend` | `game.js:620` / `613` / `1682` / `1141` / `1148` / `1270` / `1997` |
| 4 | 面板状态说明 → `talentNote`（属性加成抽屉里那行小字） | `ui.js:458` |
| 5 | 勋章：`sanitizeMedals` / `awardTalentMedal` 自动认 `TALENTS` 里的 id，无需改；但标题页勋章网格是 `repeat(4, 1fr)` | `styles.css` 的 `.medal-row` |

**坑**：
- `openTalentDraw` 的卡片列数依赖 `TALENTS.length > 3 ? 'rcards-4'`，第 5 个职业要补 CSS（`ui.js:454`）。
- 帮助文案 `ui.help.talent.p1..p4` 是四段手写的职业说明，加职业必须同步，否则帮助页少一条。
- 天赋效果必须走 `addAtk` 而不是直接 `p.atk +=`，否则角斗士的额外 +1 会时灵时不灵。

### 5.3 新增一种怪物 / 换一个区

| 步骤 | 动作 | 位置 |
| --- | --- | --- |
| 1 | 往对应区域的 `ROSTERS[region]` 加 `{ id, icon, race, hp, atk, def, min, max }`（`min/max` 是**区内深度** 1–10） | `game.js:133` |
| 2 | 精英/首领：改 `ELITES` / `BOSSES` 对应区域项 | `game.js:172`、`game.js:178` |
| 3 | 文案 `mob.<id>.name` + `mob.<id>.flavor` | `zh-CN.js` |
| 4 | `race` 必须是 `RACES` 中的值 | `game.js:185` |
| 5 | 整个新区域/主题：`THEMES` + `themePairFor` + `themeIcon` + `ROSTERS/ELITES/BOSSES` 各加一套 + `theme.<id>.name/.desc` | `game.js:18`–`31` |

**坑**：
- **不要动数值模板**去区分区域：设计上四套怪同构，区域只换面孔（`game.js:130` 注释）。想调节难度请改 `DIFFICULTIES.power` 或 `BAL`。
- 新主题要同步：`styles.css` 的 `.board-wrap[data-theme="xxx"]` 描边（`styles.css:414` 附近）、`.chip-theme.theme-xxx`（`styles.css:205` 附近）、`ui.help.machine.themes`、`ui.help.lg.*` 图例。
- `INFERNO_FIRE_PATCHES` 按**区内深度下标**取值（`[zd-1]`），加新主题若也用火，记得数组长度必须 ≥ 10。
- `i18n.test.mjs` 会枚举所有真实生成的怪并检查 `mob.*` 文案与 `race.*`，漏一个就红。

### 5.4 新增一种事件 / 商店

| 步骤 | 动作 | 位置 |
| --- | --- | --- |
| 1 | `EVENT_KINDS` 追加 kind；`EVENT_ITEMS[kind]` 列出可卖 id（必须是 `SHOP` 里的 id 或 `'relic'`）；`EVENT_STOCK[kind]` 给每件库存 | `game.js:67`–`78` |
| 2 | `planEvents` 里加权重分支 | `game.js:677` |
| 3 | 文案：`event.<kind>.name`、`ui.event.<kind>.sub`、`tile.<kind>` | `zh-CN.js` |
| 4 | 打开面板：`openEvent` 里 `kind === 'shopRelic'` 是唯一的特殊分支（遗物货架），其余走 `EVENT_ITEMS` 通用列表 | `ui.js:1123` |
| 5 | 购买：`eventBuy` 校验 kind/库存并转 `buy()` / `buyRelicOffer()` | `game.js:1904` |
| 6 | 棋盘图标与样式：`tileView` 的 `t.kind === '<kind>'` 分支 + `.tile-event` 系列 class | `ui.js:111`、`styles.css` |

**坑**：
- 事件格是**生成即 `revealed`**，因此天然不计入邻格数字、也不会被偷袭；不要在 `openTile` 里给它加结算。
- 老存档的 `stock` 缺失会在 `deserialize` 里按 `EVENT_STOCK` 补（`game.js:2289`）；新增 kind 后老存档同样能补。`eventSchedule` 缺层现在会按 `planEvents` 补满（见 8.1-7），不会再出现「从某层起没有事件格」。
- 库存买空后要同时把 `t.used = true`，否则面板会一直亮着空货架。

### 5.5 新增一种地城机关

| 步骤 | 动作 | 位置 |
| --- | --- | --- |
| 1 | 常量（数值 + 上限）与 `planFloor` 的分布字段 | `game.js` 常量区 + `planFloor`（`game.js:688`） |
| 2 | 生成：在 `ensureBoard` 里按顺序落位。**顺序有意义**：墙→火→祭坛→事件→守卫→杂兵→陷阱→地板补给（药水/炸弹/卷轴）→额外宝箱 | `game.js` |
| 3 | 每拍结算：`tickHazards` 加一个 `pulseXxx`，内部对 `s.status !== 'playing'` 提前返回 | `game.js:982` |
| 4 | 玩家交互：`openTile`（翻开时）或 `tapInner`（已探明时点开） | `game.js:1303`、`game.js:1446` |
| 5 | 炸弹能否摧毁：`tapInner` 的 bomb 分支（可参考死亡/召唤图腾的写法） | `game.js:1467` 附近 |
| 6 | 画面：`tileView` 加分支 + `.tile-xxx` 样式；`ui.js` 的 `consume` 里加事件 case（音效/粒子/提示） | `ui.js:111`、`ui.js:609` |
| 7 | 文案：`tile.*`（无障碍标签）、`log.*`（日志）、`ui.help.machine.*`（帮助页） | `zh-CN.js` |
| 8 | 测试：`tests/machines.test.mjs` 加一组（该文件已有「空棋盘 + 手摆机关」的辅助函数） | `tests/machines.test.mjs:8` |

**坑**：
- 机关**不能是威胁**：`isThreat` 只认 `monster/elite/trap/boss/mini`（`game.js:505`），否则数字推理的整体语义就崩了。
- 机关的随机落位必须用 `rand(s)`（种子随机），否则「同种子可复现」的测试会红（`game.test.mjs` 有该用例）。
- 地形类机关要先于内容落位、并且从候选池里移除；叠加层（火）**不要**从池里移除，否则内容会被挤少。
- 会伤人的机关走 `hurt(s, dmg, out, '<source>')`，`source` 需要 `source.<id>` 文案（`zh-CN.js` 的 `source.*`）。

### 5.6 调整经济数值

| 想改什么 | 改哪里 | 连带要改 |
| --- | --- | --- |
| 商店单价 | `SHOP[].base`（`game.js:112`）、`RELIC_PRICE`（`game.js:122`） | 帮助/图鉴文案里的价格、`game.test.mjs` 的定价断言 |
| 深度折价曲线 | `SHOP_PRICE_FLOOR1/STEP/FULL_FLOOR`（`game.js:104`–`106`） | `ui.help.event.p` 的说明文字、事件面板副标题（价格是注入的，会自动跟随） |
| 遗物倍率 | `shopMult`（`game.js:1122`）：深口袋 0.75、贪婪之心 1.2、火把 0.5 | `RELIC_PARAMS` 里 `greedyHeart` 的百分比 |
| 金币收入 | `BAL.mobGold/mobGoldF`、`BAL.chestGold/chestGoldF`、下楼奖励（`game.js:2021`） | `docs/relics.md` 里涉及金币的描述、`npm run sim` 的读数 |
| 库存 | `EVENT_STOCK`（`game.js:75`） | 事件面板副标题、`ui.help.event.p` |
| 重置价格 | `LEVEL_REROLL_*`、`RELIC_REROLL_*` | `ui.help.level.p` / `ui.help.relic.p`（数值是注入的） |

**坑（这是本项目最容易被忽略的一类）**：
- 有些**价格写在译文里**而不是注入的：事件面板副标题已改成 `{price}`/`{common}` 注入，但帮助页仍有写死的基准价（`ui.help.lg.supply.d` 的「基准单价 50」、`ui.help.relic.p` 的普通/稀有/史诗价）。改价必须全文搜索 `金币`、`100`、`150`、`200`、`单价`。
- `game.test.mjs` 有「同层固定价」「跨层按 `shopDepthMult` 上浮」两类断言（`tests/game.test.mjs:390` 是深度定价测试，`:416`、`:465` 是同层不变），改价必须同步这两组；取整辅助 `r5()` 在 `tests/game.test.mjs:7`。
- 取整规则是 `round(x/5)*5`（5 的倍数、最低 5），改价格时别引入零碎数字。
- `simulate.mjs` 的 `shopPass` 用 `shopPrice(s, id) + 20` 做阈值（`tests/simulate.mjs:101` 附近），改价会**改变 AI 的购买行为**，平衡读数不能与旧数据直接对比。

### 5.7 改 UI 布局

| 想改什么 | 改哪里 | 注意 |
| --- | --- | --- |
| 棋盘格子大小 | `fitBoard`（`ui.js:57`）：`--tile` = clamp(26, 容器算出值, 64) | 改 `COLS/ROWS` 才需要动公式；棋盘靠 flex 抢剩余高度 |
| 顶栏 / 英雄面板 | `index.html:100`–`130` 结构 + `styles.css` 对应区块 + `ui.js` 的 `el` 映射与 `renderHud` | 新增节点必须进 `el`，否则 `renderHud` 找不到 |
| 底部动作条 | `index.html` 的 `nav.actionbar` + `styles.css` 的 `.actionbar` 网格列数 | **列数必须等于按钮数**（曾经 7 列 6 按钮，右侧空一槽） |
| 抽屉 | `openSheet(kind, html, lock)`（`ui.js:911`）动态填 `#sheetBody` | 抽屉种类由 `sheetKind` 字符串决定；锁定抽屉（`lock=true`）不能关 |
| 新增常驻行 | `.game-screen` 是 flex 列，`.board-wrap` 是 `flex:1` | 每加一行都从棋盘偷高度；矮屏断点 `max-height:660/720/600` 要一起调 |
| 响应式 | 断点：`max-height:660`（`styles.css:781`）→ `max-height:720`（`:792`）→ `max-height:600`（`:803`）、`max-width:340`（`:836`）、`min-width:520`（`:847`） | 三段 max-height 是**书写顺序覆盖**（后写的赢），加规则时确认它落在正确的段里 |

**坑**：
- 玩家血条有两个东西：HUD 那条是 `.bar.hud-hp`（17px 高，`styles.css:179`），战斗面板里的是 `.hp-bar`（10px 高，`styles.css:761`）。名字相近、尺寸不同，改一处别以为改了两处（HUD 文字被裁切就是这样来的，见 8.1-1）。
- `--tile` 只由 JS 写，CSS 里不要再写 `width: 44px` 之类的兜底，否则首次渲染会跳一下。
- 龙王血条出现/消失会改变棋盘可用高度，`updateBossBar` 里已显式 `fitBoard()`（`ui.js:266`），新增类似行时照抄这个模式。
- 别把 `.screen` 的 `max-width: 492px` 和 `.sheet` 的 `max-width: 492px` 当成两个值维护——它们是「桌面端手机列宽」的同一个约定。

### 5.8 加一条文案

| 场景 | 写法 |
| --- | --- |
| 静态骨架（HTML 里固定） | `data-i18n="ui.xxx"`（`textContent`）、`data-i18n-html`（`innerHTML`）、`data-i18n-aria`（`aria-label`）；由 `applyI18n` 统一刷（`ui.js:1715`） |
| JS 动态生成 | `tr('ui.xxx', { n })`；禁止字符串拼接中文 |
| 需要嵌套引用（日志里的怪物名/楼层名） | `ref('mob.bat.name')`，渲染时由 `resolve` 递归翻译（`i18n.js:14`） |
| 数组 | 传数组给占位符，`list.sep` 自动连接（`i18n.js:17`） |
| 缺 key | `t()` 直接回显 key（`i18n.js:25`），开发期一眼可见 |

**坑**：
- `i18n.test.mjs:124` 会剥掉注释后扫描 `game.js/ui.js/main.js/fx.js/audio.js/i18n.js`，**任何中文都会失败**（包括 `'未命名'` 这类兜底字符串）。
- `i18n.test.mjs:132` 会校验源码里引用的 `ui.|log.|tile.|list.|mob.|relic.|shop.|altar.|floor.|difficulty.|rarity.|cat.|source.|level.|talent.` 前缀 key 必须存在。新命名空间要同时加进该正则。
- 缺键不会崩，所以「能跑」不代表文案齐了——靠测试兜。
- **文风（2026-11-20 定）**：只写**数值、条件、后果**与**氛围**；不写操作教学（「点击它才能开启」「点它就能交易」）、不写规则复述（「只能带走一件」）、不写元叙述（「游戏不会读心」「不是免费的午餐」）。玩家看得懂按钮，别替他们翻译界面。

---

## 6. 存档与兼容

### 6.1 三个存储位

| key | 内容 | 写入点 | 备注 |
| --- | --- | --- | --- |
| `bbr.run` | 当前这一局的完整状态，`JSON.stringify(state)` | `saveRun`（`ui.js:51`） | 只在 `status === 'playing'` 时保存，死亡/通关即删除 |
| `bbr.meta` | `{ wins, runs, medals }` | `saveMeta`（`ui.js:50`） | 无版本号；`medals` 每次读取都过 `sanitizeMedals` |
| `bbr.seen` | `'1'` | `startRun`（`ui.js:1488`） | 首局自动弹玩法说明的开关 |
| `bbr.diff` | 难度 id | 标题页点难度/开局 | 记住上次选择 |
| `bbr.audio` | `'0'` / `'1'` | `audio.js:38` | 音效开关 |

### 6.2 `serialize` / `deserialize`

- `serialize(s)` 就是 `JSON.stringify(s)`（`game.js:2231`）——**没有投影**，整个 state 原样落盘。
- `deserialize(text)`（`game.js:2232`）是唯一的入口，做了三层事：
  1. **拒绝**：`s.v !== SAVE_VERSION`、`tiles` 不是 63 格、难度非法、没有 `player` → 返回 `null`（`game.js:2235`）。调用方把它当「没有存档」处理（`resumeRun` 返回 false → toast + 回标题）。
  2. **补默认值 + 清洗**：后加字段（`levelChoices`/`levelOffers`/`levelReroll`/`levelTaken`/`talent`/`killHeal`/`doorUsed`/`hazardClock`/`pendingDoor`/`pendingEvent`/`eventSchedule`/`actThemes`/`themeChoices`/每格的 `fire`/`summoned`/`stock`）缺失时按白名单重建。**会被后续代码直接当数组/对象用的字段一律重建，而不是「有就用」**：`relics`（按 `relicById` 过滤 + 去重）、`relicChoices`、`bought`、`relicState`（逐键归零）、`log`（过滤非 `{k}` 项）、`logId`、`mode`、`flags`/`flagBonus`/`stairsIndex`/`solvedFlags`/`defDebt`；`player` 的 `hp/maxHp/atk/def/gold/potions/bombs/scrolls` 夹回合法区间（`hp ≤ maxHp`、非负、`atk ≥ 1`）。
  3. **补齐与重算**：`eventSchedule` 缺层时用 `planEvents` 确定性补满 30 层（补完恢复 `s.rng`，不推进随机流）；`plan` 缺失时用 `planFloor` 重算；`takeMul`/`eliteAtkBonus`/`ambushMul`/`wardBonus` 一律按已拥有遗物重新推（老存档里的百分比承伤字段作废，`game.js:2258` 附近注释）。

### 6.3 state 字段分组（`createRun`，`game.js:557`）

| 组 | 字段 |
| --- | --- |
| 元信息 | `v` `seed` `rng` `difficulty` `status`（`playing` / `dead` / `won`）`floor` `generated` |
| 棋盘 | `tiles[]`（每格：`i kind revealed flagged n mob used chest relicDrop fire stock relicOffer totem summoned`）、`stairsIndex` `stairsFound` `hasKey` `bossDown` |
| 玩家 | `player{hp,maxHp,atk,def,lv,xp,xpNext,gold,potions,bombs,scrolls,takeMul,takeFlat,eliteAtkBonus,ambushMul,freeKill,thorns,atkBonus,goldBonus,wardBonus,killHeal}` |
| 构筑 | `talent` `talentPending` `relics[]` `relicChoices` `relicReroll` `relicState{whet,firstKill,trapWard,survey,heart,bombForge}` `levelChoices` `levelOffers` `levelReroll` `levelTaken` `bought` `flagBonus` `flags` |
| 流程 | `mode` `solved` `solvedFlags` `defDebt` `pendingCombat` `forcedCombat` `pendingAltar` `pendingDoor` `pendingEvent` `themeChoices` `pendingTheme` `actThemes` `hazardClock` `eventSchedule` `doorUsed` |
| 统计/日志 | `stats{kills,revealed,goldEarned,damage,turns,chests,chestsRelics}` `log[]`（`{id,k,p,tone}`，最多 40 条） `logId` |

### 6.4 改存档结构时必须做的事

1. **加字段**：不必升版本。在 `createRun` 给默认值，并在 `deserialize` 里写补默认值/白名单清洗。
2. **删字段或改语义**：升 `SAVE_VERSION`（老存档会被整体丢弃，等价于「玩家这局没了」——这是产品决策，不是纯技术细节）。
3. **改枚举 id**（遗物 id、怪物 id、主题 id）：要么保留兼容映射，要么升版本。
4. **任何派生字段**（承伤倍率、光环、旗子上限）：一律「按源数据重算」，不要在存档里信任它——手改存档和版本迁移都会踩到。
5. 改完跑：`game.test.mjs` 里有一组「可存档往返」「旧版本存档被拒绝」「老存档补默认值」用例，新增字段时照抄模式。

---

## 7. 测试与验证

### 7.1 `npm test`

```
node --test tests/game.test.mjs tests/machines.test.mjs tests/i18n.test.mjs
```

| 文件 | 条数 | 覆盖什么 |
| --- | --- | --- |
| `tests/game.test.mjs` | 164 | 棋盘规格与首点安全、每层实体数量、数字语义（含「已清除仍给数字」）、战斗数学、偷袭、识破（含完美识破）、炸弹、钥匙/阶梯、升级与三选一、商店深度定价、卷轴空放拦截、祭坛、事件与库存、遗物逐件行为、天赋逐条、存档往返/拒绝/脏存档清洗、随机可复现 |
| `tests/machines.test.mjs` | 18 | 石墙（锁定/拆开/炸弹/不给识破添堵）、火焰（只烧亲手翻的、蔓延上限）、魔法图腾（无视防御、炸弹无效）、死亡图腾（增幅与精确回退）、召唤图腾（落点/上限/不掉钥匙）、墓园复活、大地之门 |
| `tests/i18n.test.mjs` | 7 | 解析器（插值/数组/嵌套/缺键回显）、目录完整性、动态键族可解析、**源码不得含中文**、引用 key 必须存在 |

当前状态：**194/194 全绿**（2026-11-21 快照）。

测试习惯：全部是**纯逻辑测试**（`import * as G from '../public/src/game.js'`），不碰 DOM、不开浏览器。`i18n.test.mjs` 会遍历 1–30 层真实生成一次，确保怪物文案齐全。

### 7.2 `npm run sim`

```
node tests/simulate.mjs 200                          # npm run sim
node tests/simulate.mjs 300 normal reason            # 指定难度/构筑
node tests/simulate.mjs 1 trace normal 12345         # 逐步打印一局的走法
```

- 机器人会：演绎安全格、按「数字 − 已插旗」插旗、算预演决定打不打、买补给/遗物、炸机关、识破后收尾、下层。
- 默认输出的每一行是「构筑/职业 + 难度」一档：胜率、平均层数、等级、遗物数、血上限、攻防、操作数、受伤、偷袭次数、识破次数（旗数/完美数）、主题分布、卡死数、层数直方图。
- 参数顺序：`[runs] [difficulty] [build] [talent]`；`build ∈ reason|body`（缺省混合），`talent` 缺省 `gladiator`；`difficulty` 缺省时三档全跑（`npm run sim` 实际是 3×200=600 局）。
- 用法：改完数值跑一遍，对比胜率与「平均层数」；`卡死` 必须为 0（有卡死说明规则出现死锁）。

### 7.3 浏览器 / 无头验证

```powershell
npm run dev            # node tools/serve.mjs → http://localhost:5173（PORT 可覆盖）
```

- **Node 侧没有 DOM**：`game.js` 是纯逻辑，浏览器侧的一切只能靠页面本身验证。仓库**没有** puppeteer/playwright 依赖，所以当前做法是：起本地服务器，在目标手机尺寸下人工点一遍，或在 DevTools 控制台借调试 API 驱动。
- 调试 API 挂在 `window.__game`（`ui.js:1730` 附近）：

| 用法 | 作用 |
| --- | --- |
| `__game.state` | 当前 state（只读 getter） |
| `__game.api` | 整个 `game.js` 命名空间（可直接 `__game.api.forecast(...)`） |
| `__game.tap(i)` / `__game.flag(i)` | 模拟点格 / 插旗（走完整的 UI 流程与动画） |
| `__game.start(diff)` / `__game.resume()` / `__game.toTitle()` | 开局 / 读档 / 回标题 |
| `__game.sheet()` | 当前抽屉种类（`null` 表示没开） |
| `__game.openHelp()` / `openCodex()` / `openEvent(i)` … | 直接打开某个抽屉截图 |
| `__game.setDifficulty('hard')` | 切难度并重绘标题页 |

- 无头验证的最小可行路径（不装新依赖）：用 `node --test` 覆盖规则（已经做得很密），UI 只验证「不抛异常 + 关键元素存在」——可以用 Chrome 的 `--headless --dump-dom` 或任意 DevTools 协议客户端连 5173，检查 `#board` 有 63 个 `.tile`、`#screen-game` 是否 `hidden`。
- 移动端要看的四件事：① 竖屏 7×9 是否完整不裁切；② 375×667 与 428×926 两档下动作条/日志条不挤掉棋盘；③ 抽屉 `max-height:86dvh` 时按钮仍可点；④ 长按插旗（420ms）与长按预演（220ms）不互相抢。

---

## 8. 已知问题 / 待办

### 8.1 本次迭代已修复（工作区已改、`npm test` 194/194 全绿）

| # | 问题 | 根因（改前） | 本次的改法 |
| --- | --- | --- | --- |
| 1 | **HUD 血条文字被裁切** | HUD 血条同时带 `.bar`（高 17px，`styles.css:179`）与 `.hp-bar`（高 10px，战斗面板用的那条），后者覆盖高度；而 `.bar span` 只设了 `font-size:11px`，`line-height` 继承 `body` 的 `1.5`（`styles.css:26`）→ 行盒约 16.5px 塞进 10px 且父级 `overflow:hidden` → 上下被切 | 拆开两个概念：HUD 血条改用独立类名 `.hud-hp`（`index.html:118`、`ui.js` 的 `el.hpBar` 同步），尺寸回到 `.bar` 的 17px；`.bar span` 加 `line-height:1`。注意 `.hud-hp` 目前只是**钩子类**（还没写 CSS 规则），别照着它找样式 |
| 2 | **底部「下一层」按钮与点阶梯重复** | 阶梯是明牌，点它就能下楼；底部再放一个常驻按钮是第二个入口，且多数时候是禁用态（`index.html` 的 `#btnDescend`、`ui.js` 的 `renderHud` 同步逻辑） | 删掉按钮与 `ui.act.descend` / `ui.descend.*` 文案、`case 'descend'` 分支，`ui.js` 不再持有 `el.descend`；`.actionbar` 网格从「6 列 + 1.28fr」改成 5 列（否则右侧留空槽）；`.act-descend` 样式整段删除 |
| 3 | **商店固定单价 vs 金币随层数增长** | `SHOP[].base` 与 `RELIC_PRICE` 恒定，而收入是 `2+f` / `8+3f` / `10+3f` → 前期（第 1 层 10 金币 vs 药水 50）买不起，后期金币溢出无处可花 | 引入**深度定价**：`shopDepthMult(f) = min(1, 0.4 + 0.06×(f-1))`，第 11 层起回到基准价；`shopPrice` / `relicPrice` 统一乘这个系数；开局金币上调（40/30/20）；第 1 层固定给消耗品商店（单价 20）；事件面板副标题改为注入当前层真实价格，并新增「有货但买不起」的提示条 `.shop-hint` |
| 4 | **神龛面板的旗帜加成显示 `undefined/9`** | `openEvent` 的属性行读的是 `p.flagBonus`，但 `p` 是 `S.player`，旗数加成记在局上（`S.flagBonus`） | 改读 `Math.min(G.FLAG_BONUS_CAP, S.flagBonus \|\| 0)`；实测显示「旗帜加成 3/9」，四种状态（买得起 / 买不起 / 旗囊封顶 / 售罄）全部无 `undefined` |
| 5 | **卷轴能空放：3×3 全探明也照扣** | 卷轴分支先 `scrolls--` 再探明（`game.js` 的 `tapInner`），完全没校验目标区域是否还有暗格；炸弹模式有校验，卷轴没有 | 先 `ensureBoard` 再判定：3×3 内没有任何暗格就报 `log.scroll.empty` 并拒绝，不扣卷轴、不算回合，模式保持 `scroll` 让玩家重选目标；有暗格才照常消耗 |
| 6 | **脏存档能让界面卡死** | `deserialize` 只清洗了部分字段：`relics` / `relicChoices` / `bought` / `relicState` / `log` / `logId` / `plan` 缺失或类型错时，`buy()`、`tapTile()`、`renderRelics()` 会直接抛异常（实测 `Cannot read properties of undefined`） | `deserialize` 统一按白名单重建这批字段（遗物 id 过滤 + 去重、日志过滤、`relicState` 逐键归零），面板数值夹回合法区间（`hp ≤ maxHp`、金币/道具非负、`atk ≥ 1`），`plan` 缺失时用纯函数 `planFloor` 重算 |
| 7 | **事件表被清洗成空 → 后续楼层没有事件格** | `deserialize` 只做过滤，`eventSchedule` 为空时没有兜底，第 2 层起再也刷不出商店/神龛 | 缺层时用 `planEvents` 确定性补满 30 层（保留已有楼层的类型），补完把 `s.rng` 恢复原值，不影响这一局的随机流 |
| 8 | **升级三选一的收益不成比例** | 旧值：`gold` 4/8/12 与 `heal` 4/8/12 是每层小钱，等于没有；`xpKill` 2/4/6 可以滚雪球（全押时 Lv 77、胜率 +13pp）；只有 7 类，选择面窄 | **扩到 11 类**并只调数值/稀有度：新增「每击杀金币 / 每击杀回血 / 每层攻击 / 每层防御」；`gold`/`heal` 10/20/30，其余 1–3；`xpKill` 稀有起步（2/2/3）、`atkFloor`/`defFloor` 史诗起步；升级专用稀有度曲线（史诗 5%→15%）与 `LEVEL_WEIGHT` 出现权重（核心三项 2.0）。炼狱 `power` 1.10 → 1.03。实测 easy 97% / normal 67% / hard 36.5%（原 94/69/39） |
| 9 | **宝箱没价值、商店挡推理、解谜后满屏暗 0** | 宝箱每层 3–8 个，一半开出的是药水/炸弹/卷轴——和直接捡没区别；事件格亮着却不给邻格数字，玩家推理时缺一块信息；解完一层后每个空地都挂着暗 0 | 宝箱减半；消耗品改成直接摆在地板（每层至少一瓶药水）；事件格改为显示邻格威胁数（不再需要拆除按钮）；`S.solved` 后不再渲染暗 0；商店/金币图标重画（铜钱 + 摊位），新增 `i-stall` |
| 10 | **宝箱的用途不对** | 宝箱每层 3–8 个、开出来是金币/攻防/消耗品，和「宝箱」这个名字不匹配；另外插错旗后双击连锁翻出怪物时不触发偷袭 | 宝箱改成**只出遗物**（开箱进三选一）+ 一点箱底金币；来源改为：击杀精英/关底 Boss 原位掉落、寻宝铃每层 +1、探险家翻地板 5% 发现（每层最多 1 只）。`chord` 里翻出怪物改为照常偷袭并强制开战；卷轴仍是安全探明；已现身未交手的怪物右上角加红色「!」 |
| 11 | **宝箱又给攻防、卷轴能白嫖怪物、炼狱难度错位** | 宝箱开出金币/攻防与「遗物宝箱」的设定不符；卷轴把 3×3 里的怪物直接掀开，等于免费信息；插错旗双击翻出怪物反而没有偷袭；事件格亮着却不给邻格数字 | 宝箱只出遗物，来源只剩「关底 Boss / 小 BOSS / 寻宝铃 / 探险家 3% 发现（每层 1 只）」，钥匙守卫只掉钥匙；卷轴改为不揭怪、只打红色感叹号（自动标记，不占旗子预算）；`chord` 翻出怪物一律偷袭+强制开战；事件格显示邻格威胁数 |
| 12 | **缺少中层威胁** | 除了每层的钥匙守卫与 10/20/30 的关底 Boss，中间没有任何强度台阶；事件格占位又挡推理 | 新增**小 BOSS**：`MINI_EVERY = 5`，第 5/15/25 层各一只（`MINIS` 名册，hp×2.6 / atk×1.45 / xp×5 / gold×5），**生成即亮**、不拿钥匙、击杀掉宝箱；事件格 / 祭坛 / 陷阱 / 阶梯 / 石墙显示邻格威胁数（宝箱与药水/炸弹/卷轴必然拾取，不标数字），因此**移除「拆除建筑」**，删掉 `razeEvent` 与镐子按钮。遗物 ~24 件/局，三档 `power` 重标为 0.61/0.71/0.72，实测 easy 90.5% / normal 64.5% / hard 43.5% |
| 13 | **整局没有遗物商店、格斗家提示误导** | 事件排布是纯随机（40% 补给 / 40% 神龛 / 20% 遗物商店），30 层平均 5.8 家，但确实会出现「一整局 0 家」和「连发 5 个神龛」；格斗家的天赋提示把「当前击杀回复总量」当成成长值显示，读起来像「再击杀五次 +10 回复」，而且它只显示回血一项 | `planEvents` 加两条硬约束：每个区（10 层）至少一家遗物商店、同一类不连发三次（交替修正到稳定）；格斗家四项成长写进 `stats.brawler`，提示改成「再击败 N 只随机成长一项 · 累计：生命/攻击/防御/回血」。实测 300 局：没有缺遗物商店的区，最长连发 2；格斗家 200 杀成长 hp+66 / atk+5 / def+14 / heal+10 |
| 14 | **下楼没有二次确认** | 踩阶梯就直接下楼，玩家经常忘了拿地上的宝箱/药水、漏逛没买完的商店、放着敌人不打 | 新增 `floorLeftovers(s)`（已翻开未拾取的物品 / 存活敌人数）与下楼确认抽屉：还有遗留时点阶梯先弹「确认下楼？」，列出两类遗留数量，可「留下」或「仍然下楼」；确认后本次点击放行。商店/神龛不参与判定——每层都提醒一次太烦 |
| 16 | **前 5 层怪物涨太快、下楼提醒太吵** | 杂兵公式 `6 + 1.3f` 到第 5 层就有 13 只，旗子只有 2–4 面，开局基本靠猜；下楼确认又把「还有商店没逛」算进去，前期几乎每层都弹一次 | 杂兵改成 `4 + 0.85f`（第 1 层 5 只、第 5 层 8 只），并把击杀经验系数从 1.2 抬到 1.45 补回等级节奏；`floorLeftovers` 去掉商店判定，只提醒「没拿的东西 / 没清的敌人」。实测 easy 92.5% / normal 65.5% / hard 42.5%（改动前 90.5 / 64.5 / 43.5） |
| 17 | **小 BOSS 没威胁 / 遗物重置太便宜** | 玩家防御随深度涨得比怪物攻击快，第 25 层小 BOSS 打玩家只有 1 点；遗物重置 5 金币起、每次 +5，随便刷神装 | 小 BOSS 伤害改为「攻击 − 防御×30%」（`mobPierce`），atk×1.45→1.8、hp×2.6→2.8，现在每口稳定打掉 17–19% 生命、2–3 回合的交换要付 17–38% 血；遗物重置 25 起、每次 +20，典当票改为常驻减 25（首次重置仍免费）。实测 easy 91.0% / normal 60.0% / hard 41.0% |
| 15 | **图腾机制对玩家不透明** | 棋盘上只画一个图腾图标，玩家不知道它每几拍触发、打多少、还剩几次；怪物只有 hp/atk/def 三个数，看不出精英/BOSS/召唤体/复活这些身份差异 | 长按已翻开的怪物或图腾打开详情抽屉：怪物给名称/描述/生命·攻击·防御/击杀奖励/身份说明（钥匙、宝箱、召唤体、复活、死亡图腾光环）以及本层主题提醒；图腾给触发节奏、伤害或光环数值、剩余次数。长按暗格仍然是插旗 |

> 这十五条的状态：**代码与测试都已改完**，`npm test` **200/200 全绿**，尚未提交、也还没在真机上复核。验收时重点看：① HUD 血量数字是否完整显示；② 现在只能靠点阶梯下楼，玩家是否找得到入口；③ 第 1 层开局金币（40/30/20）能否买得起 20 金币的补给；④ 神龛面板的旗帜加成是否是正常数字；⑤ 卷轴点到自己翻过的区域是否会被拒绝；⑥ 升级三选一仍是 11 类奖励、数值按新表、稀有度按新曲线；⑦ 宝箱只出遗物、来源只有关底 Boss / 寻宝铃 / 探险家；⑧ 事件格左上角有邻格威胁数（没有拆除按钮）；⑨ 整层识破后棋盘上不再出现暗 0；⑩ 插错旗后双击翻出怪物会先吃偷袭并强制开战；⑪ 卷轴不揭怪、只给红色感叹号，且这个记号不占旗子预算。

### 8.2 我从代码里确认的其它问题

| # | 问题 | 位置 | 影响 / 建议 |
| --- | --- | --- | --- |
| 4 | ~~`deserialize` 不清洗 `s.relics` 与 `s.relicChoices`~~ | 已在 8.1-6 修复：遗物 id 白名单 + 去重 | — |
| 5 | ~~商店面板的神龛属性行取错对象~~ | 已在 8.1-4 修复：`flagBonus` 记在 `S` 上，不在 `S.player` 上 | — |
| 6 | ~~卷轴模式对已探明格也扣卷轴~~ | 已在 8.1-5 修复：区域无暗格时拒绝并保留卷轴 | — |
| 7 | `bought` 是**只写不读的死字段** | 写入：`game.js:1919`、`game.js:1961`；全仓无读取 | 存档里持续增长但无意义。改价逻辑已不看它，可以删（顺带省存档体积）。注意：现在 `deserialize` 会把它补成 `{}`，删字段时记得同步 |
| 8 | `RELIC_MAX_DRAWS` 导出但**没有任何引用** | `game.js:404` | 与 `docs/relics.md` 里「一局最多 14 次」重复维护，容易漂移；要么用起来（图鉴/帮助），要么删 |
| 9 | `LOCALES` / `locale()` / `setLocale()` **无入口** | `i18n.js:8`–`10` | 目前只有 zh-CN；若不加语言切换，这些是死代码；若加，需要 UI 入口与 `applyI18n()` 重刷 |
| 10 | ~~`eventSchedule` 被清洗成 `[]` 时后续楼层没有事件格~~ | 已在 8.1-7 修复：缺层按 `planEvents` 补满 | — |
| 11 | **帮助页写死了基准价** | `zh-CN.js` 的 `ui.help.event.p`（还写死「第 1 层单价 20」）、`ui.help.lg.supply.d`（「基准单价 50」）、`ui.help.lg.relicShop.d` / `ui.help.lg.shrine.d`（100 / 100-150-200） | 这些句子表达的是「基准价」，改 `SHOP[].base` / `RELIC_PRICE` 时必须手改；事件面板的价格已改成注入（`{price}`/`{common}`），帮助页没有。改价时全文搜索「单价」「基准」「100/150/200」 |
| 12 | 改价会**改变 AI 的购买行为**，平衡读数不可跨版本比较 | `tests/simulate.mjs` 的 `shopPass`（阈值 `shopPrice(...) + 20`） | 这不算 bug，但 `docs/talents.md` 里那张胜率快照是旧价下的读数；深度定价落地后要重跑 `npm run sim` 再更新 |
| 13 | ~~`docs/relics.md` 的「获取方式」段落已过期~~ | 已按实际实现重写：摆出三件、按品级明价、金币够就能买、每格库存三件；顺手删掉「一局最多 14 次」（`RELIC_MAX_DRAWS` 无人引用，见第 8 条） | — |
| 14 | `docs/relics.md` 的遗物效果数字与常量**靠人肉同步** | `game.js:214`–`256` vs `docs/relics.md` | 例如「号旗 +2」「干粮 10%」这类，改常量时文档不会自动变；建议把该文档当成「生成物」看待，改完常量就通读一遍 |

### 8.3 还没做、但值得考虑

- **i18n 只覆盖 zh-CN**：`i18n.js` 的机制已就绪（`ref` 让历史日志可重译），但缺语言切换 UI 与第二份 catalog。
- **无自动化 UI 测试**：`window.__game` 已经暴露了足够多的钩子，接一个 headless Chromium 做冒烟测试的成本不高（需新增 devDependency）。
- **`game.js` 已 2300+ 行**：若继续长，可按「生成 / 战斗 / 经济 / 遗物 / 存档」拆文件；拆的时候注意 `tests/*.mjs` 全部是 `import * as G`，只改导出位置不改名字最省事。
- **安卓壳的 `android/` 是生成物**：`cap sync` 会把 `public/` 复制进 `android/app/src/main/assets/public/`（已 gitignore），别在那里改代码。

---

## 9. 术语表

| 术语 | 精确含义 | 代码锚点 |
| --- | --- | --- |
| **威胁** | 计入邻格数字、必须清掉才能通层的五类格：`monster`/`elite`/`trap`/`boss`/`mini`。石墙、事件格、祭坛、宝箱、药水、阶梯**都不是**威胁 | `isThreat`，`game.js` |
| **数字（n）** | 该格周围 8 格中**尚未探明**的威胁数。探明/清除后会减少；减到 0 仍显示暗 0，避免玩家以为信息丢了 | `hiddenThreatCount`，`game.js:508`；`ui.js:199` |
| **插旗** | 在暗格上放旗，表示「我已确认这是威胁」。占旗子预算、阻挡连锁展开与快速展开，但**不阻挡**主动点开（点了会自动拔旗） | `toggleFlag`，`game.js:1422` |
| **旗子上限** | `难度基数 + min(9, flagBonus)`。基数 4/3/2，加成来自旗囊（+1/件）、祭坛旗帜祝福（+2）、号旗（+2）、旗手纹章（+3），总量封顶 +9 | `flagCap`，`game.js:948` |
| **快速展开（chord）** | 点已翻开的数字格：若周围旗数 == 数字，则一次性翻开其余暗格 | `chord`，`game.js:1618` |
| **识破（解开一层）** | 当所有非威胁格（含石墙）都已探明，系统认定本层被「解开」，自动掀开剩余威胁，并按插对的旗给予奖励 | `boardSolved`，`game.js:954`；`revealSolved`，`game.js:1068` |
| **完美识破** | 识破时**每一处剩余威胁都被插了旗**（`correct === hidden.length`），额外给经验、可触发全识/编年史 | `game.js:1090` |
| **识破收益** | 本层全体怪物防御 −1（`SOLVE_DEF_CUT`）；破阵/夺气/全识再追加；每面插对的旗 +4 金币；完美 +15 经验 | `game.js:1068`–`1120` |
| **偷袭** | 亲手翻开藏着怪物的砖时，先白挨一次「怪物攻击 − 防御」并进入**无法回避**的战斗。卷轴、识破、连锁展开掀开的不算偷袭 | `ambushDamage`，`game.js:526`；`openTile`，`game.js:1328` |
| **强制战** | 偷袭后 `forcedCombat` 锁住战斗面板：不能关闭、不能逃跑，只能打或炸 | `game.js:1343`；`ui.js:979` |
| **回合** | 只有真正改变棋盘的操作（翻格、炸弹、卷轴、战斗一击、拾取）才算；插旗/切模式/看预演免费 | `tapInner` 的 `spent`，`game.js:1446` |
| **深度（depth）** | 用于一切强度公式的折算层数：`f ≤ 8 ? f : 8 + (f-8)×0.5`。注意**不是**层号，也不是区内深度 | `depthOf`，`game.js:672` |
| **区内深度（zoneDepth）** | `(f-1) % 10 + 1`，1–10。用于怪物出场区间、火场片数、图腾轮换 | `game.js:20` |
| **区域（act）** | `ceil(f/10)`，1–3。每区 10 层，区内主题一经选定覆盖该区全部楼层 | `actOf`，`game.js:19` |
| **主题（theme）** | 区域机制：`inferno` 火场 / `totem` 图腾 / `grave` 墓园复活。首区无主题；第 10、20 层 Boss 后各二选一 | `THEMES`，`game.js:18`；`themePairFor`，`game.js:27` |
| **机关（hazard）** | 叠加在地板上的额外层级：石墙、火、三种图腾、墓园复活、大地之门。不替代格子内容、不改变数字语义 | 3.8 节；`HAZARD_TICK`，`game.js:64` |
| **事件格** | 每层 1 个、生成即亮、非威胁：消耗品商店 / 遗物商店 / 属性神龛。各有库存，买空即熄 | `EVENT_KINDS`，`game.js:67` |
| **钥匙守卫（elite）** | 每层 1 只（第 2 层起、非 Boss 层），持钥匙；遗物层击杀后在地上留三选一 | `game.js:707`；`killMob`，`game.js:1718` 附近 |
| **龙王（boss）** | 第 10/20/30 层的首领，生成即亮、不计入数字、不偷袭；非最终层倒下后解封阶梯并给主题/遗物 | `ensureBoard`，`game.js:777`；`defeatBoss`，`game.js:2063` |
| **大地之门** | 全局限 1 次的回退入口，退回 5 层（避开 Boss 层），不给下楼奖励 | `useDoor`，`game.js:1841`；`doorTarget`，`game.js:973` |
| **深度定价** | 本次新增：单价 = 基准 × `shopDepthMult(层)` × 遗物倍率，同层内不变 | `shopDepthMult`，`game.js:107` |
| **遗物三选一** | 守卫/龙王掉落的遗物留在地上，走上去点开才抽 3 件（可付费重置） | `offerRelics`，`game.js:2165`；`ui.js:409` |

---

## 10. 修改前的自检清单

**改之前**

- [ ] 确认改的是哪一层：规则/数值 → `game.js`；呈现 → `ui.js`；文案 → `zh-CN.js`；视觉 → `styles.css`。
- [ ] 搜索是否已有同名常量/函数（这个项目倾向「一个概念一个出口」：`addAtk`、`shopMult`、`syncRelicMods`、`flagCap`、`isThreat` 都是不能绕过的关口）。
- [ ] 若动数值：先看 `docs/relics.md` / `docs/talents.md` / 帮助页文案里有没有写死的同一个数字。

**改之后（按顺序）**

1. `npm test` —— 189 条必须全绿。重点看：遗物数量断言（`58`）、同层固定价/跨层上浮、卷轴空放、脏存档清洗、源码禁中文、引用 key 必须存在。
2. `npm run sim` —— 三档胜率与平均层数不出现断崖，`卡死` 必须为 0。
3. `npm run dev` + 手机尺寸实机点一遍：首点安全 → 翻格 → 插旗 → 打怪 → 下楼 → 选主题 → Boss → 通关。
4. 若动了存档字段：手动「开局 → 刷新页面 → 继续探索」，确认 `bbr.run` 能往返；再手动构造旧版本存档确认被拒。
5. 若动了 UI：375×667 / 390×844 / 428×926 三档竖屏都要看，尤其底部动作条与抽屉底部按钮。

**最容易忘的五件事**

- [ ] **`SAVE_VERSION`**：删字段/改枚举 id 时忘了升，玩家的旧存档会带着非法数据进入 `renderRelics` 之类的路径（见 8.2-4）。
- [ ] **i18n key**：新文案只写在 `ui.js` 里、忘了进 `zh-CN.js`；或者写了 key 但前缀不在 `i18n.test.mjs` 的白名单里。
- [ ] **同步登记表**：遗物要进 `RELICS` + `RELIC_PARAMS` + 文案 + 测试数量；天赋要进 `TALENTS` + 文案 + 帮助页四段 + 勋章网格列数。
- [ ] **CSS 断点与列数**：动 `.actionbar` 的按钮数、加常驻行时，`repeat(N, 1fr)` 与 `max-height:660/720/600` 三处断点必须一起改。
- [ ] **文档同步**：`docs/relics.md`、`docs/talents.md`、本文第 3 节与第 8 节。数值改完不改文档，下一任接手就会照着错数字调参。
