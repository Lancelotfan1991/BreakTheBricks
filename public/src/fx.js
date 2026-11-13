// 粒子 / 浮字 / 震屏 —— 单一 rAF 循环
const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
const parts = [];
const motes = [];
let running = false;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const IMPACT = { tick: 'LIGHT', light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
const WEB_MS = { tick: 8, light: 12, medium: 24, heavy: 45 };
function nativeHaptics() {
  const c = window.Capacitor;
  return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins ? c.Plugins.Haptics : null;
}

function resize() {
  // 全屏画布每帧重绘，dpr 封顶 1.5 就够了：粒子都是软边光点，再高只是白烧填充率
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedMotes();
}

function seedMotes() {
  motes.length = 0;
  const n = reduced ? 0 : Math.round(Math.min(34, (W * H) / 26000));
  for (let i = 0; i < n; i++) motes.push(newMote(true));
}
function newMote(anywhere) {
  const pal = ['255,171,46', '160,107,255', '63,224,255', '255,213,74'];
  return {
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : H + 12,
    r: 0.6 + Math.random() * 1.7,
    vy: -(0.09 + Math.random() * 0.28),
    vx: (Math.random() - 0.5) * 0.14,
    a: 0.12 + Math.random() * 0.34,
    ph: Math.random() * Math.PI * 2,
    c: pal[(Math.random() * pal.length) | 0],
  };
}

function loop() {
  ctx.clearRect(0, 0, W, H);
  const t = performance.now() / 1000;
  for (const m of motes) {
    m.y += m.vy; m.x += m.vx + Math.sin(t * 0.6 + m.ph) * 0.16;
    if (m.y < -14 || m.x < -20 || m.x > W + 20) Object.assign(m, newMote(false));
    const a = m.a * (0.55 + 0.45 * Math.sin(t * 1.4 + m.ph));
    ctx.beginPath();
    ctx.fillStyle = `rgba(${m.c},${a.toFixed(3)})`;
    ctx.arc(m.x, m.y, m.r, 0, 6.2832);
    ctx.fill();
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= 1;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag;
    p.x += p.vx; p.y += p.vy;
    const k = p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    if (p.shape === 'ring') {
      ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(0.6, 3.4 * k);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (1 - k) * p.grow, 0, 6.2832); ctx.stroke();
    } else if (p.shape === 'shard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot += p.spin);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s * 0.5, -p.s * 0.22, p.s, p.s * 0.44);
      ctx.restore();
    } else if (p.shape === 'star') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot += p.spin);
      ctx.fillStyle = p.c;
      const s = p.s * (0.4 + k * 0.8);
      ctx.beginPath();
      for (let j = 0; j < 8; j++) { const rr = j % 2 ? s * 0.36 : s; const a = (j / 8) * 6.2832; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, p.s * k), 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(loop);
}

function start() { if (running) return; running = true; requestAnimationFrame(loop); }

function emit(x, y, o = {}) {
  if (reduced) return;
  const n = o.count ?? 12;
  for (let i = 0; i < n; i++) {
    const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread ?? 6.2832) : Math.random() * 6.2832;
    const sp = (o.speed ?? 2.4) * (0.35 + Math.random() * 0.9);
    const life = Math.round((o.life ?? 34) * (0.65 + Math.random() * 0.7));
    parts.push({
      x: x + (Math.random() - 0.5) * (o.jitter ?? 6), y: y + (Math.random() - 0.5) * (o.jitter ?? 6),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift ?? 0),
      g: o.gravity ?? 0.09, drag: o.drag ?? 0.965,
      s: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
      c: Array.isArray(o.colors) ? o.colors[(Math.random() * o.colors.length) | 0] : (o.colors || '#ffab2e'),
      life, max: life, shape: o.shape ?? 'dot', rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.4,
      r0: o.r0 ?? 6, grow: o.grow ?? 40,
    });
  }
  if (parts.length > 620) parts.splice(0, parts.length - 620);
  start();
}

export const fx = {
  init() { resize(); addEventListener('resize', resize, { passive: true }); start(); },
  center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  dust(x, y) { emit(x, y, { count: 9, colors: ['#6b5480', '#4a3a5c', '#8a6ea8'], speed: 1.7, size: 2.4, life: 26, gravity: 0.13 }); },
  blood(x, y) { emit(x, y, { count: 18, colors: ['#ff3b5c', '#ff7a3d', '#a81338'], speed: 3.6, size: 3.2, life: 32, gravity: 0.22, shape: 'dot' }); },
  shards(x, y) { emit(x, y, { count: 14, colors: ['#8a6ea8', '#5c4470', '#c9a3ff'], speed: 3.2, size: 5, life: 40, gravity: 0.3, shape: 'shard' }); },
  coins(x, y) { emit(x, y, { count: 14, colors: ['#ffd54a', '#ffab2e', '#fff3c4'], speed: 2.8, size: 3, life: 42, gravity: 0.2, lift: 1.6, shape: 'star' }); },
  heal(x, y) { emit(x, y, { count: 16, colors: ['#7dff5a', '#39d353', '#d6ffcc'], speed: 1.5, size: 2.8, life: 46, gravity: -0.05, drag: 0.97 }); },
  magic(x, y) { emit(x, y, { count: 20, colors: ['#ff4fd8', '#a06bff', '#3fe0ff'], speed: 2.6, size: 2.8, life: 44, gravity: -0.02, drag: 0.96 }); },
  boom(x, y) {
    emit(x, y, { count: 30, colors: ['#ffab2e', '#ff5a1e', '#ffd54a', '#6b5480'], speed: 5.2, size: 4, life: 40, gravity: 0.24 });
    emit(x, y, { count: 2, colors: ['#ffd27a'], speed: 0, life: 24, shape: 'ring', r0: 8, grow: 62, gravity: 0 });
  },
  ring(x, y, color = '#ffd54a', grow = 90) { emit(x, y, { count: 2, colors: [color], speed: 0, life: 32, shape: 'ring', r0: 10, grow, gravity: 0 }); },
  portal(x, y) { emit(x, y, { count: 22, colors: ['#3fe0ff', '#a06bff', '#ffffff'], speed: 2.2, size: 2.6, life: 52, gravity: -0.08, drag: 0.95 }); },

  float(x, y, text, cls = 'dmg') {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1050);
  },
  // 物品从格子抛物线飞进背包位；只动 transform/opacity，交给合成器，不触发重排
  fly(from, to, icon, o = {}) {
    const el = document.createElement('div');
    el.className = 'fly ' + (o.cls || '');
    el.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-${icon}"/></svg>`;
    el.style.left = from.x + 'px';
    el.style.top = from.y + 'px';
    document.body.appendChild(el);
    const arrive = () => { el.remove(); if (o.onArrive) o.onArrive(); };
    if (reduced || !el.animate) { arrive(); return; }
    const dx = to.x - from.x, dy = to.y - from.y;
    const lift = Math.max(26, Math.min(92, Math.hypot(dx, dy) * 0.28));
    const a = el.animate([
      { transform: 'translate(0,0) scale(.55)', opacity: 0, offset: 0 },
      { transform: `translate(${dx * 0.2}px,${dy * 0.2 - lift * 0.7}px) scale(1.18)`, opacity: 1, offset: 0.24 },
      { transform: `translate(${dx * 0.66}px,${dy * 0.66 - lift}px) scale(1)`, opacity: 1, offset: 0.62 },
      { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0, offset: 1 },
    ], { duration: o.duration || 560, easing: 'cubic-bezier(.32,.62,.36,1)', fill: 'forwards' });
    a.onfinish = arrive;
    a.oncancel = arrive;
  },
  shake(el) {
    if (reduced || !el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 380);
  },
  flash(kind) {
    const el = document.getElementById('flash');
    el.className = 'flash';
    void el.offsetWidth;
    el.classList.add(kind);
    setTimeout(() => { el.className = 'flash'; }, 640);
  },
  buzz(ms) {
    if (!navigator.vibrate || reduced) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(ms); } catch {}
  },
  // App 壳的 WebView 不提供 navigator.vibrate，改走 Capacitor 原生马达；网页回退振动 API。
  haptic(level = 'light') {
    if (reduced) return;
    const h = nativeHaptics();
    if (h) { h.impact({ style: IMPACT[level] || 'LIGHT' }).catch(() => {}); return; }
    fx.buzz(WEB_MS[level] ?? 12);
  },
  rumble(ms) {
    if (reduced) return;
    const h = nativeHaptics();
    if (h) { h.vibrate({ duration: ms }).catch(() => {}); return; }
    fx.buzz(ms);
  },
};