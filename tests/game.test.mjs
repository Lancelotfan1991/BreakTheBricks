import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/src/game.js';

const find = (s, kind) => s.tiles.filter((t) => t.kind === kind);
const firstHidden = (s) => s.tiles.find((t) => !t.revealed).i;
const hero = (o) => Object.assign(G.createRun('normal', 1).player, o);

function fresh(diff = 'normal', seed = 7) {
  const s = G.createRun(diff, seed);
  G.tapTile(s, 30); // 触发棋盘生成（首点安全）
  return s;
}

test('棋盘规格与首点安全', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = G.createRun('normal', seed);
    assert.equal(s.tiles.length, G.SIZE);
    assert.equal(s.generated, false);
    const safe = 30;
    G.tapTile(s, safe);
    assert.equal(s.generated, true);
    for (const j of [safe, ...G.neighbors(safe)]) {
      const t = s.tiles[j];
      assert.ok(!['monster', 'elite', 'trap', 'boss'].includes(t.kind), `首点安全区 ${j} 出现威胁 ${t.kind}`);
      assert.equal(t.revealed, true, `首点安全区 ${j} 未展开`);
    }
  }
});

test('每层实体数量符合规划，且阶梯/守卫/龙王存在', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let f = 1; f <= G.MAX_FLOOR; f++) {
      const s = G.createRun(diff, 100 + f);
      s.floor = f; G.buildFloor(s); G.ensureBoard(s, 30);
      const p = s.plan;
      assert.equal(find(s, 'monster').length, p.monsters);
      assert.equal(find(s, 'trap').length, p.traps);
      assert.equal(find(s, 'chest').length, p.chests);
      assert.equal(find(s, 'potion').length, p.potions);
      assert.equal(find(s, 'elite').length, p.elite);
      assert.equal(find(s, 'boss').length, p.boss);
      assert.equal(find(s, 'stairs').length, p.stairs);
      assert.equal(find(s, 'altar').length, p.altar);
      if (f < G.MAX_FLOOR) assert.ok(s.stairsIndex >= 0);
      if (f >= 2 && f < G.MAX_FLOOR) assert.equal(find(s, 'elite')[0].mob.elite, true);
      if (f === G.MAX_FLOOR) assert.equal(find(s, 'boss')[0].mob.boss, true);
      const occupied = s.tiles.filter((t) => t.kind !== 'empty').length;
      assert.equal(occupied, p.monsters + p.traps + p.chests + p.potions + p.elite + p.boss + p.stairs + p.altar);
    }
  }
});

test('泛洪露出的宝箱与药水保持未拾取，点击后才收入行囊', () => {
  for (const seed of [1, 5, 7, 42, 99, 123, 2024]) {
    const s = G.createRun('normal', seed);
    G.tapTile(s, 31);
    for (const t of s.tiles) {
      if ((t.kind === 'chest' || t.kind === 'potion') && t.revealed) {
        assert.equal(t.used, false, `种子 ${seed} 的 ${t.kind} 被自动拾取了`);
      }
    }
    const chest = s.tiles.find((t) => t.kind === 'chest' && t.revealed && !t.used);
    if (!chest) continue;
    const b = { ...s.player };
    G.tapTile(s, chest.i);
    assert.equal(chest.used, true, '点击后宝箱应开启');
    const p = s.player;
    assert.ok(p.gold > b.gold || p.potions > b.potions || p.atk > b.atk || p.def > b.def || p.scrolls > b.scrolls || p.bombs > b.bombs, '点击宝箱应获得战利品');
    const after = { ...s.player };
    G.tapTile(s, chest.i);
    assert.deepEqual({ ...s.player }, after, '空宝箱不应重复掉落');
  }
});

test('直接点击的宝箱立即开启，卷轴揭示的宝箱仍需点击', () => {
  const s = G.createRun('normal', 33);
  G.ensureBoard(s, 0);
  const chest = find(s, 'chest')[0];
  G.tapTile(s, chest.i);
  assert.equal(chest.revealed, true);
  assert.equal(chest.used, true, '直接点击应立即开启');

  const s2 = G.createRun('normal', 33);
  G.ensureBoard(s2, 0);
  const target = find(s2, 'chest')[1] || find(s2, 'chest')[0];
  G.setMode(s2, 'scroll');
  G.tapTile(s2, target.i);
  assert.equal(s2.tiles[target.i].revealed, true);
  assert.equal(s2.tiles[target.i].used, false, '卷轴不应自动开箱');
  const b = { ...s2.player };
  G.tapTile(s2, target.i);
  assert.equal(s2.tiles[target.i].used, true);
  const p = s2.player;
  assert.ok(p.gold > b.gold || p.potions > b.potions || p.atk > b.atk || p.def > b.def || p.scrolls > b.scrolls || p.bombs > b.bombs);
});

test('地面药水需点击拾取，标签区分未拾取与已拾取', () => {
  const s = G.createRun('normal', 12);
  G.ensureBoard(s, 0);
  const pot = find(s, 'potion')[0];
  G.setMode(s, 'scroll');
  G.tapTile(s, pot.i);
  assert.equal(pot.revealed, true);
  assert.equal(pot.used, false);
  assert.equal(G.tileLabel(pot), '治疗药水');
  const n = s.player.potions;
  G.tapTile(s, pot.i);
  assert.equal(pot.used, true);
  assert.equal(s.player.potions, n + 1);
  assert.equal(G.tileLabel(pot), '空地');
  G.tapTile(s, pot.i);
  assert.equal(s.player.potions, n + 1, '已拾取不应重复获得');
});

const hiddenAround = (s, i) => G.neighbors(i).filter((j) => {
  const u = s.tiles[j];
  return ['monster', 'elite', 'trap', 'boss'].includes(u.kind) && !u.revealed;
});

test('空宝箱仍给出邻雷数与危险标签，且可双击展开', () => {
  let chorded = 0;
  for (let seed = 1; seed <= 80 && chorded < 3; seed++) {
    const s = G.createRun('normal', seed);
    G.tapTile(s, 30);
    const chest = s.tiles.find((t) => t.kind === 'chest' && !t.revealed);
    if (!chest) continue;
    G.tapTile(s, chest.i);
    assert.equal(chest.used, true);
    assert.equal(chest.n, hiddenAround(s, chest.i).length, `空宝箱 ${chest.i} 邻雷数错误`);
    if (!chest.n) continue;
    assert.equal(G.tileLabel(chest), `空宝箱，危险 ${chest.n}`);

    const nb = G.neighbors(chest.i);
    const threats = hiddenAround(s, chest.i);
    const safe = nb.filter((j) => !s.tiles[j].revealed && !threats.includes(j));
    if (!safe.length) continue;
    for (const j of threats) G.toggleFlag(s, j);
    const before = s.tiles.filter((t) => t.revealed).length;
    const evs = G.tapTile(s, chest.i);
    assert.ok(evs.some((e) => e.type === 'chord'), '空宝箱格应支持双击展开');
    assert.ok(s.tiles.filter((t) => t.revealed).length > before, '双击应展开邻格');
    chorded++;
  }
  assert.ok(chorded >= 3, `可双击的空宝箱样本不足：${chorded}`);
});

test('已拾取药水与已清除怪物同样保留邻雷数', () => {
  let potSeen = 0, mobSeen = 0;
  for (let seed = 1; seed <= 80 && (potSeen < 2 || mobSeen < 2); seed++) {
    const s = G.createRun('normal', seed);
    G.tapTile(s, 30);
    const pot = s.tiles.find((t) => t.kind === 'potion' && !t.revealed);
    if (pot && potSeen < 2) {
      G.tapTile(s, pot.i);
      G.tapTile(s, pot.i);
      assert.equal(pot.used, true);
      const want = hiddenAround(s, pot.i).length;
      assert.equal(pot.n, want);
      assert.equal(G.tileLabel(pot), want ? `空地，危险 ${want}` : '空地');
      if (want) potSeen++;
    }
    const mob = s.tiles.find((t) => t.mob && t.mob.hp > 0 && !t.revealed);
    if (mob && mobSeen < 2) {
      Object.assign(s.player, { atk: 999, hp: 9999, maxHp: 9999 });
      G.tapTile(s, mob.i);
      G.attack(s, mob.i);
      if (mob.mob.hp > 0) continue;
      const want = hiddenAround(s, mob.i).length;
      assert.equal(mob.n, want);
      assert.equal(G.tileLabel(mob), want ? `${mob.mob.name}（已清除），危险 ${want}` : `${mob.mob.name}（已清除）`);
      if (want) mobSeen++;
    }
  }
  assert.ok(potSeen >= 2, `有数字的已拾取药水样本不足：${potSeen}`);
  assert.ok(mobSeen >= 2, `有数字的已清除怪物样本不足：${mobSeen}`);
});

test('数字等于周围未探明威胁数，且随清除递减', () => {
  const s = fresh('normal', 21);
  const check = () => {
    for (const t of s.tiles) {
      const want = G.neighbors(t.i).filter((j) => {
        const u = s.tiles[j];
        return ['monster', 'elite', 'trap', 'boss'].includes(u.kind) && !u.revealed;
      }).length;
      assert.equal(t.n, want, `格 ${t.i} 数字错误`);
    }
  };
  check();
  const mob = find(s, 'monster')[0];
  G.tapTile(s, mob.i);
  if (s.pendingCombat >= 0) G.attack(s, s.pendingCombat);
  G.recalc(s);
  check();
});

test('战斗数学：先手、回合数、反击伤害', () => {
  const p = hero({ hp: 40, atk: 10, def: 3 });
  const mob = { hp: 25, atk: 8, def: 2 };
  const f = G.forecast(p, mob);
  assert.equal(f.deal, 8);
  assert.equal(f.rounds, 4);       // ceil(25/8)
  assert.equal(f.perHit, 5);
  assert.equal(f.take, 15);        // (4-1)*5
  assert.equal(f.lethal, false);
  assert.equal(G.forecast(hero({ hp: 10, atk: 10, def: 3 }), mob).lethal, true);
  // 一击必杀 → 无伤
  assert.equal(G.forecast(hero({ hp: 5, atk: 99, def: 0 }), { hp: 10, atk: 50, def: 0 }).take, 0);
  // 伤害下限为 1
  assert.equal(G.hitDamage(1, 99), 1);
});

test('攻击致死会被拦下，不扣血', () => {
  const s = fresh('hard', 5);
  const mob = find(s, 'monster')[0];
  s.player.hp = 1;
  G.tapTile(s, mob.i);
  const i = s.pendingCombat;
  assert.ok(i >= 0);
  const before = s.player.hp;
  const evs = G.attack(s, i);
  assert.ok(evs.some((e) => e.type === 'blocked'));
  assert.equal(s.player.hp, before);
  assert.equal(s.status, 'playing');
  assert.ok(s.tiles[i].mob.hp > 0);
});

test('陷阱扣血、插旗格可直接点开、炸弹无伤清除', () => {
  const s = fresh('normal', 9);
  const trap = find(s, 'trap')[0];
  G.toggleFlag(s, trap.i);
  assert.equal(trap.flagged, true);
  assert.equal(s.flags, 1);
  const hp0 = s.player.hp;
  G.tapTile(s, trap.i);
  assert.equal(trap.revealed, true, '插旗格可以直接点开，不必先手动拔旗');
  assert.equal(trap.flagged, false, '点开时自动拔旗');
  assert.equal(s.flags, 0, '自动拔旗要归还旗数预算');
  assert.equal(trap.used, true);
  assert.ok(s.player.hp < hp0);

  const s2 = fresh('normal', 9);
  const trap2 = find(s2, 'trap')[0];
  G.tapTile(s2, trap2.i);
  const hp1 = s2.player.hp;
  const bombsBefore = s2.player.bombs;
  const mob = find(s2, 'monster').find((t) => !t.revealed);
  G.tapTile(s2, mob.i);
  G.closePending(s2);
  G.setMode(s2, 'bomb');
  assert.equal(s2.mode, 'bomb');
  G.tapTile(s2, mob.i);
  assert.equal(s2.player.bombs, bombsBefore - 1);
  assert.equal(s2.player.hp, hp1, '炸弹不应造成伤害');
  assert.equal(s2.tiles[mob.i].mob.hp, 0);
  assert.equal(s2.mode, 'explore');
});

test('卷轴安全探明 3×3 并拆除陷阱', () => {
  const s = G.createRun('normal', 33);
  G.ensureBoard(s, 0);
  const trap = find(s, 'trap')[0];
  const hp0 = s.player.hp;
  const area = new Set([trap.i, ...G.neighbors(trap.i)]);
  G.setMode(s, 'scroll');
  const evs = G.tapTile(s, trap.i);
  assert.equal(evs.filter((e) => e.type === 'scroll').length, 1);
  assert.equal(s.player.hp, hp0);
  assert.equal(s.tiles[trap.i].used, true);
  for (const j of area) assert.equal(s.tiles[j].revealed, true);
  for (const t of s.tiles) if (!area.has(t.i)) assert.equal(t.revealed, false, '卷轴不应连锁展开');
  assert.equal(s.pendingCombat, -1, '卷轴不应弹出战斗');
  assert.equal(s.mode, 'explore');
});

test('快速展开：旗数吻合才生效', () => {
  const s = G.createRun('normal', 77);
  G.tapTile(s, 30);
  const num = s.tiles.find((t) => t.revealed && t.kind === 'empty' && t.n > 0);
  assert.ok(num, '应存在数字格');
  const nb = G.neighbors(num.i);
  const hidden = nb.filter((j) => !s.tiles[j].revealed);
  const threats = hidden.filter((j) => ['monster', 'elite', 'trap', 'boss'].includes(s.tiles[j].kind));
  for (const j of threats) G.toggleFlag(s, j);
  const before = s.tiles.filter((t) => t.revealed).length;
  const evs = G.chord(s, num.i);
  assert.ok(evs.some((e) => e.type === 'chord'));
  assert.ok(s.tiles.filter((t) => t.revealed).length > before);
  for (const j of hidden) if (!threats.includes(j)) assert.equal(s.tiles[j].revealed, true);

  const s2 = G.createRun('normal', 77);
  G.tapTile(s2, 30);
  const n2 = s2.tiles.find((t) => t.revealed && t.kind === 'empty' && t.n > 0);
  const evs2 = G.chord(s2, n2.i);
  assert.ok(evs2.some((e) => e.type === 'chordHint'), '旗数不符应只提示');
});

test('钥匙门禁与下一层', () => {
  const s = G.createRun('normal', 12);
  G.ensureBoard(s, 30);
  const st = find(s, 'stairs')[0];
  G.tapTile(s, st.i);
  assert.equal(s.stairsFound, true);
  assert.equal(G.canDescend(s), true, '第 1 层无需钥匙');
  G.tryDescend(s);
  assert.equal(s.floor, 2);
  assert.equal(s.generated, false);
  assert.equal(s.hasKey, false);
  assert.equal(G.canDescend(s), false);
  G.ensureBoard(s, 30);
  const st2 = find(s, 'stairs')[0];
  G.tapTile(s, st2.i);
  assert.equal(s.stairsFound, true);
  assert.equal(G.canDescend(s), false, '第 2 层需要钥匙');
  const evs = G.tryDescend(s);
  assert.ok(evs.some((e) => e.type === 'locked'));
  assert.equal(s.floor, 2);
  const elite = find(s, 'elite')[0];
  G.tapTile(s, elite.i);
  s.player.hp = s.player.maxHp; s.player.atk = 999;
  G.attack(s, elite.i);
  assert.equal(s.hasKey, true);
  assert.equal(G.canDescend(s), true);
  G.tryDescend(s);
  assert.equal(s.floor, 3);
});

test('钥匙守卫在生成时满血可胜（反锁死）', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 60; seed++) {
      const s = G.createRun(diff, seed * 31);
      for (let f = 2; f <= G.MAX_FLOOR; f++) {
        s.floor = f; G.buildFloor(s); G.ensureBoard(s, 30);
        const key = f === G.MAX_FLOOR ? find(s, 'boss')[0] : find(s, 'elite')[0];
        const full = { ...s.player, hp: s.player.maxHp };
        assert.equal(G.forecast(full, key.mob).lethal, false, `${diff} 第${f}层 关键怪物满血不可胜`);
      }
    }
  }
});

test('升级、商店涨价、祭坛三选一', () => {
  const s = fresh('normal', 4);
  const p = s.player;
  p.xp = p.xpNext - 1;
  const lv0 = p.lv, hp0 = p.maxHp;
  const mob = find(s, 'monster')[0];
  G.tapTile(s, mob.i);
  p.atk = 999;
  G.attack(s, mob.i);
  assert.ok(p.lv > lv0, '应至少升 1 级');
  assert.ok(p.atk >= 999 + G.BAL.lvAtk);
  assert.ok(p.maxHp > hp0);

  const price0 = G.shopPrice(s, 'whet');
  p.gold = 10000;
  G.buy(s, 'whet');
  assert.equal(G.shopPrice(s, 'whet'), price0 + G.SHOP.find((x) => x.id === 'whet').step);
  const poor = G.createRun('normal', 4);
  poor.player.gold = 0;
  assert.ok(G.buy(poor, 'whet').some((e) => e.type === 'deny'));

  const s2 = fresh('normal', 4);
  s2.floor = 3; G.buildFloor(s2); G.ensureBoard(s2, 30);
  const altar = find(s2, 'altar')[0];
  G.tapTile(s2, altar.i);
  assert.equal(s2.pendingAltar, altar.i);
  const atkBefore = s2.player.atk;
  s2.player.hp = s2.player.maxHp;
  G.altarChoose(s2, altar.i, 'blood');
  assert.equal(s2.player.atk, atkBefore + G.BAL.bloodAtk);
  assert.equal(altar.used, true);
  assert.equal(s2.pendingAltar, -1);
  const again = G.altarChoose(s2, altar.i, 'pray');
  assert.equal(again.length, 0, '祭坛只能用一次');
});

test('药水：满血不浪费、空包不生效', () => {
  const s = fresh('normal', 8);
  const n = s.player.potions;
  G.usePotion(s);
  assert.equal(s.player.potions, n, '满血不应消耗药水');
  s.player.hp = 1;
  G.usePotion(s);
  assert.equal(s.player.potions, n - 1);
  assert.ok(s.player.hp > 1);
  s.player.potions = 0;
  const hp = s.player.hp;
  G.usePotion(s);
  assert.equal(s.player.hp, hp);
});

test('死亡与通关状态', () => {
  const s = fresh('hard', 15);
  const trap = find(s, 'trap')[0];
  s.player.hp = 1;
  G.tapTile(s, trap.i);
  assert.equal(s.status, 'dead');
  assert.equal(s.player.hp, 0);
  assert.equal(G.tapTile(s, 0).length, 0, '死亡后不再响应');

  const w = G.createRun('normal', 15);
  w.floor = G.MAX_FLOOR; G.buildFloor(w); G.ensureBoard(w, 30);
  const boss = find(w, 'boss')[0];
  G.tapTile(w, boss.i);
  w.player.atk = 9999; w.player.hp = w.player.maxHp;
  const evs = G.attack(w, boss.i);
  assert.ok(evs.some((e) => e.type === 'win'));
  assert.equal(w.status, 'won');
  assert.ok(G.score(w) > 600);
});

test('存档序列化往返一致', () => {
  const s = fresh('normal', 55);
  G.toggleFlag(s, firstHidden(s));
  s.player.gold = 123;
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.deepEqual(back.player, s.player);
  assert.equal(back.tiles.length, G.SIZE);
  assert.equal(back.floor, s.floor);
  assert.equal(back.rng, s.rng);
  assert.equal(G.deserialize('{}'), null);
  assert.equal(G.deserialize('not json'), null);
  assert.equal(G.deserialize(JSON.stringify({ ...s, v: 1 })), null);
  // 读档后可继续操作（标记不消耗回合；插旗格也能直接点开）
  G.toggleFlag(back, firstHidden(back));
  G.tapTile(back, firstHidden(back));
  assert.ok(back.stats.turns > s.stats.turns);
});

test('随机性可复现：同种子同局面', () => {
  const a = G.createRun('normal', 2024);
  const b = G.createRun('normal', 2024);
  G.tapTile(a, 30); G.tapTile(b, 30);
  assert.deepEqual(a.tiles.map((t) => t.kind), b.tiles.map((t) => t.kind));
  const c = G.createRun('normal', 2025);
  G.tapTile(c, 30);
  assert.notDeepEqual(a.tiles.map((t) => t.kind), c.tiles.map((t) => t.kind));
});

test('模式切换与道具耗尽保护', () => {
  const s = fresh('normal', 3);
  G.setMode(s, 'flag'); assert.equal(s.mode, 'flag');
  G.setMode(s, 'flag'); assert.equal(s.mode, 'explore', '再次点击应取消');
  s.player.bombs = 0;
  G.setMode(s, 'bomb'); assert.equal(s.mode, 'explore');
  s.player.scrolls = 0;
  G.setMode(s, 'scroll'); assert.equal(s.mode, 'explore');
  s.player.bombs = 1;
  G.setMode(s, 'bomb'); assert.equal(s.mode, 'bomb');
  G.setMode(s, 'explore'); assert.equal(s.mode, 'explore');
});

test('分数与统计随进程增长', () => {
  const s = fresh('normal', 66);
  const s0 = G.score(s);
  s.player.atk = 9999;
  for (const t of find(s, 'monster').slice(0, 3)) {
    G.tapTile(s, t.i);
    if (s.pendingCombat >= 0) { s.player.hp = s.player.maxHp; G.attack(s, s.pendingCombat); }
  }
  assert.ok(G.score(s) > s0);
  assert.equal(s.stats.kills, 3);
});

/* ─────────── 遗物 ─────────── */
function grant(s, id) {
  s.relicChoices = [id];
  const evs = G.chooseRelic(s, id);
  assert.ok(evs.some((e) => e.type === 'relicGain'), `遗物 ${id} 应可获得`);
}
const hiddenThreats = (s) => s.tiles.filter((t) => !t.revealed && ['monster', 'elite', 'trap', 'boss'].includes(t.kind));
function atFloor(s, f) { s.floor = f; G.buildFloor(s); G.tapTile(s, 30); G.closePending(s); return s; }

test('遗物表完整：20 件、id 唯一、分类与稀有度合法', () => {
  assert.equal(G.RELICS.length, 20);
  assert.equal(new Set(G.RELICS.map((r) => r.id)).size, 20);
  for (const r of G.RELICS) {
    assert.ok(G.RELIC_CATS[r.cat], `${r.id} 分类非法`);
    assert.ok(G.RELIC_RARITY[r.rarity], `${r.id} 稀有度非法`);
    assert.ok(r.name && r.icon && r.desc && r.flavor, `${r.id} 字段缺失`);
    assert.equal(G.relicById(r.id), r);
  }
  for (const cat of Object.keys(G.RELIC_CATS)) assert.ok(G.RELICS.some((r) => r.cat === cat), `${cat} 类为空`);
});

test('击杀钥匙守卫触发三选一：不重复、只能选其中之一', () => {
  const s = fresh('normal', 91);
  atFloor(s, 3);
  const elite = find(s, 'elite')[0];
  s.player.atk = 9999; s.player.hp = s.player.maxHp;
  G.tapTile(s, elite.i);
  const evs = G.attack(s, s.pendingCombat);
  assert.ok(evs.some((e) => e.type === 'relicOffer'), '击杀守卫应触发遗物抽取');
  assert.equal(s.relicChoices.length, G.RELIC_DRAW_COUNT);
  assert.equal(new Set(s.relicChoices).size, 3, '三个选项互不相同');
  const invalid = G.RELICS.find((r) => !s.relicChoices.includes(r.id)).id;
  assert.deepEqual(G.chooseRelic(s, invalid), [], '不在选项中的遗物不能被选');
  assert.ok(s.relicChoices, '非法选择后抽取仍应挂起');
  const pick = s.relicChoices[1];
  G.chooseRelic(s, pick);
  assert.deepEqual(s.relics, [pick]);
  assert.equal(s.relicChoices, null);
  assert.deepEqual(G.chooseRelic(s, pick), [], '不能重复领取同一次抽取');
});

test('炸毁钥匙守卫同样触发抽取，且整局不会抽到已拥有的遗物', () => {
  const s = fresh('normal', 92);
  s.player.bombs = 9;
  for (let f = 2; f <= 7; f++) {
    atFloor(s, f);
    const elite = find(s, 'elite')[0];
    s.tiles[elite.i].revealed = true;
    G.setMode(s, 'bomb');
    const evs = G.tapTile(s, elite.i);
    assert.ok(evs.some((e) => e.type === 'relicOffer'), `第${f}层炸守卫应触发抽取`);
    assert.equal(s.hasKey, true);
    for (const id of s.relicChoices) assert.ok(!s.relics.includes(id), `抽到了已拥有的 ${id}`);
    G.chooseRelic(s, s.relicChoices[0]);
  }
  assert.equal(s.relics.length, 6);
  assert.equal(new Set(s.relics).size, 6);
});

test('遗物抽取可复现：同种子同选项', () => {
  const run = (seed) => {
    const s = fresh('normal', seed);
    atFloor(s, 3);
    const elite = find(s, 'elite')[0];
    s.player.atk = 9999; s.player.hp = s.player.maxHp;
    G.tapTile(s, elite.i); G.attack(s, s.pendingCombat);
    return s.relicChoices.join(',');
  };
  assert.equal(run(4242), run(4242));
});

test('战斗承伤遗物：荆棘甲 / 龙鳞护符 / 玻璃炮 叠乘，预演等于实际结算', () => {
  const s = fresh('normal', 93);
  atFloor(s, 6);
  s.player.maxHp = 400; s.player.hp = 400;
  const mob = find(s, 'monster').find((t) => G.forecast(s.player, t.mob).take >= 8);
  assert.ok(mob, '需要一个承伤足够高的样本');
  const m = mob.mob;
  const raw = () => (Math.ceil(m.hp / Math.max(1, s.player.atk - m.def)) - 1) * Math.max(1, m.atk - s.player.def);
  const base = raw();
  grant(s, 'thornMail');
  assert.equal(s.player.takeFlat, 2);
  assert.equal(G.forecast(s.player, m).take, base - 2);
  grant(s, 'dragonWard');
  assert.equal(G.forecast(s.player, m).take, Math.round(base * 0.75) - 2);
  grant(s, 'glassCannon');
  assert.equal(s.player.atk, 5 + 6, '玻璃炮应 +6 攻击');
  const f = G.forecast(s.player, m);
  assert.equal(f.take, Math.max(0, Math.round(raw() * 0.75 * 1.35) - 2));
  G.tapTile(s, mob.i);
  const evs = G.attack(s, s.pendingCombat);
  const dmg = evs.filter((e) => e.type === 'damage').reduce((a, e) => a + e.amount, 0);
  assert.equal(dmg, f.take, '实际扣血必须等于预演');
});

test('破守者只对精英与龙王生效', () => {
  const s = fresh('normal', 94);
  atFloor(s, 6);
  const elite = find(s, 'elite')[0];
  const small = find(s, 'monster').find((t) => G.forecast(s.player, t.mob).take >= 6);
  const e0 = G.forecast(s.player, elite.mob).take;
  const m0 = G.forecast(s.player, small.mob).take;
  grant(s, 'guardianBane');
  assert.equal(G.forecast(s.player, elite.mob).take, Math.round(e0 * 0.6));
  assert.equal(G.forecast(s.player, small.mob).take, m0, '小怪承伤不应变化');
});

test('势如破竹：每层首杀免伤、之后恢复、下行重置', () => {
  const s = fresh('normal', 95);
  atFloor(s, 5);
  grant(s, 'momentum');
  assert.equal(s.player.freeKill, true);
  const mob = find(s, 'monster').find((t) => G.forecast({ ...s.player, freeKill: false }, t.mob).take > 0);
  assert.equal(G.forecast(s.player, mob.mob).take, 0, '首杀预演应为 0');
  s.player.hp = s.player.maxHp;
  G.tapTile(s, mob.i); G.attack(s, s.pendingCombat);
  assert.equal(s.player.freeKill, false);
  assert.equal(s.relicState.firstKill, true);
  const next = find(s, 'monster').find((t) => t.mob.hp > 0 && G.forecast(s.player, t.mob).take > 0);
  assert.ok(next, '第二次击杀应正常承伤');
  s.stairsFound = true; s.hasKey = true;
  G.tryDescend(s);
  assert.equal(s.player.freeKill, true, '下行后首杀额度应重置');
  assert.equal(s.relicState.firstKill, false);
});

test('势如破竹不会让守卫绕过反锁死上限（首杀被小怪用掉仍满血可胜）', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = G.createRun(diff, seed * 31 + 7);
      grant(s, 'momentum');
      for (let f = 2; f <= G.MAX_FLOOR; f++) {
        atFloor(s, f);
        const key = find(s, 'elite')[0] || find(s, 'boss')[0];
        s.player.freeKill = false; // 模拟首杀额度已被小怪消耗
        const full = { ...s.player, hp: s.player.maxHp };
        assert.equal(G.forecast(full, key.mob).lethal, false, `${diff} 第${f}层 关键怪物满血不可胜`);
      }
    }
  }
});

test('陷阱遗物：钉底靴减伤 30%、猫步 3 次充能免伤、拾荒爪给金币', () => {
  const base = fresh('normal', 96);
  atFloor(base, 3);
  base.player.hp = base.player.maxHp;
  const raw = G.tapTile(base, find(base, 'trap')[0].i).find((e) => e.type === 'damage').amount;

  const soles = fresh('normal', 96);
  atFloor(soles, 3);
  grant(soles, 'spikeSoles');
  soles.player.hp = soles.player.maxHp;
  assert.equal(G.tapTile(soles, find(soles, 'trap')[0].i).find((e) => e.type === 'damage').amount, Math.max(1, Math.round(raw * 0.7)));

  const cat = fresh('normal', 96);
  atFloor(cat, 6);
  grant(cat, 'carefulStep');
  assert.equal(cat.relicState.trapWard, G.RELIC_WARD_CHARGES);
  cat.player.hp = cat.player.maxHp;
  const traps = find(cat, 'trap');
  assert.ok(traps.length >= 3, '第 6 层应有三处陷阱');
  for (let k = 0; k < 3; k++) {
    const evs = G.tapTile(cat, traps[k].i);
    assert.ok(!evs.some((e) => e.type === 'damage'), `第 ${k + 1} 次踩陷阱应免伤`);
    assert.ok(evs.some((e) => e.type === 'disarm'));
    assert.equal(cat.relicState.trapWard, 2 - k);
  }
  assert.equal(cat.player.hp, cat.player.maxHp);
  cat.stairsFound = true; cat.hasKey = true;
  G.tryDescend(cat);
  assert.equal(cat.relicState.trapWard, 0, '充能按整局计算，下行不重置');
  G.tapTile(cat, 30); G.closePending(cat);
  const next = find(cat, 'trap').find((t) => !t.revealed);
  assert.ok(G.tapTile(cat, next.i).some((e) => e.type === 'damage'), '充能耗尽后应正常受伤');

  const scav = fresh('normal', 96);
  atFloor(scav, 3);
  grant(scav, 'trapSalvage');
  scav.player.hp = scav.player.maxHp;
  const g0 = scav.player.gold;
  G.tapTile(scav, find(scav, 'trap')[0].i);
  assert.equal(scav.player.gold - g0, 10);
});

test('冲击波：炸弹连带摧毁周围陷阱并刷新数字', () => {
  const s = fresh('normal', 97);
  const mob = find(s, 'monster')[0];
  s.tiles[mob.i].revealed = true;
  const around = G.neighbors(mob.i).slice(0, 2).map((j) => s.tiles[j]);
  for (const t of around) { t.kind = 'trap'; t.revealed = false; t.used = false; t.mob = null; t.chest = null; }
  G.recalc(s);
  grant(s, 'blastWave');
  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  const evs = G.tapTile(s, mob.i);
  assert.ok(evs.some((e) => e.type === 'bomb'));
  for (const t of around) assert.ok(t.used && t.revealed, '周围陷阱应被掀掉');
  assert.equal(s.player.hp, s.player.maxHp, '被摧毁的陷阱不应造成伤害');
  for (const t of s.tiles) {
    const live = G.neighbors(t.i).filter((j) => { const x = s.tiles[j]; return !x.revealed && ['monster', 'elite', 'trap', 'boss'].includes(x.kind); }).length;
    assert.equal(t.n, live, '数字应随之刷新');
  }
});

test('补给遗物：铁胃 / 铸币印 / 深口袋 / 神恩', () => {
  const a = fresh('normal', 98);
  a.player.hp = 10; G.usePotion(a);
  assert.equal(a.player.hp, 10 + Math.ceil(32 * 0.3));
  const b = fresh('normal', 98);
  grant(b, 'ironStomach');
  b.player.hp = 10; G.usePotion(b);
  assert.equal(b.player.hp, 10 + Math.ceil(32 * 0.38));

  const c = fresh('normal', 98);
  grant(c, 'mint');
  const ch = find(c, 'chest')[0];
  ch.chest = { type: 'gold', amount: 20 }; ch.revealed = true; ch.used = false;
  const g0 = c.player.gold;
  G.tapTile(c, ch.i);
  assert.equal(c.player.gold - g0, 30);

  const d = fresh('normal', 98);
  const before = G.shopPrice(d, 'whet');
  grant(d, 'deepPockets');
  assert.equal(G.shopPrice(d, 'whet'), Math.round(before * 0.75));
  d.player.gold = 999;
  G.buy(d, 'whet');
  assert.equal(G.shopPrice(d, 'whet'), Math.round((before + 14) * 0.75), '涨价后仍应打折');

  const e = fresh('normal', 98);
  atFloor(e, 3);
  grant(e, 'altarGrace');
  const altar = find(e, 'altar')[0];
  e.player.hp = 5;
  G.altarChoose(e, altar.i, 'pray');
  assert.equal(e.player.hp, 5 + Math.ceil(e.player.maxHp * 0.75));
});

test('下行遗物：探矿罗盘翻倍、炼金壶隔层给药、旗帜领主按正确旗数回血', () => {
  const s = fresh('normal', 99);
  grant(s, 'prospector'); grant(s, 'alchemist');
  const p0 = s.player.potions, g0 = s.player.gold;
  s.stairsFound = true;
  G.tryDescend(s);
  assert.equal(s.player.potions, p0, '第 1 层（奇数）下行不应给药');
  assert.equal(s.player.gold - g0, (10 + 1 * 3) * 2);
  s.stairsFound = true; s.hasKey = true;
  const p1 = s.player.potions;
  G.tryDescend(s);
  assert.equal(s.player.potions, p1 + 1, '第 2 层（偶数）下行应给药');

  const b = fresh('normal', 99);
  grant(b, 'bannerLord');
  for (const t of hiddenThreats(b).slice(0, 3)) G.toggleFlag(b, t.i);
  G.toggleFlag(b, b.tiles.find((t) => !t.revealed && t.kind === 'empty').i);
  b.player.hp = 10; b.stairsFound = true;
  G.tryDescend(b);
  assert.equal(b.player.hp, 10 + Math.ceil(32 * 0.05) + 6, '只有插对的 3 面旗计入');

  const c = fresh('normal', 99);
  grant(c, 'bannerLord');
  for (const t of hiddenThreats(c)) G.toggleFlag(c, t.i);
  c.player.hp = 1; c.stairsFound = true;
  G.tryDescend(c);
  assert.ok(c.player.hp <= 1 + Math.ceil(32 * 0.05) + G.RELIC_BANNER_CAP, '回血应有上限');
});

test('贪婪之心：宝箱金币翻倍、药水箱变 25 金币', () => {
  const s = fresh('normal', 100);
  grant(s, 'greedyHeart');
  const chests = find(s, 'chest');
  assert.ok(chests.length >= 2);
  chests[0].chest = { type: 'gold', amount: 20 }; chests[0].revealed = true; chests[0].used = false;
  const g0 = s.player.gold;
  G.tapTile(s, chests[0].i);
  assert.equal(s.player.gold - g0, 40);
  chests[1].chest = { type: 'potion', amount: 1 }; chests[1].revealed = true; chests[1].used = false;
  const p0 = s.player.potions, g1 = s.player.gold;
  G.tapTile(s, chests[1].i);
  assert.equal(s.player.potions, p0, '不应再产出药水');
  assert.equal(s.player.gold - g1, 25);
});

test('磨刀之魂：击杀叠攻击，封顶 6 次', () => {
  const s = fresh('normal', 101);
  atFloor(s, 5);
  grant(s, 'whetSoul');
  s.player.atk = 9999;
  s.player.xpNext = 1e9; // 排除升级带来的攻击增长，只观察遗物叠加
  const base = s.player.atk;
  const mobs = find(s, 'monster').slice(0, 9);
  assert.ok(mobs.length >= 8);
  for (const t of mobs) {
    s.player.hp = s.player.maxHp;
    G.tapTile(s, t.i);
    if (s.pendingCombat >= 0) G.attack(s, s.pendingCombat);
  }
  assert.equal(s.relicState.whet, G.RELIC_WHET_CAP);
  assert.equal(s.player.atk, base + G.RELIC_WHET_CAP);
});

test('血之契：攻击 +4、上限 −8、当前生命被夹住', () => {
  const s = fresh('normal', 102);
  const hp0 = s.player.hp, max0 = s.player.maxHp, atk0 = s.player.atk;
  grant(s, 'bloodPact');
  assert.equal(s.player.atk, atk0 + 4);
  assert.equal(s.player.maxHp, max0 - 8);
  assert.equal(s.player.hp, Math.min(hp0, max0 - 8));
  assert.ok(s.player.hp > 0);
});

test('无遗物时战斗数学与旧版一致，遗物状态可存档往返', () => {
  const s = fresh('normal', 103);
  const mob = find(s, 'monster')[0];
  const p = s.player;
  const legacy = (Math.ceil(mob.mob.hp / Math.max(1, p.atk - mob.mob.def)) - 1) * Math.max(1, mob.mob.atk - p.def);
  assert.equal(G.forecast(p, mob.mob).take, legacy);
  assert.equal(p.takeMul, 1); assert.equal(p.takeFlat, 0); assert.equal(p.eliteTakeMul, 1); assert.equal(p.freeKill, false);

  atFloor(s, 3);
  const elite = find(s, 'elite')[0];
  p.atk = 9999; p.hp = p.maxHp;
  G.tapTile(s, elite.i); G.attack(s, s.pendingCombat);
  G.chooseRelic(s, s.relicChoices[0]);
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.deepEqual(back.relics, s.relics);
  assert.deepEqual(back.relicState, s.relicState);
  assert.equal(back.player.takeMul, p.takeMul);
  assert.equal(G.deserialize(JSON.stringify({ ...s, v: 3 })), null, '旧版本存档应被拒绝');
});
// ---------- 惊扰 ----------
function arena(seed = 7) {
  const s = G.createRun('normal', seed);
  G.tapTile(s, 30);
  for (const t of s.tiles) {
    t.kind = 'empty'; t.mob = null; t.chest = null;
    t.used = false; t.revealed = false; t.flagged = false;
  }
  s.threatTotal = 0;
  s.aggroClock = null;
  G.recalc(s);
  return s;
}
function putMob(s, i, over = {}) {
  const t = s.tiles[i];
  t.kind = 'monster';
  t.mob = { id: 'bat', name: '测试蝠', icon: 'bat', flavor: '', hp: 20, maxHp: 20, atk: 10, def: 0, xp: 1, gold: 1, elite: false, boss: false, awake: false, ...over };
  G.recalc(s);
  return t;
}
function withPeriod(n, fn) {
  const old = G.BAL.aggroPeriod;
  G.BAL.aggroPeriod = n;
  try { fn(); } finally { G.BAL.aggroPeriod = old; }
}

test('惊扰：标记与无效点击不消耗回合，翻开才推进时钟', () => {
  const s = arena();
  const m = putMob(s, 0);
  G.tapTile(s, 1);
  assert.equal(m.mob.awake, true, '相邻翻开即惊扰');
  assert.equal(s.aggroClock, G.BAL.aggroPeriod - 1, '惊扰的那次翻开本身算一回合');
  const turns = s.stats.turns, clock = s.aggroClock;
  G.setMode(s, 'flag');
  for (let k = 0; k < 12; k++) G.tapTile(s, 5);
  G.setMode(s, 'explore');
  G.tapTile(s, 1);
  assert.equal(s.stats.turns, turns, '标记 / 重复点击已探明格不消耗回合');
  assert.equal(s.aggroClock, clock, '标记不推进惊扰时钟');
  G.tapTile(s, 7);
  assert.equal(s.aggroClock, clock - 1, '翻开新格推进一回合');
  assert.equal(s.stats.turns, turns + 1);
});

test('惊扰：倒计时归零造成伤害，但不致死，命中后重置', () => {
  withPeriod(2, () => {
    const s = arena();
    putMob(s, 0, { atk: 40 });
    s.player.def = 0; s.player.maxHp = 40; s.player.hp = 5;
    G.tapTile(s, 1);
    assert.equal(s.player.hp, 5, '倒计时未到不掉血');
    G.tapTile(s, 7);
    assert.equal(s.player.hp, 1, '骚扰压到 1 血为止，不致死');
    assert.equal(s.status, 'playing');
    assert.equal(s.aggroClock, 2, '命中后重置倒计时');
  });
});

test('惊扰：伤害走战斗减免，且至少 1 点', () => {
  const s = arena();
  const m = putMob(s, 0, { atk: 40 });
  s.player.def = 0;
  assert.equal(G.aggroDamage(s.player, m.mob), 10);
  grant(s, 'dragonWard');
  assert.equal(G.aggroDamage(s.player, m.mob), 8);
  grant(s, 'thornMail');
  assert.equal(G.aggroDamage(s.player, m.mob), 6);
  m.mob.atk = 2;
  assert.equal(G.aggroDamage(s.player, m.mob), 1, '减免后仍至少 1 点');
});

test('惊扰：全场共用一个时钟，每次只有最凶的那只出手', () => {
  withPeriod(2, () => {
    const s = arena();
    putMob(s, 0, { atk: 10 });
    const strong = putMob(s, 2, { atk: 40 });
    s.player.def = 0; s.player.maxHp = 200; s.player.hp = 200;
    G.tapTile(s, 1);
    const hp = s.player.hp;
    G.tapTile(s, 7);
    assert.equal(hp - s.player.hp, 10, '两只惊扰也只出手一次，取最凶的');
    s.player.atk = 999;
    G.tapTile(s, 2);
    G.attack(s, 2);
    assert.equal(strong.mob.hp, 0);
    assert.equal(G.aggroSummary(s).dmg, 3, '杀掉最凶的之后，下一击变轻');
  });
});

test('惊扰：击杀后不再骚扰，下行重置', () => {
  withPeriod(2, () => {
    const s = arena();
    const m = putMob(s, 0, { hp: 1, atk: 40 });
    s.player.atk = 99; s.player.maxHp = 40; s.player.hp = 30;
    G.tapTile(s, 1);
    G.tapTile(s, 0);
    G.attack(s, 0);
    assert.equal(m.mob.hp, 0);
    assert.equal(s.aggroClock, null, '最后一只被清除后时钟停摆');
    const hp = s.player.hp;
    G.tapTile(s, 7); G.tapTile(s, 8);
    assert.equal(s.player.hp, hp, '已清除的怪物不再骚扰');
    s.floor = 2;
    G.buildFloor(s);
    assert.equal(s.aggroClock, null);
    assert.ok(s.tiles.every((t) => !t.mob || !t.mob.awake), '下行后惊扰全部重置');
  });
});

test('惊扰：汇总只给数量/回合/伤害，不泄露未探明位置', () => {
  const s = arena();
  const a = putMob(s, 0, { atk: 40 });
  putMob(s, 2, { atk: 20 });
  putMob(s, 6, { atk: 40 });
  s.player.def = 0; s.player.maxHp = 200; s.player.hp = 200;
  assert.equal(G.aggroSummary(s), null, '未惊扰时不显示');
  G.tapTile(s, 1);
  const sum = G.aggroSummary(s);
  assert.equal(sum.count, 2, '一次翻开可同时惊扰两只');
  assert.equal(sum.next, G.BAL.aggroPeriod - 1);
  assert.equal(sum.dmg, 10, '预演的是最凶那只的伤害');
  assert.ok(!('i' in sum) && !('tiles' in sum), '汇总不含坐标');
  assert.equal(G.tileLabel(s.tiles[6]), '未探索', '未探明怪物不暴露身份');
  assert.equal(G.tileLabel(a), '未探索', '被惊扰但未探明的怪物同样不暴露身份');
  G.tapTile(s, 0);
  assert.ok(G.tileLabel(a, s.aggroClock).includes('回合后骚扰'), '已探明怪物显示倒计时');
});

test('惊扰：时钟可存档往返', () => {
  const s = arena();
  putMob(s, 0);
  G.tapTile(s, 1);
  G.tapTile(s, 7);
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.equal(back.aggroClock, s.aggroClock);
  assert.equal(back.tiles[0].mob.awake, true);
  assert.deepEqual(G.aggroSummary(back), G.aggroSummary(s));
});

test('钥匙守卫：2～7 层必定各有一名，独占一格且计入邻雷数', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let f = 1; f <= G.MAX_FLOOR; f++) {
      const s = G.createRun('normal', seed);
      s.floor = f;
      G.buildFloor(s);
      G.ensureBoard(s, 30);
      const guards = find(s, 'elite');
      assert.equal(guards.length, f >= 2 && f < G.MAX_FLOOR ? 1 : 0, `seed${seed} 第${f}层守卫数量`);
      for (const t of s.tiles) {
        assert.ok(!(t.chest && t.mob), '宝箱与怪物不可能同格');
        if (t.kind === 'elite') assert.ok(t.mob && t.mob.hp > 0, '守卫格必须带存活怪物');
      }
      if (!guards.length) continue;
      // 守卫就是一格「雷」：玩家把剩余暗格全标成雷时，它正在其中
      assert.ok(G.neighbors(guards[0].i).every((j) => s.tiles[j].n >= 1), '守卫计入周围数字');
    }
  }
});

test('钥匙守卫：攻击与炸弹两条路径都必定掉钥匙，不存在上锁死局', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let f = 2; f < G.MAX_FLOOR; f++) {
      const mk = () => {
        const s = G.createRun('normal', seed);
        s.floor = f;
        G.buildFloor(s);
        G.ensureBoard(s, 30);
        return s;
      };
      const a = mk();
      const gi = find(a, 'elite')[0].i;
      Object.assign(a.player, { atk: 9999, hp: 99999, maxHp: 99999 });
      a.tiles[gi].revealed = true;
      G.attack(a, gi);
      assert.equal(a.hasKey, true, `seed${seed} 第${f}层攻击夺钥`);

      const b = mk();
      b.player.bombs = 3;
      b.tiles[gi].revealed = true;
      G.setMode(b, 'bomb');
      G.tapTile(b, gi);
      assert.equal(b.hasKey, true, `seed${seed} 第${f}层炸弹夺钥`);
      assert.equal(G.remainingThreats(a), G.remainingThreats(b), '两条路径清掉的威胁数一致');
    }
  }
});

test('旗数预算：上限＝本层威胁总数，超限拒绝，拔旗后归还', () => {
  const s = fresh('normal', 21);
  const total = s.threatTotal;
  assert.equal(total, s.plan.monsters + s.plan.traps + (s.plan.elite ? 1 : 0) + (s.plan.boss ? 1 : 0));
  const hidden = s.tiles.filter((t) => !t.revealed);
  assert.ok(hidden.length > total, '暗格应多于威胁数，预算才有约束力');
  for (const t of hidden.slice(0, total)) G.toggleFlag(s, t.i);
  assert.equal(s.flags, total);

  const extra = hidden[total];
  const out = G.toggleFlag(s, extra.i);
  assert.equal(extra.flagged, false, '超预算不能再插旗');
  assert.equal(s.flags, total);
  assert.ok(out.some((e) => e.type === 'flagLimit'), '应给出旗数用尽事件');

  G.toggleFlag(s, hidden[0].i);
  assert.equal(s.flags, total - 1);
  G.toggleFlag(s, extra.i);
  assert.equal(extra.flagged, true, '拔掉一面就能再插');
  assert.equal(s.flags, total);

  s.floor = 2; G.buildFloor(s);
  assert.equal(s.flags, 0, '下行重置旗子');
  assert.ok(s.threatTotal > 0, '下行重置预算');
});

test('惊扰：插旗＝规避，被标记的怪物不再骚扰，拔旗后恢复', () => {
  const s = fresh('normal', 33);
  const mob = find(s, 'monster').find((t) => !t.revealed);
  // 只留这一只活口，骚扰来源才唯一可断言
  for (const t of s.tiles) if (t.mob && t.i !== mob.i) t.mob.hp = 0;
  mob.mob.awake = true; mob.mob.atk = 50; s.aggroClock = 1;
  const provoke = () => {
    const t = s.tiles.find((x) => !x.revealed && x.kind === 'monster' && x.i !== mob.i);
    return G.tapTile(s, t.i);
  };

  assert.equal(G.aggroSummary(s).count, 1);
  assert.ok(provoke().some((e) => e.type === 'aggro' && e.i === mob.i), '未插旗时它会出手');

  G.toggleFlag(s, mob.i);
  assert.equal(G.aggroSummary(s), null, '插旗后不再计入惊扰');
  s.aggroClock = 1;
  const hp = s.player.hp;
  assert.ok(!provoke().some((e) => e.type === 'aggro'), '插旗期间不受骚扰');
  assert.equal(s.player.hp, hp);

  G.toggleFlag(s, mob.i);
  s.aggroClock = 1;
  assert.ok(provoke().some((e) => e.type === 'aggro' && e.i === mob.i), '拔旗后它又是最凶的那只');
  assert.equal(G.aggroSummary(s).count, 1, '拔旗后重新计入惊扰');
});

test('插旗的怪物可以直接点开进入战斗预演，无需先手动拔旗', () => {
  const s = fresh('normal', 41);
  const mob = find(s, 'monster').find((t) => !t.revealed);
  G.toggleFlag(s, mob.i);
  assert.equal(s.flags, 1);
  const out = G.tapTile(s, mob.i);
  assert.equal(mob.revealed, true);
  assert.equal(mob.flagged, false, '点开时自动拔旗');
  assert.equal(s.flags, 0, '自动拔旗归还预算');
  assert.equal(s.pendingCombat, mob.i, '直接进入战斗预演');
  assert.ok(out.some((e) => e.type === 'encounter' && e.i === mob.i));
  G.closePending(s);
  assert.equal(s.pendingCombat, -1, '预演可以悄悄离开');
});

test('卷轴与冲击波掀开插旗格时，旗数预算同步归还', () => {
  const s = fresh('normal', 52);
  s.player.scrolls = 3;
  const trap = find(s, 'trap').find((t) => !t.revealed);
  G.toggleFlag(s, trap.i);
  assert.equal(s.flags, 1);
  G.setMode(s, 'scroll');
  G.tapTile(s, trap.i);
  assert.equal(trap.revealed, true);
  assert.equal(trap.flagged, false);
  assert.equal(s.flags, 0, '卷轴掀开插旗格后计数不漂移');

  let s2 = null, tr = null, an = null;
  const kinds = ['monster', 'elite', 'trap', 'boss'];
  for (let seed = 60; seed < 120 && !tr; seed++) {
    s2 = fresh('normal', seed);
    for (const t of find(s2, 'trap')) {
      if (t.revealed) continue;
      const a = G.neighbors(t.i).map((j) => s2.tiles[j]).find((x) => kinds.includes(x.kind) && !x.used);
      if (a) { tr = t; an = a; break; }
    }
  }
  assert.ok(tr, '应能找到与威胁相邻的陷阱');
  s2.relics.push('blastWave');
  s2.player.bombs = 3;
  G.toggleFlag(s2, tr.i);
  assert.equal(s2.flags, 1);
  an.revealed = true;
  G.setMode(s2, 'bomb');
  G.tapTile(s2, an.i);
  assert.equal(tr.revealed, true, '冲击波连带掀开它');
  assert.equal(tr.flagged, false);
  assert.equal(s2.flags, 0, '冲击波清旗后预算不漂移');
});

test('快速展开仍然跳过插旗格', () => {
  const s = fresh('normal', 17);
  const num = s.tiles.find((t) => t.revealed && t.n > 0 && G.neighbors(t.i).some((j) => !s.tiles[j].revealed));
  assert.ok(num, '应存在带暗格邻居的数字格');
  const nb = G.neighbors(num.i).filter((j) => !s.tiles[j].revealed);
  const flagged = nb.slice(0, num.n);
  for (const j of flagged) G.toggleFlag(s, j);
  assert.equal(s.flags, num.n);
  G.tapTile(s, num.i);
  for (const j of flagged) assert.equal(s.tiles[j].revealed, false, '插旗格不被快速展开掀开');
});
