import * as G from './game.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

const $ = (s) => document.querySelector(s);
const RUN_KEY = 'bbr.run';
const META_KEY = 'bbr.meta';
const SEEN_KEY = 'bbr.seen';

const el = {
  title: $('#screen-title'), game: $('#screen-game'), board: $('#board'), wrap: $('#boardWrap'),
  frame: document.querySelector('.board-frame'),
  floorNum: $('#floorNum'), floorName: $('#floorName'), floorSub: $('#floorSub'),
  hpFill: $('#hpFill'), hpText: $('#hpText'), hpBar: document.querySelector('.hp-bar'),
  atk: $('#atkVal'), def: $('#defVal'), gold: $('#goldVal'), lv: $('#lvNum'), ring: $('#xpRing'),
  threat: $('#threatVal'), flagText: $('#flagText'), threatChip: $('#threatChip'), keyChip: $('#keyChip'),
  aggroChip: $('#aggroChip'), aggroCount: $('#aggroCount'), aggroNext: $('#aggroNext'),
  potion: $('#potionCount'), bomb: $('#bombCount'), scroll: $('#scrollCount'),
  descend: $('#btnDescend'), log: $('#logLine'), ticker: document.querySelector('.ticker'),
  scrim: $('#scrim'), sheet: $('#sheet'), sheetBody: $('#sheetBody'),
  toast: $('#toast'), floorCard: $('#floorCard'), fcDepth: $('#fcDepth'), fcName: $('#fcName'),
  diffGrid: $('#diffGrid'), record: $('#record'), btnContinue: $('#btnContinue'), actionbar: $('#actionbar'),
  relicBar: $('#relicBar'), relicSlots: $('#relicSlots'),
};

let S = null;
let difficulty = localStorage.getItem('bbr.diff') || 'normal';
let meta = loadMeta();
let tiles = [];
let sheetKind = null;
let sheetLock = false;
let busy = false;
let toastTimer = 0;

function loadMeta() {
  try { return Object.assign({ best: 0, bestFloor: 0, wins: 0, runs: 0 }, JSON.parse(localStorage.getItem(META_KEY) || '{}')); }
  catch { return { best: 0, bestFloor: 0, wins: 0, runs: 0 }; }
}
function saveMeta() { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function saveRun() {
  if (S && S.status === 'playing') localStorage.setItem(RUN_KEY, G.serialize(S));
  else localStorage.removeItem(RUN_KEY);
}

/* ─────────── 棋盘尺寸 ─────────── */
function fitBoard() {
  if (!el.wrap || el.game.hidden) return;
  const r = el.wrap.getBoundingClientRect();
  const cs = getComputedStyle(el.frame);
  const pad = parseFloat(cs.paddingLeft) * 2 + parseFloat(cs.borderLeftWidth) * 2;
  const gap = 4;
  const t = Math.floor(Math.min((r.width - pad - gap * (G.COLS - 1)) / G.COLS, (r.height - pad - gap * (G.ROWS - 1)) / G.ROWS));
  const size = Math.max(26, Math.min(64, t));
  document.documentElement.style.setProperty('--tile', size + 'px');
  document.documentElement.style.setProperty('--gap', gap + 'px');
}

/* ─────────── 棋盘渲染 ─────────── */
const ICON = { monster: null, elite: 'guardian', boss: 'dragon', trap: 'trap', chest: 'chest', potion: 'potion', altar: 'altar', stairs: 'stairs' };
const svg = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

function buildBoard() {
  el.board.innerHTML = '';
  tiles = [];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < G.SIZE; i++) {
    const b = document.createElement('button');
    b.className = 'tile tile-hidden';
    b.type = 'button';
    b.dataset.i = String(i);
    b.setAttribute('role', 'gridcell');
    bindTile(b, i);
    frag.appendChild(b);
    tiles.push(b);
  }
  el.board.appendChild(frag);
  fitBoard();
}

function bindTile(b, i) {
  let timer = 0, longed = false, sx = 0, sy = 0;
  const clear = () => { clearTimeout(timer); timer = 0; };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    sx = e.clientX; sy = e.clientY; longed = false;
    clear();
    timer = setTimeout(() => { longed = true; doFlag(i); }, 420);
  });
  b.addEventListener('pointermove', (e) => {
    if (timer && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) clear();
  });
  b.addEventListener('pointerup', clear);
  b.addEventListener('pointercancel', () => { clear(); longed = false; });
  b.addEventListener('pointerleave', clear);
  b.addEventListener('contextmenu', (e) => { e.preventDefault(); clear(); longed = true; doFlag(i); });
  b.addEventListener('click', () => { if (longed) { longed = false; return; } doTap(i); });
}

function tileView(t) {
  const rev = t.revealed;
  let cls = 'tile', inner = '', n = 0, label = G.tileLabel(t, S.aggroClock);
  if (!rev) {
    cls += t.flagged ? ' tile-hidden tile-flag' : ' tile-hidden';
    if (t.flagged) inner = svg('flag');
    label = `第${Math.floor(t.i / G.COLS) + 1}行第${(t.i % G.COLS) + 1}列 ${label}`;
    return { cls, inner, n, label };
  }
  cls += ' tile-rev';
  if (t.mob && t.mob.hp > 0) {
    const m = t.mob;
    cls += t.kind === 'boss' ? ' tile-boss' : t.kind === 'elite' ? ' tile-elite' : ' tile-mob';
    // 裸数字会被误读成邻雷数，三项属性各带图标；防御为 0 的怪省略，省出横向空间
    inner = svg(m.icon) + '<span class="tile-stats">'
      + `<i class="ts-hp">${svg('heart')}<b>${m.hp}</b></i>`
      + `<span class="ts-row"><i class="ts-atk">${svg('sword')}<b>${m.atk}</b></i>`
      + (m.def ? `<i class="ts-def">${svg('shield')}<b>${m.def}</b></i>` : '')
      + '</span></span>';
    if (t.kind !== 'monster') inner += `<span class="tile-crown">${svg(t.kind === 'boss' ? 'crown' : 'key')}</span>`;
    if (m.awake && S.aggroClock != null) {
      cls += ' tile-awake';
      if (t.i === aggroTopIdx) inner += `<span class="tile-aggro">${S.aggroClock}</span>`;
    }
    label += ` 生命${m.hp} 攻击${m.atk} 防御${m.def}`;
    return { cls, inner, n, label };
  }
  if (t.kind === 'stairs') {
    cls += ' tile-stairs';
    inner = svg('stairs');
    const locked = S.floor > 1 && !S.hasKey;
    if (locked) { inner += `<span class="tile-lock">${svg('lock')}</span>`; label += '（上锁）'; }
    return { cls, inner, n, label };
  }
  if (!t.used) {
    if (t.kind === 'trap') { cls += ' tile-trap'; inner = svg('trap'); return { cls, inner, n, label }; }
    if (t.kind === 'chest') { cls += ' tile-chest tile-pick'; inner = svg('chest'); return { cls, inner, n, label }; }
    if (t.kind === 'potion') { cls += ' tile-potion tile-pick'; inner = svg('potion'); return { cls, inner, n, label }; }
    if (t.kind === 'altar') { cls += ' tile-altar'; inner = svg('altar'); return { cls, inner, n, label }; }
  }
  // 占用失效后必须和空地一样给出邻雷数，否则这些格子会成为推断雷位的信息黑洞
  n = t.n;
  cls += t.kind === 'empty' ? (n ? '' : ' tile-empty') : ' tile-dead';
  if (n) inner = `<span class="tile-num">${n}</span>`;
  return { cls, inner, n, label };
}

function renderBoard(popSet) {
  for (let i = 0; i < G.SIZE; i++) {
    const t = S.tiles[i], b = tiles[i];
    const v = tileView(t);
    const sig = v.cls + '|' + v.inner + '|' + v.n;
    if (b._sig !== sig) {
      b.className = v.cls;
      b.innerHTML = v.inner;
      b.dataset.n = v.n ? String(v.n) : '';
      b.setAttribute('aria-label', v.label);
      b._sig = sig;
      if (popSet && popSet.has(i)) {
        b.classList.add('pop');
        setTimeout(() => b.classList.remove('pop'), 360);
      }
    } else if (b.getAttribute('aria-label') !== v.label) b.setAttribute('aria-label', v.label);
  }
  el.board.classList.remove('mode-explore', 'mode-flag', 'mode-bomb', 'mode-scroll');
  el.board.classList.add('mode-' + S.mode);
}

/* ─────────── HUD ─────────── */
let prev = {};
function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); setTimeout(() => node.classList.remove('bump'), 460); }

function renderHud() {
  const p = S.player;
  el.floorNum.textContent = S.floor;
  el.floorName.textContent = G.FLOOR_NAMES[S.floor];
  el.floorSub.textContent = `DEPTH ${S.floor} / ${G.MAX_FLOOR}`;
  const pct = Math.max(0, p.hp / p.maxHp);
  el.hpFill.style.transform = `scaleX(${pct})`;
  el.hpText.textContent = `${p.hp} / ${p.maxHp}`;
  el.hpBar.classList.toggle('low', pct <= 0.3);
  el.atk.textContent = p.atk; el.def.textContent = p.def; el.gold.textContent = p.gold;
  el.lv.textContent = p.lv;
  el.ring.style.strokeDashoffset = String(119.4 * (1 - p.xp / p.xpNext));
  const remain = S.generated ? G.remainingThreats(S) : S.threatTotal;
  el.threat.textContent = remain;
  el.flagText.textContent = `${S.flags}/${S.threatTotal}`;
  el.threatChip.classList.toggle('full', S.flags >= S.threatTotal);
  el.threatChip.setAttribute('aria-label', `剩余威胁 ${remain}，旗子已用 ${S.flags}，上限 ${S.threatTotal}`);
  el.keyChip.hidden = !S.hasKey;
  const ag = G.aggroSummary(S);
  el.aggroChip.hidden = !ag;
  if (ag) {
    el.aggroCount.textContent = ag.count;
    el.aggroNext.textContent = `·${ag.next}→-${ag.dmg}`;
    el.aggroChip.classList.toggle('soon', ag.next <= 2);
    el.aggroChip.setAttribute('aria-label', `${ag.count} 只怪物被惊扰，${ag.next} 回合后承受 ${ag.dmg} 点骚扰伤害`);
  }
  el.potion.textContent = p.potions; el.bomb.textContent = p.bombs; el.scroll.textContent = p.scrolls;
  el.potion.parentElement.classList.toggle('empty', p.potions === 0);
  el.bomb.parentElement.classList.toggle('empty', p.bombs === 0);
  el.scroll.parentElement.classList.toggle('empty', p.scrolls === 0);
  for (const k of ['atk', 'def', 'gold', 'lv']) if (prev[k] != null && prev[k] !== p[k]) bump(el[k].parentElement.classList.contains('chip') ? el[k].parentElement : el.lv.parentElement);
  prev = { atk: p.atk, def: p.def, gold: p.gold, lv: p.lv };

  for (const b of el.actionbar.querySelectorAll('[data-mode]')) b.classList.toggle('is-on', b.dataset.mode === S.mode);
  const can = G.canDescend(S);
  const locked = S.stairsFound && !can;
  el.descend.disabled = !S.stairsFound;
  el.descend.classList.toggle('locked', locked);
  el.descend.querySelector('use').setAttribute('href', locked ? '#i-lock' : '#i-down');
  el.descend.querySelector('span').textContent = locked ? '需钥匙' : '下一层';

  const last = S.log[S.log.length - 1];
  if (last && el.log.dataset.id !== String(last.id)) {
    el.log.dataset.id = String(last.id);
    el.log.textContent = last.text;
    el.ticker.className = 'ticker t-' + last.tone;
    el.log.classList.remove('in'); void el.log.offsetWidth; el.log.classList.add('in');
  }
}

function render(popSet) { syncAggroTop(); renderBoard(popSet); renderHud(); renderRelics(); }

// 惊扰时钟全场共用，只有最凶的那只出手——角标只标它，其余惊扰怪只亮红环。
let aggroTopIdx = -1;
function syncAggroTop() {
  aggroTopIdx = -1;
  let best = -1;
  for (const t of S.tiles) {
    if (!t.mob || t.mob.hp <= 0 || !t.mob.awake || t.flagged) continue;
    const d = G.aggroDamage(S.player, t.mob);
    if (d > best) { best = d; aggroTopIdx = t.i; }
  }
}

/* ─────────── 遗物 ─────────── */
const rarityColor = (r) => G.RELIC_RARITY[r.rarity].color;

function relicNote(s, r) {
  if (r.id === 'whetSoul') return `${s.relicState.whet}/${G.RELIC_WHET_CAP}`;
  if (r.id === 'carefulStep') return `${s.relicState.trapWard}`;
  if (r.id === 'momentum') return s.relicState.firstKill ? '已用' : '待发';
  return '';
}

function renderRelics() {
  const list = S.relics;
  el.relicBar.hidden = !list.length;
  if (!list.length) { el.relicSlots.innerHTML = ''; return; }
  const html = list.map((id) => {
    const r = G.relicById(id), note = relicNote(S, r);
    return `<button class="relic-chip" data-act="codex" style="--rc:${rarityColor(r)}" aria-label="${r.name}：${r.desc}">
      ${svg(r.icon)}${note ? `<em>${note}</em>` : ''}</button>`;
  }).join('');
  if (el.relicSlots.innerHTML !== html) el.relicSlots.innerHTML = html;
}

function openRelicDraw() {
  const cards = S.relicChoices.map((id) => {
    const r = G.relicById(id), ra = G.RELIC_RARITY[r.rarity];
    return `<button class="rcard" data-sheet="relic" data-id="${id}" style="--rc:${ra.color}">
      <span class="rcard-rar">${ra.name}</span>
      <span class="rcard-ic">${svg(r.icon)}</span>
      <b class="rcard-name">${r.name}</b>
      <span class="rcard-cat">${G.RELIC_CATS[r.cat]}</span>
      <span class="rcard-desc">${r.desc}</span>
      <span class="rcard-flavor">${r.flavor}</span>
    </button>`;
  }).join('');
  openSheet('relic', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">遗物抉择</h2><p class="sheet-sub">守卫的残骸中浮起三件遗物，只能带走一件。已持有 ${S.relics.length} 件。</p></div>
      <button class="icon-btn sheet-close" data-sheet="codex" aria-label="查看图鉴">${svg('relic')}</button>
    </div>
    <div class="rcards">${cards}</div>
    <p class="rcard-hint">遗物永久生效，本局不会重复出现。点击卡片带走它。</p>
    <div class="sheet-actions"><button class="btn btn-ghost" data-sheet="codex">${svg('relic')}<span>查看遗物图鉴</span></button></div>`, true);
}

function openCodex() {
  const owned = S ? S.relics : [];
  const back = S && S.relicChoices ? 'relicBack' : 'close';
  const groups = Object.entries(G.RELIC_CATS).map(([cat, label]) => {
    const rows = G.RELICS.filter((r) => r.cat === cat).map((r) => {
      const ra = G.RELIC_RARITY[r.rarity], has = owned.includes(r.id);
      return `<div class="cx ${has ? 'has' : ''}" style="--rc:${ra.color}">
        <span class="cx-ic">${svg(r.icon)}</span>
        <span class="cx-tx">
          <b>${r.name}<i class="cx-rar">${ra.name}</i>${has ? '<i class="cx-own">已持有</i>' : ''}</b>
          <span class="cx-desc">${r.desc}</span>
          <span class="cx-fl">${r.flavor}</span>
        </span>
      </div>`;
    }).join('');
    const n = G.RELICS.filter((r) => r.cat === cat && owned.includes(r.id)).length;
    const total = G.RELICS.filter((r) => r.cat === cat).length;
    return `<div class="help-sec"><h3 class="help-h">${label}<i class="cx-count">${n}/${total}</i></h3>${rows}</div>`;
  }).join('');
  const rar = Object.values(G.RELIC_RARITY);
  const wsum = rar.reduce((a, r) => a + r.weight, 0);
  const odds = rar.map((r) => `<span style="color:${r.color}">${r.name} ${Math.round(r.weight / wsum * 100)}%</span>`).join(' · ');
  openSheet('codex', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">遗物图鉴</h2><p class="sheet-sub">共 ${G.RELICS.length} 件 · 本局已收集 ${owned.length} 件</p></div>
      <button class="icon-btn sheet-close" data-sheet="${back}" aria-label="关闭">${svg('close')}</button>
    </div>
    <div class="help-sec">
      <h3 class="help-h">怎么获得</h3>
      <p class="help-p">第 2～7 层各有一名<b>钥匙守卫</b>。击败它（或用炸弹炸掉它）就会浮起 <b>${G.RELIC_DRAW_COUNT} 件</b>遗物，<b>三选一</b>，一局最多 ${G.MAX_FLOOR - 2} 件。<br>
      抽取按稀有度加权：${odds}。已持有的不会再出现，所以越到后期越容易见到史诗。<br>
      遗物<b>只改变代价与收益，不改变信息量</b>——没有任何遗物会替你标雷或透视威胁，战斗数字也永远等于实际结算。</p>
    </div>
    ${groups}
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="${back}">${S && S.relicChoices ? '回到抉择' : '关闭图鉴'}</button></div>`, !!(S && S.relicChoices));
}

/* ─────────── 事件 → 反馈 ─────────── */
function tileCenter(i) { return fx.center(tiles[i]); }

// 拾取物 → 背包落点：图标飞过去，落位时计数弹一下，玩家才看得清东西进了哪一格
const FLY = {
  potion: { icon: 'potion', sel: '.act-potion', cls: 'heal', color: '#7dff5a' },
  bomb: { icon: 'bomb', sel: '[data-mode="bomb"]', cls: 'crit', color: '#ffab2e' },
  scroll: { icon: 'scroll', sel: '[data-mode="scroll"]', cls: 'cyan', color: '#3fe0ff' },
  weapon: { icon: 'sword', sel: '.chip-atk', cls: 'crit', color: '#ffab2e' },
  armor: { icon: 'shield', sel: '.chip-def', cls: 'cyan', color: '#3fe0ff' },
  gold: { icon: 'coin', sel: '.chip-gold', cls: 'gold', color: '#ffd54a' },
};

function flyToBag(from, f) {
  const node = document.querySelector(f.sel);
  if (!node) return;
  const to = fx.center(node);
  fx.fly(from, to, f.icon, {
    cls: f.cls,
    onArrive() { bump(node); fx.ring(to.x, to.y, f.color, 46); fx.haptic('light'); },
  });
}

function consume(events) {
  const pops = new Set();
  let delay = 0;
  const later = (fn, ms) => setTimeout(fn, ms);
  // item/gold 事件不带格子坐标，紧随其后的 loot 才带；先配对，别把上一层的收获算到这一格
  const flyFrom = new Map();
  let bag = [];
  for (const e of events) {
    if (e.type === 'item' && FLY[e.item]) bag.push(FLY[e.item]);
    else if (e.type === 'gold') bag.push(FLY.gold);
    else if (e.type === 'loot') { if (bag.length) flyFrom.set(e, bag); bag = []; }
    else bag = [];
  }
  for (const e of events) {
    switch (e.type) {
      case 'reveal': {
        pops.add(e.i);
        if (pops.size === 1) fx.haptic('tick');
        if (pops.size <= 3) { const c = tileCenter(e.i); later(() => fx.dust(c.x, c.y), delay); delay += 26; }
        break;
      }
      case 'encounter': audio.play('open'); fx.haptic('light'); break;
      case 'flag': audio.play(e.on ? 'flag' : 'unflag'); fx.haptic('tick'); break;
      case 'flagLimit': audio.play('deny'); toast(`旗子用完了：本层共 ${e.total} 处威胁`, 'bad'); break;
      case 'aggro': {
        if (S.tiles[e.i] && S.tiles[e.i].revealed) { const c = tileCenter(e.i); fx.ring(c.x, c.y, '#ff3b5c', 90); }
        break;
      }
      case 'damage': {
        // 骚扰可能来自未探明的怪物：特效不能落在它的格子上，否则等于透视。
        const src = e.at >= 0 ? e.at : S.pendingCombat;
        const at = src >= 0 && S.tiles[src] && S.tiles[src].revealed ? src : -1;
        const c = at >= 0 ? tileCenter(at) : fx.center(el.hpFill);
        fx.flash('hurt'); fx.shake(el.board); fx.blood(c.x, c.y);
        fx.float(c.x, c.y - 10, '-' + e.amount, 'dmg');
        audio.play(e.source === '尖刺陷阱' ? 'trap' : 'hit'); fx.haptic('heavy');
        break;
      }
      case 'heal': {
        const r = el.hpFill.getBoundingClientRect();
        fx.heal(r.left + r.width * 0.5, r.top + r.height / 2);
        fx.float(r.left + r.width * 0.5, r.top - 4, '+' + e.amount, 'heal');
        fx.flash('heal'); audio.play('heal');
        break;
      }
      case 'gold': {
        const r = el.gold.getBoundingClientRect();
        fx.coins(r.left + r.width / 2, r.top + r.height / 2);
        fx.float(r.left + r.width / 2, r.top - 6, '+' + e.amount, 'gold');
        audio.play('coin');
        break;
      }
      case 'kill': {
        const c = tileCenter(e.i);
        fx.shards(c.x, c.y); fx.ring(c.x, c.y, '#ff7a3d', 54);
        fx.float(c.x, c.y - 18, '+' + e.mob.xp + ' XP', 'xp');
        audio.play('kill'); fx.haptic('medium');
        if (e.mob.elite || e.mob.boss) fx.shake(el.board);
        break;
      }
      case 'combat': audio.play('swing'); fx.haptic('light'); break;
      case 'levelup': {
        const r = document.getElementById('lvBadge').getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        fx.ring(x, y, '#ffd54a', 120); fx.magic(x, y); fx.flash('gold');
        fx.float(x, y - 26, 'LEVEL ' + e.lv, 'crit');
        audio.play('levelup'); fx.haptic('heavy'); toast('等级提升！Lv.' + e.lv, 'magic');
        break;
      }
      case 'item': audio.play('item'); break;
      case 'discover': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, e.kind === 'chest' ? '#ffd54a' : '#7dff5a', 46);
        audio.play('sparkle');
        break;
      }
      case 'loot': {
        const c = tileCenter(e.i);
        fx.coins(c.x, c.y); fx.haptic('tick');
        for (const f of flyFrom.get(e) || []) flyToBag(c, f);
        break;
      }
      case 'key': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#ffd54a', 100); fx.coins(c.x, c.y); fx.flash('gold');
        audio.play('key'); fx.haptic('heavy'); toast('获得钥匙 · 阶梯已解封', 'magic');
        break;
      }
      case 'stairs': { const c = tileCenter(e.i); fx.portal(c.x, c.y); audio.play('stairs'); fx.haptic('medium'); toast('发现下行阶梯', 'magic'); break; }
      case 'altar': audio.play('altar'); break;
      case 'altarUsed': { const c = tileCenter(e.i); fx.magic(c.x, c.y); break; }
      case 'bomb': { const c = tileCenter(e.i); fx.boom(c.x, c.y); fx.shake(el.board); audio.play('bomb'); fx.haptic('heavy'); break; }
      case 'disarm': { const c = tileCenter(e.i); fx.dust(c.x, c.y); break; }
      case 'scroll': { const c = tileCenter(e.i); fx.magic(c.x, c.y); fx.ring(c.x, c.y, '#3fe0ff', 110); audio.play('scroll'); break; }
      case 'buy': audio.play('coin'); break;
      case 'relicOffer': audio.play('altar'); break;
      case 'relicGain': {
        const r = G.relicById(e.id);
        const c = fx.center(el.relicBar.hidden ? el.lv : el.relicBar);
        fx.ring(c.x, c.y, rarityColor(r), 130); fx.magic(c.x, c.y); fx.flash('gold');
        audio.play('levelup'); fx.haptic('heavy'); toast('遗物 · ' + r.name, 'magic');
        break;
      }
      case 'deny': audio.play('deny'); break;
      case 'locked': audio.play('locked'); toast('钥匙守卫也算「雷」，打掉它才能夺钥', 'bad'); break;
      case 'blocked': audio.play('deny'); fx.shake(el.board); fx.haptic('light'); toast('这一击会要了你的命', 'bad'); break;
      case 'chord': audio.play('open'); fx.haptic('medium'); break;
      case 'chordHint': {
        audio.play('deny');
        for (const j of G.neighbors(e.i)) if (!S.tiles[j].revealed) { tiles[j].classList.add('hint'); setTimeout(() => tiles[j].classList.remove('hint'), 1500); }
        break;
      }
      case 'mode': audio.play('ui'); break;
      case 'descend': fx.haptic('medium'); break;
      case 'death': fx.rumble(420); fx.shake(el.board); fx.flash('hurt'); break;
      case 'win': fx.rumble(260); later(() => fx.rumble(260), 320); break;
    }
  }
  if (pops.size && !events.some((e) => ['encounter', 'combat', 'damage', 'bomb', 'scroll'].includes(e.type))) audio.play('reveal');
  return pops;
}

/* ─────────── 动作 ─────────── */
function apply(events, opts = {}) {
  const pops = consume(events);
  render(pops);
  saveRun();
  if (events.some((e) => e.type === 'descend')) return descendSequence();
  if (S.status === 'dead') return endSequence(false);
  if (S.status === 'won') return endSequence(true);
  if (S.relicChoices) return openRelicDraw();
  if (S.pendingCombat >= 0) return openCombat(S.pendingCombat);
  if (S.pendingAltar >= 0) return openAltar(S.pendingAltar);
  if (!opts.keepSheet && sheetKind && !sheetLock) closeSheet();
}

function guard() { return busy || !S || S.status !== 'playing'; }

function doTap(i) {
  if (guard()) return;
  audio.init();
  if (sheetKind && !sheetLock) closeSheet();
  apply(G.tapTile(S, i));
}
function doFlag(i) {
  if (guard()) return;
  audio.init();
  if (S.tiles[i].revealed) return;
  fx.buzz(8);
  apply(G.toggleFlag(S, i));
}

/* ─────────── 抽屉 ─────────── */
function openSheet(kind, html, lock = false) {
  sheetKind = kind; sheetLock = lock;
  el.sheetBody.innerHTML = html;
  el.sheetBody.scrollTop = 0;
  el.scrim.hidden = false;
  el.sheet.hidden = false;
  el.sheet.style.animation = 'none'; void el.sheet.offsetWidth; el.sheet.style.animation = '';
}
function closeSheet() {
  if (sheetLock) return;
  sheetKind = null;
  el.scrim.hidden = true;
  el.sheet.hidden = true;
  el.sheetBody.innerHTML = '';
  if (S) { G.closePending(S); saveRun(); }
}
function forceClose() { sheetLock = false; closeSheet(); }

function openCombat(i) {
  const t = S.tiles[i], m = t.mob, p = S.player;
  const f = G.forecast(p, m);
  const safePct = Math.max(0, (p.hp - f.take) / p.maxHp * 100);
  const lossPct = Math.min(100, f.take / p.maxHp * 100);
  const kind = t.kind === 'boss' ? 'boss' : t.kind === 'elite' ? 'elite' : '';
  const tag = t.kind === 'boss' ? '<span class="mob-tag boss">龙王</span>' : t.kind === 'elite' ? '<span class="mob-tag">钥匙守卫</span>' : '';
  const note = f.lethal
    ? `<p class="fc-note danger">⚠ 预计承受 ${f.take} 点伤害，你只剩 ${p.hp} 点生命——这一击必死。先喝药水、升级，或用炸弹绕开。</p>`
    : f.take === 0
      ? `<p class="fc-note">一击必杀，毫发无伤。</p>`
      : `<p class="fc-note">你先出手，${f.rounds} 回合内解决战斗，其间被反击 ${f.rounds - 1} 次。</p>`;
  const aggroRow = m.awake && S.aggroClock != null
    ? `<div class="fc-row hurt"><span>惊扰骚扰（每 ${G.BAL.aggroPeriod} 回合）</span><b>-${G.aggroDamage(p, m)}</b></div>
       <p class="fc-note danger">它已被惊扰。留着不打，就会一直扑上来撕你——骚扰不致死，但会把你压到陷阱能补刀的血线。</p>`
    : '';
  openSheet('combat', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">战斗预演</h2><p class="sheet-sub">先算清楚，再挥剑。</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="关闭">${svg('close')}</button>
    </div>
    <div class="mob-card ${kind}">
      <div class="mob-portrait">${svg(m.icon)}</div>
      <div class="mob-info"><h3 class="mob-name">${m.name}${tag}</h3><p class="mob-flavor">${m.flavor}</p></div>
    </div>
    <div class="stat-grid">
      <div class="stat hp"><i>生命</i><b>${m.hp}</b></div>
      <div class="stat atk"><i>攻击</i><b>${m.atk}</b></div>
      <div class="stat def"><i>防御</i><b>${m.def}</b></div>
      <div class="stat xp"><i>经验</i><b>${m.xp}</b></div>
      <div class="stat gold"><i>金币</i><b>${m.gold}</b></div>
    </div>
    <div class="forecast">
      <div class="fc-row"><span>你的每击伤害</span><b>${f.deal}</b></div>
      <div class="fc-row"><span>需要回合</span><b>${f.rounds}</b></div>
      <div class="fc-row ${f.take ? 'hurt' : 'free'}"><span>预计承受</span><b>${f.take}</b></div>
      ${aggroRow}
      <div class="fc-bar"><i class="fc-safe" style="width:${safePct}%"></i><i class="fc-loss" style="width:${lossPct}%"></i></div>
      ${note}
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-sheet="close">再想想</button>
      ${p.potions > 0 && p.hp < p.maxHp ? `<button class="btn" data-sheet="potion" data-i="${i}">${svg('potion')}<span>药水</span></button>` : ''}
      ${p.bombs > 0 ? `<button class="btn" data-sheet="bomb" data-i="${i}">${svg('bomb')}<span>炸弹</span></button>` : ''}
      <button class="btn ${f.lethal ? 'btn-danger' : 'btn-primary'}" data-sheet="attack" data-i="${i}" ${f.lethal ? 'disabled' : ''}>${svg('sword')}<span>${f.lethal ? '必死' : '攻击'}</span></button>
    </div>`);
}

function openAltar(i) {
  const p = S.player;
  const opts = G.ALTAR_OPTIONS.map((o) => {
    const dis = o.id === 'blood' && p.hp <= G.BAL.bloodCost;
    return `<button class="opt" data-sheet="altar" data-i="${i}" data-choice="${o.id}" ${dis ? 'disabled' : ''}>
      <span class="opt-ic">${svg(o.icon)}</span>
      <span class="opt-tx"><b>${o.name}</b><span>${o.desc}${dis ? '（生命不足）' : ''}</span></span>
    </button>`;
  }).join('');
  openSheet('altar', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">古老祭坛</h2><p class="sheet-sub">石台上的紫色火焰只燃烧一次。选择你的献祭。</p></div>
      <button class="icon-btn sheet-close" data-sheet="skip" aria-label="离开">${svg('close')}</button>
    </div>
    ${opts}
    <div class="sheet-actions"><button class="btn btn-ghost" data-sheet="skip">悄悄离开</button></div>`);
  audio.play('altar');
}

function openShop() {
  const p = S.player;
  const rows = G.SHOP.map((it) => {
    const price = G.shopPrice(S, it.id);
    const can = p.gold >= price;
    return `<button class="opt" data-sheet="buy" data-id="${it.id}" ${can ? '' : 'disabled'}>
      <span class="opt-ic">${svg(it.icon)}</span>
      <span class="opt-tx"><b>${it.name}</b><span>${it.desc}</span></span>
      <span class="opt-price ${can ? '' : 'no'}">${svg('coin')}${price}</span>
    </button>`;
  }).join('');
  openSheet('shop', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">行囊商人</h2><p class="sheet-sub">「砖缝里什么都长，包括生意。」每次购买后价格会上涨。</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="关闭">${svg('close')}</button>
    </div>
    <div class="gold-line">${svg('coin')}<span>持有</span><b>${p.gold}</b></div>
    ${rows}
    <div class="sheet-actions"><button class="btn btn-ghost" data-sheet="close">离开商店</button></div>`);
}

function openHelp() {
  const legend = [
    ['hand', '未探索的砖', '点开后可能是空地、怪物或宝藏', '#c9a3ff'],
    ['flag', '标记', '插旗＝确认并规避：该格怪物不再骚扰你；旗数上限＝本层威胁总数', '#ffd27a'],
    ['bat', '怪物', '底部两行是生命 / 攻击·防御（防御为 0 时省略）；点击可预演战斗', '#ff8098'],
    ['trap', '尖刺陷阱', '踩中直接扣血，同样计入数字', '#ff9f3a'],
    ['guardian', '钥匙守卫', '它本身也算一格「雷」，就藏在暗格里；击败或炸掉即夺钥', '#ffd54a'],
    ['chest', '宝箱', '发光的宝箱需要再点一下才开启', '#ffd54a'],
    ['potion', '药水', '同样要点击拾取，恢复 30% 最大生命', '#7dff5a'],
    ['altar', '祭坛', '三选一的献祭，每层只出现一次', '#ff4fd8'],
    ['stairs', '下行阶梯', '找到它并持有钥匙即可下一层', '#3fe0ff'],
    ['dragon', '深渊龙王', '第 8 层的终点，击败即通关', '#ff8ae8'],
  ].map(([ic, t, d, c]) => `<div class="lg"><span class="lg-ic" style="color:${c}">${svg(ic)}</span><span class="lg-tx"><b>${t}</b><span>${d}</span></span></div>`).join('');
  const nums = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span data-n="${n}" class="tile" style="position:relative"><span class="tile-num" style="font-size:14px;color:${['', '#5fe3ff', '#8bff63', '#ffd54a', '#ff9f3a', '#ff6b4a', '#ff3b5c', '#ff4fd8', '#e6dcff'][n]}">${n}</span></span>`).join('');
  openSheet('help', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">玩法说明</h2><p class="sheet-sub">扫雷的推理 + Roguelite 的取舍。共 8 层。</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="关闭">${svg('close')}</button>
    </div>
    <div class="help-sec">
      <h3 class="help-h">数字的含义</h3>
      <p class="help-p">空地上的数字 = 周围 8 格中<b>尚未探明</b>的威胁数量（怪物 + 陷阱 + 守卫 + 龙王）。威胁被探明或清除后，数字会随之减小。</p>
      <div class="numline">${nums}</div>
      <p class="help-p">首次点击永远安全，并会自动展开一片安全区。<br>
      展开时顺带露出的<b>宝箱与药水不会自动拾取</b>——它们会持续发光，再点一下才收入行囊。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">三种操作</h3>
      <p class="help-p"><b>探索</b>：点击砖块。开到怪物不会立刻受伤，会先弹出战斗预演。<br>
      <b>标记</b>：切到标记模式，或<b>长按 / 右键</b>任意暗格插旗。旗子意味着「我已确认它、并绕着走」：
      被标记的怪物<b>不再骚扰你</b>，但旗数上限是<b>本层威胁总数</b>，所以插旗是要花预算的决策。<br>
      插旗格<b>可以直接点开</b>（自动拔旗）——想主动开战时不必先手动拔旗；旗子只挡批量展开，不挡你的主动点击。<br>
      <b>快速展开</b>：点击已探明的数字格，若周围旗数正好等于数字，其余暗格会一次性安全展开。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">战斗与成长</h3>
      <p class="help-p">你<b>先出手</b>。每击伤害 = 攻击 − 对方防御（至少 1）。战斗回合数决定你被反击几次。<br>
      击杀获得经验与金币：升级涨属性，金币可在<b>商店</b>换装备与补给。必死的战斗会被拦下——先变强，或者用炸弹。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">惊扰</h3>
      <p class="help-p">翻开怪物<b>周围 8 格</b>中的任意一格，就会把它<b>惊扰</b>。被惊扰的怪物不再安静待着：
      全场共用一个时钟，每 <b>${G.BAL.aggroPeriod} 次操作</b>，其中<b>最凶的那只</b>会扑上来撕你一口（至少 1 点，<b>不会致死</b>）。</p>
      <p class="help-p">顶部红色芯片显示「几只被惊扰 · 几回合后 · 掉多少血」；棋盘上只有<b>已探明</b>的惊扰怪会亮红环，
      带倒计时角标的那只就是下一次出手的。<b>杀掉它，下一击就换更弱的顶上；全部清光，骚扰停止。</b></p>
      <p class="help-p">时钟只按<b>操作</b>推进，不按真实时间——<b>思考、插旗、切模式、喝药、购物都不消耗回合</b>。
      它逼你规划路线与清怪顺序，而不是催你手快。</p>
      <p class="help-p"><b>插旗可以免骚扰</b>：被标记的怪物不计入惊扰，红色芯片的数字会随之减少；拔旗或翻开它，它就重新加入。
      于是「标出来绕开」和「点开打掉」都是有效解法，而不是被迫清场。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">目标</h3>
      <p class="help-p">每层找到<b>下行阶梯</b>；第 2 层起阶梯上锁，必须击败<b>钥匙守卫</b>夺钥。第 8 层击败<b>深渊龙王</b>即通关。生命归零则本局结束。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">遗物</h3>
      <p class="help-p">第 2～7 层击败<b>钥匙守卫</b>后，会浮起三件遗物让你<b>三选一</b>，永久生效且本局不重复。
      它们只改变代价与收益——不会替你标雷，也不会让战斗数字失真。完整列表见<b>遗物图鉴</b>。</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">图鉴</h3>
      <div class="legend">${legend}</div>
    </div>
    <div class="help-sec">
      <h3 class="help-h">快捷键</h3>
      <p class="help-p">方向键移动 · Enter/空格 探索 · F 标记 · 1/2/3/4 切换模式 · Q 药水 · B 商店 · H 说明 · R 遗物图鉴 · Esc 关闭</p>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-sheet="codex">${svg('relic')}<span>遗物图鉴</span></button>
      <button class="btn btn-primary btn-lg" data-sheet="close">明白了，下地牢</button>
    </div>`);
}

function openMenu() {
  openSheet('menu', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">暂停</h2><p class="sheet-sub">第 ${S.floor} 层 · ${G.FLOOR_NAMES[S.floor]} · Lv.${S.player.lv}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="关闭">${svg('close')}</button>
    </div>
    <button class="opt" data-sheet="sound"><span class="opt-ic">${svg(audio.enabled ? 'sound-on' : 'sound-off')}</span><span class="opt-tx"><b>音效与氛围</b><span>当前：${audio.enabled ? '开启' : '静音'}</span></span></button>
    <button class="opt" data-sheet="help"><span class="opt-ic">${svg('help')}</span><span class="opt-tx"><b>玩法说明</b><span>数字、战斗与道具</span></span></button>
    <button class="opt" data-sheet="codex"><span class="opt-ic">${svg('relic')}</span><span class="opt-tx"><b>遗物图鉴</b><span>${G.RELICS.length} 件遗物 · 已收集 ${S.relics.length} 件</span></span></button>
    <button class="opt" data-sheet="restart"><span class="opt-ic">${svg('skull')}</span><span class="opt-tx"><b>放弃本局</b><span>回到标题，重新开始</span></span></button>
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="close">继续探索</button></div>`);
}

function endSequence(win) {
  busy = true;
  const sc = G.score(S);
  meta.runs++;
  if (win) meta.wins++;
  meta.best = Math.max(meta.best, sc);
  meta.bestFloor = Math.max(meta.bestFloor, S.floor);
  saveMeta(); saveRun();
  audio.play(win ? 'win' : 'death');
  fx.flash(win ? 'gold' : 'hurt');
  if (win) {
    let n = 0;
    const t = setInterval(() => {
      fx.coins(Math.random() * innerWidth, innerHeight * (0.2 + Math.random() * 0.4));
      fx.ring(Math.random() * innerWidth, innerHeight * (0.2 + Math.random() * 0.5), '#ffd54a', 120);
      if (++n > 9) clearInterval(t);
    }, 190);
  }
  setTimeout(() => {
    busy = false;
    const st = S.stats;
    openSheet(win ? 'win' : 'death', `
      <div class="result ${win ? 'win' : ''}">
        <div class="result-ic">${svg(win ? 'crown' : 'skull')}</div>
        <h2 class="result-title">${win ? '重见天光' : '长眠砖下'}</h2>
        <p class="result-sub">${win ? '深渊龙王轰然崩塌，第八层的穹顶裂开一道光。你带着满身尘土走了出去。' : `你倒在了第 ${S.floor} 层「${G.FLOOR_NAMES[S.floor]}」。砖石重新合拢，等待下一个冒险者。`}</p>
        <div class="score-big">${sc}</div><div class="score-lb">SCORE</div>
      </div>
      <div class="res-grid">
        <div class="stat"><i>深度</i><b>${S.floor}</b></div>
        <div class="stat"><i>等级</i><b>${S.player.lv}</b></div>
        <div class="stat"><i>击杀</i><b>${st.kills}</b></div>
        <div class="stat gold"><i>金币</i><b>${st.goldEarned}</b></div>
      </div>
      <div class="gold-line">${svg('sparkle')}<span>历史最佳</span><b>${meta.best}</b><span>· 通关 ${meta.wins}/${meta.runs}</span></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-sheet="title">返回标题</button>
        <button class="btn btn-primary" data-sheet="again">${svg('down')}<span>再来一次</span></button>
      </div>`, true);
  }, win ? 900 : 700);
}

function descendSequence() {
  busy = true;
  audio.play('descend');
  el.fcDepth.textContent = 'DEPTH ' + S.floor;
  el.fcName.textContent = G.FLOOR_NAMES[S.floor];
  el.floorCard.hidden = false;
  el.floorCard.style.animation = 'none'; void el.floorCard.offsetWidth; el.floorCard.style.animation = '';
  const c = { x: innerWidth / 2, y: innerHeight / 2 };
  fx.portal(c.x, c.y); fx.ring(c.x, c.y, '#3fe0ff', 260);
  setTimeout(() => { buildBoard(); render(); fitBoard(); }, 620);
  setTimeout(() => { el.floorCard.hidden = true; busy = false; saveRun(); }, 1680);
}

/* ─────────── 提示 ─────────── */
function toast(text, tone = '') {
  clearTimeout(toastTimer);
  el.toast.className = 'toast ' + tone;
  el.toast.textContent = text;
  el.toast.hidden = false;
  el.toast.style.animation = 'none'; void el.toast.offsetWidth; el.toast.style.animation = '';
  toastTimer = setTimeout(() => {
    el.toast.classList.add('out');
    setTimeout(() => { el.toast.hidden = true; el.toast.classList.remove('out'); }, 300);
  }, 1700);
}

/* ─────────── 流程 ─────────── */
function startRun(diff, seed) {
  difficulty = diff;
  localStorage.setItem('bbr.diff', diff);
  S = G.createRun(diff, seed ?? ((Date.now() ^ (Math.random() * 0xffffff)) | 0));
  prev = {};
  forceClose();
  el.title.hidden = true;
  el.game.hidden = false;
  buildBoard();
  render();
  saveRun();
  requestAnimationFrame(fitBoard);
  audio.init();
  if (!localStorage.getItem(SEEN_KEY)) { localStorage.setItem(SEEN_KEY, '1'); setTimeout(openHelp, 420); }
}

function resumeRun() {
  const s = G.deserialize(localStorage.getItem(RUN_KEY) || '');
  if (!s) return false;
  S = s; difficulty = s.difficulty; prev = {};
  forceClose();
  el.title.hidden = true; el.game.hidden = false;
  buildBoard(); render();
  requestAnimationFrame(fitBoard);
  audio.init();
  if (S.relicChoices) openRelicDraw();
  else if (S.pendingCombat >= 0) openCombat(S.pendingCombat);
  else if (S.pendingAltar >= 0) openAltar(S.pendingAltar);
  return true;
}

function toTitle() {
  forceClose();
  saveRun();
  S = null;
  el.game.hidden = true;
  el.title.hidden = false;
  renderTitle();
}

function renderTitle() {
  el.diffGrid.innerHTML = Object.values(G.DIFFICULTIES).map((d) => {
    const c = d.id === 'easy' ? '#7dff5a' : d.id === 'normal' ? '#ffab2e' : '#ff3b5c';
    return `<button class="diff" role="radio" data-diff="${d.id}" style="--dc:${c}" aria-checked="${d.id === difficulty}">
      <b>${d.name}</b><i>${d.tag}</i><s>${d.desc}</s></button>`;
  }).join('');
  const has = !!G.deserialize(localStorage.getItem(RUN_KEY) || '');
  el.btnContinue.hidden = !has;
  el.record.innerHTML = meta.runs
    ? `历史最佳 <b>${meta.best}</b> 分 · 最深 <b>${meta.bestFloor}</b> 层 · 通关 <b>${meta.wins}</b> / ${meta.runs} 局`
    : '第一次下潜？先从「地窖」开始，学会读数字。';
  syncSound();
}

function syncSound() {
  for (const b of document.querySelectorAll('[data-act="sound"]')) {
    b.querySelector('use').setAttribute('href', audio.enabled ? '#i-sound-on' : '#i-sound-off');
    b.classList.toggle('is-off', !audio.enabled);
    b.setAttribute('aria-pressed', String(audio.enabled));
  }
}

/* ─────────── 输入绑定 ─────────── */
document.addEventListener('click', (e) => {
  const diff = e.target.closest('[data-diff]');
  if (diff) { difficulty = diff.dataset.diff; localStorage.setItem('bbr.diff', difficulty); audio.play('ui'); renderTitle(); return; }
  const mode = e.target.closest('[data-mode]');
  if (mode && S) { audio.init(); apply(G.setMode(S, mode.dataset.mode)); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  audio.init();
  if (a !== 'sound') audio.play('ui');
  switch (a) {
    case 'sound': audio.toggle(); syncSound(); if (sheetKind === 'menu') openMenu(); break;
    case 'start': startRun(difficulty); break;
    case 'continue': if (!resumeRun()) { toast('没有可继续的探索', 'bad'); renderTitle(); } break;
    case 'help': openHelp(); break;
    case 'codex': openCodex(); break;
    case 'menu': if (S) openMenu(); break;
    case 'potion': if (S && !guard()) apply(G.usePotion(S)); break;
    case 'shop': if (S && !guard()) openShop(); break;
    case 'descend': if (S && !guard()) apply(G.tryDescend(S)); break;
  }
});

el.scrim.addEventListener('click', () => { if (!sheetLock) { audio.play('ui'); closeSheet(); } });

el.sheetBody.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sheet]');
  if (!b) return;
  const k = b.dataset.sheet;
  audio.init();
  if (k !== 'attack') audio.play('ui');
  switch (k) {
    case 'close': closeSheet(); break;
    case 'skip': G.closePending(S); saveRun(); closeSheet(); break;
    case 'attack': { const i = +b.dataset.i; closeSheet(); apply(G.attack(S, i)); break; }
    case 'bomb': { const i = +b.dataset.i; closeSheet(); G.setMode(S, 'bomb'); apply(G.tapTile(S, i)); break; }
    case 'potion': { const i = +b.dataset.i; consume(G.usePotion(S)); render(); saveRun(); openCombat(i); break; }
    case 'altar': { const i = +b.dataset.i; closeSheet(); apply(G.altarChoose(S, i, b.dataset.choice)); break; }
    case 'buy': { const evs = G.buy(S, b.dataset.id); consume(evs); render(); saveRun(); openShop(); break; }
    case 'relic': { const id = b.dataset.id; forceClose(); apply(G.chooseRelic(S, id)); break; }
    case 'codex': openCodex(); break;
    case 'relicBack': if (S && S.relicChoices) openRelicDraw(); else forceClose(); break;
    case 'sound': audio.toggle(); syncSound(); openMenu(); break;
    case 'help': openHelp(); break;
    case 'restart': forceClose(); toTitle(); break;
    case 'title': forceClose(); toTitle(); break;
    case 'again': { const d = S ? S.difficulty : difficulty; forceClose(); startRun(d); break; }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (sheetKind && !sheetLock) closeSheet(); return; }
  if (!S || el.game.hidden) return;
  const focus = document.activeElement;
  const onBoard = focus && focus.classList && focus.classList.contains('tile');
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    e.preventDefault();
    let i = onBoard ? +focus.dataset.i : Math.floor(G.SIZE / 2);
    const x = i % G.COLS, y = Math.floor(i / G.COLS);
    if (k === 'arrowup') i = G.idx(x, Math.max(0, y - 1));
    if (k === 'arrowdown') i = G.idx(x, Math.min(G.ROWS - 1, y + 1));
    if (k === 'arrowleft') i = G.idx(Math.max(0, x - 1), y);
    if (k === 'arrowright') i = G.idx(Math.min(G.COLS - 1, x + 1), y);
    tiles[i].focus();
    return;
  }
  if (guard() || sheetKind) return;
  if (k === 'f' && onBoard) { e.preventDefault(); doFlag(+focus.dataset.i); }
  else if (k === '1') apply(G.setMode(S, 'explore'));
  else if (k === '2') apply(G.setMode(S, 'flag'));
  else if (k === '3') apply(G.setMode(S, 'scroll'));
  else if (k === '4') apply(G.setMode(S, 'bomb'));
  else if (k === 'q') apply(G.usePotion(S));
  else if (k === 'b') openShop();
  else if (k === 'h') openHelp();
  else if (k === 'r') openCodex();
});

addEventListener('resize', fitBoard, { passive: true });
addEventListener('orientationchange', () => setTimeout(fitBoard, 220));
if (window.ResizeObserver) new ResizeObserver(fitBoard).observe(el.wrap);
document.addEventListener('visibilitychange', () => { if (!document.hidden) fitBoard(); });
document.addEventListener('pointerdown', () => audio.init(), { once: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ─────────── 启动 ─────────── */
fx.init();
renderTitle();
fitBoard();

// 便于自动化测试与调试
window.__game = {
  get state() { return S; },
  api: G, fx, audio,
  tap: doTap, flag: doFlag,
  start: startRun, resume: resumeRun, toTitle,
  sheet: () => sheetKind,
  closeSheet, openShop, openHelp, openCodex, openRelicDraw,
  setDifficulty: (d) => { difficulty = d; renderTitle(); },
};