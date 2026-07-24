const PATTERNS = {
  hit: [[90, 0.04, 'square', 0.025]],
  crit: [[160, 0.05, 'sawtooth', 0.04], [80, 0.08, 'square', 0.03]],
  kill: [[220, 0.05, 'triangle', 0.025], [330, 0.08, 'triangle', 0.02]],
  bossDown: [[120, 0.12, 'sawtooth', 0.04], [180, 0.14, 'triangle', 0.04], [260, 0.2, 'triangle', 0.04]],
  skill: [[380, 0.06, 'sine', 0.025], [620, 0.1, 'sine', 0.018]],
  potion: [[520, 0.05, 'sine', 0.02], [760, 0.08, 'sine', 0.016]],
  loot: [[660, 0.04, 'triangle', 0.018], [880, 0.06, 'triangle', 0.014]],
  buy: [[520, 0.04, 'square', 0.018]],
  equip: [[240, 0.04, 'square', 0.025], [360, 0.08, 'triangle', 0.02]],
  portal: [[180, 0.14, 'sine', 0.02], [360, 0.18, 'sine', 0.014]],
  level: [[330, 0.09, 'triangle', 0.03], [440, 0.11, 'triangle', 0.03], [660, 0.18, 'triangle', 0.025]],
  quest: [[392, 0.08, 'triangle', 0.022], [523, 0.11, 'triangle', 0.02]],
  achievement: [[523, 0.08, 'sine', 0.025], [659, 0.09, 'sine', 0.024], [784, 0.15, 'sine', 0.022]],
  forge: [[150, 0.05, 'square', 0.04], [760, 0.12, 'triangle', 0.025]],
  forgeFail: [[170, 0.12, 'sawtooth', 0.025], [110, 0.16, 'sawtooth', 0.02]],
  warning: [[130, 0.12, 'square', 0.025], [130, 0.12, 'square', 0.025]],
  explosion: [[70, 0.22, 'sawtooth', 0.05]],
  dodge: [[800, 0.05, 'sine', 0.012]],
};

export class SoundSystem {
  constructor() {
    this.enabled = localStorage.getItem('ember_sound') !== '0';
    this.ctx = null;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    localStorage.setItem('ember_sound', this.enabled ? '1' : '0');
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(name) {
    const ctx = this.ensure();
    const pattern = PATTERNS[name];
    if (!ctx || !pattern) return;
    let offset = 0;
    for (const [frequency, duration, type, volume] of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + offset);
      gain.gain.setValueAtTime(volume, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + duration);
      offset += duration * 0.72;
    }
  }
}
