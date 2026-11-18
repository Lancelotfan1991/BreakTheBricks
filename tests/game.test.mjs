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
      assert.ok(s.stairsIndex >= 0, '每层都应有下行阶梯（含龙王层）');
      assert.equal(p.stairs, 1);
      const bossFloor = G.isBossFloor(f);
      assert.equal(p.boss, bossFloor ? 1 : 0);
      assert.equal(p.elite, !bossFloor && f >= 2 ? 1 : 0);
      if (f >= 2 && !bossFloor) assert.equal(find(s, 'elite')[0].mob.elite, true);
      if (bossFloor) assert.equal(find(s, 'boss')[0].mob.boss, true);
      const occupied = s.tiles.filter((t) => t.kind !== 'empty').length;
      assert.equal(occupied, p.monsters + p.traps + p.chests + p.potions + p.elite + p.boss + p.stairs + p.altar);
      assert.ok(p.monsters <= 20, `第 ${f} 层怪物数量应封顶`);
      assert.ok(p.traps <= 6, `第 ${f} 层陷阱数量应封顶`);
      assert.ok(p.chests <= 8, `第 ${f} 层宝箱数量应封顶`);
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

test('直接点击的宝箱只揭示，必须再点一次才开启', () => {
  const s = G.createRun('normal', 33);
  G.ensureBoard(s, 0);
  const chest = find(s, 'chest')[0];
  G.tapTile(s, chest.i);
  assert.equal(chest.revealed, true);
  assert.equal(chest.used, false, '翻开只是看见宝箱，不等于开启');
  G.tapTile(s, chest.i);
  assert.equal(chest.used, true, '第二次点击才开启');

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
    assert.equal(chest.revealed, true);
    G.tapTile(s, chest.i);
    assert.equal(chest.used, true, '翻开后还要点一次才开箱');
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

test('下行阶梯保留邻雷数，标签带上危险数', () => {
  let seen = 0;
  for (let seed = 1; seed <= 80 && seen < 3; seed++) {
    const s = G.createRun('normal', seed);
    G.tapTile(s, 30);
    const st = s.tiles.find((t) => t.kind === 'stairs');
    if (!st) continue;
    G.tapTile(s, st.i);
    assert.equal(st.revealed, true);
    const want = hiddenAround(s, st.i).length;
    assert.equal(st.n, want, `阶梯 ${st.i} 邻雷数错误`);
    assert.equal(G.tileLabel(st), want ? `下行阶梯，危险 ${want}` : '下行阶梯');
    if (want) seen++;
  }
  assert.ok(seen >= 3, `有数字的阶梯样本不足：${seen}`);
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
      assert.equal(G.tileLabel(mob), want ? `${G.mobName(mob.mob)}（已清除），危险 ${want}` : `${G.mobName(mob.mob)}（已清除）`);
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
  mob.revealed = true; // 已探明的怪物给普通预演，没有偷袭加成
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
  const hit = s.log[s.log.length - 1];
  assert.equal(hit.k, 'log.trap.hit', '日志应明确说明踩中了陷阱');
  assert.equal(hit.p.dmg, hp0 - s.player.hp, '日志伤害应与实际扣血一致');

  const s2 = fresh('normal', 9);
  const trap2 = find(s2, 'trap')[0];
  G.tapTile(s2, trap2.i);
  const hp1 = s2.player.hp;
  const bombsBefore = s2.player.bombs;
  const mob = find(s2, 'monster').find((t) => !t.revealed);
  mob.revealed = true; // 已探明才走普通预演，炸弹测试不受偷袭伤害干扰
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

test('怪物属性只由深度决定，不随玩家面板变化', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let f = 2; f <= 20; f += 3) {
      const weak = G.createRun(diff, 777);
      const strong = G.createRun(diff, 777);
      weak.floor = f; strong.floor = f;
      Object.assign(weak.player, { atk: 5, def: 1, maxHp: 32 });
      Object.assign(strong.player, { atk: 500, def: 200, maxHp: 2000 });
      G.buildFloor(weak); G.buildFloor(strong);
      G.ensureBoard(weak, 30); G.ensureBoard(strong, 30);
      for (const kind of ['monster', 'elite', 'boss']) {
        const sig = (s) => find(s, kind).map((t) => `${t.i}:${t.mob.hp}/${t.mob.atk}/${t.mob.def}`).sort();
        assert.equal(find(strong, kind).length, find(weak, kind).length, `${diff} 第${f}层 ${kind} 数量`);
        assert.deepEqual(sig(strong), sig(weak), `${diff} 第${f}层 ${kind} 不应随玩家面板变化`);
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
  assert.equal(altar.revealed, true);
  assert.equal(s2.pendingAltar, -1, '翻开祭坛只揭示，不直接弹出献祭');
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

test('升级三选一：三项不同属性、稀有度分档、选中后直接写进面板', () => {
  const s = fresh('normal', 200);
  const p = s.player;
  p.xp = p.xpNext - 1;
  const mob = find(s, 'monster')[0];
  G.tapTile(s, mob.i);
  p.atk = 9999;
  G.attack(s, mob.i);
  assert.ok(Array.isArray(s.levelChoices), '升级应弹出三选一');
  assert.equal(s.levelChoices.length, G.LEVEL_DRAW_COUNT);
  assert.equal(new Set(s.levelChoices.map(G.levelChoiceStat)).size, G.LEVEL_DRAW_COUNT, '三项来自不同属性');
  for (const id of s.levelChoices) {
    assert.ok(['common', 'rare', 'epic'].includes(G.levelChoiceRarity(id)));
    assert.ok(G.levelChoiceAmount(id) > 0);
    assert.ok(G.levelChoiceDesc(id).includes(String(G.levelChoiceAmount(id))), '描述必须写出具体数值');
  }
  const pick = s.levelChoices[0];
  const stat = G.levelChoiceStat(pick), n = G.levelChoiceAmount(pick);
  const before = { atk: p.atk, def: p.def, maxHp: p.maxHp, hp: p.hp };
  G.chooseLevel(s, pick);
  assert.equal(s.levelChoices, null);
  assert.equal(s.levelTaken[stat], n);
  if (stat === 'atk') assert.equal(p.atk, before.atk + n);
  if (stat === 'def') assert.equal(p.def, before.def + n);
  if (stat === 'maxHp') {
    assert.equal(p.maxHp, before.maxHp + n);
    assert.equal(p.hp, Math.min(p.maxHp, before.hp + n));
  }
  assert.deepEqual(G.chooseLevel(s, pick), [], '同一批不能选第二次');
  const absent = G.LEVEL_STATS.find((st) => !s.levelChoices?.map(G.levelChoiceStat).includes(st.id));
  if (absent) assert.deepEqual(G.chooseLevel(s, absent.id + ':common'), [], '不在选项里的属性不能被选');
});

test('升级奖励排队：连升多级时选完一批再翻下一批', () => {
  const s = arena();
  putMob(s, 0, { hp: 1, atk: 0, xp: 30 });
  s.tiles[0].revealed = true;
  s.player.xp = 0; s.player.xpNext = 1;
  const lv0 = s.player.lv;
  G.attack(s, 0);
  assert.ok(s.player.lv - lv0 >= 2, '应连升多级');
  assert.equal(s.levelOffers, s.player.lv - lv0 - 1, '其余升级排队等待');
  let guard = 0;
  while (s.levelChoices && guard++ < 10) {
    assert.equal(s.levelChoices.length, G.LEVEL_DRAW_COUNT);
    G.chooseLevel(s, s.levelChoices[0]);
  }
  assert.equal(s.levelOffers, 0);
  assert.equal(Object.keys(s.levelTaken).length >= 1, true);
});

test('升级重置：4 金币起、每次 +4，金币不足时拒绝且不扣钱', () => {
  const s = fresh('normal', 201);
  const p = s.player;
  p.xp = p.xpNext - 1;
  const mob = find(s, 'monster')[0];
  G.tapTile(s, mob.i);
  p.atk = 9999;
  G.attack(s, mob.i);
  assert.ok(s.levelChoices);
  const first = s.levelChoices.map(G.levelChoiceStat);
  p.gold = 20;
  assert.equal(G.levelRerollCost(s), G.LEVEL_REROLL_BASE);
  const evs = G.rerollLevel(s);
  assert.ok(evs.some((e) => e.type === 'reroll' && e.cost === G.LEVEL_REROLL_BASE));
  assert.equal(p.gold, 20 - G.LEVEL_REROLL_BASE);
  assert.equal(s.levelReroll, 1);
  assert.equal(G.levelRerollCost(s), G.LEVEL_REROLL_BASE + G.LEVEL_REROLL_STEP);
  for (const st of s.levelChoices.map(G.levelChoiceStat)) assert.ok(!first.includes(st), '重置应换一批新属性');
  p.gold = 0;
  const before = s.levelChoices.slice();
  assert.ok(G.rerollLevel(s).some((e) => e.type === 'deny'));
  assert.deepEqual(s.levelChoices, before);
  assert.equal(p.gold, 0);
});

test('每层金币/回复/经验加成在下行时结算', () => {
  const s = fresh('normal', 202);
  atFloor(s, 2);
  const p = s.player;
  p.hp = 10;
  s.levelTaken = { gold: 8, heal: 8, xpFloor: 12 };
  const gold0 = p.gold, lv0 = p.lv, xp0 = p.xp;
  s.stairsFound = true; s.hasKey = true;
  const evs = G.tryDescend(s);
  assert.ok(evs.filter((e) => e.type === 'gold').some((e) => e.amount >= 8), '应额外结算每层金币');
  const healed = evs.filter((e) => e.type === 'heal').reduce((a, e) => a + e.amount, 0);
  assert.equal(healed, 8 + Math.ceil(p.maxHp * 0.05), '每层回复应叠加下行的 5% 回复');
  assert.ok(p.gold > gold0 && (p.xp > xp0 || p.lv > lv0), '经验加成应到账');
  assert.equal(s.floor, 3);
});

test('击杀经验加成：每次击杀额外计入经验', () => {
  const s = arena();
  putMob(s, 0, { hp: 1, atk: 0, xp: 10 });
  s.tiles[0].revealed = true;
  s.levelTaken = { xpKill: 6 };
  const evs = G.attack(s, 0);
  const kill = evs.find((e) => e.type === 'kill');
  assert.equal(kill.xp, 16);
});

test('宝箱掉落里卷轴与炸弹各占约两成', () => {
  let total = 0, scroll = 0, bomb = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const s = G.createRun('normal', seed);
    s.floor = 3; G.buildFloor(s); G.ensureBoard(s, 30);
    for (const t of s.tiles) {
      if (t.kind !== 'chest') continue;
      total++;
      if (t.chest.type === 'scroll') scroll++;
      if (t.chest.type === 'bomb') bomb++;
    }
  }
  assert.ok(total > 200, `样本不足：${total}`);
  assert.ok(scroll / total > 0.15, `卷轴占比过低：${scroll}/${total}`);
  assert.ok(bomb / total > 0.15, `炸弹占比过低：${bomb}/${total}`);
});

test('升级字段可存档往返，旧存档缺字段时补默认值', () => {
  const s = fresh('normal', 203);
  const p = s.player;
  p.xp = p.xpNext - 1;
  const mob = find(s, 'monster')[0];
  G.tapTile(s, mob.i);
  p.atk = 9999;
  G.attack(s, mob.i);
  G.chooseLevel(s, s.levelChoices[0]);
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.deepEqual(back.levelTaken, s.levelTaken);
  assert.equal(back.levelChoices, null);
  assert.equal(back.levelOffers, 0);

  const raw = JSON.parse(G.serialize(s));
  delete raw.levelTaken; delete raw.levelChoices; delete raw.levelOffers; delete raw.levelReroll;
  const old = G.deserialize(JSON.stringify(raw));
  assert.ok(old, '缺升级字段的存档仍可读取');
  assert.deepEqual(old.levelTaken, {});
  assert.equal(old.levelChoices, null);
  assert.equal(old.levelOffers, 0);
  assert.equal(old.levelReroll, 0);
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
});

test('龙王生成即现身：亮在棋盘、不计入邻格数字、没有倒计时', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = G.createRun('normal', seed);
    s.floor = G.MAX_FLOOR;
    G.buildFloor(s);
    assert.equal(s.generated, false, '生成前棋盘仍是暗的');
    G.tapTile(s, 30);
    const boss = find(s, 'boss')[0];
    assert.ok(boss, `seed${seed} 第 30 层应有龙王`);
    assert.equal(boss.revealed, true, '龙王不藏在砖下');
    assert.equal('awake' in boss.mob, false, '龙王不再有惊扰状态');
    assert.equal('cd' in boss.mob, false, '龙王不再有攻击倒计时');
    assert.ok(![30, ...G.neighbors(30)].includes(boss.i), '现身也不侵占首点安全区');
    // 数字只数未探明的威胁：龙王已经亮着，邻格数字不该再把它算进去
    const count = (i) => G.neighbors(i).filter((j) => {
      const x = s.tiles[j];
      return !x.revealed && ['monster', 'elite', 'trap', 'boss'].includes(x.kind);
    }).length;
    for (let i = 0; i < G.SIZE; i++) assert.equal(s.tiles[i].n, count(i), `seed${seed} 第 ${i} 格数字`);
    // 把龙王也当成暗雷来数，它的邻格应当正好少 1：现身的龙王不再贡献数字
    const raw = (i) => G.neighbors(i).filter((k) => ['monster', 'elite', 'trap', 'boss'].includes(s.tiles[k].kind)).length;
    for (const j of G.neighbors(boss.i)) assert.equal(s.tiles[j].n, raw(j) - 1, '龙王格不贡献邻格数字');
  }
});

test('龙王不偷袭：点开只进普通预演，可以再想想，也不扣偷袭伤害', () => {
  const s = G.createRun('normal', 9);
  s.floor = G.MAX_FLOOR; G.buildFloor(s); G.ensureBoard(s, 30);
  const boss = find(s, 'boss')[0];
  const atk = boss.mob.atk;
  const hp = s.player.hp;
  const out = G.tapTile(s, boss.i);
  assert.equal(s.pendingCombat, boss.i);
  assert.equal(s.forcedCombat, -1, '龙王现身不算偷袭');
  assert.equal(boss.mob.atk, atk, '没有偷袭加成');
  assert.equal(s.player.hp, hp, '龙王不会先咬一口');
  assert.ok(out.some((e) => e.type === 'encounter'));
  G.closePending(s);
  assert.equal(s.pendingCombat, -1, '普通预演可以退出');

  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.deepEqual(back.tiles[boss.i].mob, boss.mob, '龙王状态可存档往返');
});

test('完全识破掀开的怪物不加攻击、不强制开战', () => {
  const s = arena();
  putMob(s, 0, { boss: true, hp: 80, atk: 40 });
  for (let i = 1; i < G.SIZE; i++) s.tiles[i].revealed = true;
  G.recalc(s);
  const atk = s.tiles[0].mob.atk;
  G.tapTile(s, 1);
  assert.equal(s.solved, true);
  assert.equal(s.tiles[0].revealed, true);
  assert.equal(s.tiles[0].mob.atk, atk, '自动揭示不是偷袭');
  assert.equal(s.pendingCombat, -1, '识破不强行拉进战斗');
  assert.equal(s.forcedCombat, -1);
});

test('第 10 层龙王倒下后继续探索：阶梯解封、不用钥匙、不结算', () => {
  const s = G.createRun('normal', 77);
  s.floor = 10; G.buildFloor(s); G.ensureBoard(s, 30);
  const stairs = find(s, 'stairs')[0];
  G.tapTile(s, stairs.i);
  assert.equal(s.stairsFound, true);
  assert.equal(G.canDescend(s), false, '龙王未倒，阶梯不能走');
  const locked = G.tryDescend(s);
  assert.ok(locked.some((e) => e.type === 'locked' && e.boss), 'Boss 层的封锁提示应指明龙王');
  assert.equal(s.floor, 10);
  const boss = find(s, 'boss')[0];
  assert.equal(boss.mob.boss, true, '第 10 层由龙王镇守');
  assert.equal(find(s, 'elite').length, 0, '龙王层不再另设守卫');
  s.tiles[boss.i].revealed = true;
  Object.assign(s.player, { atk: 99999, hp: 99999, maxHp: 99999 });
  G.attack(s, boss.i);
  assert.equal(s.status, 'playing', '不是最后一层，击杀龙王不该结束本局');
  assert.equal(s.bossDown, true);
  assert.equal(G.canDescend(s), true, '龙王倒下即解封，不需要钥匙');
  assert.equal(s.hasKey, false, 'Boss 层全程不消耗钥匙');
  assert.equal(s.relicChoices, null, '遗物先掉在地上，不直接弹三选一');
  assert.equal(s.tiles[boss.i].relicDrop, true, '龙王层应留下遗物掉落');
  G.tapTile(s, boss.i);
  assert.ok(s.relicChoices, '拾取掉落才打开三选一');
  G.chooseRelic(s, s.relicChoices[0]);
  assert.ok(G.tryDescend(s).some((e) => e.type === 'descend'));
  assert.equal(s.floor, 11);
  assert.equal(s.bossDown, false, '新一层重置封印状态');
  assert.equal(find(s, 'boss').length, 0, '第 11 层不再有龙王');
});

test('Boss 层的阶梯在龙王未倒时带锁，倒下后立即无锁', () => {
  const s = G.createRun('normal', 31);
  s.floor = 20; G.buildFloor(s); G.ensureBoard(s, 30);
  const stairs = find(s, 'stairs')[0];
  G.tapTile(s, stairs.i);
  assert.equal(G.canDescend(s), false);
  s.bossDown = true; G.recalc(s);
  assert.equal(G.canDescend(s), true, '封印只认龙王，不认钥匙');
});

test('遗物掉落有节奏：守卫每 2 层一次，走完全程也拿不满池子', () => {
  const all = Array.from({ length: G.MAX_FLOOR }, (_, k) => k + 1);
  const guardDrops = all.filter((f) => G.isRelicFloor(f));
  const bossDrops = all.filter((f) => G.isBossFloor(f) && !G.isFinalFloor(f));
  assert.deepEqual(guardDrops, [2, 4, 6, 8, 12, 14, 16, 18, 22, 24, 26, 28]);
  assert.deepEqual(bossDrops, [10, 20]);
  const draws = guardDrops.length + bossDrops.length;
  assert.equal(G.RELIC_MAX_DRAWS, draws, '对外公布的次数上限应与实际掉落节奏一致');
  assert.ok(draws < G.RELICS.length, '全程抽取次数必须少于遗物池');
  assert.ok(draws <= G.RELICS.length * 0.5, '全程最多带走一半遗物，构筑才有取舍');
  assert.equal(new Set([...guardDrops, ...bossDrops]).size, draws, '每次掉落只触发一次');
});

test('守卫只在遗物层掉落：非遗物层给钥匙但不给抽取', () => {
  const s = fresh('normal', 94);
  for (const f of [3, 5, 7]) {
    atFloor(s, f);
    const elite = find(s, 'elite')[0];
    s.player.atk = 9999; s.player.hp = s.player.maxHp;
    G.tapTile(s, elite.i);
    const evs = G.attack(s, s.pendingCombat);
    assert.equal(evs.some((e) => e.type === 'relicDrop'), false, `第${f}层不该掉遗物`);
    assert.equal(elite.relicDrop, false);
    assert.equal(s.hasKey, true, `第${f}层仍然要掉钥匙`);
    assert.equal(s.relicChoices, null);
  }
  assert.equal(s.relics.length, 0);
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

test('击杀统计随进程增长', () => {
  const s = fresh('normal', 66);
  const gold0 = s.stats.goldEarned;
  s.player.atk = 9999;
  for (const t of find(s, 'monster').slice(0, 3)) {
    G.tapTile(s, t.i);
    if (s.pendingCombat >= 0) { s.player.hp = s.player.maxHp; G.attack(s, s.pendingCombat); }
  }
  assert.equal(s.stats.kills, 3);
  assert.ok(s.stats.goldEarned > gold0);
});

/* ─────────── 遗物 ─────────── */
function grant(s, id) {
  s.relicChoices = [id];
  const evs = G.chooseRelic(s, id);
  assert.ok(evs.some((e) => e.type === 'relicGain'), `遗物 ${id} 应可获得`);
}
const hiddenThreats = (s) => s.tiles.filter((t) => !t.revealed && ['monster', 'elite', 'trap', 'boss'].includes(t.kind));
function atFloor(s, f) { s.floor = f; G.buildFloor(s); G.tapTile(s, 30); G.closePending(s); return s; }

test('遗物表完整：54 件、id 唯一、分类与稀有度合法', () => {
  assert.equal(G.RELICS.length, 54);
  assert.equal(new Set(G.RELICS.map((r) => r.id)).size, 54);
  const byRarity = {};
  for (const r of G.RELICS) byRarity[r.rarity] = (byRarity[r.rarity] || 0) + 1;
  assert.deepEqual(byRarity, { common: 25, rare: 20, epic: 9 }, '稀有度应呈普通多、史诗少的金字塔');
  for (const r of G.RELICS) {
    assert.ok(G.RELIC_CATS.includes(r.cat), `${r.id} 分类非法`);
    assert.ok(G.RELIC_RARITY[r.rarity], `${r.id} 稀有度非法`);
    assert.ok(G.relicName(r) && r.icon && G.relicDesc(r) && G.relicFlavor(r), `${r.id} 文案缺失`);
    assert.equal(G.relicById(r.id), r);
  }
  for (const cat of G.RELIC_CATS) assert.ok(G.RELICS.some((r) => r.cat === cat), `${cat} 类为空`);
});

test('稀有度随深度漂移：越深越容易抽到高品质遗物', () => {
  const w1 = G.relicRarityWeights(1);
  assert.deepEqual(w1, { common: 60, rare: 30, epic: 10 });
  const w30 = G.relicRarityWeights(G.MAX_FLOOR);
  assert.deepEqual(w30, { common: 30, rare: 45, epic: 30 });
  const mid = G.relicRarityWeights(16);
  assert.ok(mid.common < 60 && mid.common > 30, '普通权重应随深度递减');
  assert.ok(mid.epic > 10 && mid.epic < 30, '史诗权重应随深度递增');
  assert.deepEqual(G.relicRarityWeights(0), w1, '浅于第 1 层按第 1 层算');
  assert.deepEqual(G.relicRarityWeights(99), w30, '深于封顶层按第 30 层算');

  const epicShare = (floor) => {
    let epic = 0, all = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const s = G.createRun('normal', seed);
      s.floor = floor;
      G.offerRelics(s, []);
      for (const id of s.relicChoices) { all++; if (G.relicById(id).rarity === 'epic') epic++; }
    }
    return epic / all;
  };
  const shallow = epicShare(1), deep = epicShare(G.MAX_FLOOR);
  assert.ok(deep > shallow * 1.6, `深层史诗比例应显著更高（${deep.toFixed(3)} vs ${shallow.toFixed(3)}）`);
});

test('稀有度按档位权重抽取：实际比例贴合 60/30/10，而不是被各档件数带偏', () => {
  const shareAt = (floor) => {
    const bag = { common: 0, rare: 0, epic: 0 };
    let all = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = G.createRun('normal', seed);
      s.floor = floor;
      G.offerRelics(s, []);
      for (const id of s.relicChoices) { bag[G.relicById(id).rarity]++; all++; }
    }
    return { common: bag.common / all, rare: bag.rare / all, epic: bag.epic / all };
  };
  // 普通有 20 件、稀有 15 件：若按件数加权，普通占比会被抬到 70% 左右
  const s1 = shareAt(1);
  assert.ok(Math.abs(s1.common - 0.6) < 0.05, `浅层普通占比应接近 60%（实际 ${(s1.common * 100).toFixed(1)}%）`);
  assert.ok(Math.abs(s1.rare - 0.3) < 0.05, `浅层稀有占比应接近 30%（实际 ${(s1.rare * 100).toFixed(1)}%）`);
  const s30 = shareAt(G.MAX_FLOOR);
  assert.ok(Math.abs(s30.epic - 0.3) < 0.06, `深层史诗占比应接近 30%（实际 ${(s30.epic * 100).toFixed(1)}%）`);
});

test('结绳：识破时每面插对的旗额外换经验', () => {
  const full = solveWith('all', ['tally']);
  assert.equal(full.sv.xp, G.SOLVE_PERFECT_XP + full.threats.length * G.RELIC_TALLY_XP);
  const partial = solveWith(2, ['tally']);
  assert.equal(partial.sv.xp, 2 * G.RELIC_TALLY_XP, '非完美识破也按旗数给经验');
  const none = solveWith(0, ['tally']);
  assert.equal(none.sv.xp, 0, '一面旗都没插对时不发经验');
});

test('编年史：完美识破回复生命上限的 15%，非完美不触发', () => {
  for (const [flags, expected] of [['all', true], [1, false]]) {
    const { s, last } = nearlySolved('normal', 21, 4);
    grant(s, 'chronicle');
    const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
    const n = flags === 'all' ? threats.length : flags;
    plantFlags(s, threats.slice(0, n));
    s.player.hp = s.player.maxHp - 20;
    const out = G.tapTile(s, last.i);
    const healed = out.filter((e) => e.type === 'heal').reduce((a, e) => a + e.amount, 0);
    if (expected) assert.equal(healed, Math.ceil(s.player.maxHp * G.RELIC_CHRONICLE_HEAL));
    else assert.equal(healed, 0);
  }
});

test('噬心：击杀累积生命上限，封顶后不再增长', () => {
  const s = fresh('normal', 105);
  grant(s, 'heartEater');
  s.player.atk = 9999;
  s.player.xpNext = 1e9; // 排除升级带来的生命上限增长
  const max0 = s.player.maxHp;
  let kills = 0;
  for (const f of [2, 3, 4, 5, 6, 7]) {
    atFloor(s, f);
    for (const t of find(s, 'monster')) {
      if (kills > G.RELIC_HEART_CAP) break;
      s.player.hp = s.player.maxHp;
      G.tapTile(s, t.i);
      if (s.pendingCombat >= 0) { G.attack(s, s.pendingCombat); kills++; }
    }
    if (kills > G.RELIC_HEART_CAP) break;
  }
  assert.ok(kills > G.RELIC_HEART_CAP, '需要多杀一只来验证封顶');
  assert.equal(s.relicState.heart, G.RELIC_HEART_CAP);
  assert.equal(s.player.maxHp, max0 + G.RELIC_HEART_GAIN * G.RELIC_HEART_CAP);
});

test('战纹：攻击 +2，生命上限 −4', () => {
  const s = fresh('normal', 107);
  const atk0 = s.player.atk, max0 = s.player.maxHp;
  grant(s, 'warPaint');
  assert.equal(s.player.atk, atk0 + G.RELIC_PAINT_ATK);
  assert.equal(s.player.maxHp, max0 - G.RELIC_PAINT_HP);
  assert.ok(s.player.hp <= s.player.maxHp, '当前生命不能超过新上限');
});

test('普通平地件：磨刀石 +1 攻、护心骨 +1 防、血囊 +6 生命上限', () => {
  const s = fresh('normal', 109);
  const atk0 = s.player.atk, def0 = s.player.def;
  s.player.hp = s.player.maxHp - 10;
  const max0 = s.player.maxHp, cur0 = s.player.hp;
  grant(s, 'whetstone');
  grant(s, 'ribguard');
  grant(s, 'bloodSac');
  assert.equal(s.player.atk, atk0 + G.RELIC_WHETSTONE_ATK);
  assert.equal(s.player.def, def0 + G.RELIC_RIB_DEF);
  assert.equal(s.player.maxHp, max0 + G.RELIC_BLOOD_SAC_HP);
  assert.equal(s.player.hp, cur0 + G.RELIC_BLOOD_SAC_HP, '血囊同时回满新增的上限');
});

test('尖甲：反弹 1 点，与反震甲线性叠加', () => {
  const s = fresh('normal', 110);
  grant(s, 'spikedMail');
  assert.equal(s.player.thorns, G.RELIC_SPIKED_THORNS);
  grant(s, 'recoilMail');
  assert.equal(s.player.thorns, G.RELIC_RECOIL + G.RELIC_SPIKED_THORNS);
});

test('号旗：旗子上限 +1，可与旗手纹章叠加', () => {
  const s = fresh('normal', 111);
  const base = G.flagCap(s);
  grant(s, 'pennant');
  assert.equal(G.flagCap(s), base + G.RELIC_PENNANT_FLAGS);
  grant(s, 'bannerBearer');
  assert.equal(G.flagCap(s), base + G.RELIC_PENNANT_FLAGS + G.RELIC_FLAG_BONUS);
});

test('战利品袋：每次击杀额外获得固定金币', () => {
  const s = fresh('normal', 112);
  grant(s, 'lootSack');
  s.player.atk = 9999;
  atFloor(s, 3);
  const t = find(s, 'monster')[0];
  s.player.hp = s.player.maxHp;
  G.tapTile(s, t.i);
  const gold0 = s.player.gold;
  const evs = G.attack(s, s.pendingCombat);
  const gained = evs.filter((e) => e.type === 'gold').reduce((a, e) => a + e.amount, 0);
  assert.equal(gained, t.mob.gold + G.RELIC_LOOT_SACK_GOLD);
  assert.equal(s.player.gold, gold0 + gained);
});

test('赏金令：每次击杀额外 5 金币，与战利品袋叠加', () => {
  const s = fresh('normal', 112);
  grant(s, 'bounty'); grant(s, 'lootSack');
  s.player.atk = 9999;
  atFloor(s, 3);
  const t = find(s, 'monster')[0];
  s.player.hp = s.player.maxHp;
  G.tapTile(s, t.i);
  const gold0 = s.player.gold;
  const evs = G.attack(s, s.pendingCombat);
  const gained = evs.filter((e) => e.type === 'gold').reduce((a, e) => a + e.amount, 0);
  assert.equal(gained, t.mob.gold + G.RELIC_BOUNTY_GOLD + G.RELIC_LOOT_SACK_GOLD);
  assert.equal(s.player.gold, gold0 + gained);
});

test('点金手：攻防随持有金币升降，花掉即收回且不重复叠加', () => {
  const s = fresh('normal', 114);
  s.player.gold = 95;
  grant(s, 'midas');
  assert.equal(s.player.goldBonus, 3);
  assert.equal(s.player.atk, 5 + 3);
  assert.equal(s.player.def, 1 + 3);

  atFloor(s, 3);
  assert.equal(s.player.atk, 5 + 3, '反复同步不应越叠越多');
  assert.equal(s.player.def, 1 + 3);

  const ch = find(s, 'chest')[0];
  ch.chest = { type: 'gold', amount: 60 }; ch.revealed = true; ch.used = false;
  G.tapTile(s, ch.i);
  assert.equal(s.player.goldBonus, 5, '155 金币 = 5 点');
  assert.equal(s.player.atk, 5 + 5);
  assert.equal(s.player.def, 1 + 5);

  s.player.gold = 29;
  G.buy(s, 'scroll');
  assert.equal(s.player.goldBonus, 0, '花到 30 以下，加成收回');
  assert.equal(s.player.atk, 5);
  assert.equal(s.player.def, 1);

  const back = G.deserialize(G.serialize(s));
  assert.equal(back.player.goldBonus, 0, '存档往返保留派生值');
  G.buildFloor(back);
  assert.equal(back.player.atk, 5, '读档后重算不重复计入');
});

test('矿脉契与高利贷：下行固定金币与按当时金币取整的利息', () => {
  const s = fresh('normal', 115);
  grant(s, 'deed'); grant(s, 'usury');
  s.player.gold = 245;
  s.stairsFound = true;
  const g0 = s.player.gold;
  G.tryDescend(s);
  const base = 10 + 1 * 3;
  assert.equal(s.player.gold - g0, Math.floor(245 * G.RELIC_INTEREST_RATE) + base + G.RELIC_DEED_GOLD);
  assert.ok(s.log.some((l) => l.k === 'log.usury' && l.p.n === 24), '利息按 245 金币结算并向下取整');

  const b = fresh('normal', 116);
  grant(b, 'deed'); grant(b, 'prospector');
  b.stairsFound = true;
  const gb = b.player.gold;
  G.tryDescend(b);
  assert.equal(b.player.gold - gb, (10 + 3) * 2 + G.RELIC_DEED_GOLD, '探矿罗盘只翻倍通关奖励');

  const c = fresh('normal', 117);
  grant(c, 'usury');
  c.player.gold = 0;
  c.stairsFound = true;
  G.tryDescend(c);
  assert.ok(!c.log.some((l) => l.k === 'log.usury'), '没有金币就不刷利息日志');
});

test('骨甲：按生命上限派生固定减伤，封顶后不再增长', () => {
  const s = fresh('normal', 106);
  grant(s, 'bonePlate');
  s.player.gold = 9999;
  s.player.maxHp = 74; s.player.hp = 74;
  G.buy(s, 'elixir'); // 84 → 84/40 = 2
  assert.equal(s.player.maxHp, 84);
  assert.equal(s.player.takeFlat, 2);
  s.player.maxHp = 300; s.player.hp = 300;
  G.buy(s, 'elixir'); // 306 → 封顶 4
  assert.equal(s.player.takeFlat, G.RELIC_PLATE_CAP);
  const mob = find(s, 'monster')[0];
  const bare = { ...s.player, takeFlat: 0 };
  assert.equal(G.forecast(s.player, mob.mob).take,
    Math.max(0, G.forecast(bare, mob.mob).take - G.RELIC_PLATE_CAP), '预演读到的就是这份减伤');
});

test('干粮：下行时额外回复生命上限的 7%', () => {
  const s = fresh('normal', 108);
  grant(s, 'rations');
  s.floor = 2; G.buildFloor(s);
  s.stairsFound = true; s.hasKey = true;
  s.player.hp = 1;
  const maxHp = s.player.maxHp;
  const out = G.tryDescend(s);
  const healed = out.filter((e) => e.type === 'heal').reduce((a, e) => a + e.amount, 0);
  assert.equal(healed, Math.ceil(maxHp * G.BAL.descendPct) + Math.ceil(maxHp * G.RELIC_RATION_HEAL));
  assert.ok(s.log.some((l) => l.k === 'log.rations'));
});

test('火把：炸弹清除目标额外获得金币，炸弹售价减半', () => {
  const s = fresh('normal', 109);
  const price0 = G.shopPrice(s, 'bomb');
  grant(s, 'torch');
  assert.equal(G.shopPrice(s, 'bomb'), Math.round(price0 * G.RELIC_TORCH_SHOP));
  const t = find(s, 'monster')[0];
  s.tiles[t.i].revealed = true;
  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  const gold0 = s.player.gold;
  const loot = t.mob.gold;
  G.tapTile(s, t.i);
  assert.equal(s.player.gold, gold0 + loot + G.RELIC_TORCH_GOLD, '火把额外金币之外，击杀金币照常结算');
});

test('静默誓约：生命上限 +30、防御 +3、攻击 −2，不再惩罚治疗', () => {
  const s = fresh('normal', 110);
  const max0 = s.player.maxHp, def0 = s.player.def, atk0 = s.player.atk;
  grant(s, 'vow');
  assert.equal(s.player.maxHp, max0 + G.RELIC_VOW_HP);
  assert.equal(s.player.def, def0 + G.RELIC_VOW_DEF);
  assert.equal(s.player.atk, Math.max(1, atk0 - G.RELIC_VOW_ATK));
  s.player.hp = 1;
  s.player.potions = 1;
  const healed = G.usePotion(s).filter((e) => e.type === 'heal').reduce((a, e) => a + e.amount, 0);
  assert.equal(healed, Math.ceil(s.player.maxHp * G.BAL.potionPct), '药水应恢复全额');
  s.player.hp = 1;
  const altar = s.tiles.find((t) => t.kind === 'empty' && !t.revealed);
  altar.kind = 'altar'; altar.used = false;
  const pray = G.altarChoose(s, altar.i, 'pray').filter((e) => e.type === 'heal').reduce((a, e) => a + e.amount, 0);
  assert.equal(pray, Math.ceil(s.player.maxHp * G.BAL.prayPct), '祈祷应恢复全额');
});

test('击杀钥匙守卫留下遗物掉落，拾取后才三选一', () => {
  const s = fresh('normal', 91);
  atFloor(s, 2);
  const elite = find(s, 'elite')[0];
  s.player.atk = 9999; s.player.hp = s.player.maxHp;
  G.tapTile(s, elite.i);
  const evs = G.attack(s, s.pendingCombat);
  assert.ok(evs.some((e) => e.type === 'relicDrop'), '击杀守卫应留下遗物掉落');
  assert.equal(s.relicChoices, null, '掉落不会直接弹三选一');
  assert.equal(elite.relicDrop, true);
  assert.equal(G.tileLabel(elite), '敌人掉落的遗物（可拾取）');
  const pickupEvs = G.tapTile(s, elite.i);
  assert.ok(pickupEvs.some((e) => e.type === 'relicPickup'));
  assert.equal(elite.relicDrop, false, '拾取后地上的掉落消失');
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

test('炸毁钥匙守卫同样按遗物层掉落，且整局不会抽到已拥有的遗物', () => {
  const s = fresh('normal', 92);
  s.player.bombs = 9;
  for (const f of [2, 3, 6]) {
    atFloor(s, f);
    const elite = find(s, 'elite')[0];
    s.tiles[elite.i].revealed = true;
    G.setMode(s, 'bomb');
    const evs = G.tapTile(s, elite.i);
    assert.equal(evs.some((e) => e.type === 'relicDrop'), G.isRelicFloor(f), `第${f}层掉落规则应与攻击路径一致`);
    assert.equal(s.hasKey, true);
    if (!G.isRelicFloor(f)) continue;
    assert.equal(s.relicChoices, null, '炸弹击杀同样只是掉落');
    G.tapTile(s, elite.i);
    for (const id of s.relicChoices) assert.ok(!s.relics.includes(id), `抽到了已拥有的 ${id}`);
    G.chooseRelic(s, s.relicChoices[0]);
  }
  assert.equal(s.relics.length, 2);
  assert.equal(new Set(s.relics).size, 2);
});

test('遗物重置：每批 5 金币起、每次 +5，典当票减 5 且不会为负', () => {
  const s = fresh('normal', 95);
  s.player.gold = 40;
  G.offerRelics(s, []);
  const first = s.relicChoices.slice();
  assert.equal(G.relicRerollCost(s), 5);
  const evs = G.rerollRelics(s);
  assert.ok(evs.some((e) => e.type === 'reroll' && e.cost === 5));
  assert.equal(s.player.gold, 35);
  assert.equal(s.relicReroll, 1);
  assert.equal(s.relicChoices.length, G.RELIC_DRAW_COUNT);
  for (const id of s.relicChoices) {
    assert.ok(!s.relics.includes(id), '重置不会给到已拥有的遗物');
    assert.ok(!first.includes(id), '重置应换一批新选项');
  }
  assert.equal(G.relicRerollCost(s), 10);

  s.player.gold = 9;
  const before = s.relicChoices.slice();
  assert.ok(G.rerollRelics(s).some((e) => e.type === 'deny'), '金币不够时拒绝重置');
  assert.deepEqual(s.relicChoices, before);
  assert.equal(s.player.gold, 9, '拒绝时不能扣钱');

  grant(s, 'pawnTicket');
  G.offerRelics(s, []);
  assert.equal(G.relicRerollCost(s), 0, '典当票让每批首次重置免费');
  s.player.gold = 20;
  G.rerollRelics(s);
  assert.equal(s.player.gold, 20);
  assert.equal(G.relicRerollCost(s), 5);

  assert.deepEqual(G.rerollRelics(G.createRun('normal', 1)), [], '没有挂起的抽取时不能重置');
});

test('遗物抽取可复现：同种子同选项', () => {
  const run = (seed) => {
    const s = fresh('normal', seed);
    atFloor(s, 2);
    const elite = find(s, 'elite')[0];
    s.player.atk = 9999; s.player.hp = s.player.maxHp;
    G.tapTile(s, elite.i); G.attack(s, s.pendingCombat); G.tapTile(s, elite.i);
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
  mob.revealed = true; // 已探明：普通预演，偷袭的扣血不会干扰承伤对照
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

test('陷阱遗物：钉底靴减伤 30%、猫步 3 次充能免伤、拾荒爪按陷阱旗给金币', () => {
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

  const scav = solveWith('all', ['trapSalvage'], 'normal', 96, 3);
  const trapFlags = scav.threats.filter((t) => t.kind === 'trap').length;
  assert.ok(trapFlags > 0, '第 3 层应至少有一面陷阱旗');
  assert.equal(scav.sv.gold, scav.threats.length * G.SOLVE_FLAG_GOLD + trapFlags * G.RELIC_TRAP_FLAG_GOLD);
  assert.equal(scav.s.player.gold - scav.before.gold, scav.sv.gold, '奖励应真正入账');
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

test('贪婪之心：宝箱金币翻倍，商店价格提高', () => {
  const s = fresh('normal', 100);
  const price0 = G.shopPrice(s, 'potion');
  grant(s, 'greedyHeart');
  assert.equal(G.shopPrice(s, 'potion'), Math.round(price0 * G.GREEDY_HEART_SHOP));
  const chests = find(s, 'chest');
  assert.ok(chests.length >= 2);
  chests[0].chest = { type: 'gold', amount: 20 }; chests[0].revealed = true; chests[0].used = false;
  const g0 = s.player.gold;
  G.tapTile(s, chests[0].i);
  assert.equal(s.player.gold - g0, 40);
  chests[1].chest = { type: 'potion', amount: 1 }; chests[1].revealed = true; chests[1].used = false;
  const p0 = s.player.potions;
  G.tapTile(s, chests[1].i);
  assert.equal(s.player.potions, p0 + 1, '药水仍照常产出');
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

  atFloor(s, 2);
  const elite = find(s, 'elite')[0];
  p.atk = 9999; p.hp = p.maxHp;
  G.tapTile(s, elite.i); G.attack(s, s.pendingCombat); G.tapTile(s, elite.i);
  G.chooseRelic(s, s.relicChoices[0]);
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.deepEqual(back.relics, s.relics);
  assert.deepEqual(back.relicState, s.relicState);
  assert.equal(back.player.takeMul, p.takeMul);
  assert.equal(G.deserialize(JSON.stringify({ ...s, v: 3 })), null, '旧版本存档应被拒绝');
});
// ---------- 偷袭 ----------
function arena(seed = 7) {
  const s = G.createRun('normal', seed);
  G.tapTile(s, 30);
  for (const t of s.tiles) {
    t.kind = 'empty'; t.mob = null; t.chest = null;
    t.used = false; t.revealed = false; t.flagged = false;
  }
  G.recalc(s);
  return s;
}
function putMob(s, i, over = {}) {
  const t = s.tiles[i];
  t.kind = 'monster';
  t.mob = { id: 'bat', name: '测试蝠', icon: 'bat', flavor: '', hp: 20, maxHp: 20, atk: 10, def: 0, xp: 1, gold: 1, elite: false, boss: false, ...over };
  G.recalc(s);
  return t;
}

test('偷袭：手动翻到怪物即先挨一次攻击 − 防御、强制进入战斗', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 80;
  s.player.def = 3;
  const m = putMob(s, 0, { atk: 10, hp: 20 });
  const out = G.tapTile(s, 0);
  assert.equal(m.revealed, true);
  assert.equal(m.mob.atk, 10, '偷袭不再改变怪物攻击');
  assert.equal(s.player.hp, 80 - (10 - 3), '偷袭＝一次普通攻击（攻击 − 防御）');
  assert.equal(s.pendingCombat, 0);
  assert.equal(s.forcedCombat, 0, '战斗无法回避');
  assert.ok(out.some((e) => e.type === 'ambush' && e.i === 0 && e.dmg === 7));
  assert.ok(out.some((e) => e.type === 'damage' && e.source === 'mob' && e.amount === 7));
  assert.ok(out.some((e) => e.type === 'encounter' && e.i === 0));
  assert.equal(s.log.at(-1).k, 'log.ambush');
});

test('偷袭伤害：至少 1 点，减伤遗物同样生效，也可被完全挡下', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 80;
  s.player.def = 20;
  putMob(s, 0, { atk: 10 });
  G.tapTile(s, 0);
  assert.equal(s.player.hp, 79, '攻击低于防御时仍扣 1 点');

  const s2 = arena();
  s2.player.hp = s2.player.maxHp = 80;
  s2.player.def = 0;
  s2.relicChoices = ['dragonWard'];
  G.chooseRelic(s2, 'dragonWard');
  putMob(s2, 0, { atk: 12 });
  G.tapTile(s2, 0);
  assert.equal(s2.player.hp, 80 - Math.round(12 * 0.75), '减伤遗物对偷袭生效');

  const s3 = arena();
  s3.player.hp = s3.player.maxHp = 80;
  s3.player.def = 0;
  s3.relicChoices = ['thornMail'];
  G.chooseRelic(s3, 'thornMail');
  putMob(s3, 0, { atk: 2 });
  const out = G.tapTile(s3, 0);
  assert.equal(s3.player.hp, 80, '固定减伤可以完全挡下');
  assert.equal(s3.log.at(-1).k, 'log.ambush.block');
  assert.equal(s3.forcedCombat, 0, '挡下伤害仍要开战');
  assert.ok(out.some((e) => e.type === 'ambush' && e.dmg === 0));
});

test('偷袭：那一口可以直接致死，不会进入战斗', () => {
  const s = arena();
  s.player.hp = 10;
  s.player.def = 0;
  putMob(s, 0, { atk: 10 });
  const out = G.tapTile(s, 0);
  assert.equal(s.status, 'dead');
  assert.ok(out.some((e) => e.type === 'death'));
  assert.equal(s.pendingCombat, -1);
  assert.equal(s.forcedCombat, -1);
});

test('偷袭：卷轴探明与识破掀开都不扣血、不强制战斗', () => {
  const s = arena();
  s.player.hp = s.player.maxHp = 80;
  const m = putMob(s, 0, { atk: 10 });
  G.setMode(s, 'scroll');
  s.player.scrolls = 1;
  G.tapTile(s, 0);
  assert.equal(m.revealed, true);
  assert.equal(m.mob.atk, 10, '卷轴不会改变怪物');
  assert.equal(s.player.hp, 80, '卷轴是安全探明，不吃偷袭');
  assert.equal(s.pendingCombat, -1);
  assert.equal(s.forcedCombat, -1);

  const s2 = arena();
  s2.player.hp = s2.player.maxHp = 80;
  const b = putMob(s2, 0, { atk: 10 });
  for (let i = 1; i < G.SIZE; i++) s2.tiles[i].revealed = true;
  G.recalc(s2);
  G.tapTile(s2, 1);
  assert.equal(s2.solved, true);
  assert.equal(b.revealed, true);
  assert.equal(b.mob.atk, 10, '识破自动掀开不改变怪物');
  assert.equal(s2.player.hp, 80, '识破不扣血');
  assert.equal(s2.forcedCombat, -1, '识破不把玩家拉进战斗');
});

test('普通遭遇：已探明怪物再点是预演，可以退出，也不会再扣血', () => {
  const s = arena();
  const m = putMob(s, 0, { atk: 10 });
  G.setMode(s, 'scroll');
  s.player.scrolls = 1;
  G.tapTile(s, 0);
  const atk = m.mob.atk;
  const hp = s.player.hp;
  const out = G.tapTile(s, 0);
  assert.equal(s.pendingCombat, 0);
  assert.equal(s.forcedCombat, -1);
  assert.equal(m.mob.atk, atk);
  assert.equal(s.player.hp, hp, '预演不再吃偷袭伤害');
  assert.ok(out.some((e) => e.type === 'encounter'));
  G.closePending(s);
  assert.equal(s.pendingCombat, -1, '普通遭遇可以再想想');
});

test('强制战：必死的一击照常结算死亡；普通遭遇的必死一击仍被拦下', () => {
  const s = arena();
  const m = putMob(s, 0, { atk: 5, hp: 999 });
  s.player.maxHp = 40; s.player.hp = 40; s.player.def = 0;
  G.tapTile(s, 0); // 先吃一次偷袭，剩 35
  s.player.hp = 5;
  assert.equal(s.forcedCombat, 0);
  const out = G.attack(s, 0);
  assert.equal(s.status, 'dead');
  assert.ok(out.some((e) => e.type === 'death'));
  assert.ok(m.mob.hp > 0, '玩家先倒下，战斗没有结算');

  const s2 = arena();
  putMob(s2, 0, { atk: 100, hp: 999 });
  s2.player.maxHp = 40; s2.player.hp = 5; s2.player.def = 0;
  G.setMode(s2, 'scroll');
  s2.player.scrolls = 1;
  G.tapTile(s2, 0);
  G.closePending(s2);
  const out2 = G.attack(s2, 0);
  assert.equal(s2.status, 'playing');
  assert.ok(out2.some((e) => e.type === 'blocked'));
});

test('强制战：炸弹没炸死仍被面板挡住，炸死才解除', () => {
  const s = arena();
  const m = putMob(s, 0, { hp: 100, atk: 10 });
  s.player.bombs = 2;
  G.tapTile(s, 0);
  G.setMode(s, 'bomb');
  G.tapTile(s, 0);
  assert.equal(m.mob.hp, 100 - G.BOMB_DAMAGE);
  assert.equal(s.pendingCombat, 0, '没炸死，战斗继续');
  assert.equal(s.forcedCombat, 0);
  G.setMode(s, 'bomb');
  G.tapTile(s, 0);
  assert.equal(m.mob.hp, 0);
  assert.equal(s.forcedCombat, -1, '击杀后解除强制');
  assert.equal(s.pendingCombat, -1);
});

test('偷袭：强制状态可存档往返', () => {
  const s = arena();
  putMob(s, 0, { atk: 10 });
  G.tapTile(s, 0);
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.equal(back.pendingCombat, 0);
  assert.equal(back.forcedCombat, 0);
  assert.equal(back.tiles[0].mob.atk, s.tiles[0].mob.atk);
});

test('钥匙守卫：非龙王层必定各有一名，独占一格且计入邻雷数', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let f = 1; f <= G.MAX_FLOOR; f++) {
      const s = G.createRun('normal', seed);
      s.floor = f;
      G.buildFloor(s);
      G.ensureBoard(s, 30);
      const guards = find(s, 'elite');
      assert.equal(guards.length, f >= 2 && !G.isBossFloor(f) ? 1 : 0, `seed${seed} 第${f}层守卫数量`);
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
      if (G.isBossFloor(f)) continue;
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
      b.player.bombs = 20;
      b.relics.push('powderKeg', 'blastCharge', 'siegeBlast');
      b.player.hp = b.player.maxHp = 99999;
      b.tiles[gi].revealed = true;
      // 炸弹是固定伤害，深层守卫要连炸几发；这里验证的是「有炸弹就不会被钥匙锁死」
      for (let k = 0; k < 20 && !b.hasKey; k++) { G.setMode(b, 'bomb'); G.tapTile(b, gi); }
      assert.equal(b.hasKey, true, `seed${seed} 第${f}层炸弹夺钥`);
      assert.equal(G.remainingThreats(a), G.remainingThreats(b), '两条路径清掉的威胁数一致');
    }
  }
});

test('炸弹对龙王造成固定伤害：炸不死只削血，炸得死就正常击杀', () => {
  const s = atFloor(G.createRun('normal', 303), 10);
  const boss = find(s, 'boss')[0];
  boss.mob.hp = boss.mob.maxHp = 150;
  s.player.hp = s.player.maxHp = 99999;
  s.player.bombs = 9;
  G.setMode(s, 'bomb');

  const bom0 = s.player.bombs;
  G.tapTile(s, boss.i);
  assert.equal(boss.mob.hp, 150 - G.BOMB_DAMAGE, '固定 60 点伤害，不随生命上限浮动');
  assert.equal(s.player.bombs, bom0 - 1);
  assert.equal(boss.used, false, '没炸死时龙王仍在');
  assert.equal(s.mode, 'explore');

  for (let k = 0; k < 3 && boss.mob.hp > 0; k++) { G.setMode(s, 'bomb'); G.tapTile(s, boss.i); }
  assert.equal(boss.mob.hp, 0, '固定伤害可以累计炸死龙王');
  assert.equal(boss.used, true);
  assert.equal(s.bossDown, true, '炸死龙王同样解封阶梯');
});

test('炸弹遗物：+30、翻倍、对精英与龙王翻倍', () => {
  const s = G.createRun('normal', 303);
  const mob = { hp: 500, maxHp: 500, elite: false, boss: false };
  const elite = { ...mob, elite: true };
  const boss = { ...mob, boss: true };
  assert.equal(G.bombDamage(s, mob), G.BOMB_DAMAGE);
  s.relics.push('powderKeg');
  assert.equal(G.bombDamage(s, mob), G.BOMB_DAMAGE + G.RELIC_POWDER_DMG, '火药桶 +30');
  s.relics.push('blastCharge');
  assert.equal(G.bombDamage(s, mob), (G.BOMB_DAMAGE + G.RELIC_POWDER_DMG) * G.RELIC_BLAST_MUL, '烈性炸药翻倍');
  assert.equal(G.bombDamage(s, elite), (G.BOMB_DAMAGE + G.RELIC_POWDER_DMG) * G.RELIC_BLAST_MUL, '未持破城雷管时精英不翻倍');
  s.relics.push('siegeBlast');
  assert.equal(G.bombDamage(s, elite), (G.BOMB_DAMAGE + G.RELIC_POWDER_DMG) * G.RELIC_BLAST_MUL * G.RELIC_SIEGE_MUL, '破城雷管对精英翻倍');
  assert.equal(G.bombDamage(s, boss), (G.BOMB_DAMAGE + G.RELIC_POWDER_DMG) * G.RELIC_BLAST_MUL * G.RELIC_SIEGE_MUL, '破城雷管对龙王翻倍');
  assert.equal(G.bombDamage(s, mob), (G.BOMB_DAMAGE + G.RELIC_POWDER_DMG) * G.RELIC_BLAST_MUL, '破城雷管不影响普通怪');
});

test('炸弹对普通怪也只造成固定伤害', () => {
  const s = atFloor(G.createRun('normal', 808), 19);
  s.player.hp = s.player.maxHp = 99999;
  s.player.bombs = 3;

  const mob = find(s, 'monster')[0];
  mob.mob.hp = mob.mob.maxHp = 999;
  mob.revealed = true;
  G.setMode(s, 'bomb');
  G.tapTile(s, mob.i);
  assert.equal(mob.used, false, '血厚的普通怪一发炸不死');
  assert.equal(mob.mob.hp, 999 - G.bombDamage(s, mob.mob), '普通怪同样只吃固定伤害');

  mob.mob.hp = 10;
  G.setMode(s, 'bomb');
  G.tapTile(s, mob.i);
  assert.equal(mob.used, true, '血量低于伤害时照常一发带走');
});

test('锻膛：炸弹击杀永久提高基础伤害，普攻击杀不涨', () => {
  const s = atFloor(G.createRun('normal', 919), 5);
  grant(s, 'forge');
  const mob = find(s, 'monster')[0];
  mob.revealed = true;
  s.player.hp = s.player.maxHp = 99999;
  s.player.bombs = 3;
  const base0 = G.bombDamage(s, mob.mob);
  G.setMode(s, 'bomb');
  G.tapTile(s, mob.i);
  assert.equal(mob.used, true);
  assert.equal(G.bombDamage(s, mob.mob), base0 + G.RELIC_FORGE_GROW, '炸弹击杀后基础伤害 +5');

  const next = s.tiles.find((t) => t.kind === 'monster' && t.mob && t.mob.hp > 0);
  next.mob.hp = 1;
  s.player.atk = 9999;
  G.attack(s, next.i);
  assert.equal(G.bombDamage(s, next.mob), base0 + G.RELIC_FORGE_GROW, '普攻击杀不涨');
});

test('炸弹击杀照常结算经验与金币，引信再加五成经验', () => {
  const mk = () => {
    const s = atFloor(G.createRun('normal', 404), 5);
    const m = find(s, 'monster')[0];
    m.revealed = true;
    s.player.hp = 99999;
    s.player.bombs = 1;
    G.setMode(s, 'bomb');
    return { s, m };
  };
  const plain = mk();
  const kills0 = plain.s.stats.kills, lv0 = plain.s.player.lv, xp0 = plain.s.player.xp, gold0 = plain.s.player.gold;
  const evs = G.tapTile(plain.s, plain.m.i);
  const k = evs.find((e) => e.type === 'kill');
  assert.ok(k, '炸弹击杀应发出 kill 事件');
  assert.equal(k.xp, plain.m.mob.xp);
  assert.equal(plain.s.stats.kills, kills0 + 1, '炸弹击杀计入击杀数');
  assert.ok(plain.s.player.gold > gold0 || plain.s.player.lv > lv0, '炸弹击杀照常给金币或经验');
  assert.ok(plain.s.player.xp > xp0 || plain.s.player.lv > lv0);
  assert.equal(plain.m.used, true);

  const fused = mk();
  grant(fused.s, 'fuse');
  const ev2 = G.tapTile(fused.s, fused.m.i);
  const k2 = ev2.find((e) => e.type === 'kill');
  assert.equal(k2.xp, Math.round(fused.m.mob.xp * (1 + G.RELIC_FUSE_XP)), '引信提高炸弹击杀经验');
});

test('弹药袋：每下行一层补一枚炸弹', () => {
  const s = atFloor(G.createRun('normal', 505), 3);
  grant(s, 'bombBag');
  for (let f = 4; f <= 6; f++) {
    s.stairsFound = true; s.hasKey = true;
    const b0 = s.player.bombs;
    G.tryDescend(s);
    assert.equal(s.floor, f);
    assert.equal(s.player.bombs, b0 + 1, `第 ${f} 层下行触发补给`);
  }
});

test('军械箱：获得时立刻补充六枚炸弹', () => {
  const s = fresh('normal', 707);
  s.player.bombs = 1;
  s.relicChoices = ['bombCache'];
  G.chooseRelic(s, 'bombCache');
  assert.ok(s.relics.includes('bombCache'));
  assert.equal(s.player.bombs, 1 + G.RELIC_BOMB_CACHE);
});

test('商店遗物匣：随机一件、价格递增、本局限购 3 次、集齐后拒绝', () => {
  const s = fresh('normal', 606);
  s.player.gold = 1000;
  assert.equal(G.RELIC_SHOP_CAP, 3);
  assert.equal(G.shopPrice(s, 'relic'), 80);
  const evs = G.buy(s, 'relic');
  assert.ok(evs.some((e) => e.type === 'relicGain'), '购买后应直接获得一件遗物');
  assert.ok(!evs.some((e) => e.type === 'relicOffer'), '商店不再弹出三选一');
  assert.equal(s.relicChoices, null);
  assert.equal(s.relics.length, 1);
  assert.equal(s.player.gold, 920);
  assert.equal(s.bought.relic, 1);

  assert.equal(G.shopPrice(s, 'relic'), 130, '第二次购买涨价 50');
  G.buy(s, 'relic');
  assert.equal(G.shopPrice(s, 'relic'), 180, '第三次购买再涨 50');
  G.buy(s, 'relic');
  assert.equal(s.relics.length, 3);
  assert.equal(new Set(s.relics).size, 3, '不会重复发已拥有的遗物');
  assert.equal(s.player.gold, 1000 - 80 - 130 - 180);

  const gold = s.player.gold, buys = s.bought.relic;
  const out = G.buy(s, 'relic');
  assert.ok(out.some((e) => e.type === 'deny'), '超过 3 次后拒绝');
  assert.equal(s.player.gold, gold, '拒绝时不扣钱');
  assert.equal(s.bought.relic, buys, '拒绝时不计数');
  assert.equal(s.log[s.log.length - 1].k, 'log.relic.cap');

  s.relics = G.RELICS.map((r) => r.id);
  s.bought.relic = 0;
  const out2 = G.buy(s, 'relic');
  assert.ok(out2.some((e) => e.type === 'deny'), '集齐后拒绝');
  assert.equal(s.log[s.log.length - 1].k, 'log.relic.soldout');
});

test('旗数预算：上限＝难度基数，超限拒绝，拔旗后归还', () => {
  const s = fresh('normal', 21);
  const cap = G.flagCap(s);
  assert.equal(cap, G.DIFFICULTIES.normal.flags, '开局上限就是难度基数');
  const hidden = s.tiles.filter((t) => !t.revealed);
  assert.ok(hidden.length > cap, '暗格应多于旗数，预算才有约束力');
  for (const t of hidden.slice(0, cap)) G.toggleFlag(s, t.i);
  assert.equal(s.flags, cap);

  const extra = hidden[cap];
  const out = G.toggleFlag(s, extra.i);
  assert.equal(extra.flagged, false, '超预算不能再插旗');
  assert.equal(s.flags, cap);
  const limit = out.find((e) => e.type === 'flagLimit');
  assert.ok(limit, '应给出旗数用尽事件');
  assert.equal(limit.cap, cap, '事件带上当前上限，UI 才能提示');

  G.toggleFlag(s, hidden[0].i);
  assert.equal(s.flags, cap - 1);
  G.toggleFlag(s, extra.i);
  assert.equal(extra.flagged, true, '拔掉一面就能再插');
  assert.equal(s.flags, cap);

  s.floor = 2; G.buildFloor(s);
  assert.equal(s.flags, 0, '下行收回全部旗子');
  assert.equal(G.flagCap(s), cap, '下行不改变上限');
});

test('旗子上限＝难度基数，且难度越高越少', () => {
  const bases = {};
  for (const diff of ['easy', 'normal', 'hard']) {
    bases[diff] = G.DIFFICULTIES[diff].flags;
    for (let seed = 1; seed <= 12; seed++) {
      const s = fresh(diff, seed);
      assert.equal(G.flagCap(s), bases[diff], `${diff} seed${seed} 上限恒定`);
      assert.ok(G.remainingThreats(s) > G.flagCap(s), `${diff} seed${seed} 威胁应多于旗子，插旗才需要取舍`);
    }
  }
  assert.ok(bases.hard < bases.normal && bases.normal < bases.easy, '炼狱 < 深渊 < 地窖');
});

test('商店旗囊：+1 上限，价格递增，可反复购买', () => {
  const s = fresh('normal', 21);
  const base = G.flagCap(s);
  s.player.gold = 999;
  const prices = [];
  for (let k = 0; k < 3; k++) {
    prices.push(G.shopPrice(s, 'pouch'));
    G.buy(s, 'pouch');
    assert.equal(G.flagCap(s), base + k + 1, `第 ${k + 1} 次购买后上限`);
  }
  assert.ok(prices[1] > prices[0] && prices[2] > prices[1], '旗囊越买越贵');
  assert.equal(s.flags, 0, '买上限不会凭空插旗');

  for (let k = 0; k < G.FLAG_BONUS_CAP; k++) G.buy(s, 'pouch');
  assert.equal(G.flagCap(s), base + G.FLAG_BONUS_CAP, '成长加成封顶');
  const gold = s.player.gold;
  const capped = G.buy(s, 'pouch');
  assert.ok(capped.some((e) => e.type === 'deny'), '封顶后拒绝');
  assert.equal(s.player.gold, gold, '封顶拒绝时不扣钱');
  assert.equal(s.log[s.log.length - 1].k, 'log.flag.cap', '提示上限已封顶');

  const poor = fresh('normal', 21);
  poor.player.gold = 0;
  assert.ok(G.buy(poor, 'pouch').some((e) => e.type === 'deny'), '没钱买不到');
  assert.equal(G.flagCap(poor), base, '被拒绝时上限不变');
});

test('祭坛旗帜祝福：+2 上限，且不附带贪婪的副作用', () => {
  const s = fresh('normal', 21);
  s.floor = 3; G.buildFloor(s); G.ensureBoard(s, 30);
  const altar = find(s, 'altar')[0];
  assert.ok(altar, '第 3 层应有祭坛');
  const base = G.flagCap(s);
  const def = s.player.def, gold = s.player.gold, hp = s.player.hp;
  G.altarChoose(s, altar.i, 'banner');
  assert.equal(G.flagCap(s), base + G.ALTAR_FLAG_BONUS);
  assert.equal(s.player.def, def, '不该扣防御');
  assert.equal(s.player.gold, gold, '不该给金币');
  assert.equal(s.player.hp, hp, '不该扣血');
  assert.deepEqual(G.altarChoose(s, altar.i, 'banner'), [], '同一座祭坛不能重复献祭');
  assert.equal(G.flagCap(s), base + G.ALTAR_FLAG_BONUS);
});

test('遗物旗手纹章：+3 上限，且出现在图鉴与抽取池中', () => {
  const r = G.RELICS.find((x) => x.id === 'bannerBearer');
  assert.ok(r, '遗物应已注册');
  assert.equal(r.cat, 'explore');
  const s = fresh('normal', 21);
  const base = G.flagCap(s);
  s.relicChoices = ['bannerBearer'];
  G.chooseRelic(s, 'bannerBearer');
  assert.equal(G.flagCap(s), base + G.RELIC_FLAG_BONUS);
  assert.ok(s.relics.includes('bannerBearer'));
});

test('三条渠道可叠加，加成跨层保留而旗子每层收回', () => {
  const s = fresh('normal', 21);
  s.floor = 3; G.buildFloor(s); G.ensureBoard(s, 30);
  const base = G.DIFFICULTIES.normal.flags;
  s.player.gold = 999;
  for (let k = 0; k < 4; k++) G.buy(s, 'pouch');
  const altar = find(s, 'altar')[0];
  G.altarChoose(s, altar.i, 'banner');
  s.relicChoices = ['bannerBearer'];
  G.chooseRelic(s, 'bannerBearer');
  const cap = base + 4 + G.ALTAR_FLAG_BONUS + G.RELIC_FLAG_BONUS;
  assert.equal(cap, base + G.FLAG_BONUS_CAP, '三条渠道恰好把加成加满');
  assert.equal(G.flagCap(s), cap, '三条渠道线性叠加');

  const hidden = s.tiles.filter((t) => !t.revealed);
  for (const t of hidden.slice(0, cap)) G.toggleFlag(s, t.i);
  assert.equal(s.flags, cap, '投资后真的能插满');

  const back = G.deserialize(G.serialize(s));
  assert.equal(G.flagCap(back), cap, '存档往返保住加成');
  assert.equal(back.flags, cap);

  s.floor = 3; G.buildFloor(s);
  assert.equal(s.flags, 0, '旗子收回');
  assert.equal(s.tiles.some((t) => t.flagged), false, '棋盘上没有残留旗帜');
  assert.equal(G.flagCap(s), cap, '加成是整局永久的');
});

test('旗子加成封顶：祭坛加不满不消耗，放不下的旗子遗物退出池子', () => {
  const s = fresh('normal', 21);
  s.floor = 3; G.buildFloor(s); G.ensureBoard(s, 30);
  s.flagBonus = G.FLAG_BONUS_CAP - 1; // 还差 1 点，+2 的旗帜祝福放不下
  const altar = find(s, 'altar')[0];
  const cap = G.flagCap(s);
  assert.equal(G.flagBonusLeft(s), 1);
  assert.deepEqual(G.altarChoose(s, altar.i, 'banner'), [], '加不满时拒绝');
  assert.equal(altar.used, false, '祭坛不该被白白消耗');
  assert.equal(G.flagCap(s), cap, '上限不变');
  assert.ok(G.altarChoose(s, altar.i, 'pray').some((e) => e.type === 'altarUsed'), '换个选项仍能献祭');

  s.flagBonus = 60; // 旧存档或异常值也只按上限算
  assert.equal(G.flagBonusLeft(s), 0);
  assert.equal(G.flagCap(s), G.DIFFICULTIES.normal.flags + G.FLAG_BONUS_CAP, '加成封顶');
  const pool = G.relicPool(s).map((r) => r.id);
  assert.ok(!pool.includes('pennant') && !pool.includes('bannerBearer'), '放不下的旗子遗物不进池');
  assert.ok(pool.includes('whetstone'), '其他遗物不受影响');

  s.relicChoices = ['bannerBearer'];
  assert.deepEqual(G.chooseRelic(s, 'bannerBearer'), [], '直接选也拒绝');
  assert.deepEqual(s.relicChoices, ['bannerBearer'], '选项保留，玩家还能改选');
});

// ---------- 完全识破 ----------
const THREATS = ['monster', 'elite', 'trap', 'boss'];
// 结算类用例只验证识破结果，不走旗数预算：直接布旗
function plantFlags(s, tiles) {
  for (const t of tiles) { if (!t.flagged) { t.flagged = true; s.flags++; } }
}
// 把一层做到「只剩最后一个安全格」，翻开它就等价于扫雷解出整层
function nearlySolved(diff = 'normal', seed = 21, floor = 1) {
  const s = fresh(diff, seed);
  if (floor > 1) atFloor(s, floor);
  const safe = s.tiles.filter((t) => !THREATS.includes(t.kind) && !t.revealed);
  const last = safe.find((t) => t.kind === 'empty');
  assert.ok(last, `${diff} seed${seed} 应留有未翻开的空地`);
  for (const t of safe) if (t !== last) t.revealed = true;
  G.recalc(s);
  return { s, last };
}

test('完全识破：安全格全翻开即自动揭示，零伤害、收回旗帜', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 6; seed++) {
      const { s, last } = nearlySolved(diff, seed);
      const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
      for (const t of threats.slice(0, 2)) G.toggleFlag(s, t.i);
      const hp = s.player.hp;
      const out = G.tapTile(s, last.i);
      const tag = `${diff} seed${seed}`;
      assert.equal(s.solved, true, `${tag} 应判定为已识破`);
      assert.equal(s.player.hp, hp, `${tag} 完成推理的那一次操作不该掉血`);
      assert.ok(!out.some((e) => e.type === 'damage'), `${tag} 不该有任何伤害事件`);
      assert.equal(s.tiles.filter((t) => !t.revealed).length, 0, `${tag} 剩余威胁全部揭示`);
      assert.equal(s.flags, 0, `${tag} 旗帜收回`);
      assert.equal(s.tiles.some((t) => t.flagged), false, `${tag} 棋盘无残留旗帜`);
      assert.equal(s.forcedCombat, -1, `${tag} 不强行拉进战斗`);
      assert.equal(out.filter((e) => e.type === 'solved').length, 1, `${tag} 恰好一次识破事件`);
    }
  }
});

test('完全识破：事件带掀砖名单与收旗名单，供 UI 逐格回放', () => {
  const { s, last } = nearlySolved();
  const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
  const marked = threats.slice(0, 3).map((t) => t.i);
  for (const i of marked) G.toggleFlag(s, i);
  const out = G.tapTile(s, last.i);
  const sv = out.find((e) => e.type === 'solved');
  assert.deepEqual(sv.tiles, threats.map((t) => t.i), '掀砖名单＝本次自动揭示的全部威胁，按格子顺序');
  assert.deepEqual(sv.flagged, marked, '收旗名单＝识破前插着的那几面旗');
  assert.equal(sv.count, sv.tiles.length);
  assert.ok(sv.flagged.every((i) => sv.tiles.includes(i)), '插旗格必然也在掀砖名单里');
  // 状态已经一次翻完，UI 只能靠这份名单回放动画
  assert.ok(sv.tiles.every((i) => s.tiles[i].revealed && !s.tiles[i].flagged));
});

test('完全识破：陷阱安全拆除，怪物仍可自愿开战', () => {
  const { s, last } = nearlySolved();
  G.tapTile(s, last.i);
  const traps = find(s, 'trap');
  assert.ok(traps.length, '本层应有陷阱');
  assert.ok(traps.every((t) => t.used && t.revealed), '陷阱被拆除而非触发');
  const hp = s.player.hp;
  const out = G.tapTile(s, traps[0].i);
  assert.equal(s.player.hp, hp, '识破后点陷阱不扣血');
  assert.deepEqual(out, [], '已拆除的陷阱点了没反应');

  const mob = find(s, 'monster').find((t) => t.mob.hp > 0);
  const atk = mob.mob.atk;
  const co = G.tapTile(s, mob.i);
  assert.equal(s.pendingCombat, mob.i, '识破后仍能主动点开怪物赚经验');
  assert.ok(co.some((e) => e.type === 'encounter'));
  assert.equal(s.forcedCombat, -1, '主动开战不是偷袭');
  assert.equal(mob.mob.atk, atk, '自动揭示的怪物不再吃偷袭加成');
});

test('未识破时规则不变：插旗陷阱照扣血', () => {
  const s = fresh('normal', 21);
  const trap = find(s, 'trap').find((t) => !t.revealed);
  G.toggleFlag(s, trap.i);
  const hp = s.player.hp;
  G.tapTile(s, trap.i);
  assert.ok(s.player.hp < hp, '推理未完成时，点开插旗陷阱仍是玩家自己的冒进');
  assert.equal(s.solved, false);
  assert.equal(G.boardSolved(s), false, '还有安全格没翻开就不算解出');
});

test('完全识破只触发一次，下行重置', () => {
  const { s, last } = nearlySolved();
  G.tapTile(s, last.i);
  const mob = find(s, 'monster').find((t) => t.mob.hp > 0);
  const out = G.tapTile(s, mob.i);
  assert.ok(!out.some((e) => e.type === 'solved'), '不重复播报');
  s.floor = 2; G.buildFloor(s);
  assert.equal(s.solved, false, '下行重置识破状态');
  assert.equal(s.solvedFlags, 0, '下行重置旗数记账');
});

test('旗帜领主：识破收回旗帜后，仍按插对的旗数回血', () => {
  const { s, last } = nearlySolved();
  const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
  for (const t of threats.slice(0, 3)) G.toggleFlag(s, t.i);
  G.tapTile(s, last.i);
  assert.equal(s.solvedFlags, 3, '暗格全是威胁，所以插着的旗必然插对');
  assert.equal(s.flags, 0);
  s.relics.push('bannerLord');
  s.player.hp = 5;
  s.stairsFound = true; s.hasKey = true;
  G.tryDescend(s);
  assert.ok(s.log.some((l) => l.k === 'log.bannerlord' && l.p.n === 3), '完美推理不该让旗帜领主少回血');
});

test('boardSolved 把宝箱/药水/祭坛/阶梯都算安全格', () => {
  const s = fresh('normal', 21);
  const chest = find(s, 'chest')[0];
  assert.ok(chest, '本层应有宝箱');
  chest.revealed = false; // 首点泛洪可能已经顺带露出它，这里要一个确定未翻开的安全格
  for (const t of s.tiles) if (!THREATS.includes(t.kind) && t !== chest) t.revealed = true;
  G.recalc(s);
  assert.equal(G.boardSolved(s), false, '还有未翻开的宝箱就不算解出');
  chest.revealed = true;
  assert.equal(G.boardSolved(s), true);
});

test('识破状态可存档往返，旧版本存档被拒绝', () => {
  const { s, last } = nearlySolved();
  for (const t of s.tiles.filter((x) => THREATS.includes(x.kind) && !x.revealed).slice(0, 2)) G.toggleFlag(s, t.i);
  G.tapTile(s, last.i);
  const back = G.deserialize(G.serialize(s));
  assert.equal(back.solved, true);
  assert.equal(back.solvedFlags, s.solvedFlags);
  assert.equal(back.tiles.filter((t) => !t.revealed).length, 0);
  assert.equal(G.deserialize(JSON.stringify({ ...s, v: 7 })), null, 'v7 存档应被拒绝');
});

test('插旗不免疫偷袭：被标记的怪物翻到时照样先扣血并强制开战', () => {
  const s = fresh('normal', 33);
  const mob = find(s, 'monster').find((t) => !t.revealed);
  G.toggleFlag(s, mob.i);
  const atk = mob.mob.atk;
  const hp = s.player.hp;
  const dmg = G.ambushDamage(s.player, mob.mob);
  G.tapTile(s, mob.i);
  assert.equal(mob.revealed, true);
  assert.equal(mob.flagged, false, '点开自动拔旗');
  assert.equal(mob.mob.atk, atk, '插旗不会改变偷袭方式');
  assert.equal(s.player.hp, hp - dmg, '偷袭那一口照扣');
  assert.equal(s.forcedCombat, mob.i);
});

test('插旗的怪物可以直接点开，但翻到它就是偷袭', () => {
  const s = fresh('normal', 41);
  const mob = find(s, 'monster').find((t) => !t.revealed);
  G.toggleFlag(s, mob.i);
  assert.equal(s.flags, 1);
  const atk = mob.mob.atk;
  const hp = s.player.hp;
  const dmg = G.ambushDamage(s.player, mob.mob);
  const out = G.tapTile(s, mob.i);
  assert.equal(mob.revealed, true);
  assert.equal(mob.flagged, false, '点开时自动拔旗');
  assert.equal(s.flags, 0, '自动拔旗归还预算');
  assert.equal(mob.mob.atk, atk);
  assert.equal(s.player.hp, hp - dmg);
  assert.equal(s.pendingCombat, mob.i, '直接进入战斗');
  assert.equal(s.forcedCombat, mob.i, '没有退路');
  assert.ok(out.some((e) => e.type === 'encounter' && e.i === mob.i));
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

test('完整推理后快速展开不会踩中陷阱', () => {
  const kinds = ['monster', 'elite', 'trap', 'boss'];
  let s = null, target = null;
  for (let seed = 1; seed <= 60 && !target; seed++) {
    const c = fresh('normal', seed);
    for (const t of c.tiles) {
      if (!t.revealed || t.kind !== 'empty' || t.n === 0) continue;
      const hid = G.neighbors(t.i).filter((j) => !c.tiles[j].revealed && !c.tiles[j].flagged);
      const threats = hid.filter((j) => kinds.includes(c.tiles[j].kind));
      if (threats.length !== t.n || threats.length === hid.length) continue;
      s = c; target = { t, hid, threats }; break;
    }
  }
  assert.ok(target, '应能找到旗位可唯一确定的数字格');
  for (const j of target.threats) G.toggleFlag(s, j);
  assert.equal(s.flags, target.t.n);
  const hp = s.player.hp;
  const evs = G.tapTile(s, target.t.i);
  assert.ok(!evs.some((e) => e.type === 'damage'), '旗位完全正确时快速展开不应受伤');
  assert.equal(s.player.hp, hp);
  const safe = target.hid.filter((j) => !target.threats.includes(j));
  for (const j of safe) assert.equal(s.tiles[j].revealed, true, '安全暗格应被展开');
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

// ---------- 识破收益与两条构筑轴 ----------
const grantAll = (s, ...ids) => ids.forEach((id) => grant(s, id));

function solveWith(flags, relics = [], diff = 'normal', seed = 21, floor = 1) {
  const { s, last } = nearlySolved(diff, seed, floor);
  grantAll(s, ...relics);
  const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
  const pre = threats.map((t) => (t.mob ? { def: t.mob.def, atk: t.mob.atk, hp: t.mob.hp } : null));
  const n = flags === 'all' ? threats.length : flags;
  plantFlags(s, threats.slice(0, n)); // 结算类用例不走旗数预算
  const before = { gold: s.player.gold, lv: s.player.lv };
  const out = G.tapTile(s, last.i);
  return { s, out, sv: out.find((e) => e.type === 'solved'), threats, pre, before, last };
}

test('识破收益：零旗也有基础削弱，防御不会削成负数', () => {
  let cut = 0;
  // 第一层的怪防御本来就是 0，削不出记录；深层才有防御可削，两种情况都要覆盖
  for (const [floor, seed] of [[1, 21], [5, 21], [5, 5], [6, 9]]) {
    const { sv, threats, pre } = solveWith(0, [], 'normal', seed, floor);
    assert.equal(sv.perfect, false);
    assert.equal(sv.cutDef, G.SOLVE_DEF_CUT);
    assert.equal(sv.cutAtk, 0);
    assert.equal(sv.gold, 0);
    assert.equal(sv.xp, 0);
    threats.forEach((t, k) => {
      if (!pre[k]) { assert.equal(t.mob, null, '陷阱没有属性可削'); return; }
      assert.equal(t.mob.def, Math.max(0, pre[k].def - G.SOLVE_DEF_CUT));
      assert.equal(t.mob.atk, pre[k].atk, '基础收益只削防御');
      if (t.mob.cut) { cut++; assert.equal(t.mob.cut.atk, 0); }
      else assert.equal(pre[k].def, 0, '没留下削减记录只可能是因为防御本来就是 0');
    });
  }
  assert.ok(cut > 0, '有防御的怪应留下削减记录供 UI 说明');
});

test('识破收益：每面插对的旗换金币，铸币印放大它', () => {
  const a = solveWith(3);
  assert.equal(a.sv.gold, 3 * G.SOLVE_FLAG_GOLD);
  assert.equal(a.s.player.gold - a.before.gold, 3 * G.SOLVE_FLAG_GOLD);
  const b = solveWith(3, ['mint']);
  assert.equal(b.sv.gold, Math.round(3 * G.SOLVE_FLAG_GOLD * 1.5));
});

test('完美识破：剩余威胁全部插旗才给额外经验，漏一面就不算', () => {
  const full = solveWith('all');
  assert.equal(full.sv.perfect, true);
  assert.equal(full.sv.xp, G.SOLVE_PERFECT_XP);
  assert.equal(full.sv.flagged.length, full.threats.length);
  assert.ok(full.s.log.some((l) => l.k === 'log.solve.reward.perfect'), '结算要在日志里说清楚');
  const part = solveWith(full.threats.length - 1);
  assert.equal(part.sv.perfect, false);
  assert.equal(part.sv.xp, 0);
});

test('破阵与夺气：插对的旗按上限削全体怪物防御与攻击', () => {
  const { sv, threats, pre } = solveWith(6, ['siegeBreak', 'moraleBreak']);
  assert.equal(sv.cutDef, G.SOLVE_DEF_CUT + G.RELIC_SIEGE_CAP);
  assert.equal(sv.cutAtk, G.RELIC_MORALE_CAP);
  threats.forEach((t, k) => {
    if (!pre[k]) return;
    assert.equal(t.mob.def, Math.max(0, pre[k].def - sv.cutDef));
    assert.equal(t.mob.atk, Math.max(0, pre[k].atk - sv.cutAtk));
    assert.deepEqual(t.mob.cut, { def: Math.min(pre[k].def, sv.cutDef), atk: Math.min(pre[k].atk, sv.cutAtk) });
  });
  const few = solveWith(2, ['siegeBreak', 'moraleBreak']);
  assert.equal(few.sv.cutDef, G.SOLVE_DEF_CUT + 2, '未达上限时按旗数线性结算');
  assert.equal(few.sv.cutAtk, 2);
});

test('全识：完美识破再削防御并给大额经验，非完美时不触发', () => {
  const full = solveWith('all', ['perfectMind']);
  assert.equal(full.sv.xp, G.SOLVE_PERFECT_XP + G.RELIC_MIND_XP);
  assert.equal(full.sv.cutDef, G.SOLVE_DEF_CUT + G.RELIC_MIND_DEF);
  const part = solveWith(1, ['perfectMind']);
  assert.equal(part.sv.xp, 0);
  assert.equal(part.sv.cutDef, G.SOLVE_DEF_CUT);
});

test('识破削弱只作用本层，下行后新怪物不带削减记录', () => {
  const { s } = solveWith('all', ['siegeBreak', 'moraleBreak']);
  s.stairsFound = true; s.hasKey = true;
  G.tryDescend(s);
  G.tapTile(s, 30);
  assert.ok(s.tiles.some((t) => t.mob), '新一层应已生成怪物');
  assert.ok(s.tiles.every((t) => !t.mob || !t.mob.cut), '新怪物重新生成，不继承上一层的削弱');
});

test('识破收益只在解出时结算：插旗本身不发金币', () => {
  const { s, last } = nearlySolved();
  const threats = s.tiles.filter((t) => THREATS.includes(t.kind) && !t.revealed);
  const gold0 = s.player.gold;
  plantFlags(s, threats);
  assert.equal(s.player.gold, gold0, '插旗不消耗回合也不发钱');
  assert.equal(s.solved, false);
  G.tapTile(s, last.i);
  assert.ok(s.player.gold > gold0);
});

test('识破削弱后，预演与结算读的是同一份被削过的属性', () => {
  const { s, threats } = solveWith('all', ['siegeBreak', 'moraleBreak']);
  const t = threats.find((x) => x.mob && x.mob.hp > 0);
  const f = G.forecast(s.player, t.mob);
  s.player.hp = s.player.maxHp = 9999;
  const c = G.attack(s, t.i).find((e) => e.type === 'combat');
  assert.equal(c.take, f.take);
  assert.equal(c.rounds, f.rounds);
});

test('反震甲：预演回合与承伤等于逐回合模拟，含「死于反震」的那一口', () => {
  for (const T of [0, 1, 3, 7]) {
    const p = hero({ atk: 7, def: 2, hp: 500, maxHp: 500, thorns: T });
    for (const hp of [1, 4, 10, 20, 21, 37, 100]) {
      for (const def of [0, 3, 9]) {
        const mob = { hp, def, atk: 9, elite: false, boss: false };
        const f = G.forecast(p, mob);
        let left = hp, rounds = 0, counters = 0;
        while (left > 0) {
          left -= G.hitDamage(p.atk, def); rounds++;
          if (left <= 0) break;
          counters++; left -= T;
        }
        const tag = `T${T} hp${hp} def${def}`;
        assert.equal(f.rounds, rounds, `${tag} 回合数`);
        assert.equal(f.counters, counters, `${tag} 被反击次数`);
        assert.equal(f.take, counters * G.hitDamage(mob.atk, p.def), `${tag} 承伤`);
      }
    }
  }
});

test('反震甲：它省的是回合数，不是每击伤害', () => {
  const mob = { hp: 60, def: 2, atk: 12, elite: false, boss: false };
  const a = G.forecast(hero({ atk: 8, def: 3, hp: 500, maxHp: 500, thorns: 0 }), mob);
  const b = G.forecast(hero({ atk: 8, def: 3, hp: 500, maxHp: 500, thorns: G.RELIC_RECOIL }), mob);
  assert.equal(a.deal, b.deal, '反震不改变每击伤害');
  assert.ok(b.rounds < a.rounds, '反震缩短回合');
  assert.ok(b.take < a.take, '反震减少承伤');
});

test('血气方刚：攻击按生命上限派生，重复同步不叠加', () => {
  const s = fresh('normal', 5);
  const atk0 = s.player.atk;
  grant(s, 'vigor');
  const want = Math.floor(s.player.maxHp / G.RELIC_VIGOR_STEP);
  assert.equal(s.player.atk, atk0 + want);
  assert.equal(s.player.atkBonus, want);
  for (let k = 0; k < 5; k++) { s.floor = 2; G.buildFloor(s); }
  assert.equal(s.player.atk, atk0 + want, '反复下楼不该把派生攻击越叠越多');
  assert.equal(s.player.atkBonus, want);
});

test('血气方刚：生命精粹涨血上限会跟着涨攻击，血之契扣血上限会跟着扣', () => {
  const s = fresh('normal', 5);
  grant(s, 'vigor');
  s.player.gold = 9999;
  const atk0 = s.player.atk, hp0 = s.player.maxHp;
  G.buy(s, 'elixir'); G.buy(s, 'elixir');
  assert.equal(s.player.maxHp, hp0 + 2 * G.SHOP_ELIXIR_HP);
  assert.equal(s.player.atk, atk0 + Math.floor((hp0 + 2 * G.SHOP_ELIXIR_HP) / G.RELIC_VIGOR_STEP) - Math.floor(hp0 / G.RELIC_VIGOR_STEP));
  const atk1 = s.player.atk, hp1 = s.player.maxHp;
  grant(s, 'bloodPact');
  assert.equal(s.player.maxHp, hp1 - 8);
  assert.equal(s.player.atk, atk1 + 4 - (Math.floor(hp1 / G.RELIC_VIGOR_STEP) - Math.floor((hp1 - 8) / G.RELIC_VIGOR_STEP)));
});

test('生命精粹：永久 +6 生命上限并立即恢复，价格递增', () => {
  const s = fresh('normal', 3);
  s.player.gold = 999; s.player.hp = 5;
  const hp0 = s.player.maxHp, p1 = G.shopPrice(s, 'elixir');
  G.buy(s, 'elixir');
  assert.equal(s.player.maxHp, hp0 + G.SHOP_ELIXIR_HP);
  assert.equal(s.player.hp, 5 + G.SHOP_ELIXIR_HP);
  assert.equal(s.bought.elixir, 1);
  assert.ok(G.shopPrice(s, 'elixir') > p1, '越买越贵');
});

test('测绘师：卷轴探明的新威胁换永久攻击，封顶后不再涨且跨层保留', () => {
  const s = fresh('normal', 21);
  grant(s, 'cartographer');
  s.player.scrolls = 20;
  const atk0 = s.player.atk;
  const densest = () => {
    let at = -1, most = -1;
    for (const t of s.tiles) {
      if (t.revealed) continue;
      const n = [t.i, ...G.neighbors(t.i)].filter((j) => !s.tiles[j].revealed && !s.tiles[j].flagged).length;
      if (n > most) { most = n; at = t.i; }
    }
    return at;
  };
  for (let k = 0; k < 12 && s.relicState.survey < G.RELIC_SURVEY_CAP; k++) {
    const at = densest(); if (at < 0) break;
    G.setMode(s, 'scroll'); G.tapTile(s, at);
  }
  assert.equal(s.relicState.survey, G.RELIC_SURVEY_CAP, '应能攒满');
  assert.equal(s.player.atk, atk0 + G.RELIC_SURVEY_CAP);
  const at = densest();
  if (at >= 0) { G.setMode(s, 'scroll'); G.tapTile(s, at); }
  assert.equal(s.player.atk, atk0 + G.RELIC_SURVEY_CAP, '封顶后不再涨');
  s.stairsFound = true; s.hasKey = true;
  G.tryDescend(s);
  assert.equal(s.relicState.survey, G.RELIC_SURVEY_CAP, '下楼不清零');
  assert.equal(s.player.atk, atk0 + G.RELIC_SURVEY_CAP);
});

test('测绘师：只数这次新探明的威胁，已探明的不算', () => {
  const s = arena();
  grant(s, 'cartographer');
  putMob(s, 0); putMob(s, 1);
  s.tiles[0].revealed = true; G.recalc(s);
  s.player.scrolls = 3;
  const atk0 = s.player.atk;
  G.setMode(s, 'scroll'); G.tapTile(s, 1);
  assert.equal(s.relicState.survey, 1);
  assert.equal(s.player.atk, atk0 + 1);
});

test('层岩誓约：每下行一层永久 +1 防御与 +3 生命上限', () => {
  const s = fresh('normal', 9);
  grant(s, 'strataOath');
  const def0 = s.player.def, hp0 = s.player.maxHp;
  s.player.hp = 1;
  for (let f = 1; f <= 3; f++) {
    s.stairsFound = true; s.hasKey = true;
    G.tryDescend(s);
    assert.equal(s.player.def, def0 + f * G.STRATA_DEF);
    assert.equal(s.player.maxHp, hp0 + f * G.STRATA_HP);
  }
  assert.ok(s.player.hp > 1, '成长同时回血');
});

test('贪婪低语：只借本层 1 点防御，下行归还', () => {
  const s = fresh('normal', 13);
  atFloor(s, 2);
  const altar = find(s, 'altar')[0];
  assert.ok(altar, '第 2 层应有祭坛');
  const def0 = s.player.def, gold0 = s.player.gold;
  G.altarChoose(s, altar.i, 'greed');
  assert.equal(s.player.def, def0 - 1);
  assert.equal(s.defDebt, 1);
  assert.equal(s.player.gold - gold0, 45);
  assert.equal(altar.used, true);
  s.stairsFound = true; s.hasKey = true;
  G.tryDescend(s);
  assert.equal(s.player.def, def0, '下行归还借走的防御');
  assert.equal(s.defDebt, 0);
});

test('贪婪低语：防御为 0 时拒绝，不白送金币也不消耗祭坛', () => {
  const s = fresh('normal', 13);
  atFloor(s, 2);
  const altar = find(s, 'altar')[0];
  s.player.def = 0;
  const gold0 = s.player.gold;
  assert.deepEqual(G.altarChoose(s, altar.i, 'greed'), []);
  assert.equal(s.player.gold, gold0);
  assert.equal(altar.used, false);
  assert.equal(s.defDebt, 0);
});

test('贪婪低语：连借两层也不会变成永久防御损失', () => {
  const s = fresh('normal', 13);
  const def0 = s.player.def;
  for (const f of [2, 3]) {
    atFloor(s, f);
    G.altarChoose(s, find(s, 'altar')[0].i, 'greed');
    assert.equal(s.player.def, def0 - 1);
    assert.equal(s.defDebt, 1);
    s.stairsFound = true; s.hasKey = true;
    G.tryDescend(s);
    assert.equal(s.player.def, def0);
    assert.equal(s.defDebt, 0);
  }
});

test('构筑字段可存档往返，v11 存档被拒绝', () => {
  const s = fresh('normal', 21);
  grantAll(s, 'vigor', 'recoilMail', 'cartographer', 'strataOath', 'bonePlate', 'vow', 'heartEater');
  s.player.gold = 999; G.buy(s, 'elixir');
  s.defDebt = 1; s.player.def -= 1;
  const back = G.deserialize(G.serialize(s));
  assert.equal(back.player.thorns, G.RELIC_RECOIL);
  assert.equal(back.player.atkBonus, s.player.atkBonus);
  assert.equal(back.player.atk, s.player.atk);
  assert.equal(back.player.takeFlat, s.player.takeFlat);
  assert.equal(back.relicState.survey, s.relicState.survey);
  assert.equal(back.relicState.heart, s.relicState.heart);
  assert.equal(back.defDebt, 1);
  assert.equal(G.deserialize(JSON.stringify({ ...s, v: 11 })), null, 'v11 存档应被拒绝');
});

/* ─────────── 天赋（职业） ─────────── */
test('天赋：开局必须选一次，选定后锁定且不可重复', () => {
  const s = G.createRun('normal', 3);
  assert.equal(s.talent, null);
  assert.equal(s.talentPending, true);
  assert.deepEqual(G.chooseTalent(s, 'nope'), []);
  assert.equal(s.talentPending, true, '非法 id 不应清除待选状态');
  const evs = G.chooseTalent(s, 'gladiator');
  assert.equal(s.talent, 'gladiator');
  assert.equal(s.talentPending, false);
  assert.ok(evs.some((e) => e.type === 'talentPick' && e.id === 'gladiator'));
  assert.deepEqual(G.chooseTalent(s, 'brawler'), []);
  assert.equal(s.talent, 'gladiator', '选定后不能换天赋');
});

test('角斗士：场上仅 1 只存活怪物时攻击翻倍，预演与实际结算一致', () => {
  const s = fresh('normal', 11);
  G.chooseTalent(s, 'gladiator');
  s.player.atk = 10; s.player.hp = 999; s.player.maxHp = 999;
  const put = (i) => { s.tiles[i].revealed = true; s.tiles[i].mob = { id: 'bat', hp: 999, atk: 0, def: 2, xp: 0, gold: 0 }; };
  assert.equal(G.visibleMobs(s), 0);
  assert.equal(G.atkOf(s), 10);
  put(5);
  assert.equal(G.visibleMobs(s), 1);
  assert.equal(G.atkOf(s), 20, '仅 1 只时翻倍');
  const evs = G.attack(s, 5);
  const combat = evs.find((e) => e.type === 'combat');
  assert.equal(combat.deal, G.hitDamage(20, 2), '战斗按翻倍后的攻击结算');
  put(6); put(8);
  assert.equal(G.visibleMobs(s), 2);
  assert.equal(G.atkOf(s), 10, '两只以上不再翻倍');
});

test('角斗士：永久攻击增益额外 +1，升级奖励面板仍记录本身数值', () => {
  const s = fresh('normal', 17);
  G.chooseTalent(s, 'gladiator');
  const atk0 = s.player.atk;
  s.levelChoices = ['atk:common'];
  G.chooseLevel(s, 'atk:common');
  assert.equal(s.player.atk, atk0 + 2, '升级攻击 +1 实际 +2');
  assert.equal(s.levelTaken.atk, 1, '累计面板记录的是升级奖励本身');
  const atk1 = s.player.atk;
  grant(s, 'whetstone');
  assert.equal(s.player.atk, atk1 + G.RELIC_WHETSTONE_ATK + 1, '遗物加攻同样额外 +1');
});

test('格斗家：每 5 杀随机成长一项，击杀回复按次回血', () => {
  const s = fresh('normal', 23);
  G.chooseTalent(s, 'brawler');
  const p = s.player;
  p.hp = 50; p.maxHp = 100;
  s.stats.kills = G.BRAWLER_EVERY - 1;
  const before = { hp: p.maxHp, def: p.def, atk: p.atk, heal: p.killHeal };
  const put = (i) => { s.tiles[i].revealed = true; s.tiles[i].mob = { id: 'bat', hp: 1, atk: 0, def: 0, xp: 0, gold: 0 }; };
  put(5);
  const evs = G.attack(s, 5);
  const grow = evs.find((e) => e.type === 'brawlerGrow');
  assert.ok(grow, `第 ${G.BRAWLER_EVERY} 杀应触发成长`);
  assert.ok(G.BRAWLER_TYPES.includes(grow.stat));
  const delta = { hp: p.maxHp - before.hp, def: p.def - before.def, atk: p.atk - before.atk, heal: p.killHeal - before.heal };
  assert.equal(Object.values(delta).filter((n) => n !== 0).length, 1, '每次只成长一项');
  assert.equal(delta[grow.stat], grow.n, '事件数值与实际成长一致');

  p.killHeal = 3; p.hp = 10;
  put(7);
  G.attack(s, 7);
  assert.equal(p.hp, 13, '击杀回复每次击杀都生效');
});

test('宝藏猎人：每层宝箱 +1，深层封顶 9 个', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let f = 1; f <= G.MAX_FLOOR; f++) {
      const base = Math.min(8, Math.max(2, Math.round((3 + f * 0.15) * G.DIFFICULTIES[diff].loot)));
      const s = G.createRun(diff, 100 + f);
      G.chooseTalent(s, 'treasureHunter');
      s.floor = f; G.buildFloor(s); G.ensureBoard(s, 30);
      assert.equal(s.plan.chests, Math.min(9, base + 1), `${diff} 第 ${f} 层应 +1`);
      assert.equal(find(s, 'chest').length, s.plan.chests);
    }
  }
  const first = G.createRun('normal', 5);
  const base = Math.min(8, Math.max(2, Math.round((3 + 1 * 0.15) * G.DIFFICULTIES.normal.loot)));
  G.chooseTalent(first, 'treasureHunter');
  assert.equal(first.plan.chests, Math.min(9, base + 1), '首层选完天赋后方案要重算');
});

test('宝藏猎人：开箱按概率额外掉落遗物，计数与实际入栏一致', () => {
  const s = fresh('normal', 31);
  G.chooseTalent(s, 'treasureHunter');
  s.player.hp = 999; s.player.maxHp = 999;
  const chest = find(s, 'chest')[0];
  chest.revealed = true; chest.used = false;
  const relics0 = s.relics.length;
  let procs = 0;
  for (let k = 0; k < 400; k++) {
    chest.used = false;
    const before = s.stats.chestRelics;
    G.tapTile(s, chest.i);
    if (s.stats.chestRelics > before) procs++;
  }
  assert.equal(s.stats.chests, 400, '每次开箱都计数');
  assert.equal(s.stats.chestRelics, procs);
  assert.equal(s.relics.length - relics0, procs, '每件箱中遗物都真正入栏');
  assert.ok(procs > 0, '400 次开箱内应至少触发一次');
  assert.ok(procs < 400, '不应每次都掉');

  const plain = fresh('normal', 31);
  const ch = find(plain, 'chest')[0];
  ch.revealed = true; ch.used = false;
  G.tapTile(plain, ch.i);
  assert.equal(plain.stats.chestRelics, 0, '没有天赋时宝箱不掉遗物');
});

test('医者：开局与每次下行各入包 1 瓶药水', () => {
  const s = fresh('normal', 41);
  const potions0 = s.player.potions;
  const evs = G.chooseTalent(s, 'healer');
  assert.equal(s.player.potions, potions0 + 1, '选定天赋时补发首层药水');
  assert.ok(evs.some((e) => e.type === 'item' && e.item === 'potion'));

  s.stairsFound = true; s.hasKey = true;
  const before = s.player.potions;
  G.tryDescend(s);
  assert.equal(s.floor, 2);
  assert.equal(s.player.potions, before + 1, '下行进入新层再发 1 瓶');

  const plain = fresh('normal', 42);
  const base = plain.player.potions;
  G.chooseTalent(plain, 'gladiator');
  plain.stairsFound = true; plain.hasKey = true;
  G.tryDescend(plain);
  assert.equal(plain.player.potions, base, '其他天赋不会额外发药');
});

test('医者：服药额外回复 10 点并永久 +10 生命上限', () => {
  const s = fresh('normal', 43);
  G.chooseTalent(s, 'healer');
  s.player.hp = 1;
  const potions0 = s.player.potions, max0 = s.player.maxHp;
  const evs = G.usePotion(s);
  assert.equal(s.player.potions, potions0 - 1);
  assert.equal(s.player.maxHp, max0 + G.HEALER_POTION_MAXHP);
  const healed = evs.find((e) => e.type === 'heal').amount;
  assert.equal(healed, Math.ceil((max0 + G.HEALER_POTION_MAXHP) * G.BAL.potionPct) + G.HEALER_POTION_HEAL, '药水基础回复 + 医者额外 10 点');
  assert.equal(s.player.hp, 1 + healed);

  const plain = fresh('normal', 43);
  plain.player.hp = 1;
  const plainMax = plain.player.maxHp;
  const plainHeal = G.usePotion(plain).find((e) => e.type === 'heal').amount;
  assert.equal(plain.player.maxHp, plainMax, '无天赋者生命上限不变');
  assert.equal(plainHeal, Math.ceil(plainMax * G.BAL.potionPct));
});

test('天赋勋章：首通点亮、重复通关返回 false、非法 id 不计', () => {
  const meta = { wins: 0, runs: 0 };
  assert.equal(G.awardTalentMedal(meta, 'gladiator'), true, '首次通关应点亮');
  assert.equal(meta.medals.gladiator, true);
  assert.equal(G.awardTalentMedal(meta, 'gladiator'), false, '同一天赋重复通关不再点亮');
  assert.equal(G.awardTalentMedal(meta, 'nope'), false, '未知天赋不写勋章');
  assert.equal(G.awardTalentMedal(meta, null), false);
  assert.deepEqual(Object.keys(meta.medals), ['gladiator']);

  assert.equal(G.awardTalentMedal(meta, 'brawler'), true, '另一天赋应点亮第二枚');
  assert.equal(G.talentMedalCount(meta), 2);
});

test('天赋勋章：读取存档时清理非法 id，计数只认现有天赋', () => {
  assert.deepEqual(G.sanitizeMedals({ gladiator: true, ghost: true }), { gladiator: true });
  assert.deepEqual(G.sanitizeMedals(null), {});
  assert.deepEqual(G.sanitizeMedals('x'), {});
  assert.equal(G.talentMedalCount({ medals: { gladiator: true, ghost: true } }), 1);
  assert.equal(G.talentMedalCount({}), 0);
  assert.equal(G.talentMedalCount(null), 0);

  const meta = { medals: { ghost: true } };
  assert.equal(G.awardTalentMedal(meta, 'treasureHunter'), true);
  assert.deepEqual(meta.medals, { treasureHunter: true }, '写入前先清掉脏数据');
});

test('天赋与击杀回复可存档往返；老存档补默认值且不强制选天赋', () => {
  const s = fresh('normal', 29);
  G.chooseTalent(s, 'brawler');
  s.player.killHeal = 4;
  s.stats.chests = 3; s.stats.chestRelics = 1;
  const back = G.deserialize(G.serialize(s));
  assert.equal(back.talent, 'brawler');
  assert.equal(back.talentPending, false);
  assert.equal(back.player.killHeal, 4);
  assert.equal(back.stats.chests, 3);
  assert.equal(back.stats.chestRelics, 1);

  const raw = JSON.parse(G.serialize(s));
  delete raw.talent; delete raw.talentPending; delete raw.player.killHeal;
  delete raw.stats.chests; delete raw.stats.chestRelics;
  const old = G.deserialize(JSON.stringify(raw));
  assert.equal(old.talent, null);
  assert.equal(old.talentPending, false, '老存档已开局，不强行插入选天赋');
  assert.equal(old.player.killHeal, 0);
  assert.equal(old.stats.chests, 0);
  assert.equal(old.stats.chestRelics, 0);
});
