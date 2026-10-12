import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../dist/game/input.js';
class FakeElement extends EventTarget {
  constructor() { super(); this.style = {}; this.classes = new Set(); this.captures = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c) }; }
  getBoundingClientRect() { return { left: 0, top: 500 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
function setup() {
  const area = new FakeElement(), stick = new FakeElement(), knob = new FakeElement();
  globalThis.window = new EventTarget(); globalThis.document = { getElementById: id => id === 'touch-stick' ? stick : knob };
  const sim = { state: 'playing' }, input = new InputController(area, sim, () => {});
  return { area, stick, sim, input };
}
function send(target, name, props) { const e = new Event(name, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); }
test('additional fingers cannot hijack or release an active gesture', () => {
  const { area, input, stick } = setup();
  send(area, 'pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 550 });
  send(area, 'pointerdown', { pointerId: 2, button: 0, clientX: 200, clientY: 560 });
  send(area, 'pointermove', { pointerId: 2, clientX: 250, clientY: 530 }); assert.equal(input.getAngle(), null);
  // Pointer capture permits dragging far beyond the original control area.
  send(area, 'pointermove', { pointerId: 1, clientX: 400, clientY: 250 }); assert.equal(input.getAngle(), -Math.PI / 4);
  send(area, 'pointerup', { pointerId: 2 }); assert.equal(input.pointerId, 1);
  send(area, 'pointerup', { pointerId: 1 }); assert.equal(input.pointerId, null); assert.equal(input.getAngle(), null); assert.ok(stick.classes.has('hidden'));
  send(area, 'pointerdown', { pointerId: 3, button: 0, clientX: 100, clientY: 550 }); send(area, 'pointercancel', { pointerId: 3 }); assert.equal(input.pointerId, null);
  input.destroy(); delete globalThis.window; delete globalThis.document;
});
test('keyboard diagonals normalize to a direction and focus loss clears held input', () => {
  const { input, sim } = setup();
  send(window, 'keydown', { key: 'ArrowRight' }); send(window, 'keydown', { key: 'w' }); assert.equal(input.getAngle(), -Math.PI / 4);
  send(window, 'keyup', { key: 'w' }); assert.equal(input.getAngle(), 0);
  send(window, 'blur', {}); assert.equal(input.getAngle(), null);
  sim.state = 'paused'; send(window, 'keydown', { key: 'a' }); assert.equal(input.getAngle(), null);
  input.destroy(); delete globalThis.window; delete globalThis.document;
});
