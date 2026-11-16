// 破砖深渊 — 纯逻辑层（无 DOM，可在 Node 中直接测试）
// 文案一律走 i18n：本文件只产出 key 与参数，不产出任何面向玩家的字串。
import { t as tr, ref } from './i18n.js';

export const COLS = 7;
export const ROWS = 9;
export const SIZE = COLS * ROWS;
export const MAX_FLOOR = 30;
export const BOSS_EVERY = 10;
export const SAVE_VERSION = 12;
export const isBossFloor = (f) => f % BOSS_EVERY === 0;
export const isFinalFloor = (f) => f >= MAX_FLOOR;

export const DIFFICULTIES = {
  easy: { id: 'easy', threat: 0.78, power: 0.82, loot: 1.35, hp: 38, gold: 25, potions: 2, flags: 4 },
  normal: { id: 'normal', threat: 1, power: 1, loot: 1, hp: 32, gold: 10, potions: 2, flags: 3 },
  hard: { id: 'hard', threat: 1.22, power: 1.1, loot: 0.8, hp: 28, gold: 0, potions: 2, flags: 2 },
};
export const difficultyName = (d) => tr('difficulty.' + d.id + '.name');
export const difficultyTag = (d) => tr('difficulty.' + d.id + '.tag');
export const difficultyDesc = (d) => tr('difficulty.' + d.id + '.desc');

// 两条构筑轴：推理流把「插对的旗」换成战力，体魄流把「生命上限」换成战力。
// 所有加成都是确定性的加减，预演数字仍然等于实际结算。
export const SHOP_ELIXIR_HP = 6;
export const SOLVE_DEF_CUT = 1;        // 识破基础收益：本层全体怪物防御 −1
export const SOLVE_FLAG_GOLD = 4;      // 每面插对的旗换 4 金币
export const SOLVE_PERFECT_XP = 15;    // 剩余威胁全部插旗（完美识破）的额外经验
export const RELIC_SIEGE_CAP = 4;      // 破阵：旗帜换防御削减的上限
export const RELIC_MORALE_CAP = 4;     // 夺气：旗帜换攻击削减的上限
export const RELIC_MIND_XP = 50;       // 全识：完美识破的额外经验
export const RELIC_MIND_DEF = 2;       // 全识：完美识破再削防御
export const RELIC_SURVEY_CAP = 4;     // 测绘师：卷轴探明威胁换攻击的上限
export const RELIC_VIGOR_STEP = 12;    // 血气方刚：每 12 点生命上限换 1 攻击
export const RELIC_RECOIL = 3;         // 反震甲：每次被反击反弹的伤害
export const STRATA_DEF = 1;           // 层岩誓约：每下行一层的防御成长
export const STRATA_HP = 3;            // 层岩誓约：每下行一层的生命上限成长

export const SHOP = [
  { id: 'potion', icon: 'potion', base: 30, step: 12 },
  { id: 'whet', icon: 'sword', base: 30, step: 14 },
  { id: 'plate', icon: 'shield', base: 30, step: 16 },
  { id: 'elixir', icon: 'flask', base: 45, step: 18 },
  { id: 'pouch', icon: 'flag', base: 25, step: 10 },
  { id: 'scroll', icon: 'scroll', base: 22, step: 6 },
  { id: 'bomb', icon: 'bomb', base: 40, step: 10 },
];
const SHOP_PARAMS = { elixir: { hp: SHOP_ELIXIR_HP } };
export const shopName = (it) => tr('shop.' + it.id + '.name');
export const shopDesc = (it) => tr('shop.' + it.id + '.desc', SHOP_PARAMS[it.id]);

// period＝这只怪自己的骚扰间隔（按操作回合数）。快而弱的咬得勤，慢而重的憋得久，
// 于是「先杀谁」不再只是比伤害大小，而是比谁的节奏更迫近。
// 间隔取 38～58 而非个位数：每只怪各自出手，总压力随惊扰数量叠加，调短会让胜率崩掉。
const BESTIARY = [
  { id: 'bat', icon: 'bat', hp: 0.7, atk: 1.15, def: 0, min: 1, max: 3, period: 38 },
  { id: 'slime', icon: 'slime', hp: 1.35, atk: 0.78, def: 0, min: 1, max: 4, period: 52 },
  { id: 'skeleton', icon: 'skeleton', hp: 1, atk: 1, def: 1, min: 2, max: 6, period: 45 },
  { id: 'spider', icon: 'spider', hp: 0.85, atk: 1.28, def: 0, min: 3, max: 7, period: 40 },
  { id: 'orc', icon: 'orc', hp: 1.12, atk: 1.18, def: 1, min: 4, max: 8, period: 48 },
  { id: 'golem', icon: 'golem', hp: 1.55, atk: 0.9, def: 3, min: 5, max: 8, period: 58 },
  { id: 'wraith', icon: 'wraith', hp: 0.92, atk: 1.12, def: 4, min: 6, max: 8, period: 42 },
];

export const floorName = (f) => tr('floor.' + f);
export const mobName = (m) => tr('mob.' + m.id + '.name');
export const mobFlavor = (m) => tr('mob.' + m.id + '.flavor');

// ---------- 遗物 ----------
// 设计红线：遗物只改变「代价与收益」，不改变「信息量」——不自动标雷、不透视威胁，
// 战斗全程保持确定性（无命中 / 暴击 / 浮动），预演数字永远等于实际结算。
export const RELIC_RARITY = {
  common: { weight: 60, color: '#8fd8ff' },
  rare: { weight: 30, color: '#c9a3ff' },
  epic: { weight: 10, color: '#ffd54a' },
};
export const RELIC_CATS = ['explore', 'combat', 'supply', 'pact'];
export const rarityName = (id) => tr('rarity.' + id);
export const catName = (id) => tr('cat.' + id);
export const RELIC_DRAW_COUNT = 3;
// 一局能拿到的遗物必须远少于池子，构筑才有取舍。守卫每 2 层才掉一次，龙王另给一次。
export const RELIC_EVERY = 2;
export const isRelicFloor = (f) => !isBossFloor(f) && f % RELIC_EVERY === 0;
export const RELIC_WHET_CAP = 6;
export const RELIC_BANNER_CAP = 12;
export const RELIC_WARD_CHARGES = 3;
export const RELIC_FLAG_BONUS = 3;
export const ALTAR_FLAG_BONUS = 2;
export const RELIC_TALLY_XP = 5;        // 结绳：每面插对的旗换经验
export const RELIC_TRAP_FLAG_GOLD = 8;  // 拾荒爪：每面插对的陷阱换金币
export const RELIC_CHRONICLE_HEAL = 0.15; // 编年史：完美识破回复生命上限的 15%
export const RELIC_HEART_GAIN = 2;      // 噬心：每次击杀的生命上限成长
export const RELIC_HEART_CAP = 10;      // 噬心：击杀累积的次数上限
export const RELIC_PAINT_ATK = 2;       // 战纹：攻击加成
export const RELIC_PAINT_DEF = 1;       // 战纹：防御代价
export const RELIC_RATION_HEAL = 0.07;  // 干粮：下行额外回复
export const RELIC_TORCH_GOLD = 15;     // 火把：炸弹清除目标的额外金币
export const RELIC_TORCH_SHOP = 0.5;    // 火把：炸弹售价倍率
export const RELIC_PLATE_STEP = 40;     // 骨甲：每 40 生命上限换 1 点固定减伤
export const RELIC_PLATE_CAP = 4;       // 骨甲：固定减伤上限
export const RELIC_VOW_HP = 30;         // 静默誓约：生命上限加成
export const RELIC_VOW_DEF = 3;         // 静默誓约：防御加成
export const RELIC_VOW_ATK = 2;         // 静默誓约：攻击代价
export const GREEDY_HEART_SHOP = 1.2;   // 贪婪之心：商店价格倍率

// 越深越容易遇到高品质遗物。权重随层数连续漂移：
// 第 1 层 60/30/10，第 30 层 30/45/30，中间平滑过渡。
export function relicRarityWeights(floor = 1) {
  const t = Math.max(0, Math.min(1, (floor - 1) / (MAX_FLOOR - 1)));
  return {
    common: RELIC_RARITY.common.weight * (1 - 0.5 * t),
    rare: RELIC_RARITY.rare.weight * (1 + 0.5 * t),
    epic: RELIC_RARITY.epic.weight * (1 + 2 * t),
  };
}

export const RELICS = [
  { id: 'spikeSoles', icon: 'boot', cat: 'explore', rarity: 'common' },
  { id: 'carefulStep', icon: 'hand', cat: 'explore', rarity: 'rare' },
  { id: 'trapSalvage', icon: 'coin', cat: 'explore', rarity: 'common' },
  { id: 'tally', icon: 'tally', cat: 'explore', rarity: 'common' },
  { id: 'blastWave', icon: 'bomb', cat: 'explore', rarity: 'rare' },
  { id: 'bannerLord', icon: 'flag', cat: 'explore', rarity: 'rare' },
  { id: 'bannerBearer', icon: 'flag', cat: 'explore', rarity: 'rare' },
  { id: 'cartographer', icon: 'scroll', cat: 'explore', rarity: 'rare' },
  { id: 'chronicle', icon: 'book', cat: 'explore', rarity: 'rare' },
  { id: 'perfectMind', icon: 'eye', cat: 'explore', rarity: 'epic' },

  { id: 'thornMail', icon: 'shield', cat: 'combat', rarity: 'common' },
  { id: 'dragonWard', icon: 'dragon', cat: 'combat', rarity: 'rare' },
  { id: 'guardianBane', icon: 'key', cat: 'combat', rarity: 'rare' },
  { id: 'vampiricEdge', icon: 'fang', cat: 'combat', rarity: 'common' },
  { id: 'heartEater', icon: 'fang', cat: 'combat', rarity: 'common' },
  { id: 'warPaint', icon: 'paint', cat: 'combat', rarity: 'rare' },
  { id: 'momentum', icon: 'sparkle', cat: 'combat', rarity: 'epic' },
  { id: 'bonePlate', icon: 'shield', cat: 'combat', rarity: 'epic' },
  { id: 'whetSoul', icon: 'sword', cat: 'combat', rarity: 'rare' },
  { id: 'siegeBreak', icon: 'sword', cat: 'combat', rarity: 'rare' },
  { id: 'moraleBreak', icon: 'fang', cat: 'combat', rarity: 'rare' },
  { id: 'recoilMail', icon: 'shield', cat: 'combat', rarity: 'rare' },
  { id: 'vigor', icon: 'heart', cat: 'combat', rarity: 'rare' },

  { id: 'ironStomach', icon: 'flask', cat: 'supply', rarity: 'common' },
  { id: 'alchemist', icon: 'potion', cat: 'supply', rarity: 'rare' },
  { id: 'mint', icon: 'coin', cat: 'supply', rarity: 'common' },
  { id: 'deepPockets', icon: 'chest', cat: 'supply', rarity: 'common' },
  { id: 'torch', icon: 'torch', cat: 'supply', rarity: 'common' },
  { id: 'altarGrace', icon: 'altar', cat: 'supply', rarity: 'rare' },
  { id: 'rations', icon: 'bread', cat: 'supply', rarity: 'rare' },
  { id: 'prospector', icon: 'eye', cat: 'supply', rarity: 'common' },

  { id: 'bloodPact', icon: 'heart', cat: 'pact', rarity: 'epic' },
  { id: 'glassCannon', icon: 'crown', cat: 'pact', rarity: 'epic' },
  { id: 'greedyHeart', icon: 'skull', cat: 'pact', rarity: 'rare' },
  { id: 'strataOath', icon: 'altar', cat: 'pact', rarity: 'epic' },
  { id: 'vow', icon: 'lock', cat: 'pact', rarity: 'epic' },
];

// 一局最多能拿到的遗物数：遗物层守卫 + 中途倒下的每一位龙王
export const RELIC_MAX_DRAWS = Array.from({ length: MAX_FLOOR }, (_, k) => k + 1)
  .filter(isRelicFloor).length + Math.floor((MAX_FLOOR - 1) / BOSS_EVERY);

// 描述里出现的平衡数字由这里注入，改数值不必改译文，翻译不必碰数字
const RELIC_PARAMS = {
  bannerBearer: { n: RELIC_FLAG_BONUS },
  cartographer: { cap: RELIC_SURVEY_CAP },
  perfectMind: { xp: RELIC_MIND_XP, def: RELIC_MIND_DEF },
  tally: { xp: RELIC_TALLY_XP },
  trapSalvage: { gold: RELIC_TRAP_FLAG_GOLD },
  chronicle: { pct: Math.round(RELIC_CHRONICLE_HEAL * 100) },
  whetSoul: { cap: RELIC_WHET_CAP },
  siegeBreak: { cap: RELIC_SIEGE_CAP },
  moraleBreak: { cap: RELIC_MORALE_CAP },
  recoilMail: { n: RELIC_RECOIL },
  vigor: { step: RELIC_VIGOR_STEP },
  heartEater: { gain: RELIC_HEART_GAIN, hp: RELIC_HEART_GAIN * RELIC_HEART_CAP },
  warPaint: { atk: RELIC_PAINT_ATK, def: RELIC_PAINT_DEF },
  bonePlate: { step: RELIC_PLATE_STEP, cap: RELIC_PLATE_CAP },
  torch: { gold: RELIC_TORCH_GOLD },
  rations: { pct: Math.round(RELIC_RATION_HEAL * 100) },
  strataOath: { def: STRATA_DEF, hp: STRATA_HP },
  vow: { hp: RELIC_VOW_HP, def: RELIC_VOW_DEF, atk: RELIC_VOW_ATK },
  greedyHeart: { pct: Math.round((GREEDY_HEART_SHOP - 1) * 100) },
};
export const relicName = (r) => tr('relic.' + r.id + '.name');
export const relicDesc = (r) => tr('relic.' + r.id + '.desc', RELIC_PARAMS[r.id]);
export const relicFlavor = (r) => tr('relic.' + r.id + '.flavor');

export const relicById = (id) => RELICS.find((r) => r.id === id);

// ---------- RNG ----------
function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- geometry ----------
export const idx = (x, y) => y * COLS + x;
export const xy = (i) => ({ x: i % COLS, y: Math.floor(i / COLS) });
export function neighbors(i) {
  const { x, y } = xy(i);
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) out.push(idx(nx, ny));
    }
  return out;
}
const isThreat = (t) => t.kind === 'monster' || t.kind === 'elite' || t.kind === 'trap' || t.kind === 'boss';
// 数字只统计「尚未探明」的威胁：探明或清除后数字会减小，快速展开因此始终可用
const liveHidden = (t) => isThreat(t) && !t.revealed;
function hiddenThreatCount(s, i) {
  return neighbors(i).reduce((a, j) => a + (liveHidden(s.tiles[j]) ? 1 : 0), 0);
}
export function recalc(s) {
  for (const t of s.tiles) t.n = hiddenThreatCount(s, t.i);
}

// ---------- combat math ----------
export const hitDamage = (atk, def) => Math.max(1, atk - def);
export function forecast(p, mob) {
  const deal = hitDamage(p.atk, mob.def);
  const T = p.thorns;
  // 反震跟着反击走：第 r 回合玩家打 deal，怪物若没死就反击一次并吃 T 点反震。
  // 于是它可能死在第 r 次挥剑，也可能死在第 r 次反击的反震上——后者玩家仍要挨这一口。
  // 两种死法取先到的那个，回合数因此是 ceil(hp/(deal+T))，而挨打次数要多算一次。
  const rounds = Math.ceil(mob.hp / (deal + T));
  const byThorns = T > 0 && rounds * deal + (rounds - 1) * T < mob.hp;
  const counters = rounds - 1 + (byThorns ? 1 : 0);
  const perHit = hitDamage(mob.atk, p.def);
  let take = counters * perHit;
  if (mob.elite || mob.boss) take *= p.eliteTakeMul;
  take = Math.max(0, Math.round(take * p.takeMul) - p.takeFlat);
  if (p.freeKill) take = 0;
  return { deal, rounds, counters, take, lethal: take >= p.hp, perHit };
}

// ---------- 惊扰 ----------
// 怪物是「可选 + 信息完全 + 结算确定」的，理性玩家永远只打打得过的仗，
// 于是怪物沦为路障而非威胁。惊扰给「不打它」加上代价。
// 每只怪有自己的间隔与倒计时，到点各自扑一口——压力因此随惊扰数量上升，
// 而「先杀谁」取决于谁的节奏更迫近、谁咬得更痛。时钟按操作推进而非真实时间：思考免费，标记也免费。
export function aggroDamage(p, mob) {
  let dmg = hitDamage(mob.atk, p.def) * BAL.aggroMul;
  if (mob.elite || mob.boss) dmg *= p.eliteTakeMul;
  return Math.max(1, Math.round(dmg * p.takeMul) - p.takeFlat);
}

// 插旗＝我已确认并规避它：被标记的怪物不再骚扰，倒计时也冻结，拔旗后从原处继续
const awakeMobs = (s) => s.tiles.filter((t) => t.mob && t.mob.hp > 0 && t.mob.awake && !t.flagged);

// 汇总只给「几只 / 最近一口还有几回合」，不给位置——未探明怪物的坐标仍要靠演绎。
export function aggroSummary(s) {
  const awake = awakeMobs(s);
  if (!awake.length) return null;
  let next = Infinity;
  for (const t of awake) next = Math.min(next, t.mob.cd ?? t.mob.period);
  return { count: awake.length, next };
}

function awaken(s, i) {
  for (const j of [i, ...neighbors(i)]) {
    const t = s.tiles[j];
    if (t.mob && t.mob.hp > 0 && !t.mob.awake) {
      t.mob.awake = true;
      if (t.mob.cd == null) t.mob.cd = t.mob.period;
    }
  }
}

function tickAggro(s, out) {
  if (s.status !== 'playing') return;
  for (const t of awakeMobs(s)) {
    const m = t.mob;
    if (m.cd == null) m.cd = m.period;
    if (--m.cd > 0) continue;
    m.cd = m.period;
    const dmg = aggroDamage(s.player, m);
    say(s, 'log.aggro.hit', { mob: ref('mob.' + m.id + '.name'), dmg }, 'bad');
    ev(out, 'aggro', { i: t.i, amount: dmg });
    hurt(s, dmg, out, 'mob', t.i, m.id);
    if (s.status !== 'playing') return;
  }
}

// ---------- creation ----------
export function createRun(difficulty = 'normal', seed = Date.now()) {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const s = {
    v: SAVE_VERSION,
    seed,
    rng: seed | 0,
    difficulty: d.id,
    status: 'playing',
    floor: 1,
    tiles: [],
    generated: false,
    player: { hp: d.hp, maxHp: d.hp, atk: 5, def: 1, lv: 1, xp: 0, xpNext: 12, gold: d.gold, potions: 2, bombs: 1, scrolls: 1, takeMul: 1, takeFlat: 0, eliteTakeMul: 1, freeKill: false, thorns: 0, atkBonus: 0 },
    bought: {},
    relics: [],
    relicChoices: null,
    relicState: { whet: 0, firstKill: false, trapWard: 0, survey: 0, heart: 0 },
    hasKey: false,
    stairsFound: false,
    stairsIndex: -1,
    bossDown: false,
    mode: 'explore',
    threatTotal: 0,
    flags: 0,
    flagBonus: 0,
    solved: false,
    solvedFlags: 0,
    defDebt: 0,
    pendingCombat: -1,
    pendingAltar: -1,
    stats: { kills: 0, revealed: 0, goldEarned: 0, damage: 0, turns: 0 },
    log: [],
    logId: 0,
  };
  buildFloor(s);
  say(s, 'log.enter', { n: 1, name: ref('floor.1') }, 'info');
  return s;
}

function blankTiles() {
  return Array.from({ length: SIZE }, (_, i) => ({
    i, kind: 'empty', revealed: false, flagged: false, n: 0, mob: null, used: false, chest: null,
  }));
}

export function buildFloor(s) {
  const d = DIFFICULTIES[s.difficulty];
  const f = s.floor;
  s.tiles = blankTiles();
  s.generated = false;
  s.hasKey = false;
  s.stairsFound = false;
  s.stairsIndex = -1;
  s.bossDown = false;
  s.flags = 0;
  s.solved = false;
  s.solvedFlags = 0;
  s.mode = 'explore';
  s.pendingCombat = -1;
  s.pendingAltar = -1;
  s.relicState.firstKill = false;
  // 祭坛「贪婪低语」借走的防御只借一层，下楼就还——代价是周转的，不是永久的
  if (s.defDebt > 0) {
    s.player.def += s.defDebt;
    say(s, 'log.debt.repay', { n: s.defDebt }, 'good');
    s.defDebt = 0;
  }
  syncRelicMods(s);
  s.plan = planFloor(s, f, d);
  s.threatTotal = s.plan.monsters + s.plan.traps + (s.plan.elite ? 1 : 0) + (s.plan.boss ? 1 : 0);
}

// 怪物强度按「深度」而非层号成长：前 8 层保持原始曲线，之后每两层折算一层。
// 若继续线性外推，第 30 层的怪物攻击会涨到八层的四倍，任何构筑都接不住。
const depthOf = (f) => (f <= 8 ? f : 8 + (f - 8) * 0.5);

function planFloor(s, f, d) {
  const boss = isBossFloor(f);
  // 63 格里要塞下整层内容：深层靠更狠的怪而不是更多怪施压，否则满盘都是威胁，数字就不再提供信息
  const monsters = Math.round(Math.min(20, Math.max(5, (6 + f * 1.3) * d.threat)) * (boss ? 0.7 : 1));
  const traps = Math.min(6, Math.max(1, Math.round((1 + f * 0.35) * d.threat)));
  const chests = Math.min(8, Math.max(2, Math.round((3 + f * 0.15) * d.loot)));
  const potions = Math.max(1, d.potions);
  return { monsters, traps, chests, potions, elite: boss || f < 2 ? 0 : 1, boss: boss ? 1 : 0, altar: f >= 2 ? 1 : 0, stairs: 1 };
}

export const BAL = {
  mobHp: 10, mobHpF: 4.4,
  mobAtk: 2.5, mobAtkF: 1.95,
  adapt: 0.5,            // 怪物随玩家强度自适应的比例
  refRounds: 2.0, refRoundsF: 0.14,
  refBurn: 0.055, refBurnF: 0.012,
  lvXp: 12, lvXpF: 10, lvHp: 6, lvAtk: 1, lvDefEvery: 3,
  potionPct: 0.3, prayPct: 0.45, descendPct: 0.05,
  trapBase: 5, trapF: 2.8,
  aggroMul: 0.25,
  bloodCost: 10, bloodAtk: 2,
  eliteCap: 0.9, bossCap: 0.95, shopWhet: 1, mobGold: 2, mobGoldF: 1, chestGold: 8, chestGoldF: 3,
};

function makeMob(s, f, d, type) {
  const pool = BESTIARY.filter((b) => f >= b.min && f <= b.max);
  const b = type === 'elite' ? { id: 'guardian', icon: 'guardian', hp: 1, atk: 1, def: 0, period: 52 }
    : type === 'boss' ? { id: 'dragon', icon: 'dragon', hp: 1, atk: 1, def: 0, period: 48 }
      : pick(s, pool.length ? pool : BESTIARY);
  const P = d.power;
  const p = s.player;
  const B = BAL;
  const depth = depthOf(f);
  const def = Math.floor(depth / 2) + b.def;
  const mix = (fixed, ref) => fixed * (1 - B.adapt) + ref * B.adapt;
  const deal = hitDamage(p.atk, def);
  // 自适应血量必须按 forecast 的同一份公式反推，否则反震省下的回合会被生成器原样加回去
  const hpRef = (deal + p.thorns) * (B.refRounds + B.refRoundsF * depth);
  const atkRef = p.def + p.maxHp * (B.refBurn + B.refBurnF * depth);
  let hp = Math.round(mix(B.mobHp + B.mobHpF * depth, hpRef) * b.hp * P);
  let atk = Math.round(mix(B.mobAtk + B.mobAtkF * depth, atkRef) * b.atk * P);
  let xp = Math.round((2 + 1.2 * f) * (b.hp + b.atk) / 2);
  let gold = Math.round((BAL.mobGold + BAL.mobGoldF * f) * d.loot);
  if (type === 'elite') { hp = Math.round(hp * 1.9); atk = Math.round(atk * 1.3); xp *= 3; gold = Math.round(gold * 3.2); }
  if (type === 'boss') { hp = Math.round(hp * 3.4); atk = Math.round(atk * 1.45); xp = 120; gold = 260; }
  const mob = { id: b.id, icon: b.icon, hp, maxHp: hp, atk, def, xp, gold, elite: type === 'elite', boss: type === 'boss', period: b.period, cd: null, awake: false };
  // 反锁死：钥匙守卫 / 龙王在生成时必须是「满血可胜」的。
  // 这里刻意忽略 freeKill——否则「势如破竹」会让守卫绕过上限生成，一旦首杀被小怪用掉就无解。
  if (type === 'elite' || type === 'boss') {
    const cap = Math.floor(p.maxHp * (type === 'boss' ? B.bossCap : B.eliteCap));
    const ref = { ...p, freeKill: false };
    let guard = 0;
    while (forecast(ref, mob).take > cap && guard++ < 80) {
      if (mob.atk > p.def + 1) mob.atk -= 1;
      else if (mob.hp > 4) mob.hp = Math.round(mob.hp * 0.9);
      else break;
      mob.maxHp = mob.hp;
    }
  }
  return mob;
}

export function ensureBoard(s, safeIndex) {
  if (s.generated) return;
  const d = DIFFICULTIES[s.difficulty];
  const f = s.floor;
  const p = s.plan;
  const safe = new Set([safeIndex, ...neighbors(safeIndex)]);
  const pool = shuffle(s, Array.from({ length: SIZE }, (_, i) => i).filter((i) => !safe.has(i)));

  const take = (pred) => {
    for (let k = 0; k < pool.length; k++) if (!pred || pred(pool[k])) return pool.splice(k, 1)[0];
    return pool.pop();
  };
  const far = (i) => { const a = xy(i), b = xy(safeIndex); return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 4; };

  if (p.stairs) { const i = take(far); s.tiles[i].kind = 'stairs'; s.stairsIndex = i; }
  if (p.boss) {
    const i = take(far), t = s.tiles[i];
    t.kind = 'boss';
    t.mob = makeMob(s, f, d, 'boss');
    // 龙王不藏在砖下：它是这一层的压力来源，生成即亮在棋盘上，并从第一步开始计时。
    // 现身不等于「已探明」以外的特权：它只是不再计入邻格数字，其余规则照旧。
    t.revealed = true;
    t.mob.awake = true;
    t.mob.cd = t.mob.period;
    say(s, 'log.boss.awake', { mob: ref('mob.' + t.mob.id + '.name'), period: t.mob.period }, 'bad');
  }
  if (p.elite) { const i = take(far); s.tiles[i].kind = 'elite'; s.tiles[i].mob = makeMob(s, f, d, 'elite'); }
  if (p.altar) s.tiles[take()].kind = 'altar';
  for (let k = 0; k < p.monsters; k++) { const i = take(); s.tiles[i].kind = 'monster'; s.tiles[i].mob = makeMob(s, f, d, 'monster'); }
  for (let k = 0; k < p.traps; k++) s.tiles[take()].kind = 'trap';
  for (let k = 0; k < p.chests; k++) { const i = take(); s.tiles[i].kind = 'chest'; s.tiles[i].chest = rollChest(s, f, d); }
  for (let k = 0; k < p.potions; k++) s.tiles[take()].kind = 'potion';

  recalc(s);
  s.generated = true;
}

function rollChest(s, f, d) {
  const p = s.player;
  const bag = ['gold', 'gold', 'potion', 'weapon', 'armor', 'scroll', 'bomb'];
  if (p.hp < p.maxHp * 0.45) bag.push('potion', 'potion');
  if (d.loot > 1) bag.push('potion', 'gold');
  const type = pick(s, bag);
  if (type === 'gold') return { type, amount: Math.round((BAL.chestGold + BAL.chestGoldF * f) * d.loot) + ri(s, 0, 6) };
  if (type === 'weapon') return { type, amount: 1 };
  if (type === 'armor') return { type, amount: 1 };
  return { type, amount: 1 };
}

// ---------- helpers ----------
// 日志存 key + 参数，不存译文：换语言、调数值都不必重新生成历史文本。
function say(s, key, params, tone = 'info') {
  if (typeof params === 'string') { tone = params; params = null; }
  s.log.push({ id: ++s.logId, k: key, p: params, tone });
  if (s.log.length > 40) s.log.shift();
}
const ev = (list, type, data = {}) => { list.push({ type, ...data }); return list; };

export function remainingThreats(s) {
  return s.tiles.filter((t) => isThreat(t) && !t.used && !(t.mob && t.mob.hp <= 0)).length;
}
// 旗子上限＝难度固定基数 + 事件投资，刻意与敌人数量脱钩：
// 旗子是稀缺资源，「插旗免骚扰」因此是要花钱买的决策，而不是每层免费发满。
export function flagCap(s) {
  return DIFFICULTIES[s.difficulty].flags + s.flagBonus;
}
// 剩余暗格全是威胁＝安全格已全部翻开，等价于扫雷已经解出。
// 这时还让怪物骚扰、还让玩家自己踩陷阱，是在惩罚一次成功的推理。
export function boardSolved(s) {
  return s.generated && s.tiles.every((t) => t.revealed || isThreat(t));
}

function revealSolved(s, out) {
  const hidden = s.tiles.filter((t) => !t.revealed && isThreat(t));
  if (!hidden.length) return;
  s.solved = true;
  // 暗格全是威胁，所以此刻插着的每一面旗都必然插对——先记账再收回，旗帜领主才不会因完美推理而少回血
  const flagged = s.tiles.filter((t) => t.flagged).map((t) => t.i);
  s.solvedFlags = s.flags;
  for (const t of s.tiles) t.flagged = false;
  s.flags = 0;
  for (const t of hidden) {
    t.revealed = true;
    s.stats.revealed++;
    if (t.kind === 'trap') { t.used = true; ev(out, 'disarm', { i: t.i }); }
    else ev(out, 'reveal', { i: t.i, kind: t.kind });
  }
  for (const t of s.tiles) if (t.mob) { t.mob.awake = false; t.mob.cd = null; }
  say(s, 'log.solved', { n: hidden.length }, 'magic');

  // 识破结算。棋盘此刻已经全亮，「插对了几面旗」不再是泄密信息，可以放心按它发奖。
  // 完美识破＝剩下的每一处威胁都被你插了旗，而不是漏标后被系统掀开。
  const correct = flagged.length;
  const trapFlags = hasRelic(s, 'trapSalvage') ? flagged.filter((i) => s.tiles[i].kind === 'trap').length : 0;
  const perfect = correct === hidden.length;
  let cutDef = SOLVE_DEF_CUT, cutAtk = 0;
  if (hasRelic(s, 'siegeBreak')) cutDef += Math.min(RELIC_SIEGE_CAP, correct);
  if (hasRelic(s, 'moraleBreak')) cutAtk += Math.min(RELIC_MORALE_CAP, correct);
  if (perfect && hasRelic(s, 'perfectMind')) cutDef += RELIC_MIND_DEF;
  for (const t of s.tiles) {
    const m = t.mob;
    if (!m || m.hp <= 0) continue;
    const d = Math.min(m.def, cutDef), a = Math.min(m.atk, cutAtk);
    if (!d && !a) continue;
    m.def -= d; m.atk -= a;
    m.cut = { def: d, atk: a };
  }
  const gold = correct || trapFlags ? addGold(s, correct * SOLVE_FLAG_GOLD + trapFlags * RELIC_TRAP_FLAG_GOLD, out) : 0;
  let xp = perfect ? SOLVE_PERFECT_XP : 0;
  if (perfect && hasRelic(s, 'perfectMind')) xp += RELIC_MIND_XP;
  if (correct && hasRelic(s, 'tally')) xp += correct * RELIC_TALLY_XP;
  if (xp) gainXp(s, xp, out);
  if (perfect && hasRelic(s, 'chronicle')) {
    const h = heal(s, Math.ceil(s.player.maxHp * RELIC_CHRONICLE_HEAL), out);
    say(s, 'log.chronicle', { hp: h }, 'good');
  }
  const gain = [];
  if (cutDef) gain.push(ref('log.solve.part.def', { n: cutDef }));
  if (cutAtk) gain.push(ref('log.solve.part.atk', { n: cutAtk }));
  if (gold) gain.push(ref('log.solve.part.gold', { n: gold }));
  if (xp) gain.push(ref('log.solve.part.xp', { n: xp }));
  say(s, perfect ? 'log.solve.reward.perfect' : 'log.solve.reward', { parts: gain }, 'good');
  // tiles/flagged 供 UI 逐格掀砖：状态已经一次性改完，动画只能靠这份名单回放
  ev(out, 'solved', { count: hidden.length, tiles: hidden.map((t) => t.i), flagged, perfect, cutDef, cutAtk, gold, xp });
}
export function shopPrice(s, id) {
  const item = SHOP.find((x) => x.id === id);
  const base = item.base + item.step * (s.bought[id] || 0);
  const mult = (hasRelic(s, 'deepPockets') ? 0.75 : 1)
    * (hasRelic(s, 'greedyHeart') ? GREEDY_HEART_SHOP : 1)
    * (id === 'bomb' && hasRelic(s, 'torch') ? RELIC_TORCH_SHOP : 1);
  return Math.max(1, Math.round(base * mult));
}

function gainXp(s, amount, out) {
  const p = s.player;
  const lv0 = p.lv;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.lv++;
    p.xpNext = BAL.lvXp + BAL.lvXpF * (p.lv - 1);
    p.maxHp += BAL.lvHp;
    p.hp = Math.min(p.maxHp, p.hp + BAL.lvHp);
    p.atk += BAL.lvAtk;
    if (p.lv % BAL.lvDefEvery === 0) p.def += 1;
    const defUp = p.lv % BAL.lvDefEvery === 0;
    say(s, defUp ? 'log.levelup.def' : 'log.levelup', { lv: p.lv, atk: BAL.lvAtk, hp: BAL.lvHp, def: 1 }, 'good');
    ev(out, 'levelup', { lv: p.lv });
  }
  // 生命上限长了，血气方刚的派生攻击要跟着长
  if (p.lv > lv0) syncRelicMods(s);
}

// source 用稳定枚举（mob / trap / blood）：UI 据它选音效，译文只在渲染时解析
function hurt(s, amount, out, source, at = -1, mobId = null) {
  const p = s.player;
  p.hp = Math.max(0, p.hp - amount);
  s.stats.damage += amount;
  ev(out, 'damage', { amount, source, at });
  if (p.hp <= 0) {
    s.status = 'dead';
    s.mode = 'explore';
    const cause = source === 'mob' && mobId ? ref('mob.' + mobId + '.name') : ref('source.' + source);
    say(s, 'log.death', { floor: s.floor, cause }, 'bad');
    ev(out, 'death', { floor: s.floor });
  }
  return amount;
}

function heal(s, amount, out) {
  const p = s.player;
  const real = Math.min(amount, p.maxHp - p.hp);
  p.hp += real;
  if (real > 0) ev(out, 'heal', { amount: real });
  return real;
}

function addGold(s, amount, out) {
  const real = Math.round(amount * (hasRelic(s, 'mint') ? 1.5 : 1));
  s.player.gold += real;
  s.stats.goldEarned += real;
  ev(out, 'gold', { amount: real });
  return real;
}

// ---------- reveal ----------
function lootChest(s, i, out) {
  const t = s.tiles[i], p = s.player;
  let type = t.chest.type, amount = t.chest.amount;
  t.used = true;
  if (hasRelic(s, 'greedyHeart')) {
    if (type === 'gold') amount *= 2;
  }
  if (type === 'gold') { const got = addGold(s, amount, out); say(s, 'log.chest.gold', { n: got }, 'good'); }
  else if (type === 'potion') { p.potions++; say(s, 'log.chest.potion', 'good'); ev(out, 'item', { item: 'potion' }); }
  else if (type === 'weapon') { p.atk += amount; say(s, 'log.chest.weapon', { n: amount }, 'good'); ev(out, 'item', { item: 'weapon' }); }
  else if (type === 'armor') { p.def += amount; say(s, 'log.chest.armor', { n: amount }, 'good'); ev(out, 'item', { item: 'armor' }); }
  else if (type === 'scroll') { p.scrolls++; say(s, 'log.chest.scroll', 'good'); ev(out, 'item', { item: 'scroll' }); }
  else { p.bombs++; say(s, 'log.chest.bomb', 'good'); ev(out, 'item', { item: 'bomb' }); }
  ev(out, 'loot', { i });
}

function pickPotion(s, i, out) {
  s.tiles[i].used = true;
  s.player.potions++;
  say(s, 'log.pickup.potion', 'good');
  ev(out, 'item', { item: 'potion' });
  ev(out, 'loot', { i });
}

function openTile(s, i, out, opts = {}) {
  const t = s.tiles[i];
  if (t.revealed) return;
  t.revealed = true;
  if (t.flagged) { t.flagged = false; s.flags--; }
  s.stats.revealed++;
  ev(out, 'reveal', { i, kind: t.kind });
  awaken(s, i);
  const p = s.player;

  if (t.kind === 'monster' || t.kind === 'elite' || t.kind === 'boss') {
    say(s, 'log.encounter', { mob: ref('mob.' + t.mob.id + '.name'), hp: t.mob.hp, atk: t.mob.atk }, t.kind === 'monster' ? 'warn' : 'bad');
    ev(out, 'encounter', { i });
    if (!opts.silent) s.pendingCombat = i;
    return;
  }
  if (t.kind === 'trap') {
    if (opts.safe) {
      t.used = true;
      say(s, 'log.trap.disarm', 'good');
      ev(out, 'disarm', { i });
    } else {
      t.used = true;
      let dmg = Math.max(2, Math.round(BAL.trapBase + BAL.trapF * depthOf(s.floor) - Math.floor(p.def / 2)));
      if (hasRelic(s, 'spikeSoles')) dmg = Math.max(1, Math.round(dmg * 0.7));
      if (s.relicState.trapWard > 0) {
        s.relicState.trapWard--;
        say(s, 'log.trap.ward', { n: s.relicState.trapWard }, 'good');
        ev(out, 'disarm', { i });
      } else {
        say(s, 'log.trap.hit', { dmg }, 'bad');
        hurt(s, dmg, out, 'trap', i);
      }
    }
    return;
  }
  if (t.kind === 'chest') {
    if (opts.silent) {
      say(s, 'log.discover.chest', 'good');
      ev(out, 'discover', { i, kind: 'chest' });
      return;
    }
    lootChest(s, i, out);
    return;
  }
  if (t.kind === 'potion') {
    if (opts.silent) {
      say(s, 'log.discover.potion', 'good');
      ev(out, 'discover', { i, kind: 'potion' });
      return;
    }
    pickPotion(s, i, out);
    return;
  }
  if (t.kind === 'altar') {
    say(s, 'log.discover.altar', 'magic');
    if (!opts.silent) s.pendingAltar = i;
    ev(out, 'altar', { i });
    return;
  }
  if (t.kind === 'stairs') {
    s.stairsFound = true;
    const key = isBossFloor(s.floor) ? 'log.discover.stairs.boss' : s.floor === 1 ? 'log.discover.stairs' : 'log.discover.stairs.locked';
    say(s, key, 'magic');
    ev(out, 'stairs', { i });
    return;
  }
  if (!opts.noFlood && hiddenThreatCount(s, i) === 0) flood(s, i, out, opts);
}

function flood(s, start, out, opts) {
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    for (const j of neighbors(cur)) {
      const t = s.tiles[j];
      if (t.revealed || t.flagged) continue;
      if (isThreat(t)) continue;
      openTile(s, j, out, { ...opts, silent: true });
      if (s.status !== 'playing') return;
      if (t.kind === 'empty' && hiddenThreatCount(s, j) === 0) stack.push(j);
    }
  }
}

// ---------- actions ----------
export function setMode(s, mode) {
  const out = [];
  if (s.status !== 'playing') return out;
  if (mode === 'bomb' && s.player.bombs <= 0) { say(s, 'log.no.bomb', 'warn'); return out; }
  if (mode === 'scroll' && s.player.scrolls <= 0) { say(s, 'log.no.scroll', 'warn'); return out; }
  s.mode = s.mode === mode && mode !== 'explore' ? 'explore' : mode;
  ev(out, 'mode', { mode: s.mode });
  return out;
}

export function toggleFlag(s, i) {
  const out = [];
  if (s.status !== 'playing') return out;
  const t = s.tiles[i];
  if (t.revealed) return out;
  // 上限是稀缺资源，拒绝时直接指出三条抬高上限的路，否则玩家只会觉得被卡住
  const cap = flagCap(s);
  if (!t.flagged && s.flags >= cap) {
    say(s, 'log.flag.limit', { cap }, 'warn');
    ev(out, 'flagLimit', { cap });
    return out;
  }
  t.flagged = !t.flagged;
  s.flags += t.flagged ? 1 : -1;
  ev(out, 'flag', { i, on: t.flagged });
  return out;
}

export function tapTile(s, i) {
  const r = tapInner(s, i);
  if (r.spent) s.stats.turns++;
  // 先判定识破再推进惊扰时钟：完成推理的那一次操作不该再挨一口
  finish(s, r.out);
  if (r.spent) tickAggro(s, r.out);
  return r.out;
}

// spent 表示这次操作是否推进惊扰时钟。标记、切换模式、查看预演、无效点击一律免费，
// 只有真正改变棋盘的操作才算一回合。
function tapInner(s, i) {
  const out = [];
  const free = { out, spent: false };
  if (s.status !== 'playing') return free;
  if (i < 0 || i >= SIZE) return free;
  const t = s.tiles[i];

  if (s.mode === 'flag') return { out: toggleFlag(s, i), spent: false };

  if (s.mode === 'bomb') {
    if (!t.revealed || !isThreat(t) || t.used) { say(s, 'log.bomb.invalid', 'warn'); return free; }
    s.player.bombs--;
    s.mode = 'explore';
    t.used = true;
    const wasMob = !!t.mob && t.mob.hp > 0;
    if (t.mob) t.mob.hp = 0;
    ev(out, 'bomb', { i });
    say(s, 'log.bomb.hit', { target: wasMob ? ref('mob.' + t.mob.id + '.name') : ref('tile.trap') }, 'magic');
    if (hasRelic(s, 'torch')) {
      const got = addGold(s, RELIC_TORCH_GOLD, out);
      say(s, 'log.torch', { gold: got }, 'good');
    }
    if (hasRelic(s, 'blastWave')) {
      let swept = 0;
      for (const j of neighbors(i)) {
        const nt = s.tiles[j];
        if (nt.kind !== 'trap' || nt.used) continue;
        if (nt.flagged) { nt.flagged = false; s.flags--; }
        nt.used = true; nt.revealed = true; swept++;
        ev(out, 'disarm', { i: j });
      }
      if (swept) say(s, 'log.bomb.wave', { n: swept }, 'magic');
    }
    if (t.kind === 'elite') {
      s.hasKey = true;
      say(s, 'log.bomb.key', 'good');
      ev(out, 'key', { i });
      if (isRelicFloor(s.floor)) offerRelics(s, out);
    }
    if (t.kind === 'boss') return { out: defeatBoss(s, out), spent: false };
    return { out, spent: true };
  }

  if (s.mode === 'scroll') {
    s.player.scrolls--;
    s.mode = 'explore';
    ev(out, 'scroll', { i });
    ensureBoard(s, i);
    const area = [i, ...neighbors(i)];
    const surveyed = area.filter((j) => !s.tiles[j].revealed && isThreat(s.tiles[j])).length;
    for (const j of area) openTile(s, j, out, { safe: true, silent: true, noFlood: true });
    say(s, 'log.scroll', 'magic');
    if (hasRelic(s, 'cartographer') && surveyed) {
      const add = Math.min(RELIC_SURVEY_CAP - s.relicState.survey, surveyed);
      if (add > 0) {
        s.relicState.survey += add;
        s.player.atk += add;
        say(s, 'log.survey', { n: surveyed, add, have: s.relicState.survey, cap: RELIC_SURVEY_CAP }, 'magic');
      }
    }
    return { out, spent: true };
  }

  // 插旗格可以直接点开：旗子只挡批量展开，不挡主动开战，避免「免疫却打不了」的互锁。
  // 对所有插旗格一视同仁，不根据格内类型给不同反馈，否则点一下就能白嫖「是不是怪物」的信息。
  if (!t.revealed) {
    ensureBoard(s, i);
    openTile(s, i, out);
    return { out, spent: true };
  }

  // 已探明格
  if ((t.kind === 'monster' || t.kind === 'elite' || t.kind === 'boss') && t.mob.hp > 0) {
    s.pendingCombat = i;
    ev(out, 'encounter', { i });
    return free;
  }
  if (t.kind === 'altar' && !t.used) { s.pendingAltar = i; ev(out, 'altar', { i }); return free; }
  if (t.kind === 'chest' && !t.used) { lootChest(s, i, out); return { out, spent: true }; }
  if (t.kind === 'potion' && !t.used) { pickPotion(s, i, out); return { out, spent: true }; }
  if (t.kind === 'stairs') return { out: out.concat(tryDescend(s)), spent: false };
  // 能走到这里的都是空地或占用已失效的格子，数字同样支持双击展开
  if (t.n > 0) {
    const before = s.stats.revealed;
    const co = chord(s, i);
    return { out: out.concat(co), spent: s.stats.revealed > before };
  }
  return free;
}

function finish(s, out) {
  if (s.status === 'playing' && !s.solved && boardSolved(s)) revealSolved(s, out);
  recalc(s);
  return out;
}

export function chord(s, i) {
  const out = [];
  const t = s.tiles[i];
  const nb = neighbors(i);
  const flagged = nb.filter((j) => s.tiles[j].flagged).length;
  const hidden = nb.filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged);
  if (!hidden.length) return out;
  if (flagged !== t.n) {
    say(s, 'log.chord.mismatch', { n: t.n, flagged }, 'warn');
    ev(out, 'chordHint', { i, need: t.n, flagged });
    return out;
  }
  ev(out, 'chord', { i });
  for (const j of hidden) {
    if (s.status !== 'playing') break;
    openTile(s, j, out, { silent: true });
  }
  return finish(s, out);
}

export function attack(s, i) {
  const out = [];
  if (s.status !== 'playing') return out;
  const t = s.tiles[i];
  if (!t || !t.mob || t.mob.hp <= 0) return out;
  const p = s.player;
  const f = forecast(p, t.mob);
  s.pendingCombat = -1;
  if (f.lethal) { say(s, 'log.attack.lethal', 'bad'); ev(out, 'blocked', { i }); return out; }
  s.stats.turns++;
  ev(out, 'combat', { i, rounds: f.rounds, take: f.take, deal: f.deal });
  if (f.take > 0) hurt(s, f.take, out, 'mob', i, t.mob.id);
  if (s.status !== 'playing') return out;
  t.mob.hp = 0;
  t.used = true;
  s.stats.kills++;
  say(s, 'log.kill', { mob: ref('mob.' + t.mob.id + '.name'), rounds: f.rounds, take: f.take, xp: t.mob.xp }, 'good');
  ev(out, 'kill', { i, mob: t.mob });
  addGold(s, t.mob.gold, out);
  gainXp(s, t.mob.xp, out);
  if (hasRelic(s, 'momentum') && !s.relicState.firstKill) { s.relicState.firstKill = true; syncRelicMods(s); }
  if (hasRelic(s, 'vampiricEdge')) heal(s, 4, out);
  if (hasRelic(s, 'heartEater') && s.relicState.heart < RELIC_HEART_CAP) {
    s.relicState.heart++;
    p.maxHp += RELIC_HEART_GAIN;
    p.hp = Math.min(p.maxHp, p.hp + RELIC_HEART_GAIN);
    syncRelicMods(s);
    say(s, 'log.hearteater', { gain: RELIC_HEART_GAIN, have: s.relicState.heart, cap: RELIC_HEART_CAP }, 'magic');
  }
  if (hasRelic(s, 'whetSoul') && s.relicState.whet < RELIC_WHET_CAP) {
    s.relicState.whet++;
    p.atk += 1;
    say(s, 'log.whet', { have: s.relicState.whet, cap: RELIC_WHET_CAP }, 'magic');
  }
  if (t.kind === 'elite') {
    s.hasKey = true;
    say(s, 'log.key', 'magic');
    ev(out, 'key', { i });
    if (isRelicFloor(s.floor)) offerRelics(s, out);
  }
  if (t.kind === 'boss') {
    const beaten = defeatBoss(s, out);
    if (s.status !== 'playing') return beaten;
    tickAggro(s, beaten);
    return finish(s, beaten);
  }
  tickAggro(s, out);
  return finish(s, out);
}

export function closePending(s) {
  s.pendingCombat = -1;
  s.pendingAltar = -1;
  return [];
}

export function usePotion(s) {
  const out = [];
  if (s.status !== 'playing') return out;
  const p = s.player;
  if (p.potions <= 0) { say(s, 'log.no.potion', 'warn'); return out; }
  if (p.hp >= p.maxHp) { say(s, 'log.hp.full', 'warn'); return out; }
  p.potions--;
  const pct = hasRelic(s, 'ironStomach') ? 0.38 : BAL.potionPct;
  const amount = heal(s, Math.ceil(p.maxHp * pct), out);
  say(s, 'log.potion', { n: amount }, 'good');
  return out;
}

export function buy(s, id) {
  const out = [];
  if (s.status !== 'playing') return out;
  const item = SHOP.find((x) => x.id === id);
  if (!item) return out;
  const price = shopPrice(s, id);
  if (s.player.gold < price) { say(s, 'log.no.gold', 'warn'); ev(out, 'deny'); return out; }
  s.player.gold -= price;
  s.bought[id] = (s.bought[id] || 0) + 1;
  const p = s.player;
  if (id === 'potion') p.potions++;
  if (id === 'whet') p.atk += BAL.shopWhet;
  if (id === 'plate') p.def += 1;
  if (id === 'elixir') { p.maxHp += SHOP_ELIXIR_HP; heal(s, SHOP_ELIXIR_HP, out); syncRelicMods(s); }
  if (id === 'pouch') s.flagBonus += 1;
  if (id === 'scroll') p.scrolls++;
  if (id === 'bomb') p.bombs++;
  say(s, 'log.buy', { item: ref('shop.' + item.id + '.name'), price }, 'good');
  ev(out, 'buy', { id, price });
  return out;
}

export const ALTAR_GREED_GOLD = 45;
export const ALTAR_OPTIONS = [
  { id: 'blood', icon: 'sword' },
  { id: 'pray', icon: 'heart' },
  { id: 'greed', icon: 'coin' },
  { id: 'banner', icon: 'flag' },
];
const ALTAR_PARAMS = {
  blood: { hp: BAL.bloodCost, atk: BAL.bloodAtk },
  pray: { pct: Math.round(BAL.prayPct * 100) },
  greed: { gold: ALTAR_GREED_GOLD },
  banner: { n: ALTAR_FLAG_BONUS },
};
export const altarName = (o) => tr('altar.' + o.id + '.name');
export const altarDesc = (o) => tr('altar.' + o.id + '.desc', ALTAR_PARAMS[o.id]);
export const altarWhy = (id) => tr('altar.why.' + id);

export function altarChoose(s, i, choice) {
  const out = [];
  if (s.status !== 'playing') return out;
  const t = s.tiles[i];
  if (!t || t.kind !== 'altar' || t.used) return out;
  const p = s.player;
  if (choice === 'blood' && p.hp <= BAL.bloodCost) { say(s, 'log.altar.no.blood', 'warn'); return out; }
  if (choice === 'greed' && p.def <= 0) { say(s, 'log.altar.no.def', 'warn'); return out; }
  t.used = true;
  s.pendingAltar = -1;
  if (choice === 'blood') {
    hurt(s, BAL.bloodCost, out, 'blood');
    if (s.status !== 'playing') return out;
    p.atk += BAL.bloodAtk;
    say(s, 'log.altar.blood', { n: BAL.bloodAtk }, 'magic');
  } else if (choice === 'pray') {
    const pct = hasRelic(s, 'altarGrace') ? 0.75 : BAL.prayPct;
    const h = heal(s, Math.ceil(p.maxHp * pct), out);
    say(s, 'log.altar.pray', { n: h }, 'good');
  } else if (choice === 'banner') {
    s.flagBonus += ALTAR_FLAG_BONUS;
    say(s, 'log.altar.banner', { cap: flagCap(s) }, 'magic');
  } else {
    const got = addGold(s, ALTAR_GREED_GOLD, out);
    p.def -= 1;
    s.defDebt += 1;
    say(s, 'log.altar.greed', { gold: got }, 'magic');
  }
  ev(out, 'altarUsed', { i, choice });
  return out;
}

export function canDescend(s) {
  if (s.status !== 'playing' || !s.stairsFound) return false;
  // Boss 层的封印由龙王本尊镇着，不需要钥匙；其余层照旧要钥匙守卫的锈蚀钥匙
  if (isBossFloor(s.floor)) return s.bossDown;
  return s.floor === 1 || s.hasKey;
}

export function tryDescend(s) {
  const out = [];
  if (s.status !== 'playing') return out;
  if (!s.stairsFound) { say(s, 'log.no.stairs', 'warn'); return out; }
  if (isBossFloor(s.floor) && !s.bossDown) { say(s, 'log.stairs.boss', 'warn'); ev(out, 'locked', { boss: true }); return out; }
  if (!isBossFloor(s.floor) && s.floor > 1 && !s.hasKey) { say(s, 'log.stairs.locked', 'warn'); ev(out, 'locked'); return out; }
  const bonus = addGold(s, (10 + s.floor * 3) * (hasRelic(s, 'prospector') ? 2 : 1), out);
  heal(s, Math.ceil(s.player.maxHp * BAL.descendPct), out);
  if (hasRelic(s, 'rations')) {
    const h = heal(s, Math.ceil(s.player.maxHp * RELIC_RATION_HEAL), out);
    say(s, 'log.rations', { hp: h }, 'good');
  }
  if (hasRelic(s, 'bannerLord')) {
    const correct = s.solvedFlags + s.tiles.filter((t) => t.flagged && !t.revealed && isThreat(t)).length;
    if (correct) {
      const h = heal(s, Math.min(RELIC_BANNER_CAP, correct * 2), out);
      say(s, 'log.bannerlord', { n: correct, hp: h }, 'good');
    }
  }
  if (hasRelic(s, 'alchemist') && s.floor % 2 === 0) { s.player.potions++; say(s, 'log.alchemist', 'good'); ev(out, 'item', { item: 'potion' }); }
  if (hasRelic(s, 'strataOath')) {
    s.player.def += STRATA_DEF;
    s.player.maxHp += STRATA_HP;
    heal(s, STRATA_HP, out);
    syncRelicMods(s);
    say(s, 'log.strata', { def: STRATA_DEF, hp: STRATA_HP }, 'magic');
  }
  s.floor++;
  buildFloor(s);
  say(s, 'log.descend', { n: s.floor, name: ref('floor.' + s.floor), gold: bonus }, 'magic');
  ev(out, 'descend', { floor: s.floor });
  return out;
}

function defeatBoss(s, out) {
  if (isFinalFloor(s.floor)) return out.concat(winRun(s));
  s.bossDown = true;
  say(s, 'log.boss.down', { mob: ref('mob.dragon.name') }, 'good');
  ev(out, 'bossDown', { floor: s.floor });
  offerRelics(s, out);
  return out;
}

function winRun(s) {
  s.status = 'won';
  say(s, 'log.win', 'good');
  return ev([], 'win', { floor: s.floor });
}

// ---------- 遗物抽取 ----------
export const hasRelic = (s, id) => s.relics.includes(id);

// 战斗修正全部落在 player 上，forecast 因此无需知道遗物系统的存在，
// 预演 / 结算 / 生成时的反锁死校验读到的永远是同一份数字。
function syncRelicMods(s) {
  const p = s.player;
  p.takeMul = (hasRelic(s, 'dragonWard') ? 0.75 : 1) * (hasRelic(s, 'glassCannon') ? 1.35 : 1);
  p.takeFlat = (hasRelic(s, 'thornMail') ? 2 : 0)
    + (hasRelic(s, 'bonePlate') ? Math.min(RELIC_PLATE_CAP, Math.floor(p.maxHp / RELIC_PLATE_STEP)) : 0);
  p.eliteTakeMul = hasRelic(s, 'guardianBane') ? 0.6 : 1;
  p.freeKill = hasRelic(s, 'momentum') && !s.relicState.firstKill;
  p.thorns = hasRelic(s, 'recoilMail') ? RELIC_RECOIL : 0;
  // 血气方刚是派生值：按 maxHp 重算目标加成，只写回差额，重复同步才不会越叠越多
  const want = hasRelic(s, 'vigor') ? Math.floor(p.maxHp / RELIC_VIGOR_STEP) : 0;
  p.atk += want - p.atkBonus;
  p.atkBonus = want;
}

function takeWeighted(s, pool, weights) {
  const total = pool.reduce((a, r) => a + weights[r.rarity], 0);
  let x = rand(s) * total, k = 0;
  while (k < pool.length - 1 && x >= weights[pool[k].rarity]) { x -= weights[pool[k].rarity]; k++; }
  return pool.splice(k, 1)[0];
}

function rollRelicChoices(s) {
  const pool = RELICS.filter((r) => !hasRelic(s, r.id));
  const weights = relicRarityWeights(s.floor);
  const out = [];
  while (out.length < RELIC_DRAW_COUNT && pool.length) out.push(takeWeighted(s, pool, weights).id);
  return out;
}

export function offerRelics(s, out) {
  const ids = rollRelicChoices(s);
  if (!ids.length) return out;
  s.relicChoices = ids;
  say(s, 'log.relic.offer', 'magic');
  return ev(out, 'relicOffer', { ids });
}

export function chooseRelic(s, id) {
  const out = [];
  if (s.status !== 'playing' || !s.relicChoices || !s.relicChoices.includes(id)) return out;
  s.relicChoices = null;
  const p = s.player;
  s.relics.push(id);
  if (id === 'bloodPact') { p.atk += 4; p.maxHp = Math.max(8, p.maxHp - 8); p.hp = Math.min(p.hp, p.maxHp); }
  if (id === 'glassCannon') p.atk += 6;
  if (id === 'warPaint') { p.atk += RELIC_PAINT_ATK; p.def = Math.max(0, p.def - RELIC_PAINT_DEF); }
  if (id === 'vow') {
    p.maxHp += RELIC_VOW_HP;
    p.hp = Math.min(p.maxHp, p.hp + RELIC_VOW_HP);
    p.def += RELIC_VOW_DEF;
    p.atk = Math.max(1, p.atk - RELIC_VOW_ATK);
  }
  if (id === 'carefulStep') s.relicState.trapWard = RELIC_WARD_CHARGES;
  if (id === 'bannerBearer') s.flagBonus += RELIC_FLAG_BONUS;
  syncRelicMods(s);
  const r = relicById(id);
  say(s, 'log.relic.gain', { name: ref('relic.' + r.id + '.name'), desc: ref('relic.' + r.id + '.desc', RELIC_PARAMS[r.id]) }, 'magic');
  return ev(out, 'relicGain', { id });
}

// ---------- persistence ----------
export function serialize(s) { return JSON.stringify(s); }
export function deserialize(text) {
  try {
    const s = JSON.parse(text);
    if (!s || s.v !== SAVE_VERSION || !Array.isArray(s.tiles) || s.tiles.length !== SIZE) return null;
    if (!DIFFICULTIES[s.difficulty] || !s.player) return null;
    return s;
  } catch { return null; }
}

export function tileLabel(t) {
  if (!t.revealed) return tr(t.flagged ? 'tile.flagged' : 'tile.hidden');
  if (t.mob && t.mob.hp > 0) {
    const name = ref('mob.' + t.mob.id + '.name');
    return t.mob.awake && t.mob.cd != null ? tr('tile.mob.aggro', { name, cd: t.mob.cd }) : tr('tile.mob', { name });
  }
  if (t.kind === 'stairs') return t.n ? tr('tile.stairs.danger', { n: t.n }) : tr('tile.stairs');
  const name = t.mob ? tr('tile.mob.cleared', { name: ref('mob.' + t.mob.id + '.name') })
    : t.kind === 'trap' ? tr(t.used ? 'tile.trap.used' : 'tile.trap')
    : t.kind === 'altar' ? tr(t.used ? 'tile.altar.used' : 'tile.altar')
    : t.kind === 'chest' ? tr(t.used ? 'tile.chest.used' : 'tile.chest')
    : t.kind === 'potion' ? tr(t.used ? 'tile.potion.used' : 'tile.potion')
    : null;
  if (name == null) return t.n ? tr('tile.danger', { n: t.n }) : tr('tile.empty');
  const spent = t.mob ? t.mob.hp <= 0 : t.used;
  return spent && t.n ? tr('tile.spent.danger', { name, n: t.n }) : name;
}