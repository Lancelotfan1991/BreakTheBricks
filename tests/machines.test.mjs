import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/src/game.js';

const find = (s, kind) => s.tiles.filter((t) => t.kind === kind);
const isThreatKind = (k) => ['monster', 'elite', 'trap', 'boss'].includes(k);

// 一层干净的空棋盘：只保留首点安全，其余全部复位，便于手工摆机关
function arena(seed = 7) {
  const s = G.createRun('normal', seed);
  G.tapTile(s, 30);
  for (const t of s.tiles) {
    t.kind = 'empty'; t.mob = null; t.chest = null;
    t.used = false; t.revealed = false; t.flagged = false; t.fire = false;
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
function atFloor(s, f) {
  s.floor = f;
  G.buildFloor(s);
  G.tapTile(s, 30);
  G.closePending(s);
  return s;
}

// ---------- 石墙 ----------
test('石墙：未解锁时点击与插旗都被拒绝，相邻非墙格全揭开后可以手动拆', () => {
  let s = null, wall = null;
  for (let seed = 1; seed <= 40 && !wall; seed++) {
    s = atFloor(G.createRun('normal', seed), 3);
    wall = find(s, 'wall').find((t) => !G.wallOpen(s, t.i));
  }
  assert.ok(wall, '第 3 层应存在尚未解锁的石墙');

  const turns = s.stats.turns;
  const locked = G.tapTile(s, wall.i);
  assert.equal(wall.revealed, false, '未解锁的石墙不能手动翻开');
  assert.equal(s.stats.turns, turns, '无效点击不消耗回合');
  assert.ok(locked.some((e) => e.type === 'wallLock'));
  assert.equal(s.log.at(-1).k, 'log.wall.lock');

  const flags = s.flags;
  const flagOut = G.toggleFlag(s, wall.i);
  assert.equal(wall.flagged, false, '石墙不是威胁，不占旗子');
  assert.equal(s.flags, flags);
  assert.ok(flagOut.some((e) => e.type === 'wallFlag'));

  for (const j of G.neighbors(wall.i)) {
    if (s.tiles[j].kind !== 'wall') s.tiles[j].revealed = true;
  }
  G.recalc(s);
  assert.equal(G.wallOpen(s, wall.i), true, '非墙邻居全部揭开后应解锁');
  G.tapTile(s, wall.i);
  assert.equal(wall.revealed, true, '解锁后可以手动拆除');
  assert.equal(s.stats.turns, turns + 1);
});

test('石墙：炸弹直接轰开，卷轴探明会被石墙挡住，石墙不拖住完全识破', () => {
  const s = atFloor(G.createRun('normal', 11), 3);
  const wall = find(s, 'wall').find((t) => !t.revealed);
  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  const out = G.tapTile(s, wall.i);
  assert.equal(wall.revealed, true, '炸弹无视解锁条件');
  assert.equal(s.player.bombs, 0);
  assert.ok(out.some((e) => e.type === 'wallBreak'));
  assert.equal(s.log.at(-1).k, 'log.wall.break');

  // 卷轴只探明，不拆墙：锁定中的墙留在原地
  const s2 = atFloor(G.createRun('normal', 12), 3);
  const locked = find(s2, 'wall').find((t) => !G.wallOpen(s2, t.i));
  if (locked) {
    const around = G.neighbors(locked.i).find((j) => s2.tiles[j].kind !== 'wall');
    s2.player.scrolls = 1;
    G.setMode(s2, 'scroll');
    G.tapTile(s2, around);
    assert.equal(locked.revealed, false, '卷轴不会拆掉未解锁的石墙');
  }

  // 石墙是明面上的结构：安全格全开就算识破，不必先把墙拆完
  const s3 = atFloor(G.createRun('normal', 13), 3);
  const last = s3.tiles.find((t) => t.kind === 'empty' && !t.revealed);
  assert.ok(last, '应留有未翻开的空地');
  const walls = find(s3, 'wall');
  for (const t of s3.tiles) {
    if (t !== last && !isThreatKind(t.kind) && t.kind !== 'wall') t.revealed = true;
  }
  G.recalc(s3);
  assert.equal(G.boardSolved(s3), false, '还有空地没翻开时不算识破');
  G.tapTile(s3, last.i);
  assert.equal(s3.solved, true, '空地翻开后即识破，石墙不构成信息缺口');
  assert.ok(walls.some((t) => !t.revealed), '未拆的石墙不必参与识破');
});

test('石墙：给相邻的暗格插旗也算处理完毕，旗子不会把墙一起锁死', () => {
  const s = atFloor(G.createRun('normal', 21), 3);
  const wall = find(s, 'wall').find((t) => !t.revealed && !G.wallOpen(s, t.i));
  assert.ok(wall, '应找到尚未解锁的石墙');
  for (const j of G.neighbors(wall.i)) {
    if (s.tiles[j].kind !== 'wall') s.tiles[j].revealed = true;
  }
  const blocker = G.neighbors(wall.i).find((j) => s.tiles[j].kind !== 'wall');
  s.tiles[blocker].revealed = false;
  G.recalc(s);
  assert.equal(G.wallOpen(s, wall.i), false, '暗格还没处理时墙是锁着的');
  G.toggleFlag(s, blocker);
  assert.equal(s.tiles[blocker].flagged, true);
  assert.equal(G.wallOpen(s, wall.i), true, '插旗等同已处理，墙可以开');
});

// ---------- 火焰地板 ----------
test('火焰：亲手翻开只灼烧一次并熄灭，卷轴探明不烧，火焰不吞掉格子内容', () => {
  const s = arena();
  s.tiles[0].fire = true;
  s.player.hp = s.player.maxHp = 200;
  s.player.def = 0;
  const want = G.fireDamage(s);
  const out = G.tapTile(s, 0);
  assert.equal(s.player.hp, 200 - want, '手动踩火按火焰伤害结算');
  assert.equal(s.tiles[0].fire, false, '踩过的火立即熄灭');
  assert.ok(out.some((e) => e.type === 'fireBurn' && e.dmg === want));
  s.player.hp = 200;
  G.tapTile(s, 0);
  assert.equal(s.player.hp, 200, '同一格不会再烧第二次');

  const s2 = arena();
  const mob = putMob(s2, 0, { atk: 10 });
  s2.tiles[0].fire = true;
  s2.player.hp = s2.player.maxHp = 200;
  s2.player.scrolls = 1;
  G.setMode(s2, 'scroll');
  G.tapTile(s2, 0);
  assert.equal(s2.player.hp, 200, '卷轴是安全探明，不触发灼烧');
  assert.equal(mob.revealed, true);
  assert.equal(s2.tiles[0].fire, false, '探明同样会熄灭火');

  const s3 = arena();
  s3.tiles[0].kind = 'chest';
  s3.tiles[0].chest = { type: 'gold', amount: 5 };
  s3.tiles[0].fire = true;
  s3.player.hp = s3.player.maxHp = 200;
  G.tapTile(s3, 0);
  assert.equal(s3.tiles[0].kind, 'chest', '火没有烧毁宝箱');
  assert.equal(s3.tiles[0].used, false, '宝箱仍需再点一次才开启');
  const gold = s3.player.gold;
  G.tapTile(s3, 0);
  assert.equal(s3.tiles[0].used, true);
  assert.ok(s3.player.gold > gold, '火上的宝箱照常开出战利品');
});

test('火焰：每 5 个花费操作蔓延一格，封顶 12 格，且不蔓延到阶梯等机关格', () => {
  const make = () => {
    const s = arena();
    s.floor = 4;
    return s;
  };
  const s = make();
  s.tiles[0].fire = true;
  const before = s.tiles.filter((t) => t.fire).length;
  s.hazardClock = G.HAZARD_TICK - 1;
  G.tickHazards(s, []);
  assert.equal(s.tiles.filter((t) => t.fire).length, before + 1, '满 5 回合蔓延一格');
  assert.equal(s.hazardClock, 0, '计时器重置');

  // 免费操作不推进机关时钟
  const s2 = make();
  s2.tiles[0].fire = true;
  s2.tiles[30].revealed = true;
  s2.hazardClock = 2;
  G.tapTile(s2, 30);
  assert.equal(s2.hazardClock, 2, '免费操作不推进火焰时钟');

  const s3 = make();
  s3.tiles[0].fire = true;
  s3.tiles[1].kind = 'stairs';
  for (let k = 0; k < 6; k++) { s3.hazardClock = G.HAZARD_TICK - 1; G.tickHazards(s3, []); }
  assert.equal(s3.tiles[1].fire, false, '火焰不蔓延到阶梯');

  const s4 = make();
  for (let i = 0; i < G.FIRE_CAP; i++) s4.tiles[i].fire = true;
  for (let k = 0; k < 4; k++) { s4.hazardClock = G.HAZARD_TICK - 1; G.tickHazards(s4, []); }
  assert.ok(s4.tiles.filter((t) => t.fire).length <= G.FIRE_CAP, '火焰格数封顶');
});

// ---------- 魔法图腾 ----------
test('魔法图腾：每 5 回合脉冲一次、无视防御，6 次后耗尽且炸弹无效', () => {
  const s = atFloor(G.createRun('normal', 7), 5);
  const totem = find(s, 'totemMagic')[0];
  assert.ok(totem, '第 5 层应生成魔法图腾');
  assert.equal(totem.revealed, true, '图腾生成即可见');
  assert.equal(totem.totem.charges, G.TOTEM_MAGIC_CHARGES);

  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  const bombOut = G.tapTile(s, totem.i);
  assert.equal(s.player.bombs, 1, '魔法图腾不可摧毁，炸弹不被消耗');
  assert.ok(!bombOut.some((e) => e.type === 'bomb'));
  assert.equal(s.log.at(-1).k, 'log.bomb.totem');
  G.setMode(s, 'explore');

  s.player.hp = s.player.maxHp = 500;
  s.player.def = 99;
  const dmg = totem.totem.dmg;
  s.hazardClock = G.HAZARD_TICK - 1;
  const out = G.tickHazards(s, []);
  assert.equal(s.player.hp, 500 - dmg, '脉冲伤害无视防御');
  assert.equal(totem.totem.charges, G.TOTEM_MAGIC_CHARGES - 1);
  assert.ok(out.some((e) => e.type === 'totemPulse' && e.dmg === dmg));

  for (let k = 0; k < G.TOTEM_MAGIC_CHARGES - 1; k++) {
    s.hazardClock = G.HAZARD_TICK - 1;
    G.tickHazards(s, []);
  }
  assert.equal(totem.totem.charges, 0);
  assert.equal(totem.used, true, '充能耗尽后失效');
  assert.equal(s.player.hp, 500 - dmg * G.TOTEM_MAGIC_CHARGES);
  s.hazardClock = G.HAZARD_TICK - 1;
  G.tickHazards(s, []);
  assert.equal(s.player.hp, 500 - dmg * G.TOTEM_MAGIC_CHARGES, '耗尽后不再伤人');

  // 耗尽后的图腾已不是可攻击目标，炸弹也不会被浪费
  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  G.tapTile(s, totem.i);
  assert.equal(s.player.bombs, 1);
  assert.equal(s.log.at(-1).k, 'log.bomb.invalid');
});

// ---------- 死亡图腾 ----------
test('死亡图腾：在场时本层怪物获得攻防增幅，炸掉图腾后增幅被精确移除', () => {
  const s = atFloor(G.createRun('normal', 7), 6);
  const totem = find(s, 'totemDeath')[0];
  assert.ok(totem, '第 6 层应生成死亡图腾');
  assert.equal(totem.revealed, true);
  const aura = { atk: totem.totem.atk, def: totem.totem.def };
  assert.ok(aura.atk > 0, '增幅至少 +1 攻击');
  const mobs = s.tiles.filter((t) => t.mob && t.mob.hp > 0);
  assert.ok(mobs.length > 0);
  for (const t of mobs) assert.deepEqual(t.mob.aura, aura, '所有活着的怪物都带增幅');

  const before = mobs.map((t) => ({ t, atk: t.mob.atk, def: t.mob.def }));
  s.player.bombs = 1;
  G.setMode(s, 'bomb');
  const out = G.tapTile(s, totem.i);
  assert.equal(totem.used, true);
  assert.ok(out.some((e) => e.type === 'totemBreak'));
  for (const b of before) {
    assert.equal(b.t.mob.aura, null, '增幅记录被清除');
    assert.equal(b.t.mob.atk, Math.max(0, b.atk - aura.atk));
    assert.equal(b.t.mob.def, Math.max(0, b.def - aura.def));
  }
});

// ---------- 大地之门 ----------
test('大地之门：整局一扇、两步确认、回退 5 层且跳过 Boss 层，不给下行奖励', () => {
  const seed = 42;
  const doorFloor = G.doorFloorFor(seed);
  assert.ok(doorFloor >= G.DOOR_MIN_FLOOR && doorFloor <= G.MAX_FLOOR);
  assert.equal(G.isBossFloor(doorFloor), false, '门不会落在 Boss 层');

  const s = atFloor(G.createRun('normal', seed), doorFloor);
  const door = find(s, 'door')[0];
  assert.ok(door, `种子 ${seed} 的第 ${doorFloor} 层应有大地之门`);
  assert.equal(door.revealed, true, '门生成即可见');

  const turns = s.stats.turns;
  const out = G.tapTile(s, door.i);
  assert.equal(s.pendingDoor, door.i, '点击只弹确认，不立刻传送');
  assert.equal(s.stats.turns, turns, '查看门不消耗回合');
  assert.ok(out.some((e) => e.type === 'door'));
  G.closePending(s);
  assert.equal(s.pendingDoor, -1, '可以取消');

  G.tapTile(s, door.i);
  const hp = s.player.hp, gold = s.player.gold, xp = s.player.xp;
  const target = G.doorTarget({ floor: doorFloor });
  const useOut = G.useDoor(s, door.i);
  assert.equal(s.floor, target, '回退固定层数，落点是 Boss 层则再退一层');
  assert.equal(s.doorUsed, true);
  assert.equal(s.pendingDoor, -1);
  assert.ok(useOut.some((e) => e.type === 'doorUse' && e.floor === s.floor));
  assert.equal(s.player.gold, gold, '门不给下行金币');
  assert.equal(s.player.xp, xp, '门不给下行经验');
  assert.equal(s.player.hp, hp, '门不给下行回复');
  assert.equal(find(s, 'door').length, 0, '回退后的新层不再生成门');

  s.floor = doorFloor;
  G.buildFloor(s);
  G.ensureBoard(s, 30);
  assert.equal(find(s, 'door').length, 0, '整局用过的门不会再次出现');
  const stale = G.useDoor(s, door.i);
  assert.equal(stale.length, 0, '旧的门引用无法再次触发');
  assert.equal(s.floor, doorFloor);

  assert.equal(G.doorTarget({ floor: 15 }), 9, '回退的落点若是 Boss 层就再退一层');
  assert.equal(G.doorTarget({ floor: 30 }), 25);
  assert.equal(G.doorTarget({ floor: 9 }), 4);
});

// ---------- 存档往返 ----------
test('机关状态可存档往返：火焰层、时钟、门状态与待确认门', () => {
  const s = atFloor(G.createRun('normal', 7), 4);
  const fireTile = s.tiles.find((t) => t.fire) || s.tiles.find((t) => !t.revealed);
  fireTile.fire = true;
  s.hazardClock = 3;
  s.doorUsed = true;
  s.pendingDoor = 12;
  const back = G.deserialize(G.serialize(s));
  assert.ok(back);
  assert.equal(back.hazardClock, 3);
  assert.equal(back.doorUsed, true);
  assert.equal(back.pendingDoor, 12);
  assert.equal(back.tiles[fireTile.i].fire, true);

  const raw = JSON.parse(G.serialize(s));
  delete raw.doorUsed; delete raw.hazardClock; delete raw.pendingDoor;
  for (const t of raw.tiles) delete t.fire;
  const old = G.deserialize(JSON.stringify(raw));
  assert.ok(old, '缺机关字段的旧存档仍可读取');
  assert.equal(old.doorUsed, false);
  assert.equal(old.hazardClock, 0);
  assert.equal(old.pendingDoor, -1);
  assert.equal(old.tiles.some((t) => t.fire), false);
});
