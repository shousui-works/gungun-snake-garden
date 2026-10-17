import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, DIFFICULTIES } from '../dist/game/config.js';
import { addExperience, experienceNeeded, fruitExperience, radiusFor, treasureExperience, treasureFruitRewards } from '../dist/game/rules.js';
import { Simulation, makeSnake } from '../dist/game/simulation.js';
import { Renderer } from '../dist/game/renderer.js';
import { GameAudio } from '../dist/game/audio.js';

function scene(level = 1, jackpot = false, difficulty = 'normal') {
  const sim = new Simulation(() => .5, difficulty); sim.start(); sim.enemies = [];
  sim.food = sim.food.map(f => ({ ...f, x: 45, y: 45 }));
  sim.player.level = level; sim.player.radius = radiusFor(level);
  sim.spawnTreasure(); sim.treasure.jackpot = jackpot;
  sim.events.length = 0; sim.popups.length = 0;
  return sim;
}
const sum = values => values.reduce((a, b) => a + b, 0);

test('treasure keeps the early reward and scales to half a level, or a full level for jackpots, through level 100', () => {
  assert.deepEqual(treasureFruitRewards(1), [3, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(treasureExperience(50), 52); assert.equal(treasureExperience(50, true), 104);
  assert.equal(treasureExperience(100), 102); assert.equal(treasureExperience(100, true), 204);
  let previous = 0;
  for (let level = 1; level <= 100; level++) {
    const total = treasureExperience(level);
    assert.ok(total >= previous); previous = total;
    for (const jackpot of [false, true]) {
      const rewards = treasureFruitRewards(level, jackpot);
      assert.equal(rewards.length, 8); assert.ok(rewards.every(n => Number.isSafeInteger(n) && n > 0));
      assert.equal(sum(rewards), total * (jackpot ? 2 : 1));
      assert.ok(rewards[0] >= Math.max(...rewards.slice(1)));
    }
    if (level >= 10) assert.ok(total / experienceNeeded(level) >= .5 && total / experienceNeeded(level) < .55);
  }
  assert.equal(fruitExperience({ kind: 'apple', rewardXp: 100 }), 1);
  assert.equal(fruitExperience({ kind: 'apple', large: true, rewardXp: 100 }), 3);
  assert.equal(fruitExperience({ kind: 'apple', bonus: true, rewardXp: 100 }), 100);
});

test('jackpot probability has a precise boundary and does not change movement or capture rules in any difficulty', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (const [roll, jackpot] of [[CONFIG.treasureJackpotChance - .001, true], [CONFIG.treasureJackpotChance, false]]) {
      const sim = scene(1, false, difficulty); sim.treasure = null; sim.random = () => roll; sim.spawnTreasure();
      assert.equal(sim.treasure.jackpot, jackpot);
      assert.equal(sim.events.at(-1).jackpot, jackpot);
    }
    const normal = scene(1, false, difficulty), special = scene(1, true, difficulty);
    normal.updateTreasure(.05); special.updateTreasure(.05);
    assert.equal(special.treasure.x, normal.treasure.x); assert.equal(special.treasure.y, normal.treasure.y);
    assert.equal(special.treasure.radius, normal.treasure.radius);
    special.treasure.body[2] = { x: special.player.x, y: special.player.y };
    special.updateTreasure(0); special.catchTreasure();
    assert.equal(special.state, 'playing'); assert.equal(special.treasuresCaught, 1);
    assert.equal(special.events.filter(e => e.type === 'treasure').length, 1);
  }
});

test('ordinary high-level treasure pays through eight collectible fruit with no instant or duplicate XP', () => {
  const sim = scene(50), before = { level: sim.player.level, xp: sim.player.xp };
  sim.catchTreasure(); sim.catchTreasure();
  assert.equal(sim.player.level, before.level); assert.equal(sim.player.xp, before.xp);
  const bonus = sim.food.filter(f => f.bonus);
  assert.equal(bonus.length, 8); assert.equal(sum(bonus.map(fruitExperience)), 52);
  assert.equal(sim.events.find(e => e.type === 'treasure').rewardXp, 52);
  sim.step(0); assert.equal(sim.foodEaten, 0);
  sim.updateBonusFruit(CONFIG.fruitFlightSeconds);
  for (const fruit of bonus) { sim.player.x = fruit.x; sim.player.y = fruit.y; sim.step(0); }
  const expected = addExperience(50, 0, 52);
  assert.equal(sim.player.level, expected.level); assert.equal(sim.player.xp, expected.xp);
  sim.step(0); assert.equal(sim.foodEaten, 8);
  assert.equal(sim.food.filter(f => f.bonus).length, 0);
  assert.equal(sim.food.length, CONFIG.foodCount);
});

test('jackpot fruit preserves its captured value while collecting it crosses a level boundary', () => {
  const sim = scene(50, true); sim.player.xp = 90;
  sim.catchTreasure(); const bonus = sim.food.filter(f => f.bonus);
  assert.ok(bonus.every(f => f.jackpot)); assert.equal(sum(bonus.map(fruitExperience)), 104);
  assert.equal(sim.player.level, 50); assert.equal(sim.player.xp, 90);
  sim.updateBonusFruit(CONFIG.fruitFlightSeconds);
  for (const fruit of bonus) { sim.player.x = fruit.x; sim.player.y = fruit.y; sim.step(0); }
  const expected = addExperience(50, 90, 104);
  assert.equal(sim.player.level, expected.level); assert.equal(sim.player.xp, expected.xp);
  assert.equal(sim.foodEaten, 8); assert.equal(sim.treasuresCaught, 1);
  assert.ok(sim.popups.some(p => p.bite && p.text.includes('+')));
});

test('limited fruit slots keep the full available reward bounded, and expired jackpot fruit cannot award XP', () => {
  const sim = scene(100, true); sim.catchTreasure(); sim.spawnTreasure(); sim.catchTreasure();
  sim.food.splice(sim.food.length - 3, 3); // Leave three slots in an otherwise full bonus pool.
  sim.spawnTreasure(); sim.treasure.jackpot = true; sim.catchTreasure();
  const added = sim.food.slice(-3);
  assert.equal(sum(added.map(fruitExperience)), 204);
  assert.equal(sim.food.filter(f => f.bonus).length, CONFIG.maxBonusFruit);
  sim.spawnTreasure(); sim.treasure.jackpot = true; sim.catchTreasure();
  assert.equal(sim.events.at(-1).rewardXp, 0);
  assert.equal(sim.food.filter(f => f.bonus).length, CONFIG.maxBonusFruit);
  assert.equal(sim.player.level, 100); assert.equal(sim.player.xp, 0);
  sim.updateBonusFruit(CONFIG.fruitFlightSeconds); sim.updateBonusFruit(CONFIG.bonusFruitLifetime + .1);
  assert.equal(sim.food.length, CONFIG.foodCount); assert.equal(sim.player.xp, 0);
  assert.ok(sim.particles.length <= 220);
});

test('jackpots have distinct snake, fruit and off-screen artwork and readable labels without mutating play state', () => {
  const drawings = [];
  for (const jackpot of [false, true]) {
    const sim = scene(50, jackpot), t = sim.treasure, commands = [], target = {};
    const ctx = new Proxy(target, {
      get(object, key) { return key in object ? object[key] : (...args) => commands.push([key, ...args]); },
      set(object, key, value) { object[key] = value; commands.push([key, value]); return true; },
    });
    const renderer = Object.create(Renderer.prototype);
    Object.assign(renderer, { ctx, width: 240, height: 200, scale: .72, dpr: 1, clock: 0, camera: { x: 800, y: 800 }, simulation: sim });
    const before = JSON.stringify(sim);
    renderer.drawSnake(t, false); renderer.drawLabel(t); renderer.drawTreasureHint({ ...t, x: 1600, y: 1600 });
    renderer.drawFood({ x: 800, y: 800, phase: 0, kind: 'apple', bonus: true, jackpot });
    assert.equal(JSON.stringify(sim), before);
    assert.ok(commands.some(row => row[0] === 'fillText' && row[1] === (jackpot ? '大あたり' : 'おたから')));
    assert.equal(commands.some(row => row[0] === 'fillText' && ['!', '○', '＝'].includes(row[1])), false);
    drawings.push(JSON.stringify(commands));
  }
  assert.notEqual(drawings[0], drawings[1]);
});

test('jackpot appearance and capture have special sounds and still respect mute', () => {
  const audio = new GameAudio(true), notes = []; audio.note = (...args) => notes.push(args);
  audio.play('treasure-appear', { jackpot: true }); assert.equal(notes.length, 3);
  notes.length = 0; audio.play('treasure', { jackpot: true }); assert.equal(notes.length, 5);
  assert.ok(notes.at(-1)[0] > notes[0][0]);
  const muted = new GameAudio(false);
  muted.context = { state: 'running', createOscillator() { throw Error('Muted jackpot must not create audio'); } };
  muted.play('treasure-appear', { jackpot: true }); muted.play('treasure', { jackpot: true });
});
