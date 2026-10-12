import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../dist/game/config.js';
import { Simulation, makeSnake } from '../dist/game/simulation.js';
import { radiusFor, distance } from '../dist/game/rules.js';

function seeded() { let n = 41; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
const modes = ['easy', 'normal', 'hard'];

test('normal is the default and damaged difficulty values fall back to it', () => {
  assert.equal(new Simulation(seeded()).difficulty, 'normal');
  for (const invalid of ['missing', '__proto__', 'constructor', null]) {
    const s = new Simulation(seeded(), invalid);
    assert.equal(s.difficulty, 'normal'); assert.equal(s.enemies.length, 4); assert.equal(s.protection, 6);
  }
});
test('difficulty changes the real pace, enemy population and opening protection', () => {
  const travel = [], initial = [], maximum = [], protection = [], highestEnemy = [];
  for (const mode of modes) {
    const s = new Simulation(seeded(), mode); initial.push(s.enemies.length); protection.push(s.protection);
    highestEnemy.push(Math.max(...s.enemies.map(e => e.level)));
    s.start(); s.enemies = []; s.food = [];
    const before = { x: s.player.x, y: s.player.y };
    for (let i = 0; i < 10; i++) s.step(.05);
    travel.push(distance(before, s.player));
    s.reset(); s.start(); s.player.level = 16; s.player.radius = radiusFor(16);
    for (let i = 0; i < 4; i++) s.step(0);
    maximum.push(s.enemies.length);
  }
  assert.ok(travel[0] < travel[1] && travel[1] < travel[2]);
  assert.deepEqual(initial, [3, 4, 4]); assert.deepEqual(maximum, [4, 5, 6]);
  assert.deepEqual(protection, [8, 6, 5]); assert.deepEqual(highestEnemy, [2, 3, 3]);
});
test('easy enemies notice the player less often and stop chasing sooner', () => {
  const chaseTicks = [];
  for (const mode of modes) {
    const s = new Simulation(seeded(), mode); s.start(); s.protection = 0; s.random = () => .5;
    s.food = [{ x: 1400, y: 800, kind: 'apple' }];
    const e = makeSnake(950, 800, 0, 3, 'test', CONFIG.enemyColors[0]); s.enemies = [e];
    s.updateEnemy(e, .05);
    assert.equal(e.targetAngle, mode === 'hard' ? Math.PI : 0);
    e.x = 900; e.aiWait = 0; e.chaseTime = 0; e.chaseCooldown = 0;
    let ticks = 0;
    while (e.chaseCooldown <= 0 && ticks < 100) { s.updateEnemy(e, .05); ticks++; }
    assert.ok(e.chaseCooldown > 0); chaseTicks.push(ticks);
  }
  assert.ok(chaseTicks[0] < chaseTicks[1] && chaseTicks[1] < chaseTicks[2]);
});
test('respawns have fewer stronger enemies on easier modes and respect level limits', () => {
  const stronger = [];
  for (const mode of modes) {
    const s = new Simulation(seeded(), mode); s.player.level = 10; s.viewport = { width: 200, height: 200 };
    const e = makeSnake(0, 0, 0, 1, 'test', CONFIG.enemyColors[0]);
    let count = 0;
    for (let i = 0; i < 600; i++) {
      e.active = false; s.tryRespawn(e); assert.equal(e.active, true);
      assert.ok(distance(e, s.player) >= 420);
      assert.ok(e.level >= 8 && e.level <= (mode === 'easy' ? 11 : 12));
      if (e.level > s.player.level) count++;
    }
    stronger.push(count);
  }
  assert.ok(stronger[0] < stronger[1] && stronger[1] < stronger[2]);
});
test('switching modes resets the run, preserves flowers, and keeps the mode on restart', () => {
  const s = new Simulation(seeded(), 'hard'); s.start(); s.reward(20, 300, 400, false, { kind: 'apple' });
  s.treasuresCaught = 2; s.pause(); const flowers = s.flowers.length;
  s.reset('easy');
  assert.equal(s.state, 'ready'); assert.equal(s.difficulty, 'easy'); assert.equal(s.enemies.length, 3);
  assert.equal(s.flowers.length, flowers); assert.equal(s.player.level, 1); assert.equal(s.player.xp, 0);
  assert.equal(s.treasuresCaught, 0); assert.equal(s.protection, 8);
  s.start(); s.reset(); assert.equal(s.difficulty, 'easy'); assert.equal(s.protection, 8);
  // Easy mode still has the normal risk from a stronger head after protection ends.
  s.start(); s.protection = 0; s.enemies = [makeSnake(s.player.x, s.player.y, 0, 2, 'test', CONFIG.enemyColors[0])];
  s.resolveCollisions(); assert.equal(s.state, 'over');
});
test('treasure remains catchable and rewards once at every difficulty', () => {
  for (const mode of modes) {
    const s = new Simulation(seeded(), mode); s.start(); s.enemies = []; s.food = s.food.map(f => ({ ...f, x: 45, y: 45 }));
    s.spawnTreasure(); assert.ok(s.treasure);
    for (let i = 0; i < 1200 && s.treasure; i++) {
      s.enemies = [];
      s.step(1 / 60, Math.atan2(s.treasure.y - s.player.y, s.treasure.x - s.player.x));
    }
    assert.equal(s.treasuresCaught, 1); assert.equal(s.events.filter(e => e.type === 'treasure').length, 1);
    assert.equal(s.food.filter(f => f.bonus).length, CONFIG.treasureFruitCount);
  }
});
