import { eatPitch } from './rules.js';
export class GameAudio {
  constructor(enabled) { this.enabled = enabled; this.context = null; this.active = 0; }
  init() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!this.context && Audio) this.context = new Audio();
      this.context?.resume().catch(() => {});
    } catch { /* Sound is optional. Gameplay must continue. */ }
  }
  note(freq, delay = 0, duration = .12, volume = .045) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.active > 8) return;
    try {
      const c = this.context, o = c.createOscillator(), gain = c.createGain(), t = c.currentTime + delay;
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * .85, t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .012); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      o.connect(gain); gain.connect(c.destination); o.start(t); o.stop(t + duration + .02); this.active++;
      o.onended = () => { o.disconnect(); gain.disconnect(); this.active--; };
    } catch { /* Audio failures never interrupt play. */ }
  }
  play(type, event = {}) {
    if (type === 'eat') {
      this.note(170, 0, .055, .025);
      this.note(eatPitch(event.combo || 1), .035, .14, .045);
      if (event.large) this.note(eatPitch(event.combo || 1) * 1.5, .12, .17, .035);
    }
    if (type === 'level') [523, 659, 784, 1046].forEach((freq, i) => this.note(freq, i * .095, .17));
    if (type === 'enemy') [440, 660, 880].forEach((freq, i) => this.note(freq, i * .07));
    if (type === 'treasure-appear') (event.jackpot ? [988, 1319, 1661] : [988, 1175]).forEach((freq, i) => this.note(freq, i * .1, .13, .028));
    if (type === 'treasure') (event.jackpot ? [659, 831, 1046, 1319, 1661] : [659, 784, 1046, 1319]).forEach((freq, i) => this.note(freq, i * .075, .18));
    if (type === 'start') [523, 784].forEach((freq, i) => this.note(freq, i * .1, .15));
    if (type === 'over') [523, 440, 392].forEach((freq, i) => this.note(freq, i * .13, .2, .03));
  }
  destroy() { this.context?.close().catch(() => {}); }
}
