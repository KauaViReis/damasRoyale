/* ============================================================
   DAMAS 3D — Sistema de Áudio
   Sons gerados por oscilador com múltiplas camadas
   ============================================================ */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  }

  _tone(freq, dur, type = 'sine', gain = 0.05, delay = 0) {
    if (this.muted) return;
    try {
      const ac = this._ensure();
      const osc = ac.createOscillator();
      const gn = ac.createGain();
      const flt = ac.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 3000;
      osc.type = type;
      osc.frequency.value = freq;
      /* Leve variação de pitch para som mais natural */
      osc.frequency.value *= 0.98 + Math.random() * 0.04;
      const t = ac.currentTime + delay;
      gn.gain.setValueAtTime(gain, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(flt);
      flt.connect(gn);
      gn.connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* silently fail */ }
  }

  move() {
    this._tone(480, 0.1, 'triangle', 0.045);
    this._tone(520, 0.06, 'sine', 0.02, 0.03);
  }

  capture() {
    this._tone(170, 0.18, 'square', 0.05);
    this._tone(120, 0.22, 'sine', 0.045);
    this._tone(90, 0.15, 'triangle', 0.03, 0.05);
  }

  crown() {
    this._tone(660, 0.12, 'triangle', 0.05);
    this._tone(880, 0.16, 'triangle', 0.05, 0.09);
    this._tone(1100, 0.14, 'sine', 0.03, 0.18);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this._tone(f, 0.22, 'triangle', 0.055, i * 0.12);
    });
  }

  select() {
    this._tone(700, 0.05, 'sine', 0.02);
  }

  drop() {
    this._tone(150, 0.04, 'triangle', 0.04);
    this._tone(220, 0.03, 'square', 0.015);
  }

  tick() {
    this._tone(880, 0.01, 'sine', 0.02);
  }

  emote() {
    this._tone(880, 0.07, 'sine', 0.04);
    this._tone(1320, 0.09, 'sine', 0.03, 0.06);
  }

  error() {
    this._tone(220, 0.15, 'square', 0.03);
    this._tone(180, 0.12, 'square', 0.025, 0.08);
  }
}
