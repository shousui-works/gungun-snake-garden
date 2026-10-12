import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../dist/game/input.js';
import { Simulation } from '../dist/game/simulation.js';
import { Renderer } from '../dist/game/renderer.js';
class FakeCanvas extends EventTarget {
  constructor() { super(); this.captures = new Set(); }
  getBoundingClientRect() { return { left: 30, top: 50, width: 360, height: 600 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
function setup(sim = { state: 'playing' }) {
  const area = new FakeCanvas(), head = { x: 120, y: 180, radius: 15 }, directions = [];
  globalThis.window = new EventTarget();
  const input = new InputController(area, sim, () => { sim.state = 'paused'; input.clear(); }, () => head, angle => directions.push(angle));
  return { area, head, sim, directions, input, finish() { input.destroy(); delete globalThis.window; } };
}
function send(target, name, props) { const e = new Event(name, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); }
function down(area, id, x, y) { send(area,'pointerdown',{pointerId:id,button:0,clientX:x,clientY:y}); }
function up(area, id) { send(area,'pointerup',{pointerId:id}); }

test('tapping around the rendered head selects right, down, left, and up', () => {
  const { area, input, directions, finish } = setup();
  for (const [id,x,y,angle] of [[1,220,230,0],[2,150,300,Math.PI/2],[3,80,230,Math.PI],[4,150,160,-Math.PI/2]]) {
    down(area,id,x,y); up(area,id); assert.equal(input.getAngle(),angle); assert.equal(input.getAngle(),null);
  }
  assert.equal(directions.length,4); finish();
});
test('a short tap released between frames is applied once and its heading persists', () => {
  const sim = new Simulation(); sim.start(); sim.enemies = []; const { area,input,finish } = setup(sim);
  down(area,1,220,230); up(area,1);
  sim.step(.016,input.getAngle()); assert.equal(sim.player.targetAngle,0);
  sim.step(.016,input.getAngle()); assert.equal(sim.player.targetAngle,0); assert.equal(input.pointerId,null); finish();
});
test('tapping on the head preserves the previous direction', () => {
  const { area,input,directions,finish } = setup();
  down(area,1,151,232); up(area,1); assert.equal(input.getAngle(),null); assert.equal(directions.length,0); finish();
});
test('a second finger cannot hijack or release an active gesture', () => {
  const { area,input,finish } = setup();
  down(area,1,220,230); down(area,2,80,230); up(area,2);
  assert.equal(input.pointerId,1); assert.equal(input.getAngle(),0);
  send(area,'pointermove',{pointerId:2,clientX:150,clientY:160}); assert.equal(input.getAngle(),null);
  up(area,1); finish();
});
test('dragging uses the current head projection and captured motion outside the field', () => {
  const { area,input,head,finish } = setup();
  down(area,1,220,230); input.getAngle(); head.x=210;
  send(area,'pointermove',{pointerId:1,clientX:260,clientY:240}); assert.equal(input.getAngle(),Math.atan2(10,20));
  send(area,'pointermove',{pointerId:1,clientX:500,clientY:10}); assert.equal(input.getAngle(),Math.atan2(-220,260));
  up(area,1); finish();
});
test('cancel, focus loss, and pause clear pending taps; paused taps are ignored', () => {
  const { area,input,sim,finish } = setup();
  down(area,1,220,230); send(area,'pointercancel',{pointerId:1}); assert.equal(input.getAngle(),null);
  down(area,2,220,230); send(window,'blur',{}); assert.equal(input.pointerId,null); assert.equal(input.getAngle(),null);
  down(area,3,220,230); send(window,'keydown',{key:'Escape',repeat:false}); assert.equal(sim.state,'paused'); assert.equal(input.getAngle(),null);
  down(area,4,220,230); assert.equal(input.pointerId,null); finish();
});
test('keyboard diagonals still work and releasing keys does not restore an old tap', () => {
  const { area,input,finish } = setup();
  down(area,1,80,230); up(area,1); send(window,'keydown',{key:'ArrowRight'}); send(window,'keydown',{key:'w'});
  assert.equal(input.getAngle(),-Math.PI/4); send(window,'keyup',{key:'w'}); assert.equal(input.getAngle(),0);
  send(window,'keyup',{key:'ArrowRight'}); assert.equal(input.getAngle(),null); finish();
});
test('projection includes camera offset and CSS zoom instead of assuming a centered head', () => {
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer,{width:800,height:500,scale:1.25,camera:{x:200,y:140}});
  assert.deepEqual(renderer.screenPosition({x:260,y:180,radius:16}),{x:475,y:300,radius:20});
});
