export class InputController {
  constructor(area, simulation, onPause) {
    this.area = area; this.simulation = simulation; this.keys = new Set(); this.pointerId = null; this.angle = null; this.pointerAngle = null;
    this.stick = document.getElementById('touch-stick'); this.knob = document.getElementById('touch-knob'); this.cleanups = [];
    const on = (target, event, fn, opts) => { target.addEventListener(event, fn, opts); this.cleanups.push(() => target.removeEventListener(event, fn, opts)); };
    on(area, 'pointerdown', e => {
      if (simulation.state !== 'playing' || this.pointerId !== null || e.button !== 0) return;
      e.preventDefault(); this.pointerId = e.pointerId;
      const box = area.getBoundingClientRect();
      this.origin = { x: e.clientX, y: e.clientY };
      this.stick.style.left = `${e.clientX - box.left}px`; this.stick.style.top = `${e.clientY - box.top}px`;
      this.stick.classList.remove('hidden'); area.classList.add('operating'); area.setPointerCapture(e.pointerId);
    });
    on(area, 'pointermove', e => {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault(); const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y, len = Math.hypot(dx, dy);
      const scale = len > 27 ? 27 / len : 1;
      this.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      if (len > 5) this.pointerAngle = Math.atan2(dy, dx);
    });
    const release = e => { if (e.pointerId === this.pointerId) this.clearPointer(); };
    on(area, 'pointerup', release); on(area, 'pointercancel', release); on(area, 'lostpointercapture', release);
    on(window, 'keydown', e => {
      const key = e.key.toLowerCase();
      if (key === 'escape' && !e.repeat) { onPause(); return; }
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault(); if (simulation.state === 'playing') this.keys.add(key);
    });
    on(window, 'keyup', e => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.clear());
  }
  getAngle() {
    if (this.pointerId !== null && this.pointerAngle !== null) return this.pointerAngle;
    const k = this.keys;
    const x = Number(k.has('arrowright') || k.has('d')) - Number(k.has('arrowleft') || k.has('a'));
    const y = Number(k.has('arrowdown') || k.has('s')) - Number(k.has('arrowup') || k.has('w'));
    return x || y ? Math.atan2(y, x) : null;
  }
  clearPointer() {
    const id = this.pointerId; this.pointerId = null; this.pointerAngle = null;
    if (id !== null && this.area.hasPointerCapture(id)) this.area.releasePointerCapture(id);
    this.stick.classList.add('hidden'); this.area.classList.remove('operating'); this.knob.style.transform = '';
  }
  clear() { this.keys.clear(); this.clearPointer(); }
  destroy() { this.clear(); this.cleanups.forEach(fn => fn()); }
}
