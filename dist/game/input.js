import { CONFIG } from './config.js';

export class InputController {
  constructor(area, simulation, onPause, getPlayerPoint, onDirection = () => {}) {
    this.area = area; this.simulation = simulation; this.keys = new Set(); this.pointerId = null;
    this.pendingAngle = null; this.lastPointer = null; this.cleanups = [];
    this.getPlayerPoint = getPlayerPoint; this.onDirection = onDirection;
    const on = (target, event, fn) => { target.addEventListener(event, fn); this.cleanups.push(() => target.removeEventListener(event, fn)); };
    on(area, 'pointerdown', e => {
      if (simulation.state !== 'playing' || this.pointerId !== null || e.button !== 0) return;
      e.preventDefault(); this.pointerId = e.pointerId;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      area.setPointerCapture(e.pointerId); this.pointAt(e);
    });
    on(area, 'pointermove', e => {
      if (simulation.state !== 'playing' || e.pointerId !== this.pointerId) return;
      if (Math.hypot(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y) < CONFIG.pointerMoveDeadZone) return;
      e.preventDefault(); this.lastPointer = { x: e.clientX, y: e.clientY }; this.pointAt(e);
    });
    on(area, 'pointerup', e => { if (e.pointerId === this.pointerId) this.releasePointer(); });
    const cancel = e => { if (e.pointerId === this.pointerId) { this.pendingAngle = null; this.releasePointer(); } };
    on(area, 'pointercancel', cancel); on(area, 'lostpointercapture', cancel);
    on(window, 'keydown', e => {
      const key = e.key.toLowerCase();
      if (key === 'escape' && !e.repeat) { onPause(); return; }
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (simulation.state === 'playing') { this.pendingAngle = null; this.keys.add(key); }
    });
    on(window, 'keyup', e => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.clear());
  }
  pointAt(e) {
    const box = this.area.getBoundingClientRect(), head = this.getPlayerPoint();
    const dx = e.clientX - box.left - head.x, dy = e.clientY - box.top - head.y;
    if (Math.hypot(dx, dy) <= Math.max(CONFIG.inputDeadZone, head.radius || 0)) return;
    this.keys.clear(); this.pendingAngle = Math.atan2(dy, dx); this.onDirection(this.pendingAngle);
  }
  getAngle() {
    if (this.simulation.state !== 'playing') return null;
    const k = this.keys;
    const x = Number(k.has('arrowright') || k.has('d')) - Number(k.has('arrowleft') || k.has('a'));
    const y = Number(k.has('arrowdown') || k.has('s')) - Number(k.has('arrowup') || k.has('w'));
    if (x || y) return Math.atan2(y, x);
    // Consume each tap once. The simulation then keeps that direction, including after a short tap.
    const angle = this.pendingAngle; this.pendingAngle = null; return angle;
  }
  releasePointer() {
    const id = this.pointerId; this.pointerId = null; this.lastPointer = null;
    if (id !== null && this.area.hasPointerCapture(id)) this.area.releasePointerCapture(id);
  }
  clear() { this.keys.clear(); this.pendingAngle = null; this.releasePointer(); }
  destroy() { this.clear(); this.cleanups.forEach(fn => fn()); }
}
