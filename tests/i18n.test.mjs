// i18n 框架自检：解析语义、目录完整性、源码里不再夹带文案、引用键全部存在。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zhCN from '../public/src/locales/zh-CN.js';
import { t, ref, LOCALES, locale, setLocale } from '../public/src/i18n.js';
import * as G from '../public/src/game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'public', 'src', f), 'utf8');
const KEYS = Object.keys(zhCN);

// 注释天然可以写中文，扫描前先剥掉；本项目的源码里没有含 // 的字符串字面量。
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

test('解析器：插值、数组连接、嵌套引用与缺键回显', () => {
  assert.equal(t('difficulty.easy.name'), '地窖');
  assert.equal(t('difficulty.flags', { n: 4 }), '初始旗 4 面');
  assert.equal(t('tile.danger', { n: 3 }), '危险 3');
  assert.equal(t('ui.combat.cut', { parts: ['防御 −1', '攻击 −2'].join(t('ui.combat.cut.sep')) }), '本层已识破，它被削弱了：防御 −1、攻击 −2。下面的属性与预演都已计入。');

  const saved = locale();
  setLocale('zh-CN');
  assert.deepEqual(LOCALES, ['zh-CN'], '当前只发布简体中文');
  setLocale('xx-XX');
  assert.equal(locale(), saved, '未知语言不应把当前语言改坏');

  const nested = t('log.solve.reward.perfect', { parts: [ref('log.solve.part.def', { n: 2 }), ref('log.solve.part.gold', { n: 6 })] });
  assert.equal(nested, '识破奖励（完美识破）：怪物防御 −2 · +6 金币。', '历史日志必须能整段重译');

  assert.equal(t('no.such.key'), 'no.such.key', '缺键暴露 key，开发期一眼可见');
});

test('目录：每个值都是非空字符串，且没有只差大小写的重复键', () => {
  const seen = new Map();
  for (const [k, v] of Object.entries(zhCN)) {
    assert.equal(typeof v, 'string', `${k} 不是字符串`);
    assert.ok(v.trim().length, `${k} 是空值`);
    const low = k.toLowerCase();
    assert.ok(!seen.has(low), `${k} 与 ${seen.get(low)} 重复`);
    seen.set(low, k);
  }
  assert.ok(KEYS.length > 200, `目录过小，疑似漏迁：${KEYS.length}`);
});

test('动态键族：难度/商店/怪物/楼层/遗物/祭坛/稀有度/分类都能解析出文案', () => {
  for (const d of Object.values(G.DIFFICULTIES)) {
    assert.notEqual(G.difficultyName(d), `difficulty.${d.id}.name`);
    assert.ok(G.difficultyTag(d) && G.difficultyDesc(d));
  }
  for (const it of G.SHOP) {
    assert.ok(G.shopName(it) && G.shopDesc(it), `shop.${it.id}`);
  }
  for (const f of Array.from({ length: G.MAX_FLOOR }, (_, i) => i + 1)) {
    assert.ok(G.floorName(f) && !G.floorName(f).startsWith('floor.'), `floor.${f}`);
  }
  for (const r of G.RELICS) {
    assert.ok(G.relicName(r) && G.relicDesc(r) && G.relicFlavor(r), `relic.${r.id}`);
    assert.ok(G.rarityName(r.rarity) && G.catName(r.cat), `${r.id} 的稀有度/分类`);
  }
  for (const o of G.ALTAR_OPTIONS) assert.ok(G.altarName(o) && G.altarDesc(o), `altar.${o.id}`);
});

test('怪物文案覆盖所有会生成的怪', () => {
  const ids = new Set(['guardian', 'dragon']);
  for (const seed of [1, 7, 19]) {
    const run = G.createRun('normal', seed);
    run.player.hp = 99999; run.player.maxHp = 99999; // 只为枚举，别让骚扰把探索者打死
    for (let f = 1; f <= G.MAX_FLOOR; f++) {
      run.floor = f;
      G.buildFloor(run);
      G.tapTile(run, 30);
      for (const t of run.tiles) if (t.mob) ids.add(t.mob.id);
    }
  }
  assert.ok(ids.size >= 6, `生成的怪物种类过少：${[...ids].join(',')}`);
  for (const id of ids) {
    assert.ok(zhCN[`mob.${id}.name`], `缺 mob.${id}.name`);
    assert.ok(zhCN[`mob.${id}.flavor`], `缺 mob.${id}.flavor`);
  }
});

test('源码不再夹带面向玩家的中文（注释除外）', () => {
  for (const f of ['game.js', 'ui.js', 'main.js', 'fx.js', 'audio.js', 'i18n.js']) {
    const code = stripComments(read(f));
    const hits = code.split(/\r?\n/).map((l, i) => [i + 1, l]).filter(([, l]) => /[\u4e00-\u9fff]/.test(l));
    assert.deepEqual(hits, [], `${f} 仍有硬编码中文：${JSON.stringify(hits.slice(0, 5))}`);
  }
});

test('源码引用的每个 key 都能在目录里找到（允许作为前缀）', () => {
  const known = (k) => KEYS.includes(k) || KEYS.some((x) => x.startsWith(k.endsWith('.') ? k : k + '.'));
  const literal = /'((?:ui|log|tile|list|mob|relic|shop|altar|floor|difficulty|rarity|cat|source)\.[A-Za-z0-9_.]+)'/g;
  const missing = [];
  for (const f of ['game.js', 'ui.js']) {
    const code = stripComments(read(f));
    for (const m of code.matchAll(literal)) if (!known(m[1])) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});
