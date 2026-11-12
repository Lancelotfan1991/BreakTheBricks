import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/src/game.js';

const find = (s, kind) => s.tiles.filter((t) => t.kind === kind);
const firstHidden = (s) => s.tiles.find((t) => !t.revealed).i;

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
  const p = { hp: 40, atk: 10, def: 3 };
  const mob = { hp: 25, atk: 8, def: 2 };
  const f = G.forecast(p, mob);
  assert.equal(f.deal, 8);
  assert.equal(f.rounds, 4);       // ceil(25/8)
  assert.equal(f.perHit, 5);
  assert.equal(f.take, 15);        // (4-1)*5
  assert.equal(f.lethal, false);
  assert.equal(G.forecast({ hp: 10, atk: 10, def: 3 }, mob).lethal, true);
  // 一击必杀 → 无伤
  assert.equal(G.forecast({ hp: 5, atk: 99, def: 0 }, { hp: 10, atk: 50, def: 0 }).take, 0);
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

test('陷阱扣血、标记防误触、炸弹无伤清除', () => {
  const s = fresh('normal', 9);
  const trap = find(s, 'trap')[0];
  G.toggleFlag(s, trap.i);
  assert.equal(trap.flagged, true);
  assert.equal(s.flags, 1);
  const hp0 = s.player.hp;
  G.tapTile(s, trap.i);
  assert.equal(trap.revealed, false, '已标记格不应被探索');
  assert.equal(s.player.hp, hp0);
  G.toggleFlag(s, trap.i);
  G.tapTile(s, trap.i);
  assert.equal(trap.revealed, true);
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
  // 读档后可继续操作
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