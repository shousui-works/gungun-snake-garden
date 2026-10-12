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
  play(type) {
    if (type === 'eat') this.note(680 + Math.random() * 160);
    if (type === 'level') [523, 659, 784, 1046].forEach((freq, i) => this.note(freq, i * .095, .17));
    if (type === 'enemy') [440, 660, 880].forEach((freq, i) => this.note(freq, i * .07));
    if (type === 'start') [523, 784].forEach((freq, i) => this.note(freq, i * .1, .15));
    if (type === 'over') [523, 440, 392].forEach((freq, i) => this.note(freq, i * .13, .2, .03));
  }
  destroy() { this.context?.close().catch(() => {}); }
}
