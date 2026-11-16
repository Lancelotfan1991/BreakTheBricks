// 破砖深渊 — 纯逻辑层（无 DOM，可在 Node 中直接测试）
export const COLS = 7;
export const ROWS = 9;
export const SIZE = COLS * ROWS;
export const MAX_FLOOR = 8;
export const SAVE_VERSION = 9;

export const DIFFICULTIES = {
  easy: { id: 'easy', name: '地窖', tag: '轻松', desc: '怪物孱弱 · 补给充裕', threat: 0.78, power: 0.82, loot: 1.35, hp: 38, gold: 25, potions: 2, flags: 4 },
  normal: { id: 'normal', name: '深渊', tag: '标准', desc: '标准的地牢体验', threat: 1, power: 1, loot: 1, hp: 32, gold: 10, potions: 2, flags: 3 },
  hard: { id: 'hard', name: '炼狱', tag: '噩梦', desc: '寸步难行 · 精英横行', threat: 1.22, power: 1.1, loot: 0.8, hp: 28, gold: 0, potions: 2, flags: 2 },
};

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
  { id: 'potion', name: '治疗药水', icon: 'potion', desc: '恢复 30% 最大生命', base: 30, step: 12 },
  { id: 'whet', name: '磨刀石', icon: 'sword', desc: '永久 +1 攻击', base: 30, step: 14 },
  { id: 'plate', name: '铁甲片', icon: 'shield', desc: '永久 +1 防御', base: 30, step: 16 },
  { id: 'elixir', name: '生命精粹', icon: 'flask', desc: `永久 +${SHOP_ELIXIR_HP} 生命上限并立即恢复`, base: 45, step: 18 },
  { id: 'pouch', name: '旗囊', icon: 'flag', desc: '永久 +1 旗子上限', base: 25, step: 10 },
  { id: 'scroll', name: '侦查卷轴', icon: 'scroll', desc: '安全探明 3×3 区域', base: 22, step: 6 },
  { id: 'bomb', name: '裂石炸弹', icon: 'bomb', desc: '无伤摧毁一个威胁', base: 40, step: 10 },
];

// period＝这只怪自己的骚扰间隔（按操作回合数）。快而弱的咬得勤，慢而重的憋得久，
// 于是「先杀谁」不再只是比伤害大小，而是比谁的节奏更迫近。
// 间隔取 38～58 而非个位数：每只怪各自出手，总压力随惊扰数量叠加，调短会让胜率崩掉。
const BESTIARY = [
  { id: 'bat', name: '洞穴蝠', icon: 'bat', hp: 0.7, atk: 1.15, def: 0, min: 1, max: 3, period: 38, flavor: '尖啸着俯冲，脆弱却迅捷。' },
  { id: 'slime', name: '腐黏怪', icon: 'slime', hp: 1.35, atk: 0.78, def: 0, min: 1, max: 4, period: 52, flavor: '吞下了太多冒险者的铁器。' },
  { id: 'skeleton', name: '骸骨兵', icon: 'skeleton', hp: 1, atk: 1, def: 1, min: 2, max: 6, period: 45, flavor: '锈剑仍在执行千年前的军令。' },
  { id: 'spider', name: '织网蛛', icon: 'spider', hp: 0.85, atk: 1.28, def: 0, min: 3, max: 7, period: 40, flavor: '毒牙比石壁上的裂缝更细。' },
  { id: 'orc', name: '穴居兽人', icon: 'orc', hp: 1.12, atk: 1.18, def: 1, min: 4, max: 8, period: 48, flavor: '它把守这条路，只是为了晚饭。' },
  { id: 'golem', name: '石像鬼', icon: 'golem', hp: 1.55, atk: 0.9, def: 3, min: 5, max: 8, period: 58, flavor: '砖石本身站了起来。' },
  { id: 'wraith', name: '深渊怨灵', icon: 'wraith', hp: 0.92, atk: 1.12, def: 4, min: 6, max: 8, period: 42, flavor: '寒气穿过甲胄，直接啃咬骨头。' },
];

export const FLOOR_NAMES = ['', '苔痕门厅', '锈铁回廊', '蛛丝墓室', '兽骨仓窖', '熔渣锻层', '石像长廊', '哀嚎深井', '深渊王座'];

// ---------- 遗物 ----------
// 设计红线：遗物只改变「代价与收益」，不改变「信息量」——不自动标雷、不透视威胁，
// 战斗全程保持确定性（无命中 / 暴击 / 浮动），预演数字永远等于实际结算。
export const RELIC_RARITY = {
  common: { name: '普通', weight: 60, color: '#8fd8ff' },
  rare: { name: '稀有', weight: 30, color: '#c9a3ff' },
  epic: { name: '史诗', weight: 10, color: '#ffd54a' },
};
export const RELIC_CATS = { explore: '探索', combat: '战斗', supply: '补给', pact: '契约' };
export const RELIC_DRAW_COUNT = 3;
export const RELIC_WHET_CAP = 6;
export const RELIC_BANNER_CAP = 12;
export const RELIC_WARD_CHARGES = 3;
export const RELIC_FLAG_BONUS = 3;
export const ALTAR_FLAG_BONUS = 2;

export const RELICS = [
  { id: 'spikeSoles', name: '钉底靴', icon: 'boot', cat: 'explore', rarity: 'common', desc: '陷阱伤害降低 30%。', flavor: '靴底钉着前人的碎骨，踩下去反而稳。' },
  { id: 'carefulStep', name: '猫步', icon: 'hand', cat: 'explore', rarity: 'rare', desc: '获得后的 3 次踩中陷阱完全免伤。', flavor: '你听见了石板下那声极轻的咔哒。' },
  { id: 'trapSalvage', name: '拾荒爪', icon: 'coin', cat: 'explore', rarity: 'common', desc: '每次踩中陷阱额外捡到 10 金币。', flavor: '尖刺上总挂着几个没能走完的人的钱袋。' },
  { id: 'blastWave', name: '冲击波', icon: 'bomb', cat: 'explore', rarity: 'rare', desc: '炸弹同时摧毁目标周围 8 格的所有陷阱。', flavor: '砖石记得每一次爆炸的形状。' },
  { id: 'bannerLord', name: '旗帜领主', icon: 'flag', cat: 'explore', rarity: 'rare', desc: '下行时，每面插对的旗回复 2 生命（最多 12）。', flavor: '它只奖赏那些真正读懂了数字的人。' },
  { id: 'bannerBearer', name: '旗手纹章', icon: 'flag', cat: 'explore', rarity: 'rare', desc: `旗子上限永久 +${RELIC_FLAG_BONUS}。`, flavor: '纹章上的旗面比你的手臂还长，插下去就没人敢拔。' },
  { id: 'cartographer', name: '测绘师', icon: 'scroll', cat: 'explore', rarity: 'rare', desc: `卷轴每探明一处威胁，永久 +1 攻击（最多 +${RELIC_SURVEY_CAP}）。`, flavor: '把危险画进图里的人，刀也知道该往哪儿落。' },
  { id: 'perfectMind', name: '全识', icon: 'eye', cat: 'explore', rarity: 'epic', desc: `完美识破额外 +${RELIC_MIND_XP} 经验，怪物防御再 −${RELIC_MIND_DEF}。`, flavor: '一个格子都没猜错的时候，深渊会先眨眼睛。' },

  { id: 'thornMail', name: '荆棘甲', icon: 'shield', cat: 'combat', rarity: 'common', desc: '战斗承伤固定减少 2 点。', flavor: '甲片缝隙里长出了倒刺，先扎到的是敌人。' },
  { id: 'dragonWard', name: '龙鳞护符', icon: 'dragon', cat: 'combat', rarity: 'rare', desc: '战斗承伤减少 25%。', flavor: '一片幼龙的鳞，还留着体温。' },
  { id: 'guardianBane', name: '破守者', icon: 'key', cat: 'combat', rarity: 'rare', desc: '对钥匙守卫与龙王的承伤减少 40%。', flavor: '守门者的武艺，早被人拆解成了册子。' },
  { id: 'vampiricEdge', name: '吸血刃', icon: 'fang', cat: 'combat', rarity: 'common', desc: '每次击杀回复 4 生命。', flavor: '刃口有一道永不干涸的暗红细线。' },
  { id: 'momentum', name: '势如破竹', icon: 'sparkle', cat: 'combat', rarity: 'epic', desc: '每层第一次击杀不承受任何伤害。', flavor: '第一击总是最干净的，之后才轮到代价。' },
  { id: 'whetSoul', name: '磨刀之魂', icon: 'sword', cat: 'combat', rarity: 'rare', desc: `每次击杀永久 +1 攻击，最多叠加 ${RELIC_WHET_CAP} 次。`, flavor: '每一次挥砍都在替下一次开刃。' },
  { id: 'siegeBreak', name: '破阵', icon: 'sword', cat: 'combat', rarity: 'rare', desc: `识破时，每面插对的旗使本层怪物防御额外 −1（最多 −${RELIC_SIEGE_CAP}）。`, flavor: '旗插在哪里，阵就在哪里裂开。' },
  { id: 'moraleBreak', name: '夺气', icon: 'fang', cat: 'combat', rarity: 'rare', desc: `识破时，每面插对的旗使本层怪物攻击 −1（最多 −${RELIC_MORALE_CAP}）。`, flavor: '被看穿的怪物，连嘶吼都短了半截。' },
  { id: 'recoilMail', name: '反震甲', icon: 'shield', cat: 'combat', rarity: 'rare', desc: `战斗中每次被反击，反弹 ${RELIC_RECOIL} 点伤害。`, flavor: '它咬你一口，崩掉的是它自己的牙。' },
  { id: 'vigor', name: '血气方刚', icon: 'heart', cat: 'combat', rarity: 'rare', desc: `生命上限每 ${RELIC_VIGOR_STEP} 点，攻击 +1。`, flavor: '血越厚，拳越沉。' },

  { id: 'ironStomach', name: '铁胃', icon: 'flask', cat: 'supply', rarity: 'common', desc: '药水恢复量从 30% 提升到 38% 最大生命。', flavor: '连瓶塞一起嚼碎，药效才算完整。' },
  { id: 'alchemist', name: '炼金壶', icon: 'potion', cat: 'supply', rarity: 'rare', desc: '每下行两层额外获得 1 瓶药水。', flavor: '壶底永远剩着一口，摇一摇又满了。' },
  { id: 'mint', name: '铸币印', icon: 'coin', cat: 'supply', rarity: 'common', desc: '所有金币收入 +50%。', flavor: '凡经你手的金子，都会多出一枚影子。' },
  { id: 'deepPockets', name: '深口袋', icon: 'chest', cat: 'supply', rarity: 'common', desc: '商店价格降低 25%。', flavor: '商人数不清你掏出了多少，只好少收点。' },
  { id: 'altarGrace', name: '神恩', icon: 'altar', cat: 'supply', rarity: 'rare', desc: '祭坛「静默祈祷」恢复量从 45% 提升到 75%。', flavor: '石台上的紫火为你矮了一寸。' },
  { id: 'prospector', name: '探矿罗盘', icon: 'eye', cat: 'supply', rarity: 'common', desc: '下行的金币奖励翻倍。', flavor: '指针不指北，只指向还没被捡走的东西。' },

  { id: 'bloodPact', name: '血之契', icon: 'heart', cat: 'pact', rarity: 'epic', desc: '攻击 +4，但生命上限 −8。', flavor: '契约用你的血写成，也用你的血偿还。' },
  { id: 'glassCannon', name: '玻璃炮', icon: 'crown', cat: 'pact', rarity: 'epic', desc: '攻击 +6，但战斗承伤 +35%。', flavor: '通透、锋利、一碰就碎。' },
  { id: 'greedyHeart', name: '贪婪之心', icon: 'skull', cat: 'pact', rarity: 'rare', desc: '宝箱金币翻倍，但宝箱开出的药水变成 25 金币。', flavor: '它把一切能救命的东西都换算成了价钱。' },
  { id: 'strataOath', name: '层岩誓约', icon: 'altar', cat: 'pact', rarity: 'epic', desc: `每下行一层，永久 +${STRATA_DEF} 防御与 +${STRATA_HP} 生命上限。`, flavor: '石头记得每一个肯往下走的人。' },
];

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
    say(s, `${m.name}趁隙扑来，撕掉你 ${dmg} 点生命。`, 'bad');
    ev(out, 'aggro', { i: t.i, amount: dmg });
    hurt(s, dmg, out, m.name, t.i);
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
    relicState: { whet: 0, firstKill: false, trapWard: 0, survey: 0 },
    hasKey: false,
    stairsFound: false,
    stairsIndex: -1,
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
  say(s, `踏入第 1 层 · ${FLOOR_NAMES[1]}。点击任意砖块开始探索。`, 'info');
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
    say(s, `祭坛借走的甲胄回来了：防御 +${s.defDebt}。`, 'good');
    s.defDebt = 0;
  }
  syncRelicMods(s);
  s.plan = planFloor(s, f, d);
  s.threatTotal = s.plan.monsters + s.plan.traps + (s.plan.elite ? 1 : 0) + (s.plan.boss ? 1 : 0);
}

function planFloor(s, f, d) {
  const final = f >= MAX_FLOOR;
  const monsters = Math.max(5, Math.round((6 + f * 1.3) * d.threat));
  const traps = Math.max(1, Math.round((1 + f * 0.35) * d.threat));
  const chests = Math.max(2, Math.round((3 + (f % 2)) * d.loot));
  const potions = Math.max(1, d.potions);
  return { monsters, traps, chests, potions, elite: final ? 0 : f >= 2 ? 1 : 0, boss: final ? 1 : 0, altar: f >= 2 ? 1 : 0, stairs: final ? 0 : 1 };
}

export const BAL = {
  mobHp: 10, mobHpF: 4.4,
  mobAtk: 2.5, mobAtkF: 1.95,
  adapt: 0.5,            // 怪物随玩家强度自适应的比例
  refRounds: 2.0, refRoundsF: 0.14,
  refBurn: 0.055, refBurnF: 0.012,
  lvXp: 12, lvXpF: 10, lvHp: 4, lvAtk: 1, lvDefEvery: 3,
  potionPct: 0.3, prayPct: 0.45, descendPct: 0.05,
  trapBase: 4, trapF: 2.6,
  aggroMul: 0.25,
  bloodCost: 10, bloodAtk: 2,
  eliteCap: 0.9, bossCap: 0.95, shopWhet: 1, mobGold: 2, mobGoldF: 1, chestGold: 8, chestGoldF: 3,
};

function makeMob(s, f, d, type) {
  const pool = BESTIARY.filter((b) => f >= b.min && f <= b.max);
  const b = type === 'elite' ? { id: 'guardian', name: '钥匙守卫', icon: 'guardian', hp: 1, atk: 1, def: 0, period: 52, flavor: '它吞下了这一层的钥匙。' }
    : type === 'boss' ? { id: 'dragon', name: '深渊龙王', icon: 'dragon', hp: 1, atk: 1, def: 0, period: 48, flavor: '砖石深渊的心脏，正在缓慢跳动。' }
      : pick(s, pool.length ? pool : BESTIARY);
  const P = d.power;
  const p = s.player;
  const B = BAL;
  const def = Math.floor(f / 2) + b.def;
  const mix = (fixed, ref) => fixed * (1 - B.adapt) + ref * B.adapt;
  const deal = hitDamage(p.atk, def);
  // 自适应血量必须按 forecast 的同一份公式反推，否则反震省下的回合会被生成器原样加回去
  const hpRef = (deal + p.thorns) * (B.refRounds + B.refRoundsF * f);
  const atkRef = p.def + p.maxHp * (B.refBurn + B.refBurnF * f);
  let hp = Math.round(mix(B.mobHp + B.mobHpF * f, hpRef) * b.hp * P);
  let atk = Math.round(mix(B.mobAtk + B.mobAtkF * f, atkRef) * b.atk * P);
  let xp = Math.round((2 + 1.2 * f) * (b.hp + b.atk) / 2);
  let gold = Math.round((BAL.mobGold + BAL.mobGoldF * f) * d.loot);
  if (type === 'elite') { hp = Math.round(hp * 1.9); atk = Math.round(atk * 1.3); xp *= 3; gold = Math.round(gold * 3.2); }
  if (type === 'boss') { hp = Math.round(hp * 3.4); atk = Math.round(atk * 1.45); xp = 120; gold = 260; }
  const mob = { id: b.id, name: b.name, icon: b.icon, flavor: b.flavor, hp, maxHp: hp, atk, def, xp, gold, elite: type === 'elite', boss: type === 'boss', period: b.period, cd: null, awake: false };
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
  if (p.boss) { const i = take(far); s.tiles[i].kind = 'boss'; s.tiles[i].mob = makeMob(s, f, d, 'boss'); }
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
function say(s, text, tone = 'info') {
  s.log.push({ id: ++s.logId, text, tone });
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
  say(s, `本层解谜完成：${hidden.length} 处威胁全部揭示，旗帜已收回，它们不再骚扰你。`, 'magic');

  // 识破结算。棋盘此刻已经全亮，「插对了几面旗」不再是泄密信息，可以放心按它发奖。
  // 完美识破＝剩下的每一处威胁都被你插了旗，而不是漏标后被系统掀开。
  const correct = flagged.length;
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
  const gold = correct ? addGold(s, correct * SOLVE_FLAG_GOLD, out) : 0;
  let xp = perfect ? SOLVE_PERFECT_XP : 0;
  if (perfect && hasRelic(s, 'perfectMind')) xp += RELIC_MIND_XP;
  if (xp) gainXp(s, xp, out);
  const gain = [];
  if (cutDef) gain.push(`怪物防御 −${cutDef}`);
  if (cutAtk) gain.push(`怪物攻击 −${cutAtk}`);
  if (gold) gain.push(`+${gold} 金币`);
  if (xp) gain.push(`+${xp} 经验`);
  say(s, `识破奖励${perfect ? '（完美识破）' : ''}：${gain.join(' · ')}。`, 'good');
  // tiles/flagged 供 UI 逐格掀砖：状态已经一次性改完，动画只能靠这份名单回放
  ev(out, 'solved', { count: hidden.length, tiles: hidden.map((t) => t.i), flagged, perfect, cutDef, cutAtk, gold, xp });
}
export function shopPrice(s, id) {
  const item = SHOP.find((x) => x.id === id);
  const base = item.base + item.step * (s.bought[id] || 0);
  return Math.max(1, Math.round(base * (hasRelic(s, 'deepPockets') ? 0.75 : 1)));
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
    say(s, `等级提升！Lv.${p.lv} 攻击+1 生命上限+4${p.lv % BAL.lvDefEvery === 0 ? ' 防御+1' : ''}`, 'good');
    ev(out, 'levelup', { lv: p.lv });
  }
  // 生命上限长了，血气方刚的派生攻击要跟着长
  if (p.lv > lv0) syncRelicMods(s);
}

function hurt(s, amount, out, source, at = -1) {
  const p = s.player;
  p.hp = Math.max(0, p.hp - amount);
  s.stats.damage += amount;
  ev(out, 'damage', { amount, source, at });
  if (p.hp <= 0) {
    s.status = 'dead';
    s.mode = 'explore';
    say(s, `你倒在了第 ${s.floor} 层……${source || ''}`, 'bad');
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
    if (type === 'potion') { type = 'gold'; amount = 25; }
    else if (type === 'gold') amount *= 2;
  }
  if (type === 'gold') { const got = addGold(s, amount, out); say(s, `宝箱开启：${got} 金币。`, 'good'); }
  else if (type === 'potion') { p.potions++; say(s, '宝箱开启：治疗药水 ×1。', 'good'); ev(out, 'item', { item: 'potion' }); }
  else if (type === 'weapon') { p.atk += amount; say(s, `宝箱开启：附魔刃片，攻击 +${amount}！`, 'good'); ev(out, 'item', { item: 'weapon' }); }
  else if (type === 'armor') { p.def += amount; say(s, `宝箱开启：龙鳞甲片，防御 +${amount}！`, 'good'); ev(out, 'item', { item: 'armor' }); }
  else if (type === 'scroll') { p.scrolls++; say(s, '宝箱开启：侦查卷轴 ×1。', 'good'); ev(out, 'item', { item: 'scroll' }); }
  else { p.bombs++; say(s, '宝箱开启：裂石炸弹 ×1。', 'good'); ev(out, 'item', { item: 'bomb' }); }
  ev(out, 'loot', { i });
}

function pickPotion(s, i, out) {
  s.tiles[i].used = true;
  s.player.potions++;
  say(s, '拾取治疗药水 ×1。', 'good');
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
    say(s, `遭遇 ${t.mob.name}！生命 ${t.mob.hp} · 攻击 ${t.mob.atk}`, t.kind === 'monster' ? 'warn' : 'bad');
    ev(out, 'encounter', { i });
    if (!opts.silent) s.pendingCombat = i;
    return;
  }
  if (t.kind === 'trap') {
    if (opts.safe) {
      t.used = true;
      say(s, '卷轴的微光提前引爆了陷坑，你安然无恙。', 'good');
      ev(out, 'disarm', { i });
    } else {
      t.used = true;
      let dmg = Math.max(2, Math.round(BAL.trapBase + BAL.trapF * s.floor - Math.floor(p.def / 2)));
      if (hasRelic(s, 'spikeSoles')) dmg = Math.max(1, Math.round(dmg * 0.7));
      if (s.relicState.trapWard > 0) {
        s.relicState.trapWard--;
        say(s, `猫步让你在尖刺合拢前抽回了脚——毫发无伤。（剩 ${s.relicState.trapWard} 次）`, 'good');
        ev(out, 'disarm', { i });
      } else {
        say(s, `地板塌陷！尖刺造成 ${dmg} 点伤害。`, 'bad');
        hurt(s, dmg, out, '尖刺陷阱', i);
      }
      if (hasRelic(s, 'trapSalvage')) addGold(s, 10, out);
    }
    return;
  }
  if (t.kind === 'chest') {
    if (opts.silent) {
      say(s, '碎石间露出一只宝箱——点击它才能开启。', 'good');
      ev(out, 'discover', { i, kind: 'chest' });
      return;
    }
    lootChest(s, i, out);
    return;
  }
  if (t.kind === 'potion') {
    if (opts.silent) {
      say(s, '地上有一瓶治疗药水——点击拾取。', 'good');
      ev(out, 'discover', { i, kind: 'potion' });
      return;
    }
    pickPotion(s, i, out);
    return;
  }
  if (t.kind === 'altar') {
    say(s, '发现古老祭坛，它索取献祭，也赐予力量。', 'magic');
    if (!opts.silent) s.pendingAltar = i;
    ev(out, 'altar', { i });
    return;
  }
  if (t.kind === 'stairs') {
    s.stairsFound = true;
    say(s, s.floor === 1 ? '发现下行阶梯！随时可以进入下一层。' : '发现下行阶梯，但被符文锁封住了——找到钥匙守卫。', 'magic');
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
  if (mode === 'bomb' && s.player.bombs <= 0) { say(s, '没有裂石炸弹了。', 'warn'); return out; }
  if (mode === 'scroll' && s.player.scrolls <= 0) { say(s, '没有侦查卷轴了。', 'warn'); return out; }
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
    say(s, `旗子用完（上限 ${cap}）：旗囊/旗帜祝福/旗手纹章可提升`, 'warn');
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
    if (!t.revealed || !isThreat(t) || t.used) { say(s, '炸弹只能摧毁已探明的威胁。', 'warn'); return free; }
    s.player.bombs--;
    s.mode = 'explore';
    t.used = true;
    const wasMob = !!t.mob && t.mob.hp > 0;
    if (t.mob) t.mob.hp = 0;
    ev(out, 'bomb', { i });
    say(s, `轰！${wasMob ? t.mob.name : '陷阱'}被炸成了碎砖。`, 'magic');
    if (hasRelic(s, 'blastWave')) {
      let swept = 0;
      for (const j of neighbors(i)) {
        const nt = s.tiles[j];
        if (nt.kind !== 'trap' || nt.used) continue;
        if (nt.flagged) { nt.flagged = false; s.flags--; }
        nt.used = true; nt.revealed = true; swept++;
        ev(out, 'disarm', { i: j });
      }
      if (swept) say(s, `冲击波顺着砖缝荡开，连带掀掉了 ${swept} 处陷坑。`, 'magic');
    }
    if (t.kind === 'elite') { s.hasKey = true; say(s, '钥匙从碎石中滚了出来。', 'good'); ev(out, 'key', { i }); offerRelics(s, out); }
    if (t.kind === 'boss') return { out: out.concat(winRun(s)), spent: false };
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
    say(s, '卷轴展开，周围的砖石变得透明。', 'magic');
    if (hasRelic(s, 'cartographer') && surveyed) {
      const add = Math.min(RELIC_SURVEY_CAP - s.relicState.survey, surveyed);
      if (add > 0) {
        s.relicState.survey += add;
        s.player.atk += add;
        say(s, `测绘师把 ${surveyed} 处危险记进了图里：攻击 +${add}（${s.relicState.survey}/${RELIC_SURVEY_CAP}）。`, 'magic');
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
    say(s, `数字 ${t.n}：周围已标记 ${flagged} 个威胁，标记数不符，无法快速展开。`, 'warn');
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
  if (f.lethal) { say(s, '这一击会要了你的命，先变强或绕开它。', 'bad'); ev(out, 'blocked', { i }); return out; }
  s.stats.turns++;
  ev(out, 'combat', { i, rounds: f.rounds, take: f.take, deal: f.deal });
  if (f.take > 0) hurt(s, f.take, out, t.mob.name, i);
  if (s.status !== 'playing') return out;
  t.mob.hp = 0;
  t.used = true;
  s.stats.kills++;
  say(s, `${t.mob.name}倒下了！${f.rounds} 回合，承受 ${f.take} 伤害，+${t.mob.xp} 经验。`, 'good');
  ev(out, 'kill', { i, mob: t.mob });
  addGold(s, t.mob.gold, out);
  gainXp(s, t.mob.xp, out);
  if (hasRelic(s, 'momentum') && !s.relicState.firstKill) { s.relicState.firstKill = true; syncRelicMods(s); }
  if (hasRelic(s, 'vampiricEdge')) heal(s, 4, out);
  if (hasRelic(s, 'whetSoul') && s.relicState.whet < RELIC_WHET_CAP) {
    s.relicState.whet++;
    p.atk += 1;
    say(s, `磨刀之魂饮下了这一战：攻击 +1（${s.relicState.whet}/${RELIC_WHET_CAP}）。`, 'magic');
  }
  if (t.kind === 'elite') {
    s.hasKey = true;
    say(s, '获得锈蚀钥匙！下行阶梯的封印解开了。', 'magic');
    ev(out, 'key', { i });
    offerRelics(s, out);
  }
  if (t.kind === 'boss') return out.concat(winRun(s));
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
  if (p.potions <= 0) { say(s, '背包里没有药水了。', 'warn'); return out; }
  if (p.hp >= p.maxHp) { say(s, '生命已满，别浪费药水。', 'warn'); return out; }
  p.potions--;
  const amount = heal(s, Math.ceil(p.maxHp * (hasRelic(s, 'ironStomach') ? 0.38 : BAL.potionPct)), out);
  say(s, `饮下药水，恢复 ${amount} 点生命。`, 'good');
  return out;
}

export function buy(s, id) {
  const out = [];
  if (s.status !== 'playing') return out;
  const item = SHOP.find((x) => x.id === id);
  if (!item) return out;
  const price = shopPrice(s, id);
  if (s.player.gold < price) { say(s, '金币不够。', 'warn'); ev(out, 'deny'); return out; }
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
  say(s, `购入 ${item.name}（-${price} 金币）。`, 'good');
  ev(out, 'buy', { id, price });
  return out;
}

export const ALTAR_OPTIONS = [
  { id: 'blood', name: '血之契约', icon: 'sword', desc: '献祭 10 点生命，永久 +2 攻击' },
  { id: 'pray', name: '静默祈祷', icon: 'heart', desc: '恢复 45% 最大生命' },
  { id: 'greed', name: '贪婪低语', icon: 'coin', desc: '立刻获得 45 金币，本层防御 −1（下行时恢复）' },
  { id: 'banner', name: '旗帜祝福', icon: 'flag', desc: `永久 +${ALTAR_FLAG_BONUS} 旗子上限` },
];

export function altarChoose(s, i, choice) {
  const out = [];
  if (s.status !== 'playing') return out;
  const t = s.tiles[i];
  if (!t || t.kind !== 'altar' || t.used) return out;
  const p = s.player;
  if (choice === 'blood' && p.hp <= BAL.bloodCost) { say(s, '你的血不够献祭了。', 'warn'); return out; }
  if (choice === 'greed' && p.def <= 0) { say(s, '你的甲胄已经薄无可薄。', 'warn'); return out; }
  t.used = true;
  s.pendingAltar = -1;
  if (choice === 'blood') {
    hurt(s, BAL.bloodCost, out, '血之契约');
    if (s.status !== 'playing') return out;
    p.atk += BAL.bloodAtk;
    say(s, `祭坛饮下你的血，刀刃变得饥渴。攻击 +${BAL.bloodAtk}。`, 'magic');
  } else if (choice === 'pray') {
    const h = heal(s, Math.ceil(p.maxHp * (hasRelic(s, 'altarGrace') ? 0.75 : BAL.prayPct)), out);
    say(s, `温暖的光包裹了你，恢复 ${h} 点生命。`, 'good');
  } else if (choice === 'banner') {
    s.flagBonus += ALTAR_FLAG_BONUS;
    say(s, `紫火卷成一面旗落进你手里：旗子上限提升到 ${flagCap(s)}。`, 'magic');
  } else {
    const got = addGold(s, 45, out);
    p.def -= 1;
    s.defDebt += 1;
    say(s, `金币从石缝涌出（+${got}）。甲胄薄了一分：本层防御 −1，下行时恢复。`, 'magic');
  }
  ev(out, 'altarUsed', { i, choice });
  return out;
}

export function canDescend(s) {
  return s.status === 'playing' && s.stairsFound && (s.floor === 1 || s.hasKey);
}

export function tryDescend(s) {
  const out = [];
  if (s.status !== 'playing') return out;
  if (!s.stairsFound) { say(s, '还没找到下行阶梯。', 'warn'); return out; }
  if (s.floor > 1 && !s.hasKey) { say(s, '阶梯被符文锁封住。钥匙守卫也算一格「雷」，就藏在未探明的砖格里——击败它或炸掉它才能夺钥。', 'warn'); ev(out, 'locked'); return out; }
  const bonus = addGold(s, (10 + s.floor * 3) * (hasRelic(s, 'prospector') ? 2 : 1), out);
  heal(s, Math.ceil(s.player.maxHp * BAL.descendPct), out);
  if (hasRelic(s, 'bannerLord')) {
    const correct = s.solvedFlags + s.tiles.filter((t) => t.flagged && !t.revealed && isThreat(t)).length;
    if (correct) {
      const h = heal(s, Math.min(RELIC_BANNER_CAP, correct * 2), out);
      say(s, `旗帜领主认出了 ${correct} 面插对的旗，回复 ${h} 生命。`, 'good');
    }
  }
  if (hasRelic(s, 'alchemist') && s.floor % 2 === 0) { s.player.potions++; say(s, '炼金壶在行囊里凝出了一瓶药水。', 'good'); ev(out, 'item', { item: 'potion' }); }
  if (hasRelic(s, 'strataOath')) {
    s.player.def += STRATA_DEF;
    s.player.maxHp += STRATA_HP;
    heal(s, STRATA_HP, out);
    say(s, `层岩誓约又刻下一道：防御 +${STRATA_DEF}，生命上限 +${STRATA_HP}。`, 'magic');
  }
  s.floor++;
  buildFloor(s);
  say(s, `沿阶梯而下——第 ${s.floor} 层 · ${FLOOR_NAMES[s.floor]}。通关奖励 ${bonus} 金币。`, 'magic');
  ev(out, 'descend', { floor: s.floor });
  return out;
}

function winRun(s) {
  s.status = 'won';
  say(s, '深渊龙王轰然崩塌，砖石之上重见天光。你通关了！', 'good');
  return ev([], 'win', { floor: s.floor });
}

// ---------- 遗物抽取 ----------
export const hasRelic = (s, id) => s.relics.includes(id);

// 战斗修正全部落在 player 上，forecast 因此无需知道遗物系统的存在，
// 预演 / 结算 / 生成时的反锁死校验读到的永远是同一份数字。
function syncRelicMods(s) {
  const p = s.player;
  p.takeMul = (hasRelic(s, 'dragonWard') ? 0.75 : 1) * (hasRelic(s, 'glassCannon') ? 1.35 : 1);
  p.takeFlat = hasRelic(s, 'thornMail') ? 2 : 0;
  p.eliteTakeMul = hasRelic(s, 'guardianBane') ? 0.6 : 1;
  p.freeKill = hasRelic(s, 'momentum') && !s.relicState.firstKill;
  p.thorns = hasRelic(s, 'recoilMail') ? RELIC_RECOIL : 0;
  // 血气方刚是派生值：按 maxHp 重算目标加成，只写回差额，重复同步才不会越叠越多
  const want = hasRelic(s, 'vigor') ? Math.floor(p.maxHp / RELIC_VIGOR_STEP) : 0;
  p.atk += want - p.atkBonus;
  p.atkBonus = want;
}

function rollRelicChoices(s) {
  const pool = RELICS.filter((r) => !hasRelic(s, r.id));
  const out = [];
  while (out.length < RELIC_DRAW_COUNT && pool.length) {
    const total = pool.reduce((a, r) => a + RELIC_RARITY[r.rarity].weight, 0);
    let x = rand(s) * total, k = 0;
    while (k < pool.length - 1 && x >= RELIC_RARITY[pool[k].rarity].weight) { x -= RELIC_RARITY[pool[k].rarity].weight; k++; }
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}

export function offerRelics(s, out) {
  const ids = rollRelicChoices(s);
  if (!ids.length) return out;
  s.relicChoices = ids;
  say(s, '守卫的残骸中浮起三件遗物——只能带走一件。', 'magic');
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
  if (id === 'carefulStep') s.relicState.trapWard = RELIC_WARD_CHARGES;
  if (id === 'bannerBearer') s.flagBonus += RELIC_FLAG_BONUS;
  syncRelicMods(s);
  const r = relicById(id);
  say(s, `获得遗物「${r.name}」：${r.desc}`, 'magic');
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
  if (!t.revealed) return t.flagged ? '已标记' : '未探索';
  if (t.mob && t.mob.hp > 0) return t.mob.name + (t.mob.awake && t.mob.cd != null ? `，${t.mob.cd} 回合后骚扰` : '');
  if (t.kind === 'stairs') return '下行阶梯';
  const name = t.mob ? t.mob.name + '（已清除）'
    : t.kind === 'trap' ? (t.used ? '已触发陷阱' : '陷阱')
    : t.kind === 'altar' ? (t.used ? '黯淡的祭坛' : '古老祭坛')
    : t.kind === 'chest' ? (t.used ? '空宝箱' : '未开启的宝箱')
    : t.kind === 'potion' ? (t.used ? '空地' : '治疗药水')
    : null;
  if (name == null) return t.n ? `危险 ${t.n}` : '安全空地';
  const spent = t.mob ? t.mob.hp <= 0 : t.used;
  return spent && t.n ? `${name}，危险 ${t.n}` : name;
}