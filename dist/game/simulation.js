import { CONFIG } from './config.js';
import { addExperience, relation, radiusFor, segmentCount, distance, angleDifference, clamp } from './rules.js';

export function makeSnake(x, y, angle, level, id, colors) {
  const snake = { id, x, y, angle, targetAngle: angle, level, xp: 0, radius: radiusFor(level), colors, active: true, path: [], body: [], aiWait: 0, chaseTime: 0, chaseCooldown: 0, respawn: 0, bumpCooldown: 0 };
  for (let d = 0; d <= 1400; d += 4) snake.path.push({ x: clamp(x - Math.cos(angle) * d, snake.radius, CONFIG.worldSize - snake.radius), y: clamp(y - Math.sin(angle) * d, snake.radius, CONFIG.worldSize - snake.radius) });
  updateBody(snake);
  return snake;
}
export function updateBody(snake) {
  const gap = snake.radius * 1.32, count = segmentCount(snake.level);
  const result = [{ x: snake.x, y: snake.y }];
  let passed = 0, index = 1;
  for (let i = 1; i < snake.path.length; i++) {
    const a = snake.path[i - 1], b = snake.path[i], length = distance(a, b);
    while (index < count && index * gap <= passed + length) {
      const t = length ? (index * gap - passed) / length : 0;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); index++;
    }
    passed += length;
    if (passed > gap * (count + 2) + 30) { snake.path.length = i + 1; break; }
  }
  while (result.length < count) result.push({ ...(result.at(-1)) });
  snake.body = result;
}
function moveSnake(s, dt, speed) {
  const margin = 85, size = CONFIG.worldSize;
  if (s.x < margin || s.x > size - margin || s.y < margin || s.y > size - margin) {
    const vx = Math.cos(s.targetAngle), vy = Math.sin(s.targetAngle);
    const inwardX = s.x < margin ? 2.5 : s.x > size - margin ? -2.5 : 0;
    const inwardY = s.y < margin ? 2.5 : s.y > size - margin ? -2.5 : 0;
    s.targetAngle = Math.atan2(vy + inwardY, vx + inwardX);
  }
  s.angle += clamp(angleDifference(s.angle, s.targetAngle), -CONFIG.turnSpeed * dt, CONFIG.turnSpeed * dt);
  s.x = clamp(s.x + Math.cos(s.angle) * speed * dt, s.radius, size - s.radius);
  s.y = clamp(s.y + Math.sin(s.angle) * speed * dt, s.radius, size - s.radius);
  const point = { x: s.x, y: s.y };
  if (s.path.length > 1 && distance(s, s.path[1]) < 3) s.path[0] = point;
  else s.path.unshift(point);
  updateBody(s);
}
const touching = (head, body, radius) => body.some(point => distance(head, point) < radius);

export class Simulation {
  constructor(random = Math.random) { this.random = random; this.viewport = { width: 800, height: 500 }; this.reset(); }
  reset() {
    this.state = 'ready'; this.time = 0; this.protection = CONFIG.protectionSeconds; this.foodEaten = 0; this.enemiesEaten = 0; this.events = []; this.particles = []; this.popups = [];
    this.player = makeSnake(800, 800, -Math.PI / 2, 1, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
    this.food = [];
    for (let i = 0; i < 7; i++) this.food.push({ x: 800 + Math.sin(i * .7) * 8, y: 754 - i * 43, phase: this.random() * 6, color: i % 3 });
    while (this.food.length < CONFIG.foodCount) this.food.push(this.newFood());
    this.enemies = [ [1120, 490], [480, 1150], [1220, 1140], [440, 420] ].map(([x, y], i) => makeSnake(x, y, this.random() * Math.PI * 2, [1, 1, 2, 3][i], `enemy${i}`, CONFIG.enemyColors[i]));
  }
  start() { this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  newFood() {
    let x, y;
    for (let tries = 0; tries < 20; tries++) {
      x = 45 + this.random() * (CONFIG.worldSize - 90); y = 45 + this.random() * (CONFIG.worldSize - 90);
      if (distance({ x, y }, this.player) > 90) break;
    }
    return { x, y, phase: this.random() * Math.PI * 2, color: Math.floor(this.random() * 3) };
  }
  reward(amount, x, y, enemy = false) {
    const p = this.player, next = addExperience(p.level, p.xp, amount);
    p.level = next.level; p.xp = next.xp; p.radius = radiusFor(p.level);
    this.events.push({ type: next.gained ? 'level' : enemy ? 'enemy' : 'eat', level: p.level });
    this.burst(x, y, next.gained ? 24 : enemy ? 18 : 8, next.gained ? '#b293eb' : '#f2ca5b');
    if (next.gained) this.popups.push({ text: `レベル ${p.level}！`, x: p.x, y: p.y - 54, life: 1.7, maxLife: 1.7, large: true });
    else if (enemy) this.popups.push({ text: `+${amount}`, x, y: y - 40, life: 1, maxLife: 1 });
    updateBody(p);
  }
  burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2, speed = 30 + this.random() * 85;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .7, maxLife: .7, radius: 2 + this.random() * 3, color });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }
  updateEnemy(e, dt) {
    e.aiWait -= dt; e.chaseCooldown = Math.max(0, e.chaseCooldown - dt);
    if (e.aiWait > 0) return;
    e.aiWait = .35 + this.random() * .25;
    const stronger = [this.player, ...this.enemies].filter(s => s !== e && s.active && s.level > e.level && distance(s, e) < 200).sort((a, b) => distance(a, e) - distance(b, e))[0];
    if (stronger) { e.targetAngle = Math.atan2(e.y - stronger.y, e.x - stronger.x); e.chaseTime = 0; return; }
    if (e.level > this.player.level && this.protection <= 0 && distance(e, this.player) < 175 && e.chaseCooldown <= 0) {
      e.chaseTime += e.aiWait;
      e.targetAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      if (e.chaseTime > 2) { e.chaseCooldown = 5; e.chaseTime = 0; }
      return;
    }
    e.chaseTime = 0;
    const nearest = this.food.reduce((best, f) => distance(e, f) < distance(e, best) ? f : best, this.food[0]);
    e.targetAngle = Math.atan2(nearest.y - e.y, nearest.x - e.x) + (this.random() - .5) * .4;
  }
  tryRespawn(e) {
    const p = this.player, halfW = this.viewport.width / 2 + 80, halfH = this.viewport.height / 2 + 80;
    for (let i = 0; i < 35; i++) {
      const x = 130 + this.random() * 1340, y = 130 + this.random() * 1340;
      if (distance({ x, y }, p) < 420 || (Math.abs(x - p.x) < halfW && Math.abs(y - p.y) < halfH)) continue;
      const offset = this.random() < .65 ? -(1 + Math.floor(this.random() * 2)) : 1 + Math.floor(this.random() * 2);
      const angle = Math.atan2(800 - y, 800 - x);
      const fresh = makeSnake(x, y, angle, Math.max(1, p.level + offset), e.id, e.colors);
      // Keep the full new body outside the viewport, not just its head.
      if (fresh.body.some(pt => Math.abs(pt.x - p.x) < halfW && Math.abs(pt.y - p.y) < halfH)) continue;
      Object.assign(e, fresh); return;
    }
    e.respawn = .5;
  }
  resolveCollisions() {
    if (this.state !== 'playing') return;
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const mode = relation(p.level, e.level), radius = p.radius + e.radius - 2;
      if (mode === 'edible' && touching(p, e.body, radius)) {
        e.active = false; e.respawn = CONFIG.respawnSeconds; this.enemiesEaten++;
        this.reward(e.level * 3, e.x, e.y, true); continue;
      }
      if (mode === 'danger' && this.protection <= 0 && touching(e, p.body, radius)) {
        this.state = 'over'; this.events.push({ type: 'over' }); return;
      }
      if (mode !== 'edible' && p.bumpCooldown <= 0 && touching(p, e.body, radius)) {
        const away = Math.atan2(p.y - e.y, p.x - e.x);
        p.x = clamp(p.x + Math.cos(away) * 12, p.radius, CONFIG.worldSize - p.radius);
        p.y = clamp(p.y + Math.sin(away) * 12, p.radius, CONFIG.worldSize - p.radius);
        p.targetAngle = away; p.bumpCooldown = .45;
        p.path.unshift({ x: p.x, y: p.y }); updateBody(p);
      }
    }
  }
  step(delta, inputAngle = null) {
    if (this.state !== 'playing') return;
    const dt = clamp(delta, 0, .05); this.time += dt; this.protection = Math.max(0, this.protection - dt);
    const p = this.player; p.bumpCooldown = Math.max(0, p.bumpCooldown - dt);
    if (inputAngle !== null) p.targetAngle = inputAngle;
    moveSnake(p, dt, CONFIG.playerSpeed);
    for (const e of this.enemies) {
      if (!e.active) { e.respawn -= dt; if (e.respawn <= 0) this.tryRespawn(e); continue; }
      this.updateEnemy(e, dt); moveSnake(e, dt, CONFIG.enemySpeed);
    }
    this.resolveCollisions();
    if (this.state !== 'playing') return;
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      if (distance(p, f) < p.radius + 9) { this.foodEaten++; this.food[i] = this.newFood(); this.reward(1, f.x, f.y); }
      else for (const e of this.enemies) {
        if (e.active && distance(e, f) < e.radius + 7) {
          this.food[i] = this.newFood(); const next = addExperience(e.level, e.xp, 1);
          e.level = next.level; e.xp = next.xp; e.radius = radiusFor(e.level); break;
        }
      }
    }
    for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const popup of this.popups) { popup.y -= dt * 15; popup.life -= dt; }
    this.popups = this.popups.filter(pt => pt.life > 0);
    const wanted = Math.min(CONFIG.maxEnemies, CONFIG.enemyCount + Math.floor((p.level - 1) / 5));
    if (this.enemies.length < wanted) {
      const i = this.enemies.length, e = makeSnake(0, 0, 0, 1, `enemy${i}`, CONFIG.enemyColors[i]);
      e.active = false; e.respawn = 1; this.enemies.push(e);
    }
  }
}
