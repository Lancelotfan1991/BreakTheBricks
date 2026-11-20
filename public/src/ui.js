import * as G from './game.js';
import { t as tr } from './i18n.js';
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
  threat: $('#threatVal'), threatChip: $('#threatChip'), keyChip: $('#keyChip'), themeChip: $('#themeChip'),
  potion: $('#potionCount'), bomb: $('#bombCount'), scroll: $('#scrollCount'), flag: $('#flagCount'),
  descend: $('#btnDescend'), log: $('#logLine'), ticker: document.querySelector('.ticker'),
  scrim: $('#scrim'), sheet: $('#sheet'), sheetBody: $('#sheetBody'),
  toast: $('#toast'), floorCard: $('#floorCard'), fcDepth: $('#fcDepth'), fcName: $('#fcName'),
  diffGrid: $('#diffGrid'), record: $('#record'), medals: $('#medals'), btnContinue: $('#btnContinue'), actionbar: $('#actionbar'),
  relicBar: $('#relicBar'), relicSlots: $('#relicSlots'),
  bossBar: $('#bossBar'), bossName: $('#bossName'), bossFill: $('#bossFill'),
  bossHp: $('#bossHp'), bossAtk: $('#bossAtk'),
};

let S = null;
let difficulty = localStorage.getItem('bbr.diff') || 'normal';
let meta = loadMeta();
let tiles = [];
let sheetKind = null;
let sheetLock = false;
let busy = false;
let toastTimer = 0;
// 首次开局先选天赋，选完再把玩法说明推上来，两个锁定抽屉不抢同一张 sheet
let firstRunHelp = false;
// 识破时状态已一次性翻完，DOM 却要按节奏回放：solveHold 暂存掀开前的砖面，solveAnim 标记本格正在掀
let solveHold = null;
const solveAnim = new Map();
let solveTimers = [];

function loadMeta() {
  try {
    const m = Object.assign({ wins: 0, runs: 0, medals: {} }, JSON.parse(localStorage.getItem(META_KEY) || '{}'));
    m.medals = G.sanitizeMedals(m.medals);
    return m;
  } catch { return { wins: 0, runs: 0, medals: {} }; }
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
  clearSolve();
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
  let cls = 'tile', inner = '', n = 0, label = G.tileLabel(t);
  if (!rev) {
    cls += t.flagged ? ' tile-hidden tile-flag' : ' tile-hidden';
    if (t.kind === 'wall') {
      cls += ' tile-wall';
      inner = svg('wall');
    } else if (t.fire) {
      cls += ' tile-fire';
      inner = svg('flame') + (t.flagged ? `<span class="tile-fire-flag">${svg('flag')}</span>` : '');
    } else if (t.flagged) inner = svg('flag');
    label = tr('ui.board.pos', { row: Math.floor(t.i / G.COLS) + 1, col: (t.i % G.COLS) + 1, label });
    return { cls, inner, n, label };
  }
  cls += ' tile-rev';
  // 拆开的石墙：和阶梯一样保留邻雷数，否则它附近的推断会少一条线索
  if (t.kind === 'wall') {
    cls += ' tile-wall-open';
    n = t.n;
    inner = svg('wall') + `<span class="tile-num${n ? '' : ' tile-zero'}">${n}</span>`;
    return { cls, inner, n, label };
  }
  if (t.kind === 'door') {
    cls += ` tile-gate${t.used ? ' tile-used' : ' tile-pick'}`;
    n = t.n;
    inner = svg('gate') + `<span class="tile-num${n ? '' : ' tile-zero'}">${n}</span>`;
    return { cls, inner, n, label };
  }
  if (t.kind === 'totemMagic' || t.kind === 'totemDeath' || t.kind === 'totemSummon') {
    const kind = t.kind === 'totemMagic' ? 'magic' : t.kind === 'totemDeath' ? 'death' : 'summon';
    cls += ` tile-totem tile-totem-${kind}${t.used ? ' tile-used' : ''}`;
    n = t.n;
    inner = svg('totem') + `<span class="tile-num${n ? '' : ' tile-zero'}">${n}</span>`;
    if (!t.used) {
      inner += kind === 'death'
        ? `<span class="tile-aura">${svg('skull')}</span>`
        : `<span class="tile-charge">${t.totem.charges}</span>`;
    }
    return { cls, inner, n, label };
  }
  if (t.mob && t.mob.hp > 0) {
    const m = t.mob;
    cls += t.kind === 'boss' ? ' tile-boss' : t.kind === 'elite' ? ' tile-elite' : ' tile-mob';
    if (t.summoned) cls += ' tile-summoned';
    if (m.reviveHp && !m.revived) cls += ' tile-revive';
    // 裸数字会被误读成邻雷数，三项属性各带图标；防御为 0 的怪省略，省出横向空间
    inner = svg(m.icon) + '<span class="tile-stats">'
      + `<i class="ts-hp">${svg('heart')}<b>${m.hp}</b></i>`
      + `<span class="ts-row"><i class="ts-atk">${svg('sword')}<b>${m.atk}</b></i>`
      + (m.def ? `<i class="ts-def">${svg('shield')}<b>${m.def}</b></i>` : '')
      + '</span></span>';
    // 召唤出来的精锐不掉钥匙：角标改成法术纹，避免玩家误以为它是钥匙守卫
    if (t.summoned) inner += `<span class="tile-summon">${svg('sparkle')}</span>`;
    else if (t.kind !== 'monster') inner += `<span class="tile-crown">${svg(t.kind === 'boss' ? 'crown' : 'key')}</span>`;
    if (m.reviveHp && !m.revived) inner += `<span class="tile-revive-badge">${svg('skull')}</span>`;
    label += ' ' + tr('ui.board.stats', { hp: m.hp, atk: m.atk, def: m.def });
    return { cls, inner, n, label };
  }
  if (t.kind === 'stairs') {
    cls += ' tile-stairs';
    n = t.n;
    inner = svg('stairs');
    const locked = !G.canDescend(S);
    if (locked) { inner += `<span class="tile-lock">${svg('lock')}</span>`; label += tr('ui.board.locked'); }
    // 阶梯格同样要交出邻格威胁数：数字缩进左上角徽章，出口图形与推理线索两不误
    inner += `<span class="tile-num${n ? '' : ' tile-zero'}">${n}</span>`;
    return { cls, inner, n, label };
  }
  // 精英/龙王留下的遗物：和宝箱一样留在地板上，点一下才开始三选一
  if (t.relicDrop) {
    cls += ' tile-relic tile-pick tile-drop';
    return { cls, inner: svg('relic'), n, label };
  }
  if (!t.used) {
    if (t.kind === 'trap') { cls += ' tile-trap'; inner = svg('trap'); return { cls, inner, n, label }; }
    if (t.kind === 'chest') { cls += ' tile-chest tile-pick'; inner = svg('chest'); return { cls, inner, n, label }; }
    if (t.kind === 'potion') { cls += ' tile-potion tile-pick'; inner = svg('potion'); return { cls, inner, n, label }; }
    if (t.kind === 'altar') { cls += ' tile-altar'; inner = svg('altar'); return { cls, inner, n, label }; }
    if (t.kind === 'shopSupply') { cls += ' tile-event tile-supply tile-pick'; inner = svg('coin'); return { cls, inner, n, label }; }
    if (t.kind === 'shopRelic') { cls += ' tile-event tile-relicshop tile-pick'; inner = svg('relic'); return { cls, inner, n, label }; }
    if (t.kind === 'shrine') { cls += ' tile-event tile-shrine tile-pick'; inner = svg('altar'); return { cls, inner, n, label }; }
  }
  // 占用失效后必须和空地一样给出邻雷数，否则这些格子会成为推断雷位的信息黑洞
  n = t.n;
  cls += t.kind === 'empty' ? (n ? '' : ' tile-empty') : ' tile-dead';
  // 数字只统计未探明的威胁，翻开怪物后会减小；减到 0 时留一个暗 0，
  // 否则空白格会被当成「这里没给信息」，玩家以为数字丢了。
  inner = n ? `<span class="tile-num">${n}</span>` : '<span class="tile-num tile-zero">0</span>';
  return { cls, inner, n, label };
}

function renderBoard(popSet) {
  for (let i = 0; i < G.SIZE; i++) {
    const t = S.tiles[i], b = tiles[i];
    const held = solveHold && solveHold.get(i);
    const v = held || tileView(t);
    const sig = v.cls + '|' + v.inner + '|' + v.n;
    if (b._sig !== sig) {
      const shifted = !held && t.revealed && b._n != null && b._n !== v.n;
      b.className = v.cls;
      b.innerHTML = v.inner;
      b.dataset.n = v.n ? String(v.n) : '';
      b.setAttribute('aria-label', v.label);
      b._sig = sig;
      // 数字变小是「你刚探明了那处威胁」的结果，闪一下让玩家看见因果，而不是以为数字丢了
      if (shifted) {
        b.classList.add('num-shift');
        setTimeout(() => b.classList.remove('num-shift'), 620);
      }
      if (solveAnim.has(i)) {
        b.classList.add('solve-out');
        if (solveAnim.get(i)) b.classList.add('was-flag');
        solveLater(() => b.classList.remove('solve-out', 'was-flag'), 480);
      } else if (popSet && popSet.has(i)) {
        b.classList.add('pop');
        setTimeout(() => b.classList.remove('pop'), 360);
      }
    } else if (b.getAttribute('aria-label') !== v.label) b.setAttribute('aria-label', v.label);
    b._n = v.n;
  }
  solveAnim.clear();
  el.board.classList.remove('mode-explore', 'mode-flag', 'mode-bomb', 'mode-scroll');
  el.board.classList.add('mode-' + S.mode);
}

/* ─────────── HUD ─────────── */
let prev = {};
let prevFlag = null;
function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); setTimeout(() => node.classList.remove('bump'), 460); }

/* ─────────── 龙王血条 ─────────── */
let bossAnnounced = false;
let bossDying = false;
let bossShown = false;

function bossTile() {
  if (!S || !S.tiles) return null;
  return S.tiles.find((t) => t.kind === 'boss' && t.revealed && t.mob && t.mob.hp > 0) || null;
}

function resetBossUi() {
  bossAnnounced = false;
  bossDying = false;
  bossShown = false;
  el.bossBar.hidden = true;
  el.bossBar.classList.remove('dying');
  document.body.classList.remove('boss-floor');
}

function updateBossBar() {
  const t = bossTile();
  const show = !!t || bossDying;
  el.bossBar.hidden = !show;
  // 血条出现/消失会挤压棋盘，必须重算格子尺寸，否则龙王层会被顶出可视区
  if (show !== bossShown) { bossShown = show; fitBoard(); }
  // 龙王倒下后红雾留到结算，别在击杀瞬间突然褪色
  document.body.classList.toggle('boss-floor', !!t || bossDying);
  if (!t) return;
  const m = t.mob;
  el.bossName.textContent = G.mobName(m);
  el.bossFill.style.transform = `scaleX(${Math.max(0, m.hp / m.maxHp)})`;
  el.bossHp.textContent = `${m.hp} / ${m.maxHp}`;
  el.bossAtk.textContent = String(m.atk);
  el.bossBar.setAttribute('aria-label', tr('ui.boss.aria', { name: G.mobName(m), hp: m.hp, max: m.maxHp, atk: m.atk }));
}

// 龙王第一次亮在棋盘上：咆哮、震屏、红光，一次把「这一层不一样」说完
function announceBoss() {
  const t = bossTile();
  if (!t || bossAnnounced) return;
  bossAnnounced = true;
  const b = tiles[t.i];
  const c = fx.center(b);
  audio.play('boss');
  fx.flash('boss');
  fx.shake(el.game, 'heavy');
  fx.haptic('heavy');
  fx.ring(c.x, c.y, '#ff4fd8', 280);
  fx.magic(c.x, c.y);
  b.classList.add('boss-in');
  setTimeout(() => b.classList.remove('boss-in'), 1300);
  toast(tr('ui.toast.boss', { name: G.mobName(t.mob) }), 'magic');
}

function markBossFelled(mob) {
  bossDying = true;
  el.bossBar.classList.add('dying');
  el.bossFill.style.transform = 'scaleX(0)';
  el.bossHp.textContent = `0 / ${mob.maxHp}`;
  fx.flash('boss');
  fx.shake(el.game, 'heavy');
  fx.rumble(520);
  audio.play('boss');
}

function renderHud() {
  const p = S.player;
  el.floorNum.textContent = S.floor;
  el.floorName.textContent = G.floorName(S.floor);
  el.floorSub.textContent = tr('ui.hud.depth', { n: S.floor, max: G.MAX_FLOOR });
  const pct = Math.max(0, p.hp / p.maxHp);
  el.hpFill.style.transform = `scaleX(${pct})`;
  el.hpText.textContent = `${p.hp} / ${p.maxHp}`;
  el.hpBar.classList.toggle('low', pct <= 0.3);
  // 角斗士的翻倍要直接写进攻击读数，否则玩家得自己心算，预演也会对不上
  const atkNow = G.atkOf(S);
  el.atk.textContent = atkNow; el.def.textContent = p.def; el.gold.textContent = p.gold;
  const atkChip = el.atk.parentElement;
  atkChip.classList.toggle('doubled', atkNow !== p.atk);
  atkChip.title = atkNow !== p.atk ? tr('ui.hud.atk.double', { atk: atkNow, base: p.atk }) : '';
  atkChip.setAttribute('aria-label', tr(atkNow !== p.atk ? 'ui.hud.atk.double' : 'ui.hud.atk', { atk: atkNow, base: p.atk }));
  // 祭坛借走的防御要让人看见「是借的」，否则玩家会以为永久亏了
  const defChip = el.def.parentElement;
  defChip.classList.toggle('debt', S.defDebt > 0);
  defChip.title = S.defDebt > 0 ? tr('ui.hud.def.debt', { n: S.defDebt }) : '';
  defChip.setAttribute('aria-label', S.defDebt > 0
    ? tr('ui.hud.def.aria.debt', { def: p.def, n: S.defDebt })
    : tr('ui.hud.def', { def: p.def }));
  el.lv.textContent = p.lv;
  el.ring.style.strokeDashoffset = String(119.4 * (1 - p.xp / p.xpNext));
  // 剩余威胁＝还没清除的怪物与陷阱总数，是扫雷式演绎的关键读数
  const remain = S.generated ? G.remainingThreats(S) : 0;
  el.threat.textContent = remain;
  el.threatChip.hidden = !S.generated;
  el.threatChip.setAttribute('aria-label', tr('ui.hud.threat.aria', { n: remain }));
  const cap = G.flagCap(S);
  el.keyChip.hidden = !S.hasKey;
  // 主题是这一区所有机关的来源，必须在 HUD 常驻，否则玩家不知道火/图腾/复活为何出现
  const theme = G.themeOf(S);
  el.themeChip.hidden = !theme;
  if (theme) {
    el.themeChip.className = 'chip chip-theme theme-' + theme;
    el.themeChip.querySelector('use').setAttribute('href', '#i-' + G.themeIcon(theme));
    el.themeChip.querySelector('b').textContent = G.themeName(theme);
    el.themeChip.setAttribute('aria-label', tr('ui.hud.theme.aria', { name: G.themeName(theme), desc: G.themeDesc(theme) }));
  }
  el.wrap.dataset.theme = theme || '';
  el.potion.textContent = p.potions; el.bomb.textContent = p.bombs; el.scroll.textContent = p.scrolls;
  el.potion.parentElement.classList.toggle('empty', p.potions === 0);
  el.bomb.parentElement.classList.toggle('empty', p.bombs === 0);
  el.scroll.parentElement.classList.toggle('empty', p.scrolls === 0);
  // 标记按钮右上角＝还能插几面旗，和卷轴/炸弹/药水的角标同一套语言
  const flagLeft = Math.max(0, cap - S.flags);
  el.flag.textContent = flagLeft;
  el.flag.parentElement.classList.toggle('empty', flagLeft === 0);
  el.flag.parentElement.setAttribute('aria-label', tr('ui.hud.flag.aria', { left: flagLeft, cap }));
  if (prevFlag != null && prevFlag !== flagLeft) bump(el.flag.parentElement);
  prevFlag = flagLeft;
  const shown = { atk: atkNow, def: p.def, gold: p.gold, lv: p.lv };
  for (const k of ['atk', 'def', 'gold', 'lv']) if (prev[k] != null && prev[k] !== shown[k]) bump(el[k].parentElement.classList.contains('chip') ? el[k].parentElement : el.lv.parentElement);
  prev = shown;

  for (const b of el.actionbar.querySelectorAll('[data-mode]')) b.classList.toggle('is-on', b.dataset.mode === S.mode);
  const can = G.canDescend(S);
  const locked = S.stairsFound && !can;
  const bossLocked = locked && G.isBossFloor(S.floor);
  el.descend.disabled = !S.stairsFound;
  el.descend.classList.toggle('locked', locked);
  el.descend.querySelector('use').setAttribute('href', locked ? '#i-lock' : '#i-down');
  el.descend.querySelector('span').textContent = locked
    ? tr(bossLocked ? 'ui.descend.boss' : 'ui.descend.locked')
    : tr('ui.descend.next');

  const last = S.log[S.log.length - 1];
  if (last && el.log.dataset.id !== String(last.id)) {
    el.log.dataset.id = String(last.id);
    el.log.textContent = tr(last.k, last.p);
    el.ticker.className = 'ticker t-' + last.tone;
    el.log.classList.remove('in'); void el.log.offsetWidth; el.log.classList.add('in');
  }
  updateBossBar();
}

function render(popSet) { renderBoard(popSet); renderHud(); renderRelics(); announceBoss(); }

/* ─────────── 遗物 ─────────── */
const rarityColor = (r) => G.RELIC_RARITY[r.rarity].color;

function relicNote(s, r) {
  if (r.id === 'whetSoul') return `${s.relicState.whet}/${G.RELIC_WHET_CAP}`;
  if (r.id === 'carefulStep') return `${s.relicState.trapWard}`;
  if (r.id === 'momentum') return s.relicState.firstKill ? tr('ui.relic.note.used') : tr('ui.relic.note.ready');
  if (r.id === 'cartographer') return `${s.relicState.survey}/${G.RELIC_SURVEY_CAP}`;
  if (r.id === 'vigor') return `+${s.player.atkBonus}`;
  if (r.id === 'heartEater') return `${s.relicState.heart}/${G.RELIC_HEART_CAP}`;
  return '';
}

function renderRelics() {
  const list = S.relics;
  const t = S.talent ? G.talentById(S.talent) : null;
  el.relicBar.hidden = !list.length && !t;
  if (!list.length && !t) { el.relicSlots.innerHTML = ''; return; }
  // 天赋占首格：它是整局的「职业」，不参与遗物池与图鉴
  const tChip = t ? `<button class="relic-chip relic-talent" data-act="bonus" style="--rc:${t.color}" aria-label="${tr('ui.talent.chip.aria', { name: G.talentName(t), desc: G.talentDesc(t) })}">
    ${svg(t.icon)}<em>${tr('ui.talent.badge')}</em></button>` : '';
  const html = tChip + list.map((id) => {
    const r = G.relicById(id), note = relicNote(S, r);
    return `<button class="relic-chip" data-act="codex" style="--rc:${rarityColor(r)}" aria-label="${tr('ui.relic.chip.aria', { name: G.relicName(r), desc: G.relicDesc(r) })}">
      ${svg(r.icon)}${note ? `<em>${note}</em>` : ''}</button>`;
  }).join('');
  if (el.relicSlots.innerHTML !== html) el.relicSlots.innerHTML = html;
}

function openRelicDraw() {
  const cards = S.relicChoices.map((id) => {
    const r = G.relicById(id), ra = G.RELIC_RARITY[r.rarity];
    return `<button class="rcard" data-sheet="relic" data-id="${id}" style="--rc:${ra.color}">
      <span class="rcard-rar">${G.rarityName(r.rarity)}</span>
      <span class="rcard-ic">${svg(r.icon)}</span>
      <b class="rcard-name">${G.relicName(r)}</b>
      <span class="rcard-cat">${G.catName(r.cat)}</span>
      <span class="rcard-desc">${G.relicDesc(r)}</span>
      <span class="rcard-flavor">${G.relicFlavor(r)}</span>
    </button>`;
  }).join('');
  const rerollCost = G.relicRerollCost(S);
  const rerollTx = rerollCost > 0 ? tr('ui.relic.reroll', { gold: rerollCost }) : tr('ui.relic.reroll.free');
  openSheet('relic', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.relic.draw.title')}</h2><p class="sheet-sub">${tr('ui.relic.draw.sub', { n: S.relics.length })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="codex" aria-label="${tr('ui.relic.codex.aria')}">${svg('relic')}</button>
    </div>
    <div class="rcards">${cards}</div>
    <p class="rcard-hint">${tr('ui.relic.draw.hint')}</p>
    <div class="sheet-actions">
      <button class="btn btn-primary" data-sheet="reroll" ${S.player.gold >= rerollCost ? '' : 'disabled'}>${svg('coin')}<span>${rerollTx}</span></button>
      <button class="btn btn-ghost" data-sheet="codex">${svg('relic')}<span>${tr('ui.relic.codex.btn')}</span></button>
    </div>`, true);
}

// 开局选天赋：和遗物三选一同一套卡片语言，但锁定到选定为止
function openTalentDraw() {
  const cards = G.TALENTS.map((t) => {
    const done = !!meta.medals[t.id];
    return `<button class="rcard" data-sheet="talent" data-id="${t.id}" style="--rc:${t.color}">
      <span class="rcard-rar">${tr('talent.' + t.id + '.tag')}</span>
      <span class="rcard-ic">${svg(t.icon)}</span>
      <b class="rcard-name">${G.talentName(t)}</b>
      <span class="rcard-cat">${tr('ui.talent.card.cat')}</span>
      ${done ? `<span class="rcard-done">${svg('crown')}${tr('ui.talent.medal.earned')}</span>` : ''}
      <span class="rcard-desc">${G.talentDesc(t)}</span>
      <span class="rcard-flavor">${G.talentFlavor(t)}</span>
    </button>`;
  }).join('');
  openSheet('talent', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.talent.draw.title')}</h2><p class="sheet-sub">${tr('ui.talent.draw.sub')}</p></div>
    </div>
    <div class="rcards${G.TALENTS.length > 3 ? ' rcards-4' : ''}">${cards}</div>
    <p class="rcard-hint">${tr('ui.talent.draw.hint')}</p>`, true);
}

function talentNote(s) {
  if (s.talent === 'gladiator') {
    const n = G.visibleMobs(s);
    return tr(n === 1 ? 'ui.talent.note.gladiator.on' : 'ui.talent.note.gladiator.off', { n, atk: G.atkOf(s), base: s.player.atk });
  }
  if (s.talent === 'brawler') {
    const done = s.stats.kills % G.BRAWLER_EVERY;
    return tr('ui.talent.note.brawler', { left: G.BRAWLER_EVERY - done, heal: s.player.killHeal });
  }
  if (s.talent === 'treasureHunter') {
    return tr('ui.talent.note.treasureHunter', { pct: Math.round(G.CHEST_RELIC_CHANCE * 100), n: s.stats.chestRelics || 0 });
  }
  if (s.talent === 'healer') {
    return tr('ui.talent.note.healer', { extra: G.HEALER_POTION_HEAL, hp: G.HEALER_POTION_MAXHP });
  }
  return '';
}

// 升级三选一：和遗物抽取同一套卡片语言，选项是永久面板加成而不是遗物
function openLevelDraw() {
  const cards = S.levelChoices.map((id) => {
    const st = G.levelStat(G.levelChoiceStat(id)), rar = G.levelChoiceRarity(id);
    const ra = G.RELIC_RARITY[rar];
    return `<button class="rcard" data-sheet="level" data-id="${id}" style="--rc:${ra.color}">
      <span class="rcard-rar">${G.rarityName(rar)}</span>
      <span class="rcard-ic">${svg(st.icon)}</span>
      <b class="rcard-name">${G.levelStatName(st)}</b>
      <span class="rcard-desc">${G.levelChoiceDesc(id)}</span>
    </button>`;
  }).join('');
  const rerollCost = G.levelRerollCost(S);
  const rerollTx = rerollCost > 0 ? tr('ui.level.reroll', { gold: rerollCost }) : tr('ui.level.reroll.free');
  openSheet('level', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.level.title')}</h2><p class="sheet-sub">${tr('ui.level.sub', { lv: S.player.lv })}</p></div>
    </div>
    <div class="rcards">${cards}</div>
    <p class="rcard-hint">${tr('ui.level.hint', { n: G.LEVEL_REROLL_STEP })}</p>
    <div class="sheet-actions">
      <button class="btn btn-primary" data-sheet="levelReroll" ${S.player.gold >= rerollCost ? '' : 'disabled'}>${svg('coin')}<span>${rerollTx}</span></button>
    </div>`, true);
}

// 当前累计加成：只列已经选过的项，数值都是实打实落在面板/规则上的
function openBonus() {
  if (!S) return;
  const t = S.talent ? G.talentById(S.talent) : null;
  const talentRow = t ? `<div class="opt opt-talent" style="--rc:${t.color}">
      <span class="opt-ic">${svg(t.icon)}</span>
      <span class="opt-tx"><b>${G.talentName(t)}（${tr('ui.talent.badge')}）</b>
        <span>${G.talentDesc(t)}</span><span class="opt-note">${talentNote(S)}</span></span></div>` : '';
  const rows = G.LEVEL_STATS
    .filter((st) => ((S.levelTaken || {})[st.id] || 0) > 0)
    .map((st) => `<div class="opt"><span class="opt-ic">${svg(st.icon)}</span>
      <span class="opt-tx"><b>${G.levelStatName(st)}</b><span>${G.levelBonusValue(S, st.id)}</span></span></div>`)
    .join('');
  openSheet('bonus', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.bonus.title')}</h2><p class="sheet-sub">${tr('ui.bonus.sub', { n: G.levelBonusCount(S), lv: S.player.lv })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    ${talentRow}
    ${rows || (t ? '' : `<p class="log-empty">${tr('ui.bonus.empty')}</p>`)}
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="close">${tr('ui.btn.close')}</button></div>`);
}

function openLog() {
  if (!S) return;
  const rows = S.log.slice().reverse().map((e) =>
    `<div class="log-row lg-${e.tone}"><span class="log-dot"></span><p>${tr(e.k, e.p)}</p></div>`).join('');
  openSheet('log', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.log.title')}</h2><p class="sheet-sub">${tr('ui.log.sub', { n: S.log.length })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    <div class="log-list">${rows || `<p class="log-empty">${tr('ui.log.empty')}</p>`}</div>
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="close">${tr('ui.btn.close')}</button></div>`);
}

function openCodex() {
  const owned = S ? S.relics : [];
  const back = S && S.relicChoices ? 'relicBack' : 'close';
  const row = (r, has) => {
    const ra = G.RELIC_RARITY[r.rarity];
    return `<div class="cx ${has ? 'has' : ''}" style="--rc:${ra.color}">
      <span class="cx-ic">${svg(r.icon)}</span>
      <span class="cx-tx">
        <b>${G.relicName(r)}<i class="cx-rar">${G.rarityName(r.rarity)}</i>${has ? `<i class="cx-own">${tr('ui.codex.own')}</i>` : ''}</b>
        <span class="cx-desc">${G.relicDesc(r)}</span>
        <span class="cx-fl">${G.relicFlavor(r)}</span>
      </span>
    </div>`;
  };
  // 本局已收集按获得顺序置顶，翻图鉴先看到自己这局的构筑
  const mine = owned.length
    ? `<div class="help-sec"><h3 class="help-h">${tr('ui.codex.mine')}<i class="cx-count">${owned.length}</i></h3>${owned.map((id) => row(G.relicById(id), true)).join('')}</div>`
    : '';
  const groups = G.RELIC_CATS.map((cat) => {
    const rows = G.RELICS.filter((r) => r.cat === cat).map((r) => row(r, owned.includes(r.id))).join('');
    const n = G.RELICS.filter((r) => r.cat === cat && owned.includes(r.id)).length;
    const total = G.RELICS.filter((r) => r.cat === cat).length;
    return `<div class="help-sec"><h3 class="help-h">${G.catName(cat)}<i class="cx-count">${n}/${total}</i></h3>${rows}</div>`;
  }).join('');
  const rarityIds = Object.keys(G.RELIC_RARITY);
  const oddsAt = (f) => {
    const w = G.relicRarityWeights(f);
    const sum = rarityIds.reduce((a, id) => a + w[id], 0);
    return rarityIds.map((id) => {
      const r = G.RELIC_RARITY[id];
      return `<span style="color:${r.color}">${G.rarityName(id)} ${Math.round(w[id] / sum * 100)}%</span>`;
    }).join(tr('list.sep'));
  };
  const floorNow = S ? S.floor : 1;
  const relicItem = G.SHOP.find((x) => x.id === 'relic');
  openSheet('codex', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.codex.title')}</h2><p class="sheet-sub">${tr('ui.codex.sub', { total: G.RELICS.length, own: owned.length })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="${back}" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    ${mine}
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.codex.how')}</h3>
      <p class="help-p">${tr('ui.codex.how.body', { draw: G.RELIC_DRAW_COUNT, total: G.RELICS.length, floor: floorNow, odds: oddsAt(floorNow), maxFloor: G.MAX_FLOOR, deepOdds: oddsAt(G.MAX_FLOOR), shopPrice: relicItem.base, shopStep: relicItem.step, shopCap: G.RELIC_SHOP_CAP })}</p>
    </div>
    ${groups}
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="${back}">${S && S.relicChoices ? tr('ui.codex.back') : tr('ui.codex.close')}</button></div>`, !!(S && S.relicChoices));
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
  flag: { icon: 'flag', sel: '[data-mode="flag"]', cls: 'crit', color: '#ffab2e' },
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
  // 识破的格子留给 solveSequence 逐格回放，这里不能抢着弹开或扬尘
  const solveEv = events.find((e) => e.type === 'solved');
  const solveSet = new Set(solveEv ? solveEv.tiles : []);
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
        if (solveSet.has(e.i)) break;
        pops.add(e.i);
        if (pops.size === 1) fx.haptic('tick');
        if (pops.size <= 3) { const c = tileCenter(e.i); later(() => fx.dust(c.x, c.y), delay); delay += 26; }
        break;
      }
      case 'encounter': audio.play('open'); fx.haptic('light'); break;
      case 'ambush': {
        // 偷袭是玩家自己掀开的砖：红闪落在这一格上，不给任何未探明格子的位置提示
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#ff3b5c', 120);
        fx.shake(el.board, 'heavy');
        fx.haptic('heavy');
        toast(tr(e.dmg > 0 ? 'ui.toast.ambush' : 'ui.toast.ambush.block', { n: e.dmg }), e.dmg > 0 ? 'bad' : 'good');
        break;
      }
      case 'flag': audio.play(e.on ? 'flag' : 'unflag'); fx.haptic('tick'); break;
      case 'flagLimit': audio.play('deny'); toast(tr('log.flag.limit', { cap: e.cap }), 'bad'); break;
      case 'damage': {
        // 伤害来源格可能已探明（陷阱 / 战斗中的怪物）；无坐标时把飘字落在血条上，避免泄露暗格
        const src = e.at >= 0 ? e.at : S.pendingCombat;
        const at = src >= 0 && S.tiles[src] && S.tiles[src].revealed ? src : -1;
        const c = at >= 0 ? tileCenter(at) : fx.center(el.hpFill);
        // 龙王的每一口都该有分量：整屏重震 + 专属红光，和普通小怪的抖动区分开
        const bossHit = at >= 0 && S.tiles[at].mob && S.tiles[at].mob.boss;
        fx.flash(bossHit ? 'boss' : 'hurt');
        fx.shake(bossHit ? el.game : el.board, bossHit ? 'heavy' : '');
        fx.blood(c.x, c.y);
        fx.float(c.x, c.y - 10, '-' + e.amount, 'dmg');
        audio.play(e.source === 'trap' || e.source === 'fire' ? 'trap' : 'hit'); fx.haptic('heavy');
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
        fx.float(c.x, c.y - 18, '+' + (e.xp ?? e.mob.xp) + ' XP', 'xp');
        audio.play('kill'); fx.haptic('medium');
        if (e.mob.elite || e.mob.boss) fx.shake(el.board);
        if (e.mob.boss) markBossFelled(e.mob);
        break;
      }
      case 'mobHurt': {
        const c = tileCenter(e.i);
        fx.float(c.x, c.y - 10, '-' + e.amount, 'dmg');
        fx.shake(el.board, 'heavy');
        break;
      }
      case 'combat': audio.play('swing'); fx.haptic('light'); break;
      case 'levelup': {
        const r = document.getElementById('lvBadge').getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        fx.ring(x, y, '#ffd54a', 120); fx.magic(x, y); fx.flash('gold');
        fx.float(x, y - 26, 'LEVEL ' + e.lv, 'crit');
        audio.play('levelup'); fx.haptic('heavy'); toast(tr('ui.toast.levelup', { lv: e.lv }), 'magic');
        break;
      }
      case 'item': audio.play('item'); break;
      case 'discover': {
        const c = tileCenter(e.i);
        const color = e.kind === 'chest' ? '#ffd54a' : e.kind === 'altar' ? '#ff4fd8' : '#7dff5a';
        fx.ring(c.x, c.y, color, 46);
        audio.play('sparkle');
        break;
      }
      case 'wallLock': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#9b8aa8', 70);
        audio.play('deny');
        toast(tr('ui.toast.wall.lock'), 'warn');
        break;
      }
      case 'wallFlag': audio.play('deny'); toast(tr('log.wall.flag'), 'warn'); break;
      case 'wallBreak': {
        const c = tileCenter(e.i);
        fx.shards(c.x, c.y); fx.dust(c.x, c.y);
        fx.haptic('medium');
        toast(tr('ui.toast.wall.break'), 'good');
        break;
      }
      case 'fireBurn': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#ff9f3a', 110);
        toast(tr('ui.toast.fire.burn', { n: e.dmg }), 'bad');
        break;
      }
      case 'fireSpread': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#ff9f3a', 80);
        audio.play('sparkle');
        break;
      }
      case 'totemPulse': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#c9a3ff', 120); fx.magic(c.x, c.y);
        audio.play('trap'); fx.shake(el.board); fx.haptic('medium');
        break;
      }
      case 'totemSpent': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#6b5a7d', 80);
        toast(tr('ui.toast.totem.spent'), 'good');
        break;
      }
      case 'totemBreak': {
        const c = tileCenter(e.i);
        fx.shards(c.x, c.y); fx.magic(c.x, c.y);
        audio.play('sparkle');
        toast(tr('ui.toast.totem.break'), 'magic');
        break;
      }
      case 'summon': {
        const c = tileCenter(e.at);
        fx.ring(c.x, c.y, '#c9a3ff', 130); fx.magic(c.x, c.y);
        audio.play('trap'); fx.shake(el.board); fx.haptic('medium');
        toast(tr('ui.toast.summon'), 'bad');
        break;
      }
      case 'revive': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#8fd6b8', 120); fx.magic(c.x, c.y);
        audio.play('altar');
        break;
      }
      case 'themePick': {
        fx.flash('gold'); fx.ring(innerWidth / 2, innerHeight / 2, '#ffd54a', 220);
        audio.play('levelup'); fx.haptic('heavy');
        toast(tr('ui.toast.theme', { name: G.themeName(e.id) }), 'magic');
        break;
      }
      case 'door': audio.play('stairs'); break;
      case 'relicDrop': {
        const c = tileCenter(e.i);
        fx.ring(c.x, c.y, '#c9a3ff', 110);
        fx.magic(c.x, c.y);
        audio.play('sparkle');
        break;
      }
      case 'relicPickup': audio.play('altar'); break;
      case 'levelOffer': audio.play('ui'); break;
      case 'levelChoose': {
        const r = document.getElementById('lvBadge').getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        fx.ring(x, y, '#ffd54a', 110); fx.magic(x, y);
        break;
      }
      case 'talentPick': {
        const c = fx.center(el.lv);
        fx.ring(c.x, c.y, '#ffd54a', 150); fx.magic(c.x, c.y); fx.flash('gold');
        audio.play('levelup'); fx.haptic('heavy');
        toast(tr('ui.toast.talent', { name: G.talentName(G.talentById(e.id)) }), 'magic');
        break;
      }
      case 'brawlerGrow': {
        const c = fx.center(el.relicBar.hidden ? el.lv : el.relicBar);
        fx.ring(c.x, c.y, '#ff6b8a', 100); fx.magic(c.x, c.y);
        audio.play('levelup');
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
        audio.play('key'); fx.haptic('heavy'); toast(tr('ui.toast.key'), 'magic');
        break;
      }
      case 'stairs': { const c = tileCenter(e.i); fx.portal(c.x, c.y); audio.play('stairs'); fx.haptic('medium'); toast(tr('ui.toast.stairs'), 'magic'); break; }
      case 'altar': audio.play('altar'); break;
      case 'event': audio.play('altar'); break;
      case 'altarUsed': { const c = tileCenter(e.i); fx.magic(c.x, c.y); break; }
      case 'bomb': { const c = tileCenter(e.i); fx.boom(c.x, c.y); fx.shake(el.board); audio.play('bomb'); fx.haptic('heavy'); break; }
      case 'disarm': { if (solveSet.has(e.i)) break; const c = tileCenter(e.i); fx.dust(c.x, c.y); break; }
      case 'scroll': { const c = tileCenter(e.i); fx.magic(c.x, c.y); fx.ring(c.x, c.y, '#3fe0ff', 110); audio.play('scroll'); break; }
      case 'reroll': {
        const r = el.gold.getBoundingClientRect();
        fx.float(r.left + r.width / 2, r.top - 6, '-' + e.cost, 'gold');
        audio.play('coin');
        break;
      }
      case 'buy': audio.play('coin'); break;
      case 'relicOffer': audio.play('altar'); break;
      case 'relicGain': {
        const r = G.relicById(e.id);
        const c = fx.center(el.relicBar.hidden ? el.lv : el.relicBar);
        fx.ring(c.x, c.y, rarityColor(r), 130); fx.magic(c.x, c.y); fx.flash('gold');
        audio.play('levelup'); fx.haptic('heavy'); toast(tr('ui.toast.relic', { name: G.relicName(r) }), 'magic');
        break;
      }
      case 'bossDown': {
        // 龙王倒下只是这一层的封印松开，血条留一口气再退场，避免玩家以为本局结束了
        toast(tr('ui.toast.boss.down'), 'magic');
        later(() => { bossDying = false; updateBossBar(); }, 1200);
        break;
      }
      case 'deny': audio.play('deny'); break;
      case 'locked': audio.play('locked'); toast(tr(e.boss ? 'ui.toast.locked.boss' : 'ui.toast.locked'), 'bad'); break;
      case 'blocked': audio.play('deny'); fx.shake(el.board); fx.haptic('light'); toast(tr('ui.toast.lethal'), 'bad'); break;
      case 'chord': audio.play('open'); fx.haptic('medium'); break;
      case 'chordHint': {
        audio.play('deny');
        for (const j of G.neighbors(e.i)) if (!S.tiles[j].revealed) { tiles[j].classList.add('hint'); setTimeout(() => tiles[j].classList.remove('hint'), 1500); }
        break;
      }
      case 'mode': audio.play('ui'); break;
      case 'solved': holdSolve(solveEv); audio.play('levelup'); fx.haptic('heavy'); break;
      case 'descend': fx.haptic('medium'); break;
      case 'death': fx.rumble(420); fx.shake(el.board); fx.flash('hurt'); break;
      case 'win': fx.rumble(260); later(() => fx.rumble(260), 320); break;
    }
  }
  if (pops.size && !events.some((e) => ['encounter', 'combat', 'damage', 'bomb', 'scroll', 'solved'].includes(e.type))) audio.play('reveal');
  return pops;
}

/* ─────────── 动作 ─────────── */
function apply(events, opts = {}) {
  const pops = consume(events);
  render(pops);
  saveRun();
  if (events.some((e) => e.type === 'descend' || e.type === 'doorUse')) return descendSequence();
  if (S.status === 'dead') return endSequence(false);
  if (S.status === 'won') {
    // 血条排空 + 重震之后再把结算页推上来，让「龙王倒下」这一下站稳
    if (events.some((e) => e.type === 'kill' && e.mob.boss)) { busy = true; setTimeout(() => endSequence(true), 820); return; }
    return endSequence(true);
  }
  const sv = events.find((e) => e.type === 'solved');
  // 抽屉会盖住棋盘，这时候逐格回放没人看得见，直接落到终态
  if (sv && !S.levelChoices && !S.relicChoices && S.pendingCombat < 0 && S.pendingAltar < 0) return solveSequence(sv);
  if (sv) { clearSolve(); render(); }
  if (openDrawers()) return;
  if (!opts.keepSheet && sheetKind && !sheetLock) closeSheet();
}

// 升级奖励优先：它锁住棋盘，选完才轮到战斗/祭坛/遗物
function openDrawers() {
  // 天赋没选之前整局锁定，优先级高于一切抽屉
  if (S.talentPending) { openTalentDraw(); return true; }
  if (S.levelChoices) { openLevelDraw(); return true; }
  if (S.relicChoices) { openRelicDraw(); return true; }
  if (S.pendingCombat >= 0) { openCombat(S.pendingCombat); return true; }
  if (S.pendingAltar >= 0) { openAltar(S.pendingAltar); return true; }
  if (S.pendingDoor >= 0) { openDoor(S.pendingDoor); return true; }
  if (S.pendingEvent >= 0) { openEvent(S.pendingEvent); return true; }
  if (S.themeChoices) { openTheme(); return true; }
  return false;
}

function guard() { return busy || !S || S.status !== 'playing' || !!S.levelChoices || !!S.talentPending; }

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
  const wasHidden = el.sheet.hidden;
  sheetKind = kind; sheetLock = lock;
  el.sheetBody.innerHTML = html;
  el.sheetBody.scrollTop = 0;
  el.scrim.hidden = false;
  el.sheet.hidden = false;
  // 同一张面板原地刷新时不重播滑入动画，逐击战斗才不会每刀弹一次。
  if (wasHidden) { el.sheet.style.animation = 'none'; void el.sheet.offsetWidth; el.sheet.style.animation = ''; }
}
function closeSheet() {
  if (sheetLock) return;
  clearTimeout(attackHoldTimer);
  attackHoldUsed = false;
  sheetKind = null;
  el.scrim.hidden = true;
  el.sheet.hidden = true;
  el.sheetBody.innerHTML = '';
  if (S) { G.closePending(S); saveRun(); }
}
function forceClose() { sheetLock = false; closeSheet(); }

/* ─────────── 战斗反馈：面板内血条变化 + 震动 ─────────── */
// 不切页、不飘字：伤害只体现在玩家与怪物两条同高血条上，配轻震。
const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let attackHoldTimer = 0;
let attackHoldUsed = false;

function sheetHit(node) {
  if (!node || motionReduced()) return;
  node.classList.remove('hit');
  void node.offsetWidth;
  node.classList.add('hit');
}

function slideBar(fill, fromPct, toPct) {
  if (!fill) return;
  fill.style.transition = 'none';
  fill.style.width = Math.max(0, fromPct * 100) + '%';
  void fill.offsetWidth;
  fill.style.transition = 'width .3s cubic-bezier(.2,.9,.3,1)';
  fill.style.width = Math.max(0, toPct * 100) + '%';
}

// b 记录结算前的双方血量；面板已重渲染到新值，这里把血条从旧值滑到新值。
function playExchangeFx(f, b) {
  if (motionReduced()) return;
  const q = (s) => el.sheetBody.querySelector(s);
  sheetHit(q('.mob-card'));
  slideBar(q('.hp-foe-fill'), b.mob / b.mobMax, S.tiles[b.i].mob.hp / b.mobMax);
  fx.haptic('light');
  // 玩家血条先停在旧值，等怪物还手那一下再落
  const youFill = q('.hp-you-fill'), youNum = q('.hp-side.you .hp-num');
  if (youFill) youFill.style.width = Math.max(0, b.me / b.meMax * 100) + '%';
  if (youNum) youNum.textContent = b.me + '/' + b.meMax;
  if (f.take > 0) {
    setTimeout(() => {
      if (sheetKind !== 'combat') return;
      sheetHit(q('.hp-side.you'));
      slideBar(q('.hp-you-fill'), b.me / b.meMax, S.player.hp / b.meMax);
      const n = q('.hp-side.you .hp-num');
      if (n) n.textContent = S.player.hp + '/' + b.meMax;
      fx.haptic('medium');
      audio.play('hit');
    }, f.revive ? 300 : 160);
  }
}

function openCombat(i) {
  const t = S.tiles[i], m = t.mob, p = S.player;
  const f = G.forecastOnce(p, m, G.atkOf(S));
  const forced = S.forcedCombat === i;
  const kind = t.kind === 'boss' ? 'boss' : t.kind === 'elite' ? 'elite' : '';
  const tag = t.kind === 'boss' ? `<span class="mob-tag boss">${tr('ui.combat.tag.boss')}</span>` : t.kind === 'elite' ? `<span class="mob-tag">${tr('ui.combat.tag.elite')}</span>` : '';
  const race = G.mobRace(m);
  const raceTag = race ? `<span class="mob-race">${race}</span>` : '';
  const cutParts = [
    m.cut && m.cut.def ? tr('ui.combat.cut.def', { n: m.cut.def }) : '',
    m.cut && m.cut.atk ? tr('ui.combat.cut.atk', { n: m.cut.atk }) : '',
  ].filter(Boolean);
  const cutNote = cutParts.length
    ? `<p class="fc-note good">${tr('ui.combat.cut', { parts: cutParts.join(tr('ui.combat.cut.sep')) })}</p>`
    : '';
  const reviveNote = f.reviveHp
    ? `<p class="fc-note danger">${tr('ui.combat.revive', { hp: f.reviveHp })}</p>`
    : '';
  const ambushDmg = forced ? G.ambushDamage(p, m) : 0;
  const ambushNote = forced
    ? `<p class="fc-note${ambushDmg > 0 ? ' danger' : ''}">${tr(ambushDmg > 0 ? 'ui.combat.ambush.note' : 'ui.combat.ambush.note.block', { n: ambushDmg })}</p>`
    : '';
  const meAfter = Math.max(0, p.hp - f.take);
  const onceNote = f.kill
    ? tr('ui.combat.once.kill')
    : f.lethal
      ? tr(forced ? 'ui.combat.once.doom' : 'ui.combat.once.lethal', { take: f.take, hp: p.hp })
      : f.revive
        ? tr('ui.combat.once.revive', { hp: m.reviveHp, take: f.take })
        : f.thornsKill
          ? tr('ui.combat.once.thornsKill', { take: f.take })
          : f.take === 0
            ? tr('ui.combat.once.free')
            : f.thorns > 0
              ? tr('ui.combat.once.thorns', { n: f.thorns })
              : '';
  const onceCls = f.lethal || f.thornsKill ? ' danger' : f.kill ? ' good' : '';
  // 偷袭战没有逃跑：不渲染关闭/再想想，面板本身也锁住，直到把它打倒
  openSheet('combat', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr(forced ? 'ui.combat.title.ambush' : 'ui.combat.title')}</h2><p class="sheet-sub">${tr(forced ? 'ui.combat.sub.ambush' : 'ui.combat.sub')}</p></div>
      ${forced ? '' : `<button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>`}
    </div>
    <div class="mob-card ${kind}">
      <div class="mob-portrait">${svg(m.icon)}</div>
      <div class="mob-info"><h3 class="mob-name">${G.mobName(m)}${raceTag}${tag}</h3><p class="mob-flavor">${G.mobFlavor(m)}</p></div>
    </div>
    <div class="hp-duel">
      <div class="hp-side you">
        <div class="hp-top"><span class="hp-name">${tr('ui.combat.me')}</span><b class="hp-num">${p.hp}/${p.maxHp}</b></div>
        <div class="hp-bar"><i class="hp-you-fill" style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>
      </div>
      <div class="hp-side foe">
        <div class="hp-top"><span class="hp-name">${G.mobName(m)}</span><b class="hp-num">${m.hp}/${m.maxHp}</b></div>
        <div class="hp-bar"><i class="hp-foe-fill" style="width:${Math.max(0, m.hp / m.maxHp * 100)}%"></i></div>
      </div>
    </div>
    ${ambushNote}
    <div class="stat-grid">
      <div class="stat atk"><i>${tr('ui.combat.stat.atk')}</i><b>${m.atk}</b></div>
      <div class="stat def"><i>${tr('ui.combat.stat.def')}</i><b>${m.def}</b></div>
      <div class="stat xp"><i>${tr('ui.combat.stat.xp')}</i><b>${m.xp}</b></div>
      <div class="stat gold"><i>${tr('ui.combat.stat.gold')}</i><b>${m.gold}</b></div>
    </div>
    ${cutNote}
    ${reviveNote}
    <div class="forecast fc-preview" hidden>
      <div class="fc-row"><span>${tr('ui.combat.once.deal')}</span><b>${f.deal}</b></div>
      <div class="fc-row ${f.take ? 'hurt' : 'free'}"><span>${tr('ui.combat.once.take')}</span><b>${f.take}</b></div>
      <div class="fc-row"><span>${tr('ui.combat.once.mobLeft')}</span><b>${f.mobAfter}</b></div>
      <div class="fc-row ${meAfter > 0 ? '' : 'hurt'}"><span>${tr('ui.combat.once.youLeft')}</span><b>${meAfter}</b></div>
      ${onceNote ? `<p class="fc-note${onceCls}">${onceNote}</p>` : ''}
    </div>
    <div class="sheet-foot">
      <p class="fc-hint">${tr('ui.combat.hold')}</p>
      <div class="sheet-actions">
        ${forced ? '' : `<button class="btn btn-ghost" data-sheet="close">${tr('ui.combat.again')}</button>`}
        ${p.potions > 0 && p.hp < p.maxHp ? `<button class="btn" data-sheet="potion" data-i="${i}">${svg('potion')}<span>${tr('ui.combat.potion')}</span></button>` : ''}
        ${p.bombs > 0 ? `<button class="btn" data-sheet="bomb" data-i="${i}">${svg('bomb')}<span>${tr('ui.combat.bomb')}</span></button>` : ''}
        <button class="btn ${f.lethal ? 'btn-danger' : 'btn-primary'}" data-sheet="attack" data-i="${i}">${svg('sword')}<span>${tr(f.lethal ? (forced ? 'ui.combat.attack.doom' : 'ui.combat.attack.lethal') : 'ui.combat.attack')}</span></button>
      </div>
    </div>`, forced);
}

function openAltar(i) {
  const p = S.player;
  const opts = G.ALTAR_OPTIONS.map((o) => {
    const dis = (o.id === 'blood' && p.hp <= G.BAL.bloodCost) || (o.id === 'greed' && p.def <= 0)
      || (o.id === 'banner' && G.flagBonusLeft(S) < G.ALTAR_FLAG_BONUS);
    const why = o.id === 'blood' ? G.altarWhy('blood')
      : o.id === 'greed' ? G.altarWhy('greed')
        : o.id === 'banner' ? G.altarWhy('banner', { left: G.flagBonusLeft(S), n: G.ALTAR_FLAG_BONUS })
          : '';
    return `<button class="opt" data-sheet="altar" data-i="${i}" data-choice="${o.id}" ${dis ? 'disabled' : ''}>
      <span class="opt-ic">${svg(o.icon)}</span>
      <span class="opt-tx"><b>${G.altarName(o)}</b><span>${G.altarDesc(o)}${dis ? why : ''}</span></span>
    </button>`;
  }).join('');
  openSheet('altar', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.altar.title')}</h2><p class="sheet-sub">${tr('ui.altar.sub')}</p></div>
      <button class="icon-btn sheet-close" data-sheet="skip" aria-label="${tr('ui.altar.leave.aria')}">${svg('close')}</button>
    </div>
    ${opts}
    <div class="sheet-actions"><button class="btn btn-ghost" data-sheet="skip">${tr('ui.altar.leave')}</button></div>`);
  audio.play('altar');
}

// 大地之门：点开先确认。它是整局唯一的回头路，误触的代价太重，不能一点就走。
function openDoor(i) {
  const to = G.doorTarget(S);
  openSheet('door', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.door.title')}</h2><p class="sheet-sub">${tr('ui.door.sub', { from: S.floor, to })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="skip" aria-label="${tr('ui.door.leave')}">${svg('close')}</button>
    </div>
    <div class="gold-line">${svg('down')}<span>${tr('ui.door.depth')}</span><b>${to}</b></div>
    <p class="help-p">${tr('ui.door.note', { to })}</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-sheet="skip">${tr('ui.door.leave')}</button>
      <button class="btn btn-primary" data-sheet="doorGo" data-i="${i}">${svg('gate')}<span>${tr('ui.door.go')}</span></button>
    </div>`);
  audio.play('stairs');
}

// 主题二选一：只在击破 10 / 20 层 Boss 后出现。允许先关掉去拾取遗物，
// 但没选之前楼梯不会放行（game.tryDescend 会再把这张纸推回来）。
function openTheme() {
  const choices = S.themeChoices || [];
  const cards = choices.map((id) => `
    <button class="opt theme-opt theme-${id}" data-sheet="theme" data-choice="${id}">
      <span class="opt-ic">${svg(G.themeIcon(id))}</span>
      <span class="opt-tx"><b>${G.themeName(id)}</b><span>${G.themeDesc(id)}</span></span>
    </button>`).join('');
  openSheet('theme', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.theme.title', { act: S.pendingTheme })}</h2><p class="sheet-sub">${tr('ui.theme.sub')}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    <p class="help-p">${tr('ui.theme.note')}</p>
    ${cards}`);
  audio.play('altar');
}

function openEvent(i) {
  const t = S.tiles[i], p = S.player;
  const kind = t.kind;
  const rows = G.EVENT_ITEMS[kind].map((id) => {
    const it = G.SHOP.find((x) => x.id === id);
    const price = G.shopPrice(S, id);
    const stock = (t.stock && t.stock[id]) || 0;
    const capped = id === 'relic'
      ? G.relicShopLeft(S) <= 0 || G.relicPool(S).length === 0
      : id === 'pouch' && G.flagBonusLeft(S) <= 0;
    const soldout = stock <= 0 || capped;
    const can = !soldout && p.gold >= price;
    const priceTx = soldout ? tr(id === 'pouch' && capped ? 'ui.shop.full' : 'ui.shop.soldout') : `${svg('coin')}${price}`;
    return `<button class="opt" data-sheet="eventBuy" data-i="${i}" data-id="${id}" ${can ? '' : 'disabled'}>
      <span class="opt-ic">${svg(it.icon)}</span>
      <span class="opt-tx"><b>${G.shopName(it)}</b><span>${G.shopDesc(it, S)}</span></span>
      <span class="opt-stock">${tr('ui.event.stock', { n: stock })}</span>
      <span class="opt-price ${can ? '' : 'no'}">${priceTx}</span>
    </button>`;
  }).join('');
  const sub = kind === 'shopRelic'
    ? tr('ui.event.shopRelic.sub', { cap: G.RELIC_SHOP_CAP, left: G.relicShopLeft(S) })
    : tr('ui.event.' + kind + '.sub');
  const statline = kind === 'shrine'
    ? `<div class="statline">${tr('ui.event.stat.atk')} <b>${p.atk}</b> · ${tr('ui.event.stat.def')} <b>${p.def}</b> · ${tr('ui.event.stat.hp')} <b>${p.maxHp}</b> · ${tr('ui.event.stat.flag')} <b>${p.flagBonus}/${G.FLAG_BONUS_CAP}</b></div>`
    : '';
  openSheet('event', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('event.' + kind + '.name')}</h2><p class="sheet-sub">${sub}</p></div>
      <button class="icon-btn sheet-close" data-sheet="skip" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    <div class="gold-line">${svg('coin')}<span>${tr('ui.shop.hold')}</span><b>${p.gold}</b></div>
    ${statline}
    ${rows}
    <div class="sheet-actions"><button class="btn btn-ghost" data-sheet="skip">${tr('ui.event.leave')}</button></div>`);
  audio.play('altar');
}

function openHelp() {
  const flagBases = Object.values(G.DIFFICULTIES).map((d) => `${G.difficultyName(d)} ${d.flags}`).join(tr('ui.help.flagSep'));
  const legend = [
    ['hand', 'ui.help.lg.hand', '#c9a3ff'],
    ['flag', 'ui.help.lg.flag', '#ffd27a'],
    ['bat', 'ui.help.lg.bat', '#ff8098'],
    ['trap', 'ui.help.lg.trap', '#ff9f3a'],
    ['guardian', 'ui.help.lg.guardian', '#ffd54a'],
    ['chest', 'ui.help.lg.chest', '#ffd54a'],
    ['potion', 'ui.help.lg.potion', '#7dff5a'],
    ['altar', 'ui.help.lg.altar', '#ff4fd8'],
    ['coin', 'ui.help.lg.supply', '#ffd54a'],
    ['relic', 'ui.help.lg.relicShop', '#c9a3ff'],
    ['altar', 'ui.help.lg.shrine', '#7dff5a'],
    ['relic', 'ui.help.lg.relic', '#c9a3ff'],
    ['wall', 'ui.help.lg.wall', '#b9a9c6'],
    ['flame', 'ui.help.lg.fire', '#ff9f3a'],
    ['totem', 'ui.help.lg.totem', '#c9a3ff'],
    ['skull', 'ui.help.lg.totemDeath', '#ff6b8a'],
    ['sparkle', 'ui.help.lg.totemSummon', '#7dffd4'],
    ['gate', 'ui.help.lg.door', '#8bff63'],
    ['stairs', 'ui.help.lg.stairs', '#3fe0ff'],
    ['dragon', 'ui.help.lg.dragon', '#ff8ae8'],
  ].map(([ic, k, c]) => `<div class="lg"><span class="lg-ic" style="color:${c}">${svg(ic)}</span><span class="lg-tx"><b>${tr(k + '.t')}</b><span>${tr(k + '.d')}</span></span></div>`).join('');
  const nums = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span data-n="${n}" class="tile" style="position:relative"><span class="tile-num" style="font-size:14px;color:${['', '#5fe3ff', '#8bff63', '#ffd54a', '#ff9f3a', '#ff6b4a', '#ff3b5c', '#ff4fd8', '#e6dcff'][n]}">${n}</span></span>`).join('');
  const P = {
    flagBases,
    altar: G.ALTAR_FLAG_BONUS, relic: G.RELIC_FLAG_BONUS, flagCap: G.FLAG_BONUS_CAP, recoil: G.RELIC_RECOIL,
    defCut: G.SOLVE_DEF_CUT, flagGold: G.SOLVE_FLAG_GOLD, perfectXp: G.SOLVE_PERFECT_XP,
    siege: G.RELIC_SIEGE_CAP, mindXp: G.RELIC_MIND_XP, mindDef: G.RELIC_MIND_DEF, survey: G.RELIC_SURVEY_CAP,
    elixir: G.SHOP_ELIXIR_HP, vigorStep: G.RELIC_VIGOR_STEP, strataDef: G.STRATA_DEF, strataHp: G.STRATA_HP,
    bombDmg: G.BOMB_DAMAGE, powderDmg: G.RELIC_POWDER_DMG, forgeDmg: G.RELIC_FORGE_GROW,
    reroll: G.RELIC_REROLL_BASE, rerollStep: G.RELIC_REROLL_STEP,
    lvReroll: G.LEVEL_REROLL_BASE, lvRerollStep: G.LEVEL_REROLL_STEP,
    every: G.BRAWLER_EVERY, hp: G.BRAWLER_HP, def: G.BRAWLER_DEF, atk: G.BRAWLER_ATK, heal: G.BRAWLER_HEAL,
    chestPct: Math.round(G.CHEST_RELIC_CHANCE * 100),
    healerHeal: G.HEALER_POTION_HEAL, healerHp: G.HEALER_POTION_MAXHP,
    wallMin: G.WALL_MIN_FLOOR, wallCount: G.WALL_MIN, wallCountMax: G.WALL_MAX,
    fireBase: G.FIRE_BASE, fireF: G.FIRE_F, fireCap: G.FIRE_CAP, acts: G.ACTS,
    hazardTick: G.HAZARD_TICK, totemCharges: G.TOTEM_MAGIC_CHARGES,
    totemBase: G.TOTEM_MAGIC_BASE, totemF: G.TOTEM_MAGIC_F,
    deathAtkStep: G.TOTEM_DEATH_ATK_STEP, deathDefStep: G.TOTEM_DEATH_DEF_STEP,
    summonCharges: G.SUMMON_TOTEM_CHARGES, revivePct: Math.round(G.GRAVE_REVIVE_PCT * 100),
    doorBack: G.DOOR_BACK,
  };
  openSheet('help', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.help.title')}</h2><p class="sheet-sub">${tr('ui.help.sub')}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.num.h')}</h3>
      <p class="help-p">${tr('ui.help.num.p1')}</p>
      <div class="numline">${nums}</div>
      <p class="help-p">${tr('ui.help.num.p2')}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.ops.h')}</h3>
      <p class="help-p">${tr('ui.help.ops.p', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.cap.h')}</h3>
      <p class="help-p">${tr('ui.help.cap.p1', P)}</p>
      <p class="help-p">${tr('ui.help.cap.p2')}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.combat.h')}</h3>
      <p class="help-p">${tr('ui.help.combat.p', P)}</p>
      <p class="help-p">${tr('ui.help.combat.bomb', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.level.h')}</h3>
      <p class="help-p">${tr('ui.help.level.p', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.talent.h')}</h3>
      <p class="help-p">${tr('ui.help.talent.p1')}</p>
      <p class="help-p">${tr('ui.help.talent.p2', P)}</p>
      <p class="help-p">${tr('ui.help.talent.p3', P)}</p>
      <p class="help-p">${tr('ui.help.talent.p4', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.ambush.h')}</h3>
      <p class="help-p">${tr('ui.help.ambush.p1')}</p>
      <p class="help-p">${tr('ui.help.ambush.p2')}</p>
      <p class="help-p">${tr('ui.help.ambush.p3')}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.machine.h')}</h3>
      <p class="help-p">${tr('ui.help.machine.themes', P)}</p>
      <p class="help-p">${tr('ui.help.machine.wall', P)}</p>
      <p class="help-p">${tr('ui.help.machine.fire', P)}</p>
      <p class="help-p">${tr('ui.help.machine.totem', P)}</p>
      <p class="help-p">${tr('ui.help.machine.grave', P)}</p>
      <p class="help-p">${tr('ui.help.machine.door', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.event.h')}</h3>
      <p class="help-p">${tr('ui.help.event.p', { shopCap: G.RELIC_SHOP_CAP })}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.solve.h')}</h3>
      <p class="help-p">${tr('ui.help.solve.p1')}</p>
      <p class="help-p">${tr('ui.help.solve.p2')}</p>
      <p class="help-p">${tr('ui.help.solve.p3')}</p>
      <p class="help-p">${tr('ui.help.solve.p4', P)}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.build.h')}</h3>
      <p class="help-p">${tr('ui.help.build.p1', P)}</p>
      <p class="help-p">${tr('ui.help.build.p2', P)}</p>
      <p class="help-p">${tr('ui.help.build.p3')}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.goal.h')}</h3>
      <p class="help-p">${tr('ui.help.goal.p')}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.relic.h')}</h3>
      <p class="help-p">${tr('ui.help.relic.p', { every: G.RELIC_EVERY, total: G.RELICS.length, reroll: G.RELIC_REROLL_BASE, rerollStep: G.RELIC_REROLL_STEP, shopPrice: G.SHOP.find((x) => x.id === 'relic').base, shopStep: G.SHOP.find((x) => x.id === 'relic').step, shopCap: G.RELIC_SHOP_CAP })}</p>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.legend.h')}</h3>
      <div class="legend">${legend}</div>
    </div>
    <div class="help-sec">
      <h3 class="help-h">${tr('ui.help.keys.h')}</h3>
      <p class="help-p">${tr('ui.help.keys.p')}</p>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-sheet="codex">${svg('relic')}<span>${tr('ui.btn.codex')}</span></button>
      <button class="btn btn-primary btn-lg" data-sheet="close">${tr('ui.help.ok')}</button>
    </div>`);
}

function openMenu() {
  openSheet('menu', `
    <div class="sheet-head">
      <div><h2 class="sheet-title">${tr('ui.menu.title')}</h2><p class="sheet-sub">${tr('ui.menu.sub', { floor: S.floor, name: G.floorName(S.floor), lv: S.player.lv })}</p></div>
      <button class="icon-btn sheet-close" data-sheet="close" aria-label="${tr('ui.btn.close')}">${svg('close')}</button>
    </div>
    <button class="opt" data-sheet="sound"><span class="opt-ic">${svg(audio.enabled ? 'sound-on' : 'sound-off')}</span><span class="opt-tx"><b>${tr('ui.menu.sound.name')}</b><span>${tr('ui.menu.sound.current', { s: audio.enabled ? tr('ui.menu.sound.on') : tr('ui.menu.sound.off') })}</span></span></button>
    <button class="opt" data-sheet="help"><span class="opt-ic">${svg('help')}</span><span class="opt-tx"><b>${tr('ui.menu.help.name')}</b><span>${tr('ui.menu.help.desc')}</span></span></button>
    <button class="opt" data-sheet="codex"><span class="opt-ic">${svg('relic')}</span><span class="opt-tx"><b>${tr('ui.menu.codex.name')}</b><span>${tr('ui.menu.codex.desc', { total: G.RELICS.length, own: S.relics.length })}</span></span></button>
    <button class="opt" data-sheet="restart"><span class="opt-ic">${svg('skull')}</span><span class="opt-tx"><b>${tr('ui.menu.restart.name')}</b><span>${tr('ui.menu.restart.desc')}</span></span></button>
    <div class="sheet-actions"><button class="btn btn-primary btn-lg" data-sheet="close">${tr('ui.menu.resume')}</button></div>`);
}

function endSequence(win) {
  clearSolve();
  busy = true;
  meta.runs++;
  if (win) meta.wins++;
  const newMedal = win && G.awardTalentMedal(meta, S.talent);
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
        <h2 class="result-title">${win ? tr('ui.result.win.title') : tr('ui.result.death.title')}</h2>
        <p class="result-sub">${win ? tr('ui.result.win.sub') : tr('ui.result.death.sub', { floor: S.floor, name: G.floorName(S.floor) })}</p>
      </div>
      ${newMedal ? `<div class="medal-new" style="--mc:${G.talentById(S.talent).color}">
        <span class="medal-new-ic">${svg(G.talentById(S.talent).icon)}</span>
        <span><b>${tr('ui.result.medal', { name: G.talentName(G.talentById(S.talent)) })}</b><span>${tr('ui.result.medal.sub')}</span></span>
      </div>` : ''}
      <div class="res-grid">
        <div class="stat"><i>${tr('ui.result.depth')}</i><b>${S.floor}</b></div>
        <div class="stat"><i>${tr('ui.result.lv')}</i><b>${S.player.lv}</b></div>
        <div class="stat"><i>${tr('ui.result.kills')}</i><b>${st.kills}</b></div>
        <div class="stat gold"><i>${tr('ui.result.gold')}</i><b>${st.goldEarned}</b></div>
      </div>
      <div class="gold-line">${svg('sparkle')}<span>${tr('ui.result.clears')}</span><b>${meta.wins}</b><span>${tr('ui.result.runs', { n: meta.runs })}</span></div>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-sheet="title">${tr('ui.result.toTitle')}</button>
        <button class="btn btn-primary" data-sheet="again">${svg('down')}<span>${tr('ui.result.again')}</span></button>
      </div>`, true);
  }, win ? 900 : 700);
}

function descendSequence() {
  clearSolve();
  resetBossUi();
  busy = true;
  audio.play('descend');
  el.fcDepth.textContent = tr('ui.hud.depth.short', { n: S.floor });
  el.fcName.textContent = G.floorName(S.floor);
  el.floorCard.hidden = false;
  el.floorCard.style.animation = 'none'; void el.floorCard.offsetWidth; el.floorCard.style.animation = '';
  const c = { x: innerWidth / 2, y: innerHeight / 2 };
  fx.portal(c.x, c.y); fx.ring(c.x, c.y, '#3fe0ff', 260);
  setTimeout(() => { buildBoard(); render(); fitBoard(); }, 620);
  setTimeout(() => {
    el.floorCard.hidden = true;
    busy = false;
    saveRun();
    // 「每层经验」加成可能在下楼瞬间触发升级
    openDrawers();
  }, 1680);
}

/* ─────────── 完全识破：收旗 + 逐格掀砖 ─────────── */
// 状态在 revealSolved 里一次翻完，DOM 却要按节奏回放：先把翻完前的砖面扣下来，
// 再一面一面收旗、一格一格掀砖。玩家看见的是「我插的旗确实对了，剩下的暗格也确实是雷」，
// 而不是一块盖住棋盘的横幅。
function holdSolve(e) {
  clearSolve();
  solveHold = new Map();
  for (const i of e.tiles) {
    const b = tiles[i];
    solveHold.set(i, {
      cls: b.className.replace(/\s*(pop|num-shift|hint|solve-out|was-flag|flag-retract)\b/g, ''),
      inner: b.innerHTML,
      n: Number(b.dataset.n) || 0,
      label: b.getAttribute('aria-label') || '',
      flag: b.classList.contains('tile-flag'),
    });
  }
}

function solveLater(fn, ms) { solveTimers.push(setTimeout(fn, ms)); }

function clearSolve() {
  for (const id of solveTimers) clearTimeout(id);
  solveTimers = [];
  solveHold = null;
  solveAnim.clear();
  for (const b of tiles) b.classList.remove('solve-out', 'was-flag', 'flag-retract');
}

function solveSequence(e) {
  const bricks = e.tiles, flags = e.flagged;
  if (!bricks.length || matchMedia('(prefers-reduced-motion: reduce)').matches) { clearSolve(); render(); openDrawers(); return; }
  busy = true;
  const cap = G.flagCap(S);
  const setFlagLeft = (left) => { el.flag.textContent = String(cap - left); };
  toast(tr(e.perfect ? 'ui.toast.solve.perfect' : 'ui.toast.solve', { n: e.count }), 'magic');
  setFlagLeft(flags.length);
  const fStep = flags.length ? Math.max(70, Math.min(160, Math.round(560 / flags.length))) : 0;
  flags.forEach((i, k) => solveLater(() => {
    tiles[i].classList.add('flag-retract');
    flyToBag(tileCenter(i), FLY.flag);
    audio.play('unflag');
    setFlagLeft(flags.length - k - 1);
  }, k * fStep));
  const start = flags.length * fStep + 260;
  const step = Math.max(45, Math.min(110, Math.round(1000 / bricks.length)));
  bricks.forEach((i, k) => solveLater(() => {
    const wasFlag = solveHold.get(i).flag;
    solveHold.delete(i);
    solveAnim.set(i, wasFlag);
    renderBoard();
    const c = tileCenter(i);
    fx.dust(c.x, c.y);
    if (k % 2 === 0) fx.haptic('tick');
    if (k % 3 === 0) audio.play('reveal');
  }, start + k * step));
  solveLater(() => {
    clearSolve();
    busy = false;
    render(); fitBoard(); saveRun();
    const c = fx.center(el.board);
    fx.ring(c.x, c.y, '#ffd54a', 240);
    // 识破给的经验可能刚好升级：回放结束后补上三选一抽屉
    openDrawers();
  }, start + bricks.length * step + 400);
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
  busy = false;
  resetBossUi();
  forceClose();
  el.title.hidden = true;
  el.game.hidden = false;
  buildBoard();
  render();
  saveRun();
  requestAnimationFrame(fitBoard);
  audio.init();
  firstRunHelp = !localStorage.getItem(SEEN_KEY);
  if (firstRunHelp) localStorage.setItem(SEEN_KEY, '1');
  if (S.talentPending) openTalentDraw();
  else if (firstRunHelp) setTimeout(openHelp, 420);
}

function resumeRun() {
  const s = G.deserialize(localStorage.getItem(RUN_KEY) || '');
  if (!s) return false;
  S = s; difficulty = s.difficulty; prev = {};
  busy = false;
  resetBossUi();
  forceClose();
  el.title.hidden = true; el.game.hidden = false;
  buildBoard(); render();
  requestAnimationFrame(fitBoard);
  audio.init();
  openDrawers();
  return true;
}

function toTitle() {
  clearSolve();
  busy = false;
  resetBossUi();
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
      <b>${G.difficultyName(d)}</b><i>${G.difficultyTag(d)}</i><s>${G.difficultyDesc(d)}<br>${tr('difficulty.flags', { n: d.flags })}</s></button>`;
  }).join('');
  const has = !!G.deserialize(localStorage.getItem(RUN_KEY) || '');
  el.btnContinue.hidden = !has;
  el.record.innerHTML = meta.runs
    ? tr('ui.title.record', { wins: meta.wins, runs: meta.runs })
    : tr('ui.title.first');
  const got = G.talentMedalCount(meta);
  el.medals.innerHTML = `<p class="medal-head">${tr('ui.title.medals', { got, total: G.TALENTS.length })}</p>
    <div class="medal-row">${G.TALENTS.map((t) => {
      const has = !!meta.medals[t.id];
      return `<span class="medal${has ? ' has' : ''}" style="--mc:${t.color}" aria-label="${tr(has ? 'ui.title.medal.earned' : 'ui.title.medal.locked', { name: G.talentName(t) })}">
        <span class="medal-ic">${svg(t.icon)}</span><b>${G.talentName(t)}</b><i>${tr(has ? 'ui.medal.has' : 'ui.medal.lock')}</i>
      </span>`;
    }).join('')}</div>`;
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
    case 'continue': if (!resumeRun()) { toast(tr('ui.toast.noRun'), 'bad'); renderTitle(); } break;
    case 'help': openHelp(); break;
    case 'codex': openCodex(); break;
    case 'bonus': if (S && !S.levelChoices && !S.talentPending) openBonus(); break;
    case 'menu': if (S && !S.talentPending) openMenu(); break;
    case 'potion': if (S && !guard()) apply(G.usePotion(S)); break;
    case 'descend': if (S && !guard()) apply(G.tryDescend(S)); break;
  }
});

el.ticker.addEventListener('click', () => { if (!guard()) { audio.play('ui'); openLog(); } });
el.ticker.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  if (!guard()) { audio.play('ui'); openLog(); }
});

el.scrim.addEventListener('click', () => { if (!sheetLock) { audio.play('ui'); closeSheet(); } });

// 长按攻击只亮出这一击的预演，不落子；松手后的那次 click 被吞掉，要点第二下才真的挥剑。
el.sheetBody.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('[data-sheet="attack"]');
  if (!b || busy) return;
  clearTimeout(attackHoldTimer);
  attackHoldUsed = false;
  attackHoldTimer = setTimeout(() => {
    const pv = el.sheetBody.querySelector('.fc-preview');
    if (!pv) return;
    attackHoldUsed = true;
    pv.hidden = false;
    el.sheetBody.scrollTop = el.sheetBody.scrollHeight;
    fx.buzz(8);
    audio.play('ui');
  }, 220);
});
for (const evt of ['pointerup', 'pointercancel', 'pointerleave']) {
  el.sheetBody.addEventListener(evt, () => clearTimeout(attackHoldTimer));
}

el.sheetBody.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sheet]');
  if (!b) return;
  const k = b.dataset.sheet;
  audio.init();
  if (k !== 'attack') audio.play('ui');
  switch (k) {
    case 'close': closeSheet(); break;
    case 'skip': G.closePending(S); saveRun(); closeSheet(); break;
    case 'attack': {
      if (attackHoldUsed) { attackHoldUsed = false; break; }
      const i = +b.dataset.i;
      const t = S.tiles[i];
      if (!t || !t.mob || t.mob.hp <= 0) break;
      const forced = S.forcedCombat === i;
      const f = G.forecastOnce(S.player, t.mob, G.atkOf(S));
      // 必死的一击直接交给 blocked 反馈
      if (f.lethal && !forced) { apply(G.strike(S, i)); break; }
      const snap = { i, mob: t.mob.hp, me: S.player.hp, mobMax: t.mob.maxHp, meMax: S.player.maxHp };
      const evs = G.strike(S, i);
      const dead = !t.mob || t.mob.hp <= 0;
      if (dead || S.status !== 'playing') forceClose();
      apply(evs, { keepSheet: true });
      if (!dead && S.status === 'playing' && sheetKind === 'combat') playExchangeFx(f, snap);
      break;
    }
    case 'bomb': { const i = +b.dataset.i; forceClose(); G.setMode(S, 'bomb'); apply(G.tapTile(S, i)); break; }
    case 'potion': { const i = +b.dataset.i; consume(G.usePotion(S)); render(); saveRun(); openCombat(i); break; }
    case 'altar': { const i = +b.dataset.i; closeSheet(); apply(G.altarChoose(S, i, b.dataset.choice)); break; }
    case 'doorGo': { const i = +b.dataset.i; closeSheet(); apply(G.useDoor(S, i)); break; }
    case 'theme': { const id = b.dataset.choice; closeSheet(); apply(G.chooseTheme(S, id)); break; }
    case 'eventBuy': {
      const i = +b.dataset.i;
      const evs = G.eventBuy(S, i, b.dataset.id);
      consume(evs); render(); saveRun();
      if (S.tiles[i] && !S.tiles[i].used && G.EVENT_KINDS.includes(S.tiles[i].kind)) openEvent(i);
      else closeSheet();
      break;
    }
    case 'talent': {
      const id = b.dataset.id;
      forceClose();
      apply(G.chooseTalent(S, id));
      if (firstRunHelp) { firstRunHelp = false; setTimeout(openHelp, 260); }
      break;
    }
    case 'relic': { const id = b.dataset.id; forceClose(); apply(G.chooseRelic(S, id)); break; }
    case 'reroll': apply(G.rerollRelics(S)); break;
    case 'level': { const id = b.dataset.id; forceClose(); apply(G.chooseLevel(S, id)); break; }
    case 'levelReroll': apply(G.rerollLevel(S)); break;
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
// 静态骨架的文案挂在 data-i18n 上，HTML 里的中文只作为无脚本时的兜底。
function applyI18n() {
  for (const n of document.querySelectorAll('[data-i18n]')) n.textContent = tr(n.dataset.i18n);
  for (const n of document.querySelectorAll('[data-i18n-html]')) n.innerHTML = tr(n.dataset.i18nHtml);
  for (const n of document.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', tr(n.dataset.i18nAria));
  const desc = document.querySelector('meta[data-i18n-desc]');
  if (desc) desc.setAttribute('content', tr(desc.dataset.i18nDesc));
  document.title = tr('ui.meta.title');
}

fx.init();
applyI18n();
renderTitle();
fitBoard();

// 便于自动化测试与调试
window.__game = {
  get state() { return S; },
  api: G, fx, audio,
  tap: doTap, flag: doFlag,
  start: startRun, resume: resumeRun, toTitle,
  sheet: () => sheetKind,
  closeSheet, openEvent, openHelp, openCodex, openRelicDraw, openLevelDraw, openTalentDraw, openBonus, openCombat, openLog,
  setDifficulty: (d) => { difficulty = d; renderTitle(); },
};