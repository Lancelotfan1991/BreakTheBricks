// 破砖深渊 — 纯逻辑层（无 DOM，可在 Node 中直接测试）
export const COLS = 7;
export const ROWS = 9;
export const SIZE = COLS * ROWS;
export const MAX_FLOOR = 8;
export const SAVE_VERSION = 3;

export const DIFFICULTIES = {
  easy: { id: 'easy', name: '地窖', tag: '轻松', desc: '怪物孱弱 · 补给充裕', threat: 0.78, power: 0.82, loot: 1.35, hp: 38, gold: 25, potions: 2 },
  normal: { id: 'normal', name: '深渊', tag: '标准', desc: '标准的地牢体验', threat: 1, power: 1, loot: 1, hp: 32, gold: 10, potions: 2 },
  hard: { id: 'hard', name: '炼狱', tag: '噩梦', desc: '寸步难行 · 精英横行', threat: 1.22, power: 1.1, loot: 0.8, hp: 28, gold: 0, potions: 2 },
};

export const SHOP = [
  { id: 'potion', name: '治疗药水', icon: 'potion', desc: '恢复 30% 最大生命', base: 30, step: 12 },
  { id: 'whet', name: '磨刀石', icon: 'sword', desc: '永久 +1 攻击', base: 30, step: 14 },
  { id: 'plate', name: '铁甲片', icon: 'shield', desc: '永久 +1 防御', base: 30, step: 16 },
  { id: 'scroll', name: '侦查卷轴', icon: 'scroll', desc: '安全探明 3×3 区域', base: 22, step: 6 },
  { id: 'bomb', name: '裂石炸弹', icon: 'bomb', desc: '无伤摧毁一个威胁', base: 40, step: 10 },
];

const BESTIARY = [
  { id: 'bat', name: '洞穴蝠', icon: 'bat', hp: 0.7, atk: 1.15, def: 0, min: 1, max: 3, flavor: '尖啸着俯冲，脆弱却迅捷。' },
  { id: 'slime', name: '腐黏怪', icon: 'slime', hp: 1.35, atk: 0.78, def: 0, min: 1, max: 4, flavor: '吞下了太多冒险者的铁器。' },
  { id: 'skeleton', name: '骸骨兵', icon: 'skeleton', hp: 1, atk: 1, def: 1, min: 2, max: 6, flavor: '锈剑仍在执行千年前的军令。' },
  { id: 'spider', name: '织网蛛', icon: 'spider', hp: 0.85, atk: 1.28, def: 0, min: 3, max: 7, flavor: '毒牙比石壁上的裂缝更细。' },
  { id: 'orc', name: '穴居兽人', icon: 'orc', hp: 1.12, atk: 1.18, def: 1, min: 4, max: 8, flavor: '它把守这条路，只是为了晚饭。' },
  { id: 'golem', name: '石像鬼', icon: 'golem', hp: 1.55, atk: 0.9, def: 3, min: 5, max: 8, flavor: '砖石本身站了起来。' },
  { id: 'wraith', name: '深渊怨灵', icon: 'wraith', hp: 0.92, atk: 1.12, def: 4, min: 6, max: 8, flavor: '寒气穿过甲胄，直接啃咬骨头。' },
];

export const FLOOR_NAMES = ['', '苔痕门厅', '锈铁回廊', '蛛丝墓室', '兽骨仓窖', '熔渣锻层', '石像长廊', '哀嚎深井', '深渊王座'];

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
  const rounds = Math.ceil(mob.hp / deal);
  const take = (rounds - 1) * hitDamage(mob.atk, p.def);
  return { deal, rounds, take, lethal: take >= p.hp, perHit: hitDamage(mob.atk, p.def) };
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
    player: { hp: d.hp, maxHp: d.hp, atk: 5, def: 1, lv: 1, xp: 0, xpNext: 12, gold: d.gold, potions: 2, bombs: 1, scrolls: 1 },
    bought: {},
    hasKey: false,
    stairsFound: false,
    stairsIndex: -1,
    mode: 'explore',
    threatTotal: 0,
    flags: 0,
    pendingCombat: -1,
    pendingAltar: -1,
    stats: { kills: 0, elites: 0, revealed: 0, goldEarned: 0, damage: 0, turns: 0, floors: 0 },
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
  s.mode = 'explore';
  s.pendingCombat = -1;
  s.pendingAltar = -1;
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
  bloodCost: 10, bloodAtk: 2,
  eliteCap: 0.9, bossCap: 0.95, shopWhet: 1, mobGold: 2, mobGoldF: 1, chestGold: 8, chestGoldF: 3,
};

function makeMob(s, f, d, type) {
  const pool = BESTIARY.filter((b) => f >= b.min && f <= b.max);
  const b = type === 'elite' ? { id: 'guardian', name: '钥匙守卫', icon: 'guardian', hp: 1, atk: 1, def: 0, flavor: '它吞下了这一层的钥匙。' }
    : type === 'boss' ? { id: 'dragon', name: '深渊龙王', icon: 'dragon', hp: 1, atk: 1, def: 0, flavor: '砖石深渊的心脏，正在缓慢跳动。' }
      : pick(s, pool.length ? pool : BESTIARY);
  const P = d.power;
  const p = s.player;
  const B = BAL;
  const def = Math.floor(f / 2) + b.def;
  const mix = (fixed, ref) => fixed * (1 - B.adapt) + ref * B.adapt;
  const hpRef = hitDamage(p.atk, def) * (B.refRounds + B.refRoundsF * f);
  const atkRef = p.def + p.maxHp * (B.refBurn + B.refBurnF * f);
  let hp = Math.round(mix(B.mobHp + B.mobHpF * f, hpRef) * b.hp * P);
  let atk = Math.round(mix(B.mobAtk + B.mobAtkF * f, atkRef) * b.atk * P);
  let xp = Math.round((2 + 1.2 * f) * (b.hp + b.atk) / 2);
  let gold = Math.round((BAL.mobGold + BAL.mobGoldF * f) * d.loot);
  if (type === 'elite') { hp = Math.round(hp * 1.9); atk = Math.round(atk * 1.3); xp *= 3; gold = Math.round(gold * 3.2); }
  if (type === 'boss') { hp = Math.round(hp * 3.4); atk = Math.round(atk * 1.45); xp = 120; gold = 260; }
  const mob = { id: b.id, name: b.name, icon: b.icon, flavor: b.flavor, hp, maxHp: hp, atk, def, xp, gold, elite: type === 'elite', boss: type === 'boss' };
  // 反锁死：钥匙守卫 / 龙王在生成时必须是「满血可胜」的
  if (type === 'elite' || type === 'boss') {
    const cap = Math.floor(p.maxHp * (type === 'boss' ? B.bossCap : B.eliteCap));
    let guard = 0;
    while (forecast(p, mob).take > cap && guard++ < 80) {
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
export function shopPrice(s, id) {
  const item = SHOP.find((x) => x.id === id);
  return item.base + item.step * (s.bought[id] || 0);
}
export function score(s) {
  return s.stats.floors * 120 + s.stats.kills * 12 + s.stats.elites * 40 + s.player.lv * 25 + s.stats.goldEarned + (s.status === 'won' ? 600 : 0);
}

function gainXp(s, amount, out) {
  const p = s.player;
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
  s.player.gold += amount;
  s.stats.goldEarned += amount;
  ev(out, 'gold', { amount });
}

// ---------- reveal ----------
function openTile(s, i, out, opts = {}) {
  const t = s.tiles[i];
  if (t.revealed) return;
  t.revealed = true;
  t.flagged = false;
  s.stats.revealed++;
  ev(out, 'reveal', { i, kind: t.kind });
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
      const dmg = Math.max(2, 4 + 2 * s.floor - Math.floor(p.def / 2));
      say(s, `地板塌陷！尖刺造成 ${dmg} 点伤害。`, 'bad');
      hurt(s, dmg, out, '尖刺陷阱', i);
    }
    return;
  }
  if (t.kind === 'chest') {
    t.used = true;
    const c = t.chest;
    if (c.type === 'gold') { addGold(s, c.amount, out); say(s, `宝箱开启：${c.amount} 金币。`, 'good'); }
    else if (c.type === 'potion') { p.potions++; say(s, '宝箱开启：治疗药水 ×1。', 'good'); ev(out, 'item', { item: 'potion' }); }
    else if (c.type === 'weapon') { p.atk += c.amount; say(s, `宝箱开启：附魔刃片，攻击 +${c.amount}！`, 'good'); ev(out, 'item', { item: 'weapon' }); }
    else if (c.type === 'armor') { p.def += c.amount; say(s, `宝箱开启：龙鳞甲片，防御 +${c.amount}！`, 'good'); ev(out, 'item', { item: 'armor' }); }
    else if (c.type === 'scroll') { p.scrolls++; say(s, '宝箱开启：侦查卷轴 ×1。', 'good'); ev(out, 'item', { item: 'scroll' }); }
    else { p.bombs++; say(s, '宝箱开启：裂石炸弹 ×1。', 'good'); ev(out, 'item', { item: 'bomb' }); }
    ev(out, 'loot', { i });
    return;
  }
  if (t.kind === 'potion') {
    t.used = true;
    p.potions++;
    say(s, '拾取治疗药水 ×1。', 'good');
    ev(out, 'item', { item: 'potion' });
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
  t.flagged = !t.flagged;
  s.flags += t.flagged ? 1 : -1;
  ev(out, 'flag', { i, on: t.flagged });
  return out;
}

export function tapTile(s, i) {
  return finish(s, tapInner(s, i));
}

function tapInner(s, i) {
  let out = [];
  if (s.status !== 'playing') return out;
  if (i < 0 || i >= SIZE) return out;
  const t = s.tiles[i];
  s.stats.turns++;

  if (s.mode === 'flag') return toggleFlag(s, i);

  if (s.mode === 'bomb') {
    if (!t.revealed || !isThreat(t) || t.used) { say(s, '炸弹只能摧毁已探明的威胁。', 'warn'); return out; }
    s.player.bombs--;
    s.mode = 'explore';
    t.used = true;
    const wasMob = !!t.mob && t.mob.hp > 0;
    if (t.mob) t.mob.hp = 0;
    ev(out, 'bomb', { i });
    say(s, `轰！${wasMob ? t.mob.name : '陷阱'}被炸成了碎砖。`, 'magic');
    if (t.kind === 'elite') { s.hasKey = true; say(s, '钥匙从碎石中滚了出来。', 'good'); ev(out, 'key', { i }); }
    if (t.kind === 'boss') return out.concat(winRun(s));
    return out;
  }

  if (s.mode === 'scroll') {
    s.player.scrolls--;
    s.mode = 'explore';
    ev(out, 'scroll', { i });
    ensureBoard(s, i);
    const area = [i, ...neighbors(i)];
    for (const j of area) openTile(s, j, out, { safe: true, silent: true, noFlood: true });
    say(s, '卷轴展开，周围的砖石变得透明。', 'magic');
    return out;
  }

  if (t.flagged) { say(s, '这格被标记了，先取消标记再探索。', 'warn'); return out; }

  if (!t.revealed) {
    ensureBoard(s, i);
    openTile(s, i, out);
    return out;
  }

  // 已探明格
  if ((t.kind === 'monster' || t.kind === 'elite' || t.kind === 'boss') && t.mob.hp > 0) {
    s.pendingCombat = i;
    ev(out, 'encounter', { i });
    return out;
  }
  if (t.kind === 'altar' && !t.used) { s.pendingAltar = i; ev(out, 'altar', { i }); return out; }
  if (t.kind === 'stairs') return out.concat(tryDescend(s));
  if (t.kind === 'empty' && t.n > 0) return finish(s, out.concat(chord(s, i)));
  return finish(s, out);
}

function finish(s, out) {
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
  if (t.kind === 'elite') s.stats.elites++;
  say(s, `${t.mob.name}倒下了！${f.rounds} 回合，承受 ${f.take} 伤害，+${t.mob.xp} 经验 +${t.mob.gold} 金币。`, 'good');
  ev(out, 'kill', { i, mob: t.mob });
  addGold(s, t.mob.gold, out);
  gainXp(s, t.mob.xp, out);
  if (t.kind === 'elite') {
    s.hasKey = true;
    say(s, '获得锈蚀钥匙！下行阶梯的封印解开了。', 'magic');
    ev(out, 'key', { i });
  }
  if (t.kind === 'boss') return out.concat(winRun(s));
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
  const amount = heal(s, Math.ceil(p.maxHp * BAL.potionPct), out);
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
  if (id === 'scroll') p.scrolls++;
  if (id === 'bomb') p.bombs++;
  say(s, `购入 ${item.name}（-${price} 金币）。`, 'good');
  ev(out, 'buy', { id, price });
  return out;
}

export const ALTAR_OPTIONS = [
  { id: 'blood', name: '血之契约', icon: 'sword', desc: '献祭 10 点生命，永久 +2 攻击' },
  { id: 'pray', name: '静默祈祷', icon: 'heart', desc: '恢复 45% 最大生命' },
  { id: 'greed', name: '贪婪低语', icon: 'coin', desc: '立刻获得 45 金币，但防御 -1' },
];

export function altarChoose(s, i, choice) {
  const out = [];
  if (s.status !== 'playing') return out;
  const t = s.tiles[i];
  if (!t || t.kind !== 'altar' || t.used) return out;
  const p = s.player;
  if (choice === 'blood' && p.hp <= BAL.bloodCost) { say(s, '你的血不够献祭了。', 'warn'); return out; }
  t.used = true;
  s.pendingAltar = -1;
  if (choice === 'blood') {
    hurt(s, BAL.bloodCost, out, '血之契约');
    if (s.status !== 'playing') return out;
    p.atk += BAL.bloodAtk;
    say(s, `祭坛饮下你的血，刀刃变得饥渴。攻击 +${BAL.bloodAtk}。`, 'magic');
  } else if (choice === 'pray') {
    const h = heal(s, Math.ceil(p.maxHp * BAL.prayPct), out);
    say(s, `温暖的光包裹了你，恢复 ${h} 点生命。`, 'good');
  } else {
    addGold(s, 45, out);
    p.def = Math.max(0, p.def - 1);
    say(s, '金币从石缝涌出，而你的甲胄薄了一分。', 'magic');
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
  if (s.floor > 1 && !s.hasKey) { say(s, '阶梯被符文锁封住，需要钥匙守卫身上的钥匙。', 'warn'); ev(out, 'locked'); return out; }
  s.stats.floors++;
  const bonus = 10 + s.floor * 3;
  addGold(s, bonus, out);
  heal(s, Math.ceil(s.player.maxHp * BAL.descendPct), out);
  s.floor++;
  buildFloor(s);
  say(s, `沿阶梯而下——第 ${s.floor} 层 · ${FLOOR_NAMES[s.floor]}。通关奖励 ${bonus} 金币。`, 'magic');
  ev(out, 'descend', { floor: s.floor });
  return out;
}

function winRun(s) {
  s.status = 'won';
  s.stats.floors++;
  say(s, '深渊龙王轰然崩塌，砖石之上重见天光。你通关了！', 'good');
  return ev([], 'win', { floor: s.floor });
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
  if (t.mob && t.mob.hp > 0) return t.mob.name;
  if (t.mob) return t.mob.name + '（已清除）';
  if (t.kind === 'trap') return t.used ? '已触发陷阱' : '陷阱';
  if (t.kind === 'stairs') return '下行阶梯';
  if (t.kind === 'altar') return t.used ? '黯淡的祭坛' : '古老祭坛';
  if (t.kind === 'chest') return '空宝箱';
  if (t.kind === 'potion') return '空地';
  return t.n ? `危险 ${t.n}` : '安全空地';
}