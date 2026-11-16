// WebAudio 合成音效 —— 无外部音频资源
const STORE = 'bbr.audio';

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem(STORE) !== '0';
    this.started = false;
    this._noise = null;
    this._amb = null;
    this._dripTimer = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0;
    this.amb.connect(this.master);
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    this.startAmbience();
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(STORE, this.enabled ? '1' : '0');
    if (this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
    if (this.enabled) this.play('ui');
    return this.enabled;
  }

  startAmbience() {
    if (!this.ctx || this._amb) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain(); g.gain.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 0.7;
    g.connect(lp); lp.connect(this.amb);
    const oscs = [];
    for (const [f, type, vol] of [[55, 'sine', 0.5], [82.4, 'triangle', 0.22], [110.3, 'sine', 0.14]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const og = c.createGain(); og.gain.value = vol;
      o.connect(og); og.connect(g); o.start(); oscs.push(o);
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
    const lg = c.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(g.gain); lfo.start(); oscs.push(lfo);
    const air = c.createBufferSource(); air.buffer = this._noise; air.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.5;
    const ag = c.createGain(); ag.gain.value = 0.035;
    air.connect(bp); bp.connect(ag); ag.connect(this.amb); air.start();
    this.amb.gain.setTargetAtTime(0.16, t, 2.4);
    this._amb = { oscs, air, g };
    this._scheduleDrip();
  }

  _scheduleDrip() {
    clearTimeout(this._dripTimer);
    this._dripTimer = setTimeout(() => {
      if (this.ctx && this.enabled) this._drip();
      this._scheduleDrip();
    }, 7000 + Math.random() * 13000);
  }

  _drip() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    const f = 700 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.16);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.amb); o.start(t); o.stop(t + 0.34);
  }

  _tone({ freq = 440, to = null, type = 'sine', dur = 0.18, vol = 0.2, delay = 0, attack = 0.006, curve = 'exp' }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency[curve === 'exp' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime'](Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.04);
  }

  _burst({ dur = 0.2, vol = 0.2, freq = 1200, type = 'lowpass', q = 1, delay = 0, sweep = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this._noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur + 0.04);
  }

  play(name) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'reveal': this._burst({ dur: 0.09, vol: 0.1, freq: 2400, sweep: 700 }); this._tone({ freq: 320, to: 210, type: 'triangle', dur: 0.07, vol: 0.05 }); break;
      case 'open': this._burst({ dur: 0.22, vol: 0.11, freq: 1800, sweep: 420 }); this._tone({ freq: 180, to: 120, type: 'sine', dur: 0.2, vol: 0.09 }); break;
      case 'flag': this._tone({ freq: 880, to: 1320, type: 'square', dur: 0.06, vol: 0.05 }); break;
      case 'unflag': this._tone({ freq: 700, to: 460, type: 'square', dur: 0.06, vol: 0.04 }); break;
      case 'ui': this._tone({ freq: 620, to: 780, type: 'triangle', dur: 0.06, vol: 0.06 }); break;
      case 'deny': this._tone({ freq: 180, to: 110, type: 'sawtooth', dur: 0.18, vol: 0.1 }); break;
      case 'hit':
        this._burst({ dur: 0.16, vol: 0.24, freq: 2600, sweep: 300 });
        this._tone({ freq: 150, to: 52, type: 'sawtooth', dur: 0.2, vol: 0.2 });
        break;
      case 'swing': this._burst({ dur: 0.13, vol: 0.13, freq: 3400, type: 'bandpass', q: 1.6, sweep: 900 }); break;
      case 'kill':
        this._burst({ dur: 0.3, vol: 0.2, freq: 1600, sweep: 180 });
        this._tone({ freq: 300, to: 70, type: 'square', dur: 0.3, vol: 0.12 });
        this._tone({ freq: 520, to: 180, type: 'triangle', dur: 0.24, vol: 0.08, delay: 0.05 });
        break;
      case 'trap':
        this._burst({ dur: 0.26, vol: 0.24, freq: 3800, sweep: 500, type: 'highpass' });
        this._tone({ freq: 240, to: 60, type: 'sawtooth', dur: 0.28, vol: 0.16 });
        break;
      case 'coin':
        this._tone({ freq: 1180, type: 'triangle', dur: 0.09, vol: 0.11 });
        this._tone({ freq: 1720, type: 'triangle', dur: 0.14, vol: 0.09, delay: 0.06 });
        break;
      case 'item':
        this._tone({ freq: 660, type: 'triangle', dur: 0.1, vol: 0.1 });
        this._tone({ freq: 990, type: 'triangle', dur: 0.14, vol: 0.09, delay: 0.07 });
        this._tone({ freq: 1320, type: 'sine', dur: 0.2, vol: 0.07, delay: 0.14 });
        break;
      case 'sparkle':
        this._tone({ freq: 1560, type: 'sine', dur: 0.12, vol: 0.055 });
        this._tone({ freq: 2080, type: 'sine', dur: 0.16, vol: 0.04, delay: 0.08 });
        break;
      case 'heal':
        [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.1, delay: i * 0.065 }));
        break;
      case 'levelup':
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.42, vol: 0.11, delay: i * 0.075 }));
        this._burst({ dur: 0.5, vol: 0.06, freq: 5200, type: 'highpass', delay: 0.1 });
        break;
      case 'key':
        [1046, 1318, 1568].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 0.34, vol: 0.1, delay: i * 0.09 }));
        this._burst({ dur: 0.18, vol: 0.07, freq: 4200, type: 'highpass' });
        break;
      case 'bomb':
        this._burst({ dur: 0.62, vol: 0.32, freq: 1400, sweep: 70 });
        this._tone({ freq: 110, to: 32, type: 'sawtooth', dur: 0.55, vol: 0.24 });
        break;
      case 'scroll':
        this._burst({ dur: 0.42, vol: 0.09, freq: 900, type: 'bandpass', q: 2.4, sweep: 4200 });
        [880, 1174, 1568].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.06, delay: i * 0.06 }));
        break;
      case 'stairs':
        this._tone({ freq: 330, to: 660, type: 'sine', dur: 0.4, vol: 0.1 });
        this._tone({ freq: 495, to: 990, type: 'sine', dur: 0.45, vol: 0.07, delay: 0.08 });
        break;
      case 'descend':
        this._tone({ freq: 420, to: 60, type: 'sawtooth', dur: 0.9, vol: 0.14 });
        this._burst({ dur: 1.0, vol: 0.14, freq: 900, sweep: 90 });
        [196, 262, 330].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.7, vol: 0.08, delay: 0.35 + i * 0.1 }));
        break;
      case 'locked': this._tone({ freq: 130, to: 90, type: 'square', dur: 0.16, vol: 0.11 }); this._burst({ dur: 0.1, vol: 0.08, freq: 700 }); break;
      case 'death':
        [330, 262, 208, 156, 104].forEach((f, i) => this._tone({ freq: f, to: f * 0.94, type: 'sawtooth', dur: 0.7, vol: 0.13, delay: i * 0.17 }));
        this._burst({ dur: 1.4, vol: 0.12, freq: 600, sweep: 60 });
        break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.13, delay: i * 0.13 }));
        [262, 330, 392].forEach((f) => this._tone({ freq: f, type: 'sine', dur: 1.6, vol: 0.07, delay: 0.9 }));
        break;
      case 'boss':
        this._tone({ freq: 92, to: 46, type: 'sawtooth', dur: 0.9, vol: 0.2 });
        this._tone({ freq: 138, to: 68, type: 'square', dur: 0.75, vol: 0.1, delay: 0.05 });
        this._burst({ dur: 0.85, vol: 0.2, freq: 700, sweep: 60 });
        [330, 392, 494].forEach((f, i) => this._tone({ freq: f, to: f * 0.5, type: 'sawtooth', dur: 0.6, vol: 0.07, delay: 0.18 + i * 0.1 }));
        break;
      case 'altar':
        this._tone({ freq: 220, to: 440, type: 'sine', dur: 0.7, vol: 0.1 });
        this._tone({ freq: 331, to: 662, type: 'sine', dur: 0.8, vol: 0.07, delay: 0.06 });
        this._burst({ dur: 0.7, vol: 0.05, freq: 2600, type: 'bandpass', q: 3, sweep: 600 });
        break;
    }
  }
}

export const audio = new Audio();