import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, makeSnake, updateBody } from '../dist/game/simulation.js';
import { addExperience, experienceNeeded, relation, radiusFor, segmentCount, distance } from '../dist/game/rules.js';
import { CONFIG } from '../dist/game/config.js';
function seeded() { let n = 17; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
function isolated() { const s = new Simulation(seeded()); s.enemies = []; s.start(); return s; }
function enemyAt(s, level, x = s.player.x, y = s.player.y) {
  return makeSnake(x, y, 0, level, 'test', CONFIG.enemyColors[0]);
}
test('XP carries over through multiple level increases', () => {
  assert.equal(experienceNeeded(1), 5);
  assert.deepEqual(addExperience(1, 4, 20), { level: 4, xp: 3, gained: 3 });
  assert.deepEqual(addExperience(2, 6, 1), { level: 3, xp: 0, gained: 1 });
  assert.equal(relation(3, 3), 'equal'); assert.equal(relation(4, 3), 'edible'); assert.equal(relation(2, 3), 'danger');
});
test('a consumed enemy rewards only once, including body contact', () => {
  const s = isolated(); s.player.level = 3; s.player.radius = radiusFor(3);
  const e = enemyAt(s, 1, s.player.x + 70); e.body[3] = { x: s.player.x, y: s.player.y }; s.enemies = [e];
  s.resolveCollisions(); s.resolveCollisions();
  assert.equal(s.player.xp, 3); assert.equal(s.enemiesEaten, 1); assert.equal(e.active, false); assert.equal(e.respawn, s.settings.respawnSeconds);
});
test('equal level collisions are harmless and cannot reward', () => {
  const s = isolated(); s.protection = 0; s.enemies = [enemyAt(s, 1)]; s.resolveCollisions();
  assert.equal(s.state, 'playing'); assert.equal(s.enemiesEaten, 0); assert.equal(s.player.xp, 0);
});
test('initial protection prevents a stronger head from ending the game', () => {
  const s = isolated(); const e = enemyAt(s, 2); s.enemies = [e]; s.resolveCollisions();
  assert.equal(s.state, 'playing'); s.protection = 0; e.x = s.player.x; e.y = s.player.y; s.resolveCollisions();
  s.resolveCollisions(); assert.equal(s.state, 'over'); assert.equal(s.events.filter(e => e.type === 'over').length, 1);
});
test('only a stronger head can eat the player; its body is harmless', () => {
  const s = isolated(); s.protection = 0; const e = enemyAt(s, 3, s.player.x + 200); e.body[2] = { x: s.player.x, y: s.player.y }; s.enemies = [e];
  s.resolveCollisions(); assert.equal(s.state, 'playing');
  e.x = s.player.body[4].x; e.y = s.player.body[4].y;
  s.resolveCollisions(); assert.equal(s.state, 'over');
});
test('food maintains its population and is not rewarded twice', () => {
  const s = isolated(); s.food[0] = { x: s.player.x, y: s.player.y, phase: 0, kind: 'apple', large: false };
  s.step(0); assert.equal(s.foodEaten, 1); assert.equal(s.player.xp, 1); assert.equal(s.food.length, 80);
  s.step(0); assert.equal(s.foodEaten, 1); assert.equal(s.player.xp, 1);
});
test('pause freezes position, protection, XP, effects, and respawn', () => {
  const s = isolated(); const e = enemyAt(s, 1, 1300, 1300); e.active = false; e.respawn = 3; s.enemies = [e];
  s.burst(800, 800, 1, '#fff'); s.pause(); const before = JSON.stringify(s);
  s.step(.05, 0); assert.equal(JSON.stringify(s), before);
  s.resume(); s.step(.05, 0); assert.equal(s.state, 'playing'); assert.ok(s.time > 0); assert.ok(e.respawn < 3);
});
test('restart restores every gameplay counter and initial protection', () => {
  const s = isolated(); s.player.level = 9; s.player.xp = 10; s.foodEaten = 15; s.enemiesEaten = 3; s.protection = 0; s.state = 'over'; s.burst(0, 0, 3, '#fff'); s.reset(); s.start();
  assert.equal(s.player.level, 1); assert.equal(s.player.xp, 0); assert.equal(s.foodEaten, 0); assert.equal(s.enemiesEaten, 0);
  assert.equal(s.protection, s.settings.protectionSeconds); assert.equal(s.enemies.length, s.settings.enemyCount); assert.equal(s.food.length, 80); assert.equal(s.particles.length, 0);
});
test('turns are gradual, edges are safe, and long frame deltas are capped', () => {
  const s = isolated(); const before = s.player.angle; s.step(20, Math.PI / 2);
  assert.ok(Math.abs(s.player.angle - before) <= CONFIG.playerTurnSpeed * .05 + .00001); assert.equal(s.time, .05);
  s.player.x = 1585; s.player.y = 800; s.player.angle = 0;
  // Keep spawned enemies out of this check of wall movement.
  for (let i = 0; i < 250; i++) { s.enemies = []; s.step(.05, 0); }
  assert.equal(s.state, 'playing'); assert.equal(s.player.x, 1600 - s.player.radius);
  assert.equal(s.player.angle, 0); assert.equal(s.player.targetAngle, 0);
});
test('a tap toward any wall or corner keeps its heading after release, without bouncing or crossing the boundary', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) for (const level of [1, 100]) {
    const r = radiusFor(level), end = CONFIG.worldSize - r;
    for (const [x, y, angle, finalX, finalY] of [
      [end - 5, 800, 0, end, 800], [r + 5, 800, Math.PI, r, 800],
      [800, r + 5, -Math.PI / 2, 800, r], [800, end - 5, Math.PI / 2, 800, end],
      [end - 2, end - 2, Math.PI / 4, end, end], [r + 2, end - 2, Math.PI * .75, r, end],
      [r + 2, r + 2, -Math.PI * .75, r, r], [end - 2, r + 2, -Math.PI / 4, end, r],
    ]) {
      const s = new Simulation(seeded(), difficulty); s.start(); s.food = []; s.treasureNextAt = Infinity;
      s.player = makeSnake(x, y, angle, level, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
      for (let i = 0; i < 60; i++) { s.enemies = []; s.step(.05, i === 0 ? angle : null); }
      assert.equal(s.state, 'playing'); assert.equal(s.player.targetAngle, angle); assert.equal(s.player.angle, angle);
      assert.ok(Math.abs(s.player.x - finalX) < 1e-8); assert.ok(Math.abs(s.player.y - finalY) < 1e-8);
      assert.ok(s.player.path.length < 600);
    }
  }
});
test('diagonal input slides along each wall, and a new tap can turn away from it', () => {
  const r = radiusFor(1), end = CONFIG.worldSize - r;
  for (const [x, y, angle, axis, tangent] of [
    [end, 800, Math.PI / 4, 'x', 'y'], [r, 800, Math.PI * .75, 'x', 'y'],
    [800, r, -Math.PI / 4, 'y', 'x'], [800, end, Math.PI / 4, 'y', 'x'],
  ]) {
    const s = isolated(); s.food = []; s.treasureNextAt = Infinity;
    s.player = makeSnake(x, y, angle, 1, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
    for (let i = 0; i < 10; i++) { s.enemies = []; s.step(.05, i === 0 ? angle : null); }
    assert.equal(s.player[axis], axis === 'x' ? x : y); assert.equal(s.player.targetAngle, angle);
    const expected = (tangent === 'x' ? x : y) + s.settings.speed * .5 * Math.SQRT1_2;
    assert.ok(Math.abs(s.player[tangent] - expected) < 1e-8);
    const inward = Math.atan2(800 - s.player.y, 800 - s.player.x);
    for (let i = 0; i < 30; i++) { s.enemies = []; s.step(.05, i === 0 ? inward : null); }
    assert.equal(s.player.targetAngle, inward);
    assert.ok(s.player.x > r + 10 && s.player.x < end - 10 && s.player.y > r + 10 && s.player.y < end - 10);
  }
});
test('computer-controlled snakes still steer away from the wall', () => {
  const s = isolated(); s.food = []; s.treasureNextAt = Infinity;
  const enemy = makeSnake(1580, 800, 0, 1, 'test', CONFIG.enemyColors[0]); enemy.aiWait = 100; s.enemies = [enemy];
  const treasure = makeSnake(800, 20, -Math.PI / 2, 1, 'treasure', ['#f0cf65', '#b98937']);
  Object.assign(treasure, { treasure: true, life: 20, aiWait: 100 }); s.treasure = treasure;
  s.step(.05);
  assert.equal(enemy.targetAngle, Math.PI); assert.ok(Math.abs(treasure.targetAngle - Math.PI / 2) < 1e-8);
});
test('movement is equally fast for the player and ordinary enemies at every level', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const travelled = [];
    for (const level of [1, 5, 12, 50, 100]) {
      const s = new Simulation(seeded(), difficulty); s.start(); s.food = [];
      s.player = makeSnake(300, 500, 0, level, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
      const e = makeSnake(300, 1100, 0, level, 'test', CONFIG.enemyColors[0]); e.aiWait = 100; s.enemies = [e];
      const playerStart = { x: s.player.x, y: s.player.y }, enemyStart = { x: e.x, y: e.y };
      for (let i = 0; i < 10; i++) s.step(.05, 0);
      const playerDistance = distance(s.player, playerStart), enemyDistance = distance(e, enemyStart);
      assert.ok(Math.abs(playerDistance - s.settings.speed * .5) < .001);
      assert.ok(Math.abs(playerDistance - enemyDistance) < .001);
      travelled.push(playerDistance);
    }
    assert.ok(travelled.every(value => value === travelled[0]));
  }
});
test('body spacing is based on distance and history stays bounded at high frame rates', () => {
  const s = isolated(); s.food = s.food.map(f => ({ ...f, x: 20, y: 20 }));
  s.player.level = 50; s.player.radius = radiusFor(50); updateBody(s.player);
  for (let i = 0; i < 20000; i++) s.step(.001, Math.atan2(Math.sin(i / 1400), Math.cos(i / 1400)));
  assert.equal(s.player.body.length, segmentCount(50)); assert.equal(s.player.body.length, 40);
  assert.ok(s.player.path.length < 600, `history: ${s.player.path.length}`);
  assert.ok(distance(s.player.body[0], s.player.body[1]) < s.player.radius * 1.4);
});
test('respawn stays away from the player and outside the entire viewport', () => {
  const s = isolated(), e = enemyAt(s, 1); e.active = false; s.enemies = [e];
  for (let i = 0; i < 5 && !e.active; i++) s.tryRespawn(e);
  assert.equal(e.active, true); assert.ok(distance(e, s.player) >= 420);
  const hw = s.viewport.width / 2 + 80, hh = s.viewport.height / 2 + 80;
  assert.ok(e.body.every(pt => Math.abs(pt.x - s.player.x) >= hw || Math.abs(pt.y - s.player.y) >= hh));
});
test('five minute maximum population run keeps entities and effects bounded', () => {
  const s = new Simulation(seeded(), 'hard'); s.start(); s.player.level = 100; s.player.radius = radiusFor(100); updateBody(s.player); s.protection = 1000;
  for (let i = 0; i < 18000; i++) {
    s.step(1 / 60, i / 200); s.events.length = 0;
  }
  assert.equal(s.enemies.length, 6); assert.equal(s.food.filter(f => !f.bonus).length, 80); assert.ok(s.food.length <= CONFIG.foodCount + CONFIG.maxBonusFruit); assert.ok(s.particles.length <= 220);
  assert.ok(s.flowers.length <= CONFIG.maxFlowers);
  for (const snake of [s.player, ...s.enemies, ...(s.treasure ? [s.treasure] : [])]) { assert.ok(snake.path.length < 900); assert.ok(snake.body.length <= 40); assert.ok(Number.isFinite(snake.x + snake.y)); }
});
