import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../dist/game/config.js';
import { distance } from '../dist/game/rules.js';
import { Simulation, makeSnake } from '../dist/game/simulation.js';
import { GameAudio } from '../dist/game/audio.js';

function seeded() { let n = 73; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
function isolated() {
  const s = new Simulation(seeded()); s.enemies = []; s.start();
  s.food = s.food.map(f => ({ ...f, x: 45, y: 45 })); return s;
}
function treasureAt(s, x = s.player.x, y = s.player.y) {
  const t = makeSnake(x, y, 0, 1, 'treasure', ['#f0cf65', '#b98937']);
  t.treasure = true; t.radius = 10.5; t.life = CONFIG.treasureLifetime; t.body.length = 5;
  s.treasure = t; return t;
}

test('treasure appears nearby after the opening and retries unsafe spawn locations', () => {
  const s = isolated(); s.time = CONFIG.treasureFirstSeconds - .1;
  s.updateTreasure(0); assert.equal(s.treasure, null);
  s.time = CONFIG.treasureFirstSeconds; s.updateTreasure(0);
  assert.ok(s.treasure); assert.ok(distance(s.treasure, s.player) >= 75); assert.ok(distance(s.treasure, s.player) < 175);
  assert.equal(s.events.filter(e => e.type === 'treasure-appear').length, 1);
  const blocked = isolated(); blocked.enemies = [makeSnake(800, 670, 0, 5, 'guard', CONFIG.enemyColors[0])];
  blocked.random = () => .5; blocked.time = CONFIG.treasureFirstSeconds; blocked.updateTreasure(0);
  assert.equal(blocked.treasure, null); assert.equal(blocked.treasureNextAt, blocked.time + 2);
});
test('treasure flees the approaching player, stays catchable and is harmless at level one', () => {
  const s = isolated(), t = treasureAt(s, s.player.x + 110, s.player.y); t.body = [{ x: t.x, y: t.y }];
  s.updateTreasure(.05);
  assert.ok(t.x > s.player.x + 110); assert.ok(CONFIG.treasureSpeed < CONFIG.playerSpeed);
  assert.equal(s.state, 'playing'); assert.equal(s.player.level, 1);
  t.x = s.player.x; t.y = s.player.y; t.body = [{ x: t.x, y: t.y }];
  s.updateTreasure(0); assert.equal(s.treasuresCaught, 1); assert.equal(s.state, 'playing');
});
test('body contact catches treasure once and scatters real fruit without an instant XP award', () => {
  const s = isolated(), t = treasureAt(s, s.player.x + 60); t.body[2] = { x: s.player.x, y: s.player.y };
  s.updateTreasure(0); s.catchTreasure(); s.updateTreasure(0);
  assert.equal(s.treasuresCaught, 1); assert.equal(s.treasure, null);
  assert.equal(s.events.filter(e => e.type === 'treasure').length, 1);
  assert.equal(s.player.xp, 0); assert.equal(s.foodEaten, 0); assert.equal(s.enemiesEaten, 0);
  const bonus = s.food.filter(f => f.bonus);
  assert.equal(bonus.length, CONFIG.treasureFruitCount); assert.ok(bonus.some(f => f.large));
  assert.deepEqual([...new Set(bonus.map(f => f.kind))].sort(), ['apple', 'banana', 'grapes']);
  assert.ok(bonus.every(f => f.flight > 0)); assert.equal(s.flowers[0].kind, 'gold');
});
test('bonus fruit cannot be eaten in flight, lands inside the garden and rewards once', () => {
  const s = isolated(); treasureAt(s); s.catchTreasure();
  s.step(0); assert.equal(s.foodEaten, 0);
  for (let i = 0; i < 12; i++) s.updateBonusFruit(.05);
  const bonus = s.food.filter(f => f.bonus);
  assert.ok(bonus.every(f => f.flight === 0 && f.x >= 35 && f.x <= 1565 && f.y >= 35 && f.y <= 1565));
  const f = bonus[0]; s.player.x = f.x; s.player.y = f.y;
  s.step(0); s.step(0);
  assert.equal(s.foodEaten, 1); assert.equal(s.player.xp, 3);
  assert.equal(s.food.filter(f => f.bonus).length, CONFIG.treasureFruitCount - 1);
  assert.equal(s.food.filter(f => !f.bonus).length, CONFIG.foodCount);
});
test('enemies leave bonus fruit for the player and expired loot does not replenish', () => {
  const s = isolated(); treasureAt(s, 1300, 1300); s.catchTreasure();
  s.updateBonusFruit(CONFIG.fruitFlightSeconds);
  const f = s.food.find(f => f.bonus), e = makeSnake(f.x, f.y, 0, 1, 'test', CONFIG.enemyColors[0]);
  s.enemies = [e]; s.step(0);
  assert.equal(e.xp, 0); assert.ok(s.food.includes(f));
  s.updateBonusFruit(CONFIG.bonusFruitLifetime + .1);
  assert.equal(s.food.length, CONFIG.foodCount);
});
test('missed treasure leaves peacefully, and later treasure never duplicates active snakes', () => {
  const s = isolated(), t = treasureAt(s, 1300, 1300); t.life = .01;
  s.updateTreasure(.05); assert.equal(s.treasure, null); assert.equal(s.state, 'playing'); assert.equal(s.treasuresCaught, 0);
  assert.ok(s.treasureNextAt > s.time);
  s.time = s.treasureNextAt; s.updateTreasure(0); const next = s.treasure;
  assert.ok(next); s.updateTreasure(0); assert.equal(s.treasure, next);
});
test('flowers bloom where the player eats, while enemy meals leave the garden unchanged', () => {
  const s = isolated(); s.food[0] = { x: 800, y: 800, kind: 'grapes', phase: 0, large: false };
  s.step(0); assert.equal(s.flowers.length, 1); assert.equal(s.flowers[0].kind, 'grapes');
  assert.equal(s.flowers[0].x, 800); assert.equal(s.flowers[0].y, 800); assert.ok(s.flowers[0].bloomTimer > 0);
  const e = makeSnake(1300, 1300, 0, 1, 'test', CONFIG.enemyColors[0]); s.enemies = [e];
  s.food[0] = { x: 1300, y: 1300, kind: 'apple', phase: 0, large: false }; s.step(0);
  assert.equal(e.xp, 1); assert.equal(s.flowers.length, 1);
  s.bloom(801, 800, 'banana'); assert.equal(s.flowers.length, 1);
});
test('pause freezes treasure, flying fruit and blooms; restart keeps the garden and clears rewards', () => {
  const s = isolated(); treasureAt(s, 1300, 1300); s.catchTreasure(); s.spawnTreasure(); s.bloom(200, 300, 'apple');
  s.pause(); const before = JSON.stringify(s); s.step(.05, 0); assert.equal(JSON.stringify(s), before);
  const flowers = s.flowers.length; s.reset();
  assert.equal(s.flowers.length, flowers); assert.ok(s.flowers.every(f => f.bloomTimer === 0));
  assert.equal(s.treasure, null); assert.equal(s.treasuresCaught, 0); assert.equal(s.flowersPlanted, 0);
  assert.equal(s.food.length, CONFIG.foodCount); assert.equal(s.treasureNextAt, CONFIG.treasureFirstSeconds);
});
test('garden save restores flowers with safe bounds, ignores damaged entries and limits growth', () => {
  const s = isolated(); s.bloom(300, 400, 'grapes'); s.bloom(600, 700, 'gold');
  const saved = JSON.parse(JSON.stringify(s.flowers)), restored = new Simulation(seeded());
  restored.restoreGarden([...saved, null, { x: -1, y: 2, kind: 'apple' }, { x: 100, y: 100, kind: 'unknown' }, { x: 300, y: 400, kind: 'apple' }]);
  assert.equal(restored.flowers.length, 2); assert.deepEqual(restored.flowers.map(f => [f.x, f.y, f.kind]), [[300, 400, 'grapes'], [600, 700, 'gold']]);
  restored.restoreGarden('bad'); assert.equal(restored.flowers.length, 2);
  for (let i = 0; i < 1000; i++) restored.bloom(25 + (i % 50) * 30, 25 + Math.floor(i / 50) * 30, 'apple');
  assert.equal(restored.flowers.length, CONFIG.maxFlowers);
});
test('repeated captures keep loot and effects bounded, including at the world edge', () => {
  const s = isolated();
  for (let i = 0; i < 20; i++) { treasureAt(s, 20, 1580); s.catchTreasure(); }
  assert.ok(s.food.filter(f => f.bonus).length <= CONFIG.maxBonusFruit);
  assert.equal(s.food.filter(f => !f.bonus).length, CONFIG.foodCount);
  assert.ok(s.food.filter(f => f.bonus).every(f => f.landingX >= 35 && f.landingY <= 1565));
  assert.ok(s.particles.length <= 220);
  s.step(0); assert.ok(s.popups.length <= CONFIG.maxPopups);
});
test('treasure sound celebrates captures and respects mute', () => {
  const audio = new GameAudio(true), notes = []; audio.note = (...args) => notes.push(args);
  audio.play('treasure'); assert.equal(notes.length, 4); assert.ok(notes.at(-1)[0] > notes[0][0]);
  const muted = new GameAudio(false); let created = 0;
  muted.context = { state: 'running', createOscillator: () => { created++; throw Error('Must not be called'); } };
  muted.play('treasure-appear'); muted.play('treasure'); assert.equal(created, 0);
});
