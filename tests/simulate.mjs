// 自动玩家：用于平衡性与稳定性验证
// node tests/simulate.mjs [runs] [difficulty] [build] [talent]   build ∈ reason(推理流) / body(体魄流)，缺省为混合抓取；talent ∈ gladiator / brawler / treasureHunter / healer
import {
  createRun, tapTile, attack, usePotion, eventBuy, altarChoose, tryDescend, closePending, useDoor,
  forecast, neighbors, canDescend, SIZE, MAX_FLOOR, shopPrice, setMode, chooseRelic, chooseLevel,
  levelChoiceStat, levelChoiceAmount, chooseTalent, atkOf, wallOpen, chooseTheme,
  toggleFlag, flagCap, flagBonusLeft, ALTAR_FLAG_BONUS, RELIC_SURVEY_CAP, RELIC_SHOP_CAP, EVENT_ITEMS,
} from '../public/src/game.js';

const isMob = (t) => t.mob && t.mob.hp > 0;
// 石墙不参与雷数推理：它永远不会是威胁，但未解锁时点了也是白点
const wallBlocks = (s, t) => t.kind === 'wall' && !t.revealed && !wallOpen(s, t.i);

// 演绎的另一半：暗格数正好等于「数字 − 已插旗」→ 这些暗格全是威胁，插旗规避。
// 插旗不消耗回合，所以这是纯收益；也是测量识破收益与推理流的前提。
function flagPass(s) {
  const cap = flagCap(s);
  if (s.flags >= cap) return false;
  for (const t of s.tiles) {
    if (!t.revealed || t.kind !== 'empty' || t.n === 0) continue;
    const nb = neighbors(t.i);
    const flags = nb.filter((j) => s.tiles[j].flagged).length;
    const hidden = nb.filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged && s.tiles[j].kind !== 'wall');
    if (!hidden.length || hidden.length !== t.n - flags) continue;
    let did = false;
    for (const j of hidden) {
      if (s.flags >= cap) break;
      toggleFlag(s, j); did = true;
    }
    if (did) return true;
  }
  return false;
}

function bestSafeTile(s) {
  // 演绎：数字格标记数 == 数字 → 其余暗格安全
  for (const t of s.tiles) {
    if (!t.revealed || t.kind !== 'empty' || t.n === 0) continue;
    const nb = neighbors(t.i);
    const flags = nb.filter((j) => s.tiles[j].flagged).length;
    if (flags !== t.n) continue;
    const hidden = nb.filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged && s.tiles[j].kind !== 'wall');
    if (hidden.length) return (hidden.find((j) => !s.tiles[j].fire) ?? hidden[0]);
  }
  // 数字格已无暗邻居威胁 → 无
  let best = -1, bestRisk = 99;
  for (const t of s.tiles) {
    if (t.revealed || t.flagged) continue;
    if (wallBlocks(s, t)) continue; // 未解锁的墙点了也是白点
    const nb = neighbors(t.i).filter((j) => s.tiles[j].revealed && s.tiles[j].kind === 'empty');
    if (!nb.length) continue;
    let risk = 0;
    for (const j of nb) {
      const jn = neighbors(j);
      const flags = jn.filter((k) => s.tiles[k].flagged).length;
      const hid = jn.filter((k) => !s.tiles[k].revealed && !s.tiles[k].flagged).length;
      const left = s.tiles[j].n - flags;
      risk = Math.max(risk, hid ? left / hid : 0);
    }
    if (risk < bestRisk) { bestRisk = risk; best = t.i; }
  }
  if (best >= 0 && bestRisk <= 0.34) return best;
  // 全暗：优先非火格与角落（邻居少）；未解锁的墙留到最后，点了也不消耗但毫无收益
  const hidden = s.tiles.filter((t) => !t.revealed && !t.flagged && !wallBlocks(s, t));
  if (!hidden.length) return -1;
  if (bestRisk <= 0.5) return best;
  hidden.sort((a, b) => Number(a.fire) - Number(b.fire) || neighbors(a.i).length - neighbors(b.i).length);
  return hidden[0].i;
}

function shopPass(s, build) {
  const p = s.player;
  // 购买只能发生在当前层的事件格上：找到卖这件商品的那类格子再下单
  const tileFor = (id) => {
    const kind = Object.keys(EVENT_ITEMS).find((k) => EVENT_ITEMS[k].includes(id));
    return s.tiles.find((t) => t.kind === kind && t.revealed && !t.used);
  };
  const tryBuy = (id) => {
    const t = tileFor(id);
    if (t && p.gold >= shopPrice(s, id)) { eventBuy(s, t.i, id); return true; }
    return false;
  };
  let guard = 0;
  while (guard++ < 12) {
    if (p.hp < p.maxHp * 0.5 && p.potions === 0 && tryBuy('potion')) continue;
    if (build === 'reason' && flagBonusLeft(s) > 0 && p.gold >= shopPrice(s, 'pouch') + 20 && tryBuy('pouch')) continue;
    if (build === 'body' && p.gold >= shopPrice(s, 'elixir') + 20 && tryBuy('elixir')) continue;
    if (p.gold >= shopPrice(s, 'whet') + 20 && tryBuy('whet')) continue;
    if (p.gold >= shopPrice(s, 'plate') + 20 && tryBuy('plate')) continue;
    if (build === 'reason' && p.scrolls < 2 && p.gold >= shopPrice(s, 'scroll') + 20 && tryBuy('scroll')) continue;
    if (p.potions < 2 && tryBuy('potion')) continue;
    if ((s.bought.relic || 0) < RELIC_SHOP_CAP && p.gold >= shopPrice(s, 'relic') + 40 && tryBuy('relic')) return;
    break;
  }
}

const RELIC_PREF = ['momentum', 'strataOath', 'vow', 'dragonWard', 'ironStomach', 'vampiricEdge', 'heartEater',
  'guardianBane', 'thornMail', 'recoilMail', 'spikedMail', 'alchemist', 'whetSoul', 'vigor', 'midas', 'bloodSac',
  'ribguard', 'bannerLord', 'bannerBearer', 'pennant', 'siegeBreak', 'moraleBreak', 'spikeSoles', 'carefulStep',
  'mint', 'lootSack', 'bounty', 'deed', 'usury', 'deepPockets', 'greedyHeart', 'altarGrace', 'warPaint', 'whetstone',
  'prospector', 'richBrew', 'hunterFlask', 'steadyNerve', 'treasureBell',
  'torch', 'perfectMind', 'trapSalvage', 'tally', 'blastWave', 'cartographer', 'bloodPact', 'glassCannon',
  'chronicle', 'bonePlate', 'rations', 'bombBag', 'powderKeg', 'fuse', 'forge', 'blastCharge', 'siegeBlast', 'bombCache',
  'pawnTicket'];

// 两条构筑轴各自的取舍顺序：用来验证「专投一条」是否真的能通关，而不是只测混合抓取
const BUILD_PREF = {
  reason: ['bannerBearer', 'pennant', 'siegeBreak', 'moraleBreak', 'perfectMind', 'bannerLord', 'cartographer',
    'tally', 'trapSalvage', 'chronicle', 'momentum', 'dragonWard', 'guardianBane', 'recoilMail', 'thornMail',
    'spikedMail', 'whetSoul', 'whetstone', 'vigor', 'ironStomach', 'vampiricEdge', 'bonePlate', 'rations',
    'lootSack', 'bounty', 'deed', 'usury', 'midas', 'alchemist', 'mint', 'deepPockets', 'greedyHeart', 'altarGrace', 'warPaint', 'prospector',
    'treasureBell', 'steadyNerve', 'richBrew', 'hunterFlask',
    'spikeSoles', 'carefulStep', 'blastWave', 'torch', 'bloodSac', 'ribguard', 'strataOath', 'bloodPact',
    'glassCannon', 'heartEater', 'vow', 'bombBag', 'powderKeg', 'fuse', 'forge', 'blastCharge', 'siegeBlast', 'bombCache',
    'pawnTicket'],
  body: ['strataOath', 'recoilMail', 'vigor', 'vow', 'ironStomach', 'richBrew', 'hunterFlask', 'vampiricEdge', 'heartEater', 'dragonWard',
    'steadyNerve', 'thornMail', 'guardianBane', 'momentum', 'midas', 'alchemist', 'whetSoul', 'altarGrace', 'warPaint', 'bloodPact',
    'glassCannon', 'bloodSac', 'ribguard', 'spikedMail', 'whetstone', 'lootSack', 'bannerLord', 'bannerBearer',
    'treasureBell',
    'siegeBreak', 'moraleBreak', 'spikeSoles', 'carefulStep', 'mint', 'deepPockets', 'greedyHeart', 'prospector',
    'perfectMind', 'blastWave', 'cartographer', 'trapSalvage', 'bonePlate', 'rations', 'tally', 'chronicle',
    'torch', 'pennant', 'bounty', 'deed', 'usury', 'bombBag', 'powderKeg', 'fuse', 'forge', 'blastCharge', 'siegeBlast', 'bombCache',
    'pawnTicket'],
};

// 升级三选一：攻击/防御优先，血线吃紧时生命也加分；数值本身已含稀有度差异
function pickLevel(s) {
  const p = s.player;
  const val = (id) => {
    const stat = levelChoiceStat(id), n = levelChoiceAmount(id);
    if (stat === 'atk') return n * 9;
    if (stat === 'def') return n * 7;
    if (stat === 'maxHp') return n * 2 + (p.hp < p.maxHp * 0.5 ? n * 2 : 0);
    if (stat === 'xpKill') return n * 2.2;
    if (stat === 'heal') return n * 1.1;
    if (stat === 'gold') return n * 0.7;
    if (stat === 'xpFloor') return n * 0.8;
    return 0;
  };
  return s.levelChoices.slice().sort((a, b) => val(b) - val(a))[0];
}

// 主题按种子固定挑选，保证两种区域都会被跑到；第三区同样由种子决定拿哪个
function pickTheme(s) {
  const choices = s.themeChoices;
  return choices[(s.seed >>> 1) % choices.length];
}

function pickRelic(s, prefer) {
  const table = BUILD_PREF[prefer] || RELIC_PREF;
  if (prefer && !BUILD_PREF[prefer]) {
    if (s.relicChoices.includes(prefer)) return prefer;
    const idle = table.slice().reverse().find((id) => s.relicChoices.includes(id));
    return idle || s.relicChoices[0];
  }
  const hurt = s.player.hp < s.player.maxHp * 0.6;
  const val = (id) => {
    const idx = table.indexOf(id);
    // 表外遗物给低分而不是 indexOf(-1) 反推出的最高分，否则新增遗物会被机器人当成首选
    let v = idx < 0 ? -5 : table.length - idx;
    if (hurt && ['ironStomach', 'vampiricEdge', 'alchemist', 'dragonWard', 'altarGrace', 'chronicle', 'rations', 'vow', 'heartEater'].includes(id)) v += 12;
    if (!hurt && ['whetSoul', 'whetstone', 'bloodPact', 'glassCannon', 'momentum', 'warPaint', 'heartEater', 'tally', 'trapSalvage', 'torch', 'lootSack'].includes(id)) v += 8;
    if (['bannerLord', 'bannerBearer', 'siegeBreak', 'moraleBreak'].includes(id)) v += 4; // 机器人会插旗，这几条不再是白板
    return v;
  };
  return s.relicChoices.slice().sort((a, b) => val(b) - val(a))[0];
}

export function playRun(difficulty, seed, verbose = false, prefer = null, build = null, talent = 'gladiator') {
  const s = createRun(difficulty, seed);
  chooseTalent(s, talent);
  const trace = [];
  const floors = [];
  let guard = 0, dmg = 0, healed = 0, potionsUsed = 0, blocked = 0, ambushes = 0;
  let solves = 0, solveFlags = 0, perfect = 0;
  let retry = -1, retrySig = '';
  let mark = { floor: 1, dmg: 0, healed: 0 };
  const snap = () => {
    floors.push({ floor: mark.floor, hp: s.player.hp, maxHp: s.player.maxHp, lv: s.player.lv, atk: s.player.atk, def: s.player.def, gold: s.player.gold, potions: s.player.potions, dmg: dmg - mark.dmg, healed: healed - mark.healed });
    mark = { floor: s.floor, dmg, healed };
  };
  const run = (fn, ...a) => {
    const evs = fn(s, ...a);
    for (const e of evs) {
      if (e.type === 'damage') dmg += e.amount;
      if (e.type === 'ambush') ambushes++;
      if (e.type === 'heal') healed += e.amount;
      if (e.type === 'solved') { solves++; solveFlags += e.flagged.length; if (e.flagged.length === e.count) perfect++; }
      if (e.type === 'descend' || e.type === 'win') snap();
    }
    return evs;
  };
  while (s.status === 'playing' && guard++ < 12000) {
    if (s.levelChoices) { run(chooseLevel, pickLevel(s)); continue; }
    if (s.relicChoices) { run(chooseRelic, pickRelic(s, build || prefer)); continue; }
    if (s.themeChoices) { run(chooseTheme, pickTheme(s)); continue; }
    if (s.pendingAltar >= 0) {
      const p = s.player;
      // 加满上限后旗帜祝福会被拒绝且不消耗祭坛，必须换一个选项，否则 pendingAltar 永远关不掉
      const choice = p.hp < p.maxHp * 0.6 ? 'pray'
        : build === 'reason' && flagBonusLeft(s) >= ALTAR_FLAG_BONUS ? 'banner'
          : p.hp > 20 ? 'blood' : p.def > 0 ? 'greed' : 'pray';
      run(altarChoose, s.pendingAltar, choice);
      continue;
    }
    // 大地之门整局只有一次：退回 5 层补资源，是正收益但会拖慢推进
    if (s.pendingDoor >= 0) { run(useDoor, s.pendingDoor); continue; }
    const doorTile = s.tiles.find((t) => t.revealed && t.kind === 'door' && !t.used);
    if (doorTile) { run(tapTile, doorTile.i); continue; }
    // 死亡/召唤图腾都可炸：血线尚可时用炸弹拔掉，别让增幅与增援滚起来
    const dangerTotem = s.tiles.find((t) => t.revealed && !t.used && (t.kind === 'totemDeath' || t.kind === 'totemSummon'));
    if (dangerTotem && s.player.bombs >= 2 && s.player.hp > s.player.maxHp * 0.5) {
      setMode(s, 'bomb');
      run(tapTile, dangerTotem.i);
      continue;
    }
    if (s.pendingCombat >= 0) {
      const t = s.tiles[s.pendingCombat];
      const f = forecast(s.player, t.mob, atkOf(s));
      if (s.forcedCombat === s.pendingCombat) {
        // 偷袭战无路可退：药水把血补到能扛，炸弹削到能打，最后只能硬拼
        if (f.lethal && s.player.potions > 0 && s.player.hp < s.player.maxHp) { run(usePotion); potionsUsed++; continue; }
        if (f.lethal && s.player.bombs > 0) { setMode(s, 'bomb'); run(tapTile, t.i); continue; }
        run(attack, s.pendingCombat);
        continue;
      }
      const must = t.kind === 'elite' || t.kind === 'boss';
      if (!f.lethal && (f.take <= s.player.hp * 0.42 || must)) {
        run(attack, s.pendingCombat);
      } else if (must && f.lethal && s.player.hp < s.player.maxHp && s.player.potions > 0) {
        // 先回血再考虑炸弹：炸弹现在是固定伤害，补不掉的血只能靠药水补
        run(usePotion);
      } else if (must && s.player.bombs > 0) {
        closePending(s); setMode(s, 'bomb'); run(tapTile, t.i);
      } else if (must && f.lethal) {
        shopPass(s, build);
        if (s.player.hp < s.player.maxHp && s.player.potions > 0) { run(usePotion); continue; }
        const f2 = forecast(s.player, t.mob, atkOf(s));
        if (!f2.lethal) { run(attack, s.pendingCombat); continue; }
        closePending(s); blocked++;
      } else {
        closePending(s);
      }
      continue;
    }
    // 精英/龙王留下的遗物要自己踩上去拾取，拾取是免费的
    const drop = s.tiles.find((t) => t.relicDrop);
    if (drop) { run(tapTile, drop.i); continue; }
    const p = s.player;
    if (flagPass(s)) continue;
    const loot = s.tiles.find((t) => t.revealed && !t.used && (t.kind === 'chest' || t.kind === 'potion'));
    if (loot) { run(tapTile, loot.i); continue; }
    // 祭坛／宝箱／药水翻开后都留在原地，必须再点一次才交互
    const altar = s.tiles.find((t) => t.revealed && !t.used && t.kind === 'altar');
    if (altar) { run(tapTile, altar.i); continue; }
    if (p.hp < p.maxHp * 0.45 && p.potions > 0) { run(usePotion); potionsUsed++; continue; }
    shopPass(s, build);

    // 推理流用卷轴喂测绘师：挑暗格最密处展开，一次探明的威胁最多
    if (build === 'reason' && s.relics.includes('cartographer') && p.scrolls > 0 && s.relicState.survey < RELIC_SURVEY_CAP) {
      const hidden = s.tiles.filter((t) => !t.revealed && !t.flagged);
      if (hidden.length > 12) {
        let at = -1, most = -1;
        for (const t of hidden) {
          const n = [t.i, ...neighbors(t.i)].filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged).length;
          if (n > most) { most = n; at = t.i; }
        }
        if (at >= 0) { setMode(s, 'scroll'); run(tapTile, at); continue; }
      }
    }

    const cheap = s.tiles.find((t) => t.revealed && isMob(t) && !forecast(p, t.mob, atkOf(s)).lethal && forecast(p, t.mob, atkOf(s)).take <= p.hp * 0.3);
    if (cheap) { run(attack, cheap.i); continue; }

    if (canDescend(s)) {
      const left = s.tiles.filter((t) => t.revealed && isMob(t) && !forecast(p, t.mob, atkOf(s)).lethal && forecast(p, t.mob, atkOf(s)).take <= p.hp * 0.22);
      if (!left.length || p.hp < p.maxHp * 0.4) { run(tryDescend); trace.push(`F${s.floor}`); continue; }
      run(attack, left[0].i); continue;
    }
    const i = bestSafeTile(s);
    if (i < 0) {
      if (canDescend(s)) { run(tryDescend); continue; }
      // 棋盘被完全识破后，守卫/龙王就摆在明面上且不会自动进预演：
      // 必须主动去夺钥或通关，而不是把「没有暗格」当成无路可走。
      // 守卫也可能仍藏在旗子下面——它是唯一必须清掉的威胁，点了才会掉钥匙。
      const must = s.tiles.find((t) => (t.kind === 'elite' || t.kind === 'boss') && isMob(t) && (t.revealed || t.flagged));
      const sig = `${p.hp}|${p.atk}|${p.def}|${p.bombs}|${p.potions}`;
      if (must && (retry !== must.i || retrySig !== sig)) {
        retry = must.i; retrySig = sig;
        run(tapTile, must.i);
        continue;
      }
      // 石墙可能围出了唯一通往阶梯的口子：没有安全格可走时用炸弹开路
      const wall = s.tiles.find((t) => t.kind === 'wall' && !t.revealed);
      if (wall && p.bombs > 0) { setMode(s, 'bomb'); run(tapTile, wall.i); continue; }
      break;
    }
    run(tapTile, i);
  }
  const res = {
    seed, difficulty, status: s.status, floor: s.floor, lv: s.player.lv, hp: s.player.hp, maxHp: s.player.maxHp,
    atk: s.player.atk, def: s.player.def, kills: s.stats.kills, turns: s.stats.turns, guard,
    stuck: guard >= 12000, dmg, healed, potionsUsed, blocked, ambushes, trace: trace.join('>'), floors,
    relics: s.relics.slice(), whet: s.relicState.whet, solves, solveFlags, perfect,
    thorns: s.player.thorns, survey: s.relicState.survey, atkBonus: s.player.atkBonus, flagBonus: s.flagBonus,
    chests: s.stats.chests, chestRelics: s.stats.chestRelics,
    themes: s.actThemes.slice(),
  };
  if (verbose) { console.log(res); for (const f of floors) console.log(JSON.stringify(f)); }
  return res;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('simulate.mjs')) {
  const runs = Number(process.argv[2] || 120);
  const diff = process.argv[3];
  const build = process.argv[4] || null;
  const talent = process.argv[5] || 'gladiator';
  if (diff === 'trace') { playRun(process.argv[4] || 'normal', Number(process.argv[5] || 12345), true, null, null, process.argv[6] || 'gladiator'); }
  else {
    const diffs = diff ? [diff] : ['easy', 'normal', 'hard'];
    for (const d of diffs) {
      const out = [];
      for (let k = 0; k < runs; k++) out.push(playRun(d, 1000 + k * 7919, false, null, build, talent));
      const wins = out.filter((r) => r.status === 'won').length;
      const stuck = out.filter((r) => r.stuck).length;
      const avgFloor = out.reduce((a, r) => a + r.floor, 0) / out.length;
      const avgLv = out.reduce((a, r) => a + r.lv, 0) / out.length;
      const avgTurns = out.reduce((a, r) => a + r.turns, 0) / out.length;
      const avgDmg = out.reduce((a, r) => a + r.dmg, 0) / out.length;
      const avgHeal = out.reduce((a, r) => a + r.healed, 0) / out.length;
      const hist = {};
      for (const r of out) hist[r.floor] = (hist[r.floor] || 0) + 1;
      const avgRelics = out.reduce((a, r) => a + r.relics.length, 0) / out.length;
      const avgAmbush = out.reduce((a, r) => a + r.ambushes, 0) / out.length;
      const avgSolves = out.reduce((a, r) => a + r.solves, 0) / out.length;
      const avgSolveFlags = out.reduce((a, r) => a + r.solveFlags, 0) / out.length;
      const perfects = out.reduce((a, r) => a + r.perfect, 0);
      const avgMaxHp = out.reduce((a, r) => a + r.maxHp, 0) / out.length;
      const avgAtk = out.reduce((a, r) => a + r.atk, 0) / out.length;
      const avgDef = out.reduce((a, r) => a + r.def, 0) / out.length;
      const avgChestRelics = out.reduce((a, r) => a + r.chestRelics, 0) / out.length;
      const themeCount = {};
      for (const r of out) {
        const k = `${r.themes[2] || '-'}/${r.themes[3] || '-'}`;
        themeCount[k] = (themeCount[k] || 0) + 1;
      }
      console.log(`${((build || 'mixed') + '/' + talent).padEnd(16)} ${d.padEnd(7)} 胜率 ${(wins / runs * 100).toFixed(1)}%  层数 ${avgFloor.toFixed(2)}  等级 ${avgLv.toFixed(1)}  遗物 ${avgRelics.toFixed(1)}  箱中遗物 ${avgChestRelics.toFixed(2)}  血上限 ${avgMaxHp.toFixed(0)}  攻 ${avgAtk.toFixed(1)}  防 ${avgDef.toFixed(1)}  操作 ${avgTurns.toFixed(0)}  受伤 ${avgDmg.toFixed(0)}  偷袭 ${avgAmbush.toFixed(1)}次  治疗 ${avgHeal.toFixed(0)}  识破 ${avgSolves.toFixed(2)}(旗${avgSolveFlags.toFixed(1)},完美${perfects})  主题 ${JSON.stringify(themeCount)}  卡死 ${stuck}  分布 ${JSON.stringify(hist)}`);
    }
  }
}