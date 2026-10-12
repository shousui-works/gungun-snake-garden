import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, FRUIT_KINDS } from '../dist/game/config.js';
import { fruitRadius, fruitExperience, appearanceFor, nextAppearance, unlockedAppearances, eatPitch } from '../dist/game/rules.js';
import { Simulation } from '../dist/game/simulation.js';
import { GameAudio } from '../dist/game/audio.js';
function seeded() { let n = 21; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
function isolated() {
  const s = new Simulation(seeded()); s.enemies = []; s.start();
  s.food = s.food.map(f => ({ ...f, x: 45, y: 45 })); return s;
}
const apple = { kind: 'apple', large: false };

test('all three fruits and both fruit sizes can appear without changing the population', () => {
  const s = isolated(), samples = Array.from({ length: 500 }, () => s.newFood());
  assert.deepEqual([...new Set(samples.map(f => f.kind))].sort(), [...FRUIT_KINDS].sort());
  assert.ok(samples.some(f => f.large)); assert.ok(samples.some(f => !f.large));
  assert.equal(s.food.length, CONFIG.foodCount);
  for (const f of samples) { assert.ok(f.x >= 45 && f.x <= 1555); assert.ok(f.y >= 45 && f.y <= 1555); }
});
test('large fruit has a larger collision radius and rewards three XP exactly once', () => {
  const s = isolated();
  assert.equal(fruitExperience(apple), 1); assert.equal(fruitExperience({ ...apple, large: true }), 3);
  assert.equal(fruitRadius({ ...apple, large: true }), fruitRadius(apple) * CONFIG.bigFruitScale);
  s.food[0] = { ...apple, x: s.player.x + 27, y: s.player.y, phase: 0 };
  s.step(0); assert.equal(s.foodEaten, 0);
  s.food[0].large = true; s.step(0); s.step(0);
  assert.equal(s.foodEaten, 1); assert.equal(s.player.xp, 3); assert.equal(s.food.length, 80);
  assert.equal(s.events.filter(e => e.type === 'eat').length, 1);
});
test('a bite that levels up retains both the bite feedback and the level event', () => {
  const s = isolated(); s.player.xp = 4;
  s.food[0] = { ...apple, large: true, x: s.player.x, y: s.player.y, phase: 0 }; s.step(0);
  assert.equal(s.player.level, 2); assert.equal(s.player.xp, 2);
  assert.equal(s.events.filter(e => e.type === 'eat').length, 1);
  assert.equal(s.events.filter(e => e.type === 'level').length, 1);
  assert.ok(s.player.chewTimer > 0); assert.ok(s.player.growthTimer > 0);
});
test('rapid bites raise the melody, stay bounded, and restart after a gap', () => {
  const s = isolated();
  for (let i = 0; i < 20; i++) { s.reward(1, 800, 800, false, apple); s.time += .2; }
  const bites = s.events.filter(e => e.type === 'eat');
  assert.equal(bites[0].combo, 1); assert.equal(bites[6].combo, 7); assert.equal(bites.at(-1).combo, CONFIG.comboCap);
  assert.ok(eatPitch(1) < eatPitch(4)); assert.ok(eatPitch(4) < eatPitch(8)); assert.equal(eatPitch(999), eatPitch(8));
  assert.ok(s.popups.length <= CONFIG.maxPopups); assert.ok(s.particles.length <= 220);
  s.time += CONFIG.comboSeconds + .01; s.reward(1, 800, 800, false, apple);
  assert.equal(s.events.filter(e => e.type === 'eat').at(-1).combo, 1);
});
test('growth milestones have exact boundaries and no further locked style after level eight', () => {
  assert.equal(appearanceFor(2).id, 'plain'); assert.equal(appearanceFor(3).id, 'dots'); assert.equal(appearanceFor(4).id, 'dots');
  assert.equal(appearanceFor(5).id, 'flower'); assert.equal(appearanceFor(7).id, 'flower'); assert.equal(appearanceFor(8).id, 'rainbow');
  assert.equal(appearanceFor(100).id, 'rainbow'); assert.equal(nextAppearance(4).level, 5); assert.equal(nextAppearance(8), null);
  assert.deepEqual(unlockedAppearances(2, 8).map(s => s.id), ['dots', 'flower', 'rainbow']);
});
test('one large XP reward crossing multiple milestones announces the final appearance once', () => {
  const s = isolated(); s.reward(77, 800, 800);
  assert.equal(s.player.level, 8);
  const levels = s.events.filter(e => e.type === 'level'); assert.equal(levels.length, 1);
  assert.equal(levels[0].style.id, 'rainbow'); assert.deepEqual(levels[0].unlocked.map(s => s.id), ['dots', 'flower', 'rainbow']);
  s.events = []; s.reward(1, 800, 800); assert.equal(s.events.filter(e => e.type === 'level').length, 0);
});
test('pause freezes the chewing and combo timers; restart resets cosmetic progress', () => {
  const s = isolated(); s.reward(24, 800, 800, false, apple); s.pause(); const before = JSON.stringify(s);
  s.step(.05); assert.equal(JSON.stringify(s), before);
  s.reset(); assert.equal(s.combo, 0); assert.equal(s.comboUntil, 0); assert.equal(s.player.chewTimer, 0); assert.equal(s.player.growthTimer, 0);
  assert.equal(appearanceFor(s.player.level).id, 'plain'); assert.equal(s.popups.length, 0);
});
test('bite sounds use combo pitch and muted audio never creates oscillators', () => {
  const audio = new GameAudio(true), notes = []; audio.note = (...args) => notes.push(args);
  audio.play('eat', { combo: 1 }); audio.play('eat', { combo: 8, large: true });
  assert.equal(notes[1][0], eatPitch(1)); assert.equal(notes[3][0], eatPitch(8)); assert.equal(notes.length, 5);
  const muted = new GameAudio(false); let created = 0;
  muted.context = { state: 'running', createOscillator: () => { created++; throw new Error('Must not be called'); } };
  muted.play('eat', { combo: 8, large: true }); assert.equal(created, 0);
});
