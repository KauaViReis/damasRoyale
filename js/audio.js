/* ============================================================
   DAMAS 3D — Sistema de Áudio
   Sons gerados por oscilador com múltiplas camadas
   ============================================================ */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    /* Trilha sonora ambiente */
    this.musicOn = false;
    this.musicVolume = 0.5;
    this.musicGain = null;
    this._musicTimer = null;
    this._chordIdx = 0;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
      /* Variação de pitch e duração para som mais natural (Polish V2) */
      osc.frequency.value *= 0.94 + Math.random() * 0.12;
      dur *= 0.9 + Math.random() * 0.2;
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

  /* ============ TRILHA SONORA AMBIENTE ============
     Pad medieval/estratégico gerado por osciladores — sem áudio externo.
     Progressão lenta em lá menor (Am · F · G · C) com brilho ocasional. */
  _CHORDS = [
    [220.00, 261.63, 329.63], // Am
    [174.61, 220.00, 261.63], // F
    [196.00, 246.94, 392.00], // G
    [261.63, 329.63, 392.00]  // C
  ];

  startMusic() {
    this.musicOn = true;
    try {
      const ac = this._ensure();
      if (!this.musicGain) {
        this.musicGain = ac.createGain();
        this.musicGain.gain.value = this.musicVolume * 0.12;
        this.musicGain.connect(ac.destination);
      }
      if (this._musicTimer) return;
      this._playChord();
      this._musicTimer = setInterval(() => this._playChord(), 4800);
    } catch (e) { /* silently fail */ }
  }

  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this.musicGain) {
      try {
        const ac = this._ensure();
        this.musicGain.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      } catch (e) { /* ok */ }
    }
  }

  toggleMusic() {
    if (this.musicOn) this.stopMusic(); else this.startMusic();
    return this.musicOn;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) {
      try {
        const ac = this._ensure();
        this.musicGain.gain.setTargetAtTime(v * 0.12, ac.currentTime, 0.1);
      } catch (e) { /* ok */ }
    }
  }

  _playChord() {
    if (!this.musicOn) return;
    try {
      const ac = this._ensure();
      if (!this.musicGain) return;
      /* Reabre o ganho caso tenha sido fechado por stop anterior */
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.12, ac.currentTime, 0.1);
      const chord = this._CHORDS[this._chordIdx % this._CHORDS.length];
      this._chordIdx++;
      const t = ac.currentTime, dur = 4.6;
      chord.forEach((f, i) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        const flt = ac.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = 900;
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(flt); flt.connect(g); g.connect(this.musicGain);
        osc.start(t); osc.stop(t + dur + 0.1);
      });
      /* Brilho (oitava acima) a cada 2 acordes */
      if (this._chordIdx % 2 === 0) {
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = chord[2] * 2;
        g.gain.setValueAtTime(0.0001, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.05, t + 1.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(t + 0.5); osc.stop(t + 3.6);
      }
    } catch (e) { /* silently fail */ }
  }
}
