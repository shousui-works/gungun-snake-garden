import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../dist/game/config.js';
import { Simulation, makeSnake } from '../dist/game/simulation.js';
import { distance } from '../dist/game/rules.js';

function seeded(seed = 271) { let n = seed; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
function scene(mode = 'normal', level = 100) {
  const s = new Simulation(seeded(), mode); s.start(); s.protection = 0;
  s.player = makeSnake(800, 800, 0, level, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
  s.viewport = { width: 300, height: 400, x: 800, y: 800 };
  s.enemies = [[1350, 1350], [250, 1350], [1350, 250], [250, 250]].map(([x, y], i) => {
    const e = makeSnake(x, y, 0, i + 1, `enemy${i}`, CONFIG.enemyColors[i]);
    e.body = [{ x, y }]; return e;
  });
  return s;
}
function hunting(mode, level, gap) {
  const s = scene(mode, level); s.random = () => .5;
  const e = makeSnake(800 + gap, 800, 0, level + 3, 'hunter', CONFIG.enemyColors[0]);
  s.enemies = [e]; s.food = [{ x: e.x + 250, y: 800, kind: 'apple' }];
  return { s, e };
}

test('early runs keep the original enemy behavior, with a later and gentler start on easy', () => {
  for (const [mode, level] of [['easy', 39], ['normal', 19], ['hard', 19]]) {
    const s = scene(mode, level), before = JSON.stringify(s.enemies);
    s.refreshEnemies(); assert.equal(JSON.stringify(s.enemies), before);
    const { s: hunt, e } = hunting(mode, level, s.settings.chaseRange + 2);
    hunt.updateEnemy(e, .05); assert.equal(e.targetAngle, 0);
  }
  const easy = scene('easy', 40); easy.refreshEnemies();
  assert.equal(easy.enemies.filter(e => e.level > easy.player.level).length, 1);
});

test('enemies gradually notice farther away, with bounded range even above level 100', () => {
  for (const [mode, levels, gaps] of [
    ['easy', [40, 70, 100, 200], [128, 136, 145]],
    ['normal', [20, 60, 100, 200], [150, 175, 195]],
    ['hard', [20, 60, 100, 200], [185, 215, 240]],
  ]) {
    const noticed = levels.map(level => gaps.filter(gap => {
      const { s, e } = hunting(mode, level, gap); s.updateEnemy(e, .05);
      return e.targetAngle === Math.PI;
    }).length);
    assert.deepEqual(noticed, [0, 1, 2, 2], mode);
  }
});

test('late chases last a little longer but always give a full cooldown and respect protection', () => {
  const increases = [];
  for (const [mode, start] of [['easy', 40], ['normal', 20], ['hard', 20]]) {
    const durations = [start, 100, 200].map(level => {
      const { s, e } = hunting(mode, level, 90); let elapsed = 0;
      while (e.chaseCooldown <= 0 && elapsed < 10) { s.updateEnemy(e, .01); elapsed += .01; }
      assert.equal(e.chaseCooldown, s.settings.chaseCooldown);
      e.aiWait = 0; s.updateEnemy(e, .05); assert.equal(e.targetAngle, 0);
      e.aiWait = 0; e.chaseCooldown = 0; s.protection = 1;
      s.updateEnemy(e, .05); assert.equal(e.targetAngle, 0);
      return elapsed;
    });
    assert.ok(durations[1] > durations[0], mode); assert.equal(durations[1], durations[2]);
    increases.push(durations[1] - durations[0]);
  }
  assert.ok(increases[0] < increases[1] && increases[1] < increases[2]);
});

test('a visible head or any visible tail segment prevents replacement, even if a threat is missing', () => {
  for (const part of ['head', 'tail']) {
    const s = scene(), e = s.enemies[0]; s.enemies = [e];
    if (part === 'head') { e.x = 800; e.y = 800; } else e.body.push({ x: 800, y: 800 });
    const before = JSON.stringify(e); s.refreshEnemies(); assert.equal(JSON.stringify(e), before, part);
  }
  const s = scene(), e = s.enemies[0]; s.enemies = [e];
  // The player is far from the camera at a wall; that camera's visible enemy must stay.
  s.viewport.x = 1350; s.viewport.y = 1350;
  const before = JSON.stringify(e); s.refreshEnemies(); assert.equal(JSON.stringify(e), before);
});

test('one off-screen enemy is replaced at a time, keeps its identity, and grants no reward', () => {
  const s = scene();
  const before = s.enemies.map(e => JSON.stringify(e));
  const player = JSON.stringify(s.player), flowers = JSON.stringify(s.flowers);
  s.refreshEnemies();
  const changed = s.enemies.filter((e, i) => JSON.stringify(e) !== before[i]);
  assert.equal(changed.length, 1); const fresh = changed[0];
  assert.equal(fresh.id, 'enemy0'); assert.deepEqual(fresh.colors, CONFIG.enemyColors[0]);
  assert.ok(fresh.active && fresh.level > s.player.level);
  assert.ok(distance(fresh, s.player) >= 420);
  const hw = s.viewport.width / 2 + 80, hh = s.viewport.height / 2 + 80;
  assert.ok(fresh.body.every(pt => Math.abs(pt.x - s.viewport.x) >= hw || Math.abs(pt.y - s.viewport.y) >= hh));
  assert.ok(s.player.body.every(pt => distance(fresh, pt) >= fresh.radius + s.player.radius + 180));
  assert.equal(JSON.stringify(s.player), player); assert.equal(JSON.stringify(s.flowers), flowers);
  assert.equal(s.enemiesEaten, 0); assert.equal(s.events.length, 0);
  const after = JSON.stringify(s.enemies); s.time = 7.99; s.refreshEnemies(); assert.equal(JSON.stringify(s.enemies), after);
  s.time = 8; s.random = () => .9; s.refreshEnemies(); assert.notEqual(JSON.stringify(s.enemies), after);
  assert.equal(s.enemies.filter(e => e.level > s.player.level).length, 1, 'with a threat already present, the next replacement stays edible');
});

test('late hard mode keeps two threats while leaving edible enemies, and replenishes after growth', () => {
  const s = scene('hard');
  s.refreshEnemies(); assert.equal(s.enemies.filter(e => e.level > 100).length, 1);
  s.time = 6; s.refreshEnemies(); assert.equal(s.enemies.filter(e => e.level > 100).length, 2);
  assert.equal(s.enemies.filter(e => e.level < 100).length, 2);
  s.player.level += 6; s.time = 12; s.refreshEnemies();
  assert.ok(s.enemies.some(e => e.level > s.player.level));
  for (const e of s.enemies) if (e.level > s.player.level) assert.ok(e.level <= s.player.level + 5);
});

test('lack of a safe spawn keeps the existing snake and retries later without touching the player tail', () => {
  const s = scene(), before = JSON.stringify(s.enemies);
  s.random = () => .5; s.refreshEnemies();
  assert.equal(JSON.stringify(s.enemies), before); assert.ok(s.enemyRefreshAt > s.time);
  s.time = s.enemyRefreshAt; s.random = seeded(55); s.refreshEnemies();
  assert.notEqual(JSON.stringify(s.enemies), before);
  const blocked = scene(), e = blocked.enemies[0]; e.active = false;
  // Every sampled head is off-screen but directly on the player's tail.
  blocked.player.body.push({ x: 1336, y: 1336 }); blocked.random = () => .9;
  assert.equal(blocked.tryRespawn(e), false); assert.equal(e.active, false);
});

test('late replacement runs during play, pauses with the game, and resets for a new run', () => {
  const s = scene(); s.food = []; s.treasureNextAt = Infinity;
  for (const e of s.enemies) e.aiWait = 100;
  const before = JSON.stringify(s.enemies); s.pause(); s.step(.05); assert.equal(JSON.stringify(s.enemies), before);
  s.resume(); s.step(0); assert.ok(s.enemies.some(e => e.level > s.player.level));
  const after = JSON.stringify(s.enemies); s.state = 'over'; s.step(.05); assert.equal(JSON.stringify(s.enemies), after);
  s.reset('easy'); assert.equal(s.enemyRefreshAt, 0); assert.equal(s.player.level, 1);
  assert.ok(s.enemies.every(e => e.level <= 2));
});
