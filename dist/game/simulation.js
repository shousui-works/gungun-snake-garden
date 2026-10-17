import { CONFIG, DIFFICULTIES, FRUIT_KINDS, FRUITS } from './config.js';
import { addExperience, relation, radiusFor, segmentCount, distance, angleDifference, clamp, fruitRadius, fruitExperience, treasureFruitRewards, unlockedAppearances } from './rules.js';

export function makeSnake(x, y, angle, level, id, colors) {
  const snake = { id, x, y, angle, targetAngle: angle, level, xp: 0, radius: radiusFor(level), colors, active: true, path: [], body: [], aiWait: 0, chaseTime: 0, chaseCooldown: 0, respawn: 0, bumpCooldown: 0, chewTimer: 0, growthTimer: 0 };
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
function moveSnake(s, dt, speed, turnSpeed = CONFIG.turnSpeed) {
  const margin = 85, size = CONFIG.worldSize;
  if (s.x < margin || s.x > size - margin || s.y < margin || s.y > size - margin) {
    const vx = Math.cos(s.targetAngle), vy = Math.sin(s.targetAngle);
    const inwardX = s.x < margin ? 2.5 : s.x > size - margin ? -2.5 : 0;
    const inwardY = s.y < margin ? 2.5 : s.y > size - margin ? -2.5 : 0;
    s.targetAngle = Math.atan2(vy + inwardY, vx + inwardX);
  }
  s.angle += clamp(angleDifference(s.angle, s.targetAngle), -turnSpeed * dt, turnSpeed * dt);
  s.x = clamp(s.x + Math.cos(s.angle) * speed * dt, s.radius, size - s.radius);
  s.y = clamp(s.y + Math.sin(s.angle) * speed * dt, s.radius, size - s.radius);
  const point = { x: s.x, y: s.y };
  if (s.path.length > 1 && distance(s, s.path[1]) < 3) s.path[0] = point;
  else s.path.unshift(point);
  updateBody(s);
}
const touching = (head, body, radius) => body.some(point => distance(head, point) < radius);

export class Simulation {
  constructor(random = Math.random, difficulty = 'normal') { this.random = random; this.viewport = { width: 800, height: 500 }; this.reset(difficulty); }
  reset(difficulty = this.difficulty ?? 'normal') {
    this.difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'normal'; this.settings = DIFFICULTIES[this.difficulty];
    this.state = 'ready'; this.time = 0; this.protection = this.settings.protectionSeconds; this.foodEaten = 0; this.enemiesEaten = 0; this.events = []; this.particles = []; this.popups = []; this.combo = 0; this.comboUntil = 0;
    this.flowers ??= []; this.gardenRevision ??= 0;
    for (const flower of this.flowers) flower.bloomTimer = 0;
    this.flowersPlanted = 0; this.treasuresCaught = 0; this.treasure = null; this.treasureNextAt = CONFIG.treasureFirstSeconds;
    this.enemyRefreshAt = 0;
    this.player = makeSnake(800, 800, -Math.PI / 2, 1, 'player', [CONFIG.playerColor, CONFIG.playerDark]);
    this.food = [];
    for (let i = 0; i < 7; i++) this.food.push({ x: 800 + Math.sin(i * .7) * 8, y: 754 - i * 43, phase: this.random() * 6, kind: FRUIT_KINDS[i % 3], large: false });
    while (this.food.length < CONFIG.foodCount) this.food.push(this.newFood());
    this.enemies = [ [1120, 490], [480, 1150], [1220, 1140], [440, 420] ].slice(0, this.settings.enemyCount).map(([x, y], i) => makeSnake(x, y, this.random() * Math.PI * 2, this.settings.enemyLevels[i], `enemy${i}`, CONFIG.enemyColors[i]));
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
    return { x, y, phase: this.random() * Math.PI * 2, kind: FRUIT_KINDS[Math.floor(this.random() * FRUIT_KINDS.length)], large: this.random() < CONFIG.bigFruitChance };
  }
  restoreGarden(saved) {
    if (!Array.isArray(saved)) return;
    const cells = new Set(), restored = [];
    for (const f of saved.slice(-CONFIG.maxFlowers)) {
      if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || f.x < 20 || f.x > CONFIG.worldSize - 20 || f.y < 20 || f.y > CONFIG.worldSize - 20) continue;
      if (!FRUIT_KINDS.includes(f.kind) && f.kind !== 'gold') continue;
      const key = `${Math.floor(f.x / 24)},${Math.floor(f.y / 24)}`;
      if (cells.has(key)) continue;
      cells.add(key);
      restored.push({ x: f.x, y: f.y, kind: f.kind, key, rotation: Number.isFinite(f.rotation) ? clamp(f.rotation, 0, Math.PI * 2) : 0, scale: Number.isFinite(f.scale) ? clamp(f.scale, .85, 1.15) : 1, bloomTimer: 0 });
    }
    this.flowers = restored; this.gardenRevision++;
  }
  bloom(x, y, kind = 'apple') {
    x = clamp(x, 20, CONFIG.worldSize - 20); y = clamp(y, 20, CONFIG.worldSize - 20);
    const key = `${Math.floor(x / 24)},${Math.floor(y / 24)}`;
    const existing = this.flowers.find(f => f.key === key);
    if (existing) { existing.kind = kind; existing.bloomTimer = .65; }
    else {
      this.flowers.push({ x, y, key, kind, rotation: this.random() * Math.PI * 2, scale: .9 + this.random() * .2, bloomTimer: .65 });
      this.flowersPlanted++;
      if (this.flowers.length > CONFIG.maxFlowers) this.flowers.shift();
    }
    this.gardenRevision++;
  }
  scheduleTreasure() { this.treasureNextAt = this.time + CONFIG.treasureIntervalSeconds + this.random() * 8; }
  spawnTreasure() {
    const p = this.player;
    for (let i = 0; i < 12; i++) {
      const angle = p.angle + (this.random() - .5) * 1.6, gap = 130 + this.random() * 40;
      const x = clamp(p.x + Math.cos(angle) * gap, 90, CONFIG.worldSize - 90), y = clamp(p.y + Math.sin(angle) * gap, 90, CONFIG.worldSize - 90);
      if (distance({ x, y }, p) < 75 || this.enemies.some(e => e.active && distance({ x, y }, e) < 135)) continue;
      const t = makeSnake(x, y, angle, 1, 'treasure', ['#f0cf65', '#b98937']);
      t.jackpot = this.random() < CONFIG.treasureJackpotChance;
      t.treasure = true; t.radius = 10.5; t.life = CONFIG.treasureLifetime; updateBody(t); t.body.length = 5;
      this.treasure = t;
      this.events.push({ type: 'treasure-appear', jackpot: t.jackpot });
      this.popups.push({ text: t.jackpot ? '大あたりの おたからヘビ！' : 'おたからヘビ！', x, y: y - 62, life: 2, maxLife: 2, treasure: true, jackpot: t.jackpot });
      this.burst(x, y, t.jackpot ? 22 : 14, t.jackpot ? '#d6bbef' : '#fff0a8'); return;
    }
    this.treasureNextAt = this.time + 2;
  }
  updateTreasure(dt) {
    if (!this.treasure) { if (this.time >= this.treasureNextAt) this.spawnTreasure(); return; }
    const t = this.treasure, p = this.player;
    t.life -= dt;
    if (t.life <= 0) { this.burst(t.x, t.y, 10, '#f1d578'); this.treasure = null; this.scheduleTreasure(); return; }
    t.aiWait -= dt;
    if (t.aiWait <= 0) {
      t.aiWait = .18;
      const gap = distance(t, p);
      const danger = this.enemies.find(e => e.active && distance(e, t) < 120);
      const avoid = danger || p;
      t.targetAngle = gap > 300 && !danger ? Math.atan2(p.y - t.y, p.x - t.x) : Math.atan2(t.y - avoid.y, t.x - avoid.x) + Math.sin(this.time * 2.1) * .28;
    }
    const speedScale = this.settings.speed / CONFIG.snakeSpeed;
    moveSnake(t, dt, CONFIG.treasureSpeed * speedScale, CONFIG.treasureTurnSpeed * speedScale); t.body.length = 5;
    if (touching(p, t.body, p.radius + t.radius)) this.catchTreasure();
  }
  catchTreasure() {
    if (this.state !== 'playing' || !this.treasure) return;
    const t = this.treasure; this.treasure = null; this.treasuresCaught++; this.scheduleTreasure();
    this.bloom(t.x, t.y, 'gold');
    this.burst(t.x, t.y, t.jackpot ? 40 : 30, t.jackpot ? '#d6bbef' : '#f5d36f');
    this.popups.push({ text: t.jackpot ? '大あたり！' : 'おたから！', x: t.x, y: t.y - 55, life: 1.8, maxLife: 1.8, large: true, treasure: true, jackpot: t.jackpot });
    // Bonus fruit is collected once, after its short flight. Regular food stays at 80.
    const room = CONFIG.maxBonusFruit - this.food.filter(f => f.bonus).length;
    // Freeze the reward at capture time, so collecting fruit after a level-up never changes its value.
    const rewards = treasureFruitRewards(this.player.level, t.jackpot, room);
    this.events.push({ type: 'treasure', jackpot: !!t.jackpot, rewardXp: rewards.reduce((sum, value) => sum + value, 0) });
    for (let i = 0; i < rewards.length; i++) {
      const angle = i * Math.PI * 2 / rewards.length, radius = 48 + (i % 3) * 17;
      this.food.push({ x: t.x, y: t.y, originX: t.x, originY: t.y, landingX: clamp(t.x + Math.cos(angle) * radius, 35, CONFIG.worldSize - 35), landingY: clamp(t.y + Math.sin(angle) * radius, 35, CONFIG.worldSize - 35), flight: CONFIG.fruitFlightSeconds, life: CONFIG.bonusFruitLifetime, bonus: true, jackpot: !!t.jackpot, rewardXp: rewards[i], phase: angle, kind: FRUIT_KINDS[i % FRUIT_KINDS.length], large: i === 0 });
    }
  }
  updateBonusFruit(dt) {
    for (const f of this.food) if (f.bonus) {
      if (f.flight > 0) {
        f.flight = Math.max(0, f.flight - dt);
        const progress = 1 - f.flight / CONFIG.fruitFlightSeconds, ease = 1 - (1 - progress) ** 2;
        f.x = f.originX + (f.landingX - f.originX) * ease; f.y = f.originY + (f.landingY - f.originY) * ease;
      } else f.life -= dt;
    }
    this.food = this.food.filter(f => !f.bonus || f.life > 0);
  }
  reward(amount, x, y, enemy = false, fruit = null) {
    const p = this.player, previousLevel = p.level, next = addExperience(p.level, p.xp, amount);
    p.level = next.level; p.xp = next.xp; p.radius = radiusFor(p.level);
    this.bloom(x, y, fruit?.kind || 'apple');
    p.chewTimer = CONFIG.chewSeconds;
    if (fruit) {
      this.combo = this.time <= this.comboUntil ? Math.min(this.combo + 1, CONFIG.comboCap) : 1;
      this.comboUntil = this.time + CONFIG.comboSeconds;
      this.events.push({ type: 'eat', combo: this.combo, kind: fruit.kind, large: fruit.large });
      this.popups.push({ text: fruit.large || fruit.bonus ? `ぱくっ！ +${amount}` : this.combo >= 3 ? 'ぱくぱく！' : 'ぱくっ！', x: p.x + 43, y: p.y - 24, life: .75, maxLife: .75, bite: true });
    } else if (enemy) {
      this.events.push({ type: 'enemy' });
      this.popups.push({ text: `+${amount}`, x, y: y - 40, life: 1, maxLife: 1 });
    }
    const unlocked = unlockedAppearances(previousLevel, p.level);
    if (next.gained) {
      const style = unlocked.at(-1) || null;
      p.growthTimer = style ? 1.5 : .7;
      this.events.push({ type: 'level', level: p.level, style, unlocked });
      this.popups.push({ text: style ? `${style.label}に へんしん！` : `レベル ${p.level}！`, x: p.x, y: p.y - 75, life: 1.8, maxLife: 1.8, large: true });
    }
    this.burst(x, y, next.gained ? 24 : enemy || fruit?.large ? 18 : 8, next.gained ? '#b293eb' : (FRUITS[fruit?.kind] || FRUITS.banana).color);
    if (this.popups.length > CONFIG.maxPopups) this.popups.splice(0, this.popups.length - CONFIG.maxPopups);
    updateBody(p);
  }
  burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2, speed = 30 + this.random() * 85;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .7, maxLife: .7, radius: 2 + this.random() * 3, color });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }
  enemyPressure() {
    const late = this.settings.lateGame;
    const progress = clamp((this.player.level - late.startLevel) / (100 - late.startLevel), 0, 1);
    return {
      chaseRange: this.settings.chaseRange + (late.chaseRange - this.settings.chaseRange) * progress,
      chaseSeconds: this.settings.chaseSeconds + (late.chaseSeconds - this.settings.chaseSeconds) * progress,
      strongOffsetMax: Math.round(this.settings.strongOffsetMax + (late.strongOffsetMax - this.settings.strongOffsetMax) * progress),
      strongEnemies: this.player.level < late.startLevel ? 0 : Math.min(late.strongEnemies, progress < .5 ? 1 : 2),
    };
  }
  updateEnemy(e, dt) {
    e.aiWait -= dt; e.chaseCooldown = Math.max(0, e.chaseCooldown - dt);
    if (e.aiWait > 0) return;
    e.aiWait = this.settings.aiWait + this.random() * this.settings.aiJitter;
    const stronger = [this.player, ...this.enemies].filter(s => s !== e && s.active && s.level > e.level && distance(s, e) < 200).sort((a, b) => distance(a, e) - distance(b, e))[0];
    if (stronger) { e.targetAngle = Math.atan2(e.y - stronger.y, e.x - stronger.x); e.chaseTime = 0; return; }
    const pressure = this.enemyPressure();
    if (e.level > this.player.level && this.protection <= 0 && distance(e, this.player) < pressure.chaseRange && e.chaseCooldown <= 0) {
      e.chaseTime += e.aiWait;
      e.targetAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      if (e.chaseTime > pressure.chaseSeconds) { e.chaseCooldown = this.settings.chaseCooldown; e.chaseTime = 0; }
      return;
    }
    e.chaseTime = 0;
    const regularFood = this.food.filter(f => !f.bonus);
    const nearest = regularFood.reduce((best, f) => distance(e, f) < distance(e, best) ? f : best, regularFood[0]);
    if (!nearest) return;
    e.targetAngle = Math.atan2(nearest.y - e.y, nearest.x - e.x) + (this.random() - .5) * .4;
  }
  outsideView(snake) {
    const { width, height, x = this.player.x, y = this.player.y } = this.viewport;
    const halfW = width / 2 + 80, halfH = height / 2 + 80;
    return [snake, ...snake.body].every(pt => Math.abs(pt.x - x) >= halfW || Math.abs(pt.y - y) >= halfH);
  }
  tryRespawn(e, replacing = false) {
    const p = this.player, pressure = this.enemyPressure();
    const strongCount = this.enemies.filter(other => other !== e && other.active && other.level > p.level).length;
    const needsStrong = strongCount < pressure.strongEnemies;
    for (let i = 0; i < 35; i++) {
      const x = 130 + this.random() * 1340, y = 130 + this.random() * 1340;
      if (distance({ x, y }, p) < 420 || !this.outsideView({ x, y, body: [] })) continue;
      // Once threats are replenished, replacements stay edible; normal respawns keep their mix.
      const strong = needsStrong || (!replacing && this.random() >= 1 - this.settings.strongChance);
      const offset = strong ? 1 + Math.floor(this.random() * pressure.strongOffsetMax) : -(1 + Math.floor(this.random() * 2));
      const angle = Math.atan2(800 - y, 800 - x);
      const fresh = makeSnake(x, y, angle, Math.max(1, p.level + offset), e.id, e.colors);
      // A new head must not appear near the player's long, off-screen tail.
      if (!this.outsideView(fresh) || touching(fresh, p.body, p.radius + fresh.radius + 180)) continue;
      Object.assign(e, fresh); return true;
    }
    if (!e.active) e.respawn = .5;
    return false;
  }
  refreshEnemies() {
    const p = this.player, late = this.settings.lateGame;
    if (p.level < late.startLevel || this.time < this.enemyRefreshAt) return;
    const pressure = this.enemyPressure();
    const needsStrong = this.enemies.filter(e => e.active && e.level > p.level).length < pressure.strongEnemies;
    const candidate = this.enemies.filter(e => e.active && e.level < p.level &&
      (needsStrong || p.level - e.level >= late.refreshLevelGap) && distance(e, p) >= 420 && this.outsideView(e))
      .sort((a, b) => a.level - b.level)[0];
    if (!candidate) return;
    // Replace atomically: if no safe position exists, the old snake stays intact.
    this.enemyRefreshAt = this.time + (this.tryRespawn(candidate, true) ? late.refreshSeconds : 1);
  }
  resolveCollisions() {
    if (this.state !== 'playing') return;
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const mode = relation(p.level, e.level), radius = p.radius + e.radius - 2;
      if (mode === 'edible' && touching(p, e.body, radius)) {
        e.active = false; e.respawn = this.settings.respawnSeconds; this.enemiesEaten++;
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
    const p = this.player; p.bumpCooldown = Math.max(0, p.bumpCooldown - dt); p.chewTimer = Math.max(0, p.chewTimer - dt); p.growthTimer = Math.max(0, p.growthTimer - dt);
    if (this.time > this.comboUntil) this.combo = 0;
    if (inputAngle !== null) p.targetAngle = inputAngle;
    const speedScale = this.settings.speed / CONFIG.snakeSpeed;
    moveSnake(p, dt, this.settings.speed, CONFIG.playerTurnSpeed * speedScale);
    for (const e of this.enemies) {
      if (!e.active) { e.respawn -= dt; if (e.respawn <= 0) this.tryRespawn(e); continue; }
      this.updateEnemy(e, dt); moveSnake(e, dt, this.settings.speed, CONFIG.turnSpeed * speedScale);
    }
    this.resolveCollisions();
    if (this.state !== 'playing') return;
    this.updateBonusFruit(dt); this.updateTreasure(dt);
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      if (f.flight > 0) continue;
      if (distance(p, f) < p.radius + fruitRadius(f)) {
        this.foodEaten++;
        if (f.bonus) { this.food.splice(i, 1); i--; } else this.food[i] = this.newFood();
        this.reward(fruitExperience(f), f.x, f.y, false, f);
      } else if (!f.bonus) for (const e of this.enemies) {
        if (e.active && distance(e, f) < e.radius + fruitRadius(f) - 2) {
          this.food[i] = this.newFood(); const next = addExperience(e.level, e.xp, fruitExperience(f));
          e.level = next.level; e.xp = next.xp; e.radius = radiusFor(e.level); break;
        }
      }
    }
    for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const popup of this.popups) { popup.y -= dt * 15; popup.life -= dt; }
    this.popups = this.popups.filter(pt => pt.life > 0);
    if (this.popups.length > CONFIG.maxPopups) this.popups.splice(0, this.popups.length - CONFIG.maxPopups);
    for (const flower of this.flowers) flower.bloomTimer = Math.max(0, flower.bloomTimer - dt);
    const wanted = Math.min(this.settings.maxEnemies, this.settings.enemyCount + Math.floor((p.level - 1) / 5));
    if (this.enemies.length < wanted) {
      const i = this.enemies.length, e = makeSnake(0, 0, 0, 1, `enemy${i}`, CONFIG.enemyColors[i]);
      e.active = false; e.respawn = 1; this.enemies.push(e);
    }
    this.refreshEnemies();
  }
}
