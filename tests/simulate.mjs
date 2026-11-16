// 自动玩家：用于平衡性与稳定性验证（node tests/simulate.mjs [runs] [difficulty]）
import {
  createRun, tapTile, attack, usePotion, buy, altarChoose, tryDescend, closePending,
  forecast, neighbors, canDescend, SIZE, MAX_FLOOR, shopPrice, setMode, chooseRelic,
} from '../public/src/game.js';

const isMob = (t) => t.mob && t.mob.hp > 0;

function bestSafeTile(s) {
  // 演绎：数字格标记数 == 数字 → 其余暗格安全
  for (const t of s.tiles) {
    if (!t.revealed || t.kind !== 'empty' || t.n === 0) continue;
    const nb = neighbors(t.i);
    const flags = nb.filter((j) => s.tiles[j].flagged).length;
    if (flags !== t.n) continue;
    const hidden = nb.filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged);
    if (hidden.length) return hidden[0];
  }
  // 数字格已无暗邻居威胁 → 无
  let best = -1, bestRisk = 99;
  for (const t of s.tiles) {
    if (t.revealed || t.flagged) continue;
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
  // 全暗：优先角落（邻居少）
  const hidden = s.tiles.filter((t) => !t.revealed && !t.flagged);
  if (!hidden.length) return -1;
  if (bestRisk <= 0.5) return best;
  hidden.sort((a, b) => neighbors(a.i).length - neighbors(b.i).length);
  return hidden[0].i;
}

function shopPass(s) {
  const p = s.player;
  let guard = 0;
  while (guard++ < 12) {
    if (p.hp < p.maxHp * 0.5 && p.potions === 0 && p.gold >= shopPrice(s, 'potion')) { buy(s, 'potion'); continue; }
    if (p.gold >= shopPrice(s, 'whet') + 20) { buy(s, 'whet'); continue; }
    if (p.gold >= shopPrice(s, 'plate') + 20) { buy(s, 'plate'); continue; }
    if (p.potions < 2 && p.gold >= shopPrice(s, 'potion')) { buy(s, 'potion'); continue; }
    break;
  }
}

const RELIC_PREF = ['momentum', 'dragonWard', 'ironStomach', 'vampiricEdge', 'guardianBane', 'thornMail',
  'alchemist', 'whetSoul', 'spikeSoles', 'carefulStep', 'mint', 'deepPockets', 'altarGrace', 'prospector',
  'blastWave', 'trapSalvage', 'bloodPact', 'glassCannon', 'greedyHeart', 'bannerLord', 'bannerBearer'];

function pickRelic(s, prefer) {
  if (prefer) {
    if (s.relicChoices.includes(prefer)) return prefer;
    const idle = RELIC_PREF.slice().reverse().find((id) => s.relicChoices.includes(id));
    return idle || s.relicChoices[0];
  }
  const hurt = s.player.hp < s.player.maxHp * 0.6;
  const val = (id) => {
    const idx = RELIC_PREF.indexOf(id);
    // 表外遗物给低分而不是 indexOf(-1) 反推出的最高分，否则新增遗物会被机器人当成首选
    let v = idx < 0 ? -5 : RELIC_PREF.length - idx;
    if (hurt && ['ironStomach', 'vampiricEdge', 'alchemist', 'dragonWard', 'altarGrace'].includes(id)) v += 12;
    if (!hurt && ['whetSoul', 'bloodPact', 'glassCannon', 'momentum'].includes(id)) v += 8;
    if (id === 'bannerLord' || id === 'bannerBearer') v -= 20; // 自动玩家不插旗，这两条对它等于白板
    return v;
  };
  return s.relicChoices.slice().sort((a, b) => val(b) - val(a))[0];
}

export function playRun(difficulty, seed, verbose = false, prefer = null) {
  const s = createRun(difficulty, seed);
  const trace = [];
  const floors = [];
  let guard = 0, dmg = 0, healed = 0, potionsUsed = 0, blocked = 0, aggroDmg = 0, aggroHits = 0;
  let forced = -1, forcedSig = '';
  let mark = { floor: 1, dmg: 0, healed: 0 };
  const snap = () => {
    floors.push({ floor: mark.floor, hp: s.player.hp, maxHp: s.player.maxHp, lv: s.player.lv, atk: s.player.atk, def: s.player.def, gold: s.player.gold, potions: s.player.potions, dmg: dmg - mark.dmg, healed: healed - mark.healed });
    mark = { floor: s.floor, dmg, healed };
  };
  const run = (fn, ...a) => {
    const evs = fn(s, ...a);
    for (const e of evs) {
      if (e.type === 'damage') dmg += e.amount;
      if (e.type === 'aggro') { aggroDmg += e.amount; aggroHits++; }
      if (e.type === 'heal') healed += e.amount;
      if (e.type === 'descend' || e.type === 'win') snap();
    }
    return evs;
  };
  while (s.status === 'playing' && guard++ < 4000) {
    if (s.relicChoices) { run(chooseRelic, pickRelic(s, prefer)); continue; }
    if (s.pendingAltar >= 0) {
      const p = s.player;
      const choice = p.hp < p.maxHp * 0.6 ? 'pray' : p.hp > 20 ? 'blood' : 'greed';
      run(altarChoose, s.pendingAltar, choice);
      continue;
    }
    if (s.pendingCombat >= 0) {
      const t = s.tiles[s.pendingCombat];
      const f = forecast(s.player, t.mob);
      const must = t.kind === 'elite' || t.kind === 'boss';
      if (!f.lethal && (f.take <= s.player.hp * 0.42 || must)) {
        run(attack, s.pendingCombat);
      } else if (must && s.player.bombs > 0) {
        closePending(s); setMode(s, 'bomb'); run(tapTile, t.i);
      } else if (must && f.lethal) {
        shopPass(s);
        if (s.player.hp < s.player.maxHp && s.player.potions > 0) { run(usePotion); continue; }
        const f2 = forecast(s.player, t.mob);
        if (!f2.lethal) { run(attack, s.pendingCombat); continue; }
        closePending(s); blocked++;
      } else {
        closePending(s);
      }
      continue;
    }
    const p = s.player;
    const loot = s.tiles.find((t) => t.revealed && !t.used && (t.kind === 'chest' || t.kind === 'potion'));
    if (loot) { run(tapTile, loot.i); continue; }
    if (p.hp < p.maxHp * 0.45 && p.potions > 0) { run(usePotion); potionsUsed++; continue; }
    shopPass(s);

    const cheap = s.tiles.find((t) => t.revealed && isMob(t) && !forecast(p, t.mob).lethal && forecast(p, t.mob).take <= p.hp * 0.3);
    if (cheap) { run(attack, cheap.i); continue; }

    if (canDescend(s) && (s.floor === 1 || s.hasKey)) {
      const left = s.tiles.filter((t) => t.revealed && isMob(t) && !forecast(p, t.mob).lethal && forecast(p, t.mob).take <= p.hp * 0.22);
      if (!left.length || p.hp < p.maxHp * 0.4) { run(tryDescend); trace.push(`F${s.floor}`); continue; }
      run(attack, left[0].i); continue;
    }
    const i = bestSafeTile(s);
    if (i < 0) {
      if (canDescend(s)) { run(tryDescend); continue; }
      // 棋盘被完全识破后，守卫/龙王就摆在明面上且不会自动进预演：
      // 必须主动去夺钥或通关，而不是把「没有暗格」当成无路可走。
      const must = s.tiles.find((t) => t.revealed && (t.kind === 'elite' || t.kind === 'boss') && isMob(t));
      const sig = `${p.hp}|${p.atk}|${p.def}|${p.bombs}|${p.potions}`;
      if (must && (forced !== must.i || forcedSig !== sig)) {
        forced = must.i; forcedSig = sig;
        run(tapTile, must.i);
        continue;
      }
      break;
    }
    run(tapTile, i);
  }
  const res = {
    seed, difficulty, status: s.status, floor: s.floor, lv: s.player.lv, hp: s.player.hp, maxHp: s.player.maxHp,
    atk: s.player.atk, def: s.player.def, kills: s.stats.kills, turns: s.stats.turns, guard,
    stuck: guard >= 4000, dmg, healed, potionsUsed, blocked, aggroDmg, aggroHits, trace: trace.join('>'), floors,
    relics: s.relics.slice(), whet: s.relicState.whet,
  };
  if (verbose) { console.log(res); for (const f of floors) console.log(JSON.stringify(f)); }
  return res;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('simulate.mjs')) {
  const runs = Number(process.argv[2] || 120);
  const diff = process.argv[3];
  if (diff === 'trace') { playRun(process.argv[4] || 'normal', Number(process.argv[5] || 12345), true); }
  else {
    const diffs = diff ? [diff] : ['easy', 'normal', 'hard'];
    for (const d of diffs) {
      const out = [];
      for (let k = 0; k < runs; k++) out.push(playRun(d, 1000 + k * 7919));
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
      const avgAggro = out.reduce((a, r) => a + r.aggroDmg, 0) / out.length;
      const avgHits = out.reduce((a, r) => a + r.aggroHits, 0) / out.length;
      console.log(`${d.padEnd(7)} 胜率 ${(wins / runs * 100).toFixed(1)}%  层数 ${avgFloor.toFixed(2)}  等级 ${avgLv.toFixed(1)}  遗物 ${avgRelics.toFixed(1)}  操作 ${avgTurns.toFixed(0)}  受伤 ${avgDmg.toFixed(0)}  骚扰 ${avgAggro.toFixed(0)}(${(avgAggro / avgDmg * 100).toFixed(0)}%,${avgHits.toFixed(0)}次)  治疗 ${avgHeal.toFixed(0)}  卡死 ${stuck}  分布 ${JSON.stringify(hist)}`);
    }
  }
}