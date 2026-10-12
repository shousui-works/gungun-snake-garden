import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../dist/game/renderer.js';
import { makeSnake } from '../dist/game/simulation.js';
import { CONFIG } from '../dist/game/config.js';

function scene(body) {
  const text = [];
  const ctx = new Proxy({ fillText: (value, x, y) => text.push({ value, x, y }) }, {
    get: (target, key) => key in target ? target[key] : () => {},
  });
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, { ctx, width: 240, height: 200, scale: 1, clock: 0, camera: { x: 120, y: 100 }, simulation: { player: { level: 1 }, protection: 0, state: 'playing' } });
  const enemy = makeSnake(700, 100, 0, 3, 'test', CONFIG.enemyColors[0]);
  enemy.body = [{ x: 700, y: 100 }, ...body];
  return { renderer, enemy, text };
}

test('every visible body fragment shows its current relation while the head is off screen', () => {
  const { renderer, enemy, text } = scene([
    { x: 500, y: 100 }, { x: 110, y: 80 }, { x: 130, y: 80 },
    { x: 260, y: 100 }, { x: 180, y: 120 }, { x: 260, y: 130 },
    { x: 60, y: 110 }, { x: 65, y: 110 }, { x: 300, y: 130 },
  ]);
  assert.equal(renderer.visible(enemy.x, enemy.y), false);
  for (const [level, symbol] of [[1, '!'], [3, '＝'], [4, '○']]) {
    renderer.simulation.player.level = level; text.length = 0;
    renderer.drawSnake(enemy, false);
    assert.ok(text.length >= 3); assert.ok(text.every(item => item.value === symbol));
    for (const [left, right] of [[90, 150], [160, 200], [45, 85]]) assert.ok(text.some(item => item.x >= left && item.x <= right));
  }
});
test('a short tail at the edge gets a readable mark, and player and treasure bodies are excluded', () => {
  const { renderer, enemy, text } = scene([{ x: 500, y: 100 }, { x: 237, y: 50 }]);
  renderer.drawSnake(enemy, false);
  assert.equal(text.length, 1); assert.equal(text[0].value, '!');
  assert.ok(text[0].x > 220 && text[0].x <= renderer.width - 7);
  text.length = 0; renderer.drawSnake(enemy, true); assert.equal(text.length, 0);
  enemy.treasure = true; renderer.drawSnake(enemy, false); assert.equal(text.length, 0);
});
