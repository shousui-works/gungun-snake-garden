import { CONFIG, FRUITS } from './config.js';
import { relation, clamp, appearanceFor, experienceNeeded } from './rules.js';
import { viewModeFor, viewScaleFor } from './view.js';
const FONT = '"Hiragino Maru Gothic ProN", "Yu Gothic", system-ui, sans-serif';
const ENEMY_CUES = Object.freeze({
  danger: { symbol: '!', edge: '#c77462', background: '#fff0e5', ink: '#ad4c38' },
  edible: { symbol: '○', edge: '#6e9650', background: '#f8faee', ink: '#527d32' },
  equal: { symbol: '＝', edge: '#a1aa92', background: '#f4f4ea', ink: '#7d896e' },
});
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
function pill(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function star(c, x, y, radius) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .45 : radius; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill();
}
function jewel(c, x, y, radius, color = '#bca1df') {
  c.save(); c.translate(x, y); c.lineWidth = 1.2; c.strokeStyle = '#fffdf5'; c.fillStyle = color;
  c.beginPath(); c.moveTo(0, -radius); c.lineTo(radius * .7, 0); c.lineTo(0, radius); c.lineTo(-radius * .7, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -radius); c.lineTo(0, radius); c.moveTo(-radius * .7, 0); c.lineTo(radius * .7, 0); c.stroke(); c.restore();
}
export class Renderer {
  constructor(canvas, simulation, viewMode = 'wide') {
    this.canvas = canvas; this.simulation = simulation; this.ctx = canvas.getContext('2d', { alpha: false }); this.camera = { x: 800, y: 800 }; this.clock = 0;
    this.viewMode = viewModeFor(viewMode);
    this.decorations = Array.from({ length: 135 }, (_, i) => ({ x: ((i * 227 + 61) % 1500) + 50, y: ((i * 379 + 137) % 1500) + 50, type: i % 5, rotation: i * 1.62 }));
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.scale = viewScaleFor(this.width, this.height, this.viewMode);
    this.simulation.viewport = { width: this.width / this.scale, height: this.height / this.scale };
  }
  setViewMode(mode) { this.viewMode = viewModeFor(mode); this.resize(); }
  resetCamera() { this.camera = { x: this.simulation.player.x, y: this.simulation.player.y }; this.directionCue = null; }
  screenPosition(point) {
    return { x: this.width / 2 + (point.x - this.camera.x) * this.scale, y: this.height / 2 + (point.y - this.camera.y) * this.scale, radius: (point.radius || 0) * this.scale };
  }
  showDirection(angle) { this.directionCue = { angle, life: .7 }; }
  visible(x, y, pad = 60) {
    return Math.abs(x - this.camera.x) < this.width / this.scale / 2 + pad && Math.abs(y - this.camera.y) < this.height / this.scale / 2 + pad;
  }
  draw(dt) {
    const c = this.ctx, sim = this.simulation, p = sim.player;
    if (!this.width || !this.height) return;
    this.clock += dt;
    const follow = 1 - Math.exp(-dt * 8), halfW = this.width / this.scale / 2, halfH = this.height / this.scale / 2;
    const x = clamp(p.x, Math.min(halfW, 800), Math.max(1600 - halfW, 800));
    const y = clamp(p.y, Math.min(halfH, 800), Math.max(1600 - halfH, 800));
    this.camera.x += (x - this.camera.x) * follow; this.camera.y += (y - this.camera.y) * follow;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#b9cda8'; c.fillRect(0, 0, this.width, this.height);
    c.translate(this.width / 2, this.height / 2); c.scale(this.scale, this.scale); c.translate(-this.camera.x, -this.camera.y);
    c.fillStyle = '#cedfbc'; c.fillRect(0, 0, 1600, 1600);
    c.fillStyle = '#d5e3c780';
    for (const [px, py, r] of [[800,800,220],[260,410,160],[1160,410,230],[550,1340,190],[1400,1230,180]]) {
      circle(c, px, py, r); c.fill();
    }
    c.strokeStyle = '#6b8a5510'; c.lineWidth = 1;
    c.beginPath();
    for (let n = 0; n <= 1600; n += 80) { c.moveTo(n, 0); c.lineTo(n, 1600); c.moveTo(0, n); c.lineTo(1600, n); } c.stroke();
    c.strokeStyle = '#98b281'; c.lineWidth = 12; c.strokeRect(6, 6, 1588, 1588);
    c.strokeStyle = '#e1eacd'; c.lineWidth = 3; c.strokeRect(18, 18, 1564, 1564);
    for (const d of this.decorations) if (this.visible(d.x, d.y)) this.drawPlant(d);
    for (const flower of sim.flowers) if (this.visible(flower.x, flower.y, 30)) this.drawGardenFlower(flower);
    for (const f of sim.food) if (this.visible(f.x, f.y)) this.drawFood(f);
    for (const e of sim.enemies) if (e.active) this.drawSnake(e, false);
    if (sim.treasure) this.drawSnake(sim.treasure, false);
    this.drawSnake(p, true);
    for (const e of sim.enemies) if (e.active && this.visible(e.x, e.y)) this.drawLabel(e);
    if (sim.treasure) {
      if (this.visible(sim.treasure.x, sim.treasure.y)) this.drawLabel(sim.treasure);
      this.drawTreasureHint(sim.treasure);
    }
    if (this.directionCue) {
      this.directionCue.life -= dt;
      if (this.directionCue.life <= 0 || sim.state !== 'playing') this.directionCue = null;
      else {
        c.save(); c.translate(p.x,p.y); c.rotate(this.directionCue.angle); c.globalAlpha = Math.min(1,this.directionCue.life*3);
        c.strokeStyle='#fffbea'; c.lineWidth=4; c.lineCap='round'; c.beginPath(); c.moveTo(p.radius+18,0); c.lineTo(p.radius+46,0); c.stroke();
        c.strokeStyle='#9876c3'; c.lineWidth=2; c.beginPath(); c.moveTo(p.radius+18,0); c.lineTo(p.radius+45,0); c.moveTo(p.radius+38,-6); c.lineTo(p.radius+45,0); c.lineTo(p.radius+38,6); c.stroke(); c.restore();
      }
    }
    for (const pt of sim.particles) {
      c.globalAlpha = Math.max(0, pt.life / pt.maxLife); c.fillStyle = pt.color; circle(c, pt.x, pt.y, pt.radius); c.fill();
    }
    c.globalAlpha = 1;
    for (const pt of sim.popups) {
      const point = this.screenPosition(pt);
      c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = Math.min(1, pt.life * 3); c.font = `800 ${pt.large ? 23 : pt.bite ? 16 : 19}px ${FONT}`; c.textAlign = 'center';
      const measured = c.measureText(pt.text).width;
      if (measured > this.width - 20) c.font = `800 ${Math.max(14, (pt.large ? 23 : pt.bite ? 16 : 19) * (this.width - 20) / measured)}px ${FONT}`;
      const textWidth = Math.min(c.measureText(pt.text).width, this.width - 20), x = clamp(point.x, 10 + textWidth / 2, this.width - 10 - textWidth / 2), y = clamp(point.y, 32, this.height - 20);
      c.lineWidth = 5; c.strokeStyle = '#fdfcf5'; c.strokeText(pt.text, x, y); c.fillStyle = pt.jackpot ? '#8260b5' : pt.treasure ? '#a47726' : pt.bite ? '#b56c57' : '#7956b7'; c.fillText(pt.text, x, y); c.restore();
    }
    this.drawGrowthLabel(p);
  }
  drawGardenFlower(f) {
    const c = this.ctx, growth = 1 - f.bloomTimer / .65;
    const size = f.scale * .74 * (f.bloomTimer > 0 ? .15 + .85 * (1 - (1 - growth) ** 3) : 1);
    c.save(); c.translate(f.x, f.y); c.scale(size, size); c.globalAlpha = f.bloomTimer > 0 ? .8 : .64;
    c.fillStyle = '#8ba57435'; c.beginPath(); c.ellipse(0, 6, 10, 3, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#7c9d64'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 5); c.quadraticCurveTo(2, -1, 0, -9); c.stroke();
    c.fillStyle = '#97b577'; c.beginPath(); c.ellipse(-4, 1, 5, 2.4, .5, 0, Math.PI * 2); c.ellipse(4, -3, 5, 2.4, -.5, 0, Math.PI * 2); c.fill();
    c.translate(0, -10); c.rotate(f.rotation);
    c.fillStyle = f.kind === 'gold' ? '#cbb979' : f.kind === 'apple' ? '#cba8b0' : f.kind === 'banana' ? '#c7bb8d' : '#b5adc8';
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; circle(c, Math.cos(a) * 5.1, Math.sin(a) * 5.1, 4.4); c.fill(); }
    c.fillStyle = '#e4d6ab'; circle(c, 0, 0, 3.3); c.fill();
    if (f.bloomTimer > 0) { c.globalAlpha = .45 * f.bloomTimer / .65; c.fillStyle = '#fffbe8'; star(c, 15, -7 - growth * 10, 4); star(c, -13, 3 - growth * 7, 3); }
    c.restore();
  }
  drawTreasureHint(t) {
    const point = this.screenPosition(t);
    if (point.x >= 24 && point.x <= this.width - 24 && point.y >= 55 && point.y <= this.height - 65) return;
    const x = clamp(point.x, 25, this.width - 25), y = clamp(point.y, x > this.width - 130 ? 86 : 30, this.height - 68);
    const angle = Math.atan2(point.y - y, point.x - x), c = this.ctx;
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.translate(x, y);
    c.fillStyle = t.jackpot ? '#f3e7ffeb' : '#fff6d8eb'; c.strokeStyle = t.jackpot ? '#a17cc7' : '#cba851'; c.lineWidth = 1.2; circle(c, 0, 0, 17); c.fill(); c.stroke();
    if (t.jackpot) jewel(c, 0, 0, 9); else { c.fillStyle = '#c9a044'; star(c, 0, 0, 8); }
    c.fillStyle = t.jackpot ? '#9671bb' : '#c9a044';
    c.rotate(angle); c.beginPath(); c.moveTo(20, -4); c.lineTo(27, 0); c.lineTo(20, 4); c.closePath(); c.fill(); c.restore();
  }
  drawPlant(d) {
    const c = this.ctx; c.save(); c.translate(d.x, d.y); c.rotate(d.rotation);
    if (d.type <= 2) {
      c.strokeStyle = '#9ab17e88'; c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath();
      c.moveTo(-5,4); c.quadraticCurveTo(-7,-1,-4,-5); c.moveTo(0,4); c.quadraticCurveTo(-2,-3,1,-7); c.moveTo(4,4); c.quadraticCurveTo(3,0,7,-3); c.stroke();
    } else {
      c.fillStyle = d.type === 3 ? '#f8f9eaaa' : '#b0c39480';
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; circle(c, Math.cos(a) * 3.4, Math.sin(a) * 3.4, 2.9); c.fill(); }
      c.fillStyle = '#d1bc6880'; circle(c, 0, 0, 1.7); c.fill();
    } c.restore();
  }
  drawFood(f) {
    const c = this.ctx, bob = Math.sin(this.clock * 2.2 + f.phase) * 1.1 - (f.flight > 0 ? Math.sin((1 - f.flight / CONFIG.fruitFlightSeconds) * Math.PI) * 32 : 0);
    c.save(); c.translate(f.x, f.y + bob); c.scale(f.large ? CONFIG.bigFruitScale : 1, f.large ? CONFIG.bigFruitScale : 1);
    if (f.bonus) {
      c.fillStyle = f.jackpot ? '#eadfff77' : '#fff1aa55'; circle(c, 0, 0, 15); c.fill();
      if (f.jackpot) jewel(c, 13, -14, 5); else { c.fillStyle = '#f5e6a3'; star(c, 13, -14, 4); }
    }
    if (f.large) {
      c.fillStyle = '#fff3ba65'; circle(c, 0, 0, 17 + Math.sin(this.clock * 2 + f.phase)); c.fill();
      c.strokeStyle = '#fff8d8b0'; c.lineWidth = 1.2; circle(c, 0, 0, 17); c.stroke();
      c.fillStyle = '#fff9d8'; c.beginPath(); c.moveTo(15,-19); c.lineTo(17,-14); c.lineTo(22,-12); c.lineTo(17,-10); c.lineTo(15,-5); c.lineTo(13,-10); c.lineTo(8,-12); c.lineTo(13,-14); c.closePath(); c.fill();
    }
    c.fillStyle = '#78975a38'; c.beginPath(); c.ellipse(0, 10, 10, 3.7, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = 1.2; c.lineJoin = 'round'; c.lineCap = 'round';
    if (f.kind === 'banana') {
      c.beginPath();
      c.moveTo(-11,-7); c.quadraticCurveTo(-3,8,12,-5); c.quadraticCurveTo(10,8,1,11); c.quadraticCurveTo(-12,12,-11,-7); c.closePath();
      c.strokeStyle = '#fffdf2'; c.lineWidth = 5; c.stroke();
      c.fillStyle = FRUITS.banana.color; c.fill(); c.strokeStyle = '#c99e42'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = '#fff0b5'; c.lineWidth = 2; c.beginPath(); c.moveTo(-7,-1); c.quadraticCurveTo(-3,9,7,3); c.stroke();
      c.strokeStyle = '#8a7951'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-11,-7); c.lineTo(-10,-5); c.moveTo(12,-5); c.lineTo(11,-3); c.stroke();
    } else if (f.kind === 'grapes') {
      c.strokeStyle = '#63874e'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0,-9); c.quadraticCurveTo(-3,-13,1,-16); c.stroke();
      c.fillStyle = '#81a764'; c.beginPath(); c.ellipse(5,-12,5,2.4,-.5,0,Math.PI*2); c.fill();
      // Draw one bright silhouette behind the whole bunch, keeping the berry detail clear.
      c.strokeStyle = '#fffdf2'; c.lineWidth = 4.5;
      for (const [x,y] of [[0,6],[-3,0],[4,0],[-5,-6],[3,-6]]) { circle(c,x,y,4.4); c.stroke(); }
      for (const [x,y] of [[0,6],[-3,0],[4,0],[-5,-6],[3,-6]]) {
        c.fillStyle = FRUITS.grapes.color; c.strokeStyle = '#8063a8'; c.lineWidth = .8; circle(c,x,y,4.4); c.fill(); c.stroke();
        c.fillStyle = '#d7c8eb'; circle(c,x-1.2,y-1.5,1.2); c.fill();
      }
    } else {
      c.strokeStyle = '#886443'; c.lineWidth = 2; c.beginPath(); c.moveTo(0,-7); c.quadraticCurveTo(-2,-12,1,-15); c.stroke();
      c.fillStyle = '#85ac68'; c.beginPath(); c.ellipse(5,-11,5,2.6,-.4,0,Math.PI*2); c.fill();
      c.beginPath();
      c.moveTo(0,-7); c.bezierCurveTo(-13,-13,-14,6,-5,9); c.quadraticCurveTo(0,11,4,9); c.bezierCurveTo(14,7,13,-12,0,-7); c.closePath();
      c.strokeStyle = '#fffdf2'; c.lineWidth = 5; c.stroke();
      c.fillStyle = FRUITS.apple.color; c.fill(); c.strokeStyle = '#c26763'; c.lineWidth = 1.1; c.stroke();
      c.strokeStyle = '#ffbdb0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-6,-3); c.quadraticCurveTo(-8,-1,-7,3); c.stroke();
    }
    c.restore();
  }
  drawSnake(s, player) {
    const c = this.ctx, r = s.radius, count = s.body.length, style = player ? appearanceFor(s.level) : null;
    const enemyCue = !player && !s.treasure ? ENEMY_CUES[relation(this.simulation.player.level, s.level)] : null;
    const palette = style?.palette, baseColors = style?.colors || palette?.[0] || s.colors;
    const chew = player && s.chewTimer > 0 ? Math.sin((1 - s.chewTimer / CONFIG.chewSeconds) * Math.PI) : 0;
    if (s.treasure) {
      c.save(); c.fillStyle = s.jackpot ? '#e2c6f977' : '#ffe9a06b'; circle(c, s.x, s.y, r + 8 + Math.sin(this.clock * 4) * 2); c.fill();
      if (s.jackpot) { c.strokeStyle = '#fff5c5'; c.lineWidth = 1.5; circle(c, s.x, s.y, r + 13); c.stroke(); }
      c.fillStyle = '#fff7c5'; star(c, s.x - 20, s.y - 18, 4); star(c, s.x + 22, s.y + 10, 3); c.restore();
    }
    if (player && s.growthTimer > 0) {
      c.save(); c.globalAlpha = Math.min(.7, s.growthTimer); c.strokeStyle = '#fff5c0'; c.lineWidth = 3;
      circle(c, s.x, s.y, r + 18 + (1.5 - s.growthTimer) * 15); c.stroke(); c.restore();
    }
    if (player && this.simulation.protection > 0 && this.simulation.state === 'playing') {
      c.save(); c.strokeStyle = '#faf5c4'; c.lineWidth = 3; c.setLineDash([7, 6]); c.lineDashOffset = -this.clock * 14; circle(c, s.x, s.y, r + 12); c.stroke();
      c.fillStyle = '#fbf3c130'; circle(c, s.x, s.y, r + 12); c.fill(); c.restore();
    }
    for (let i = count - 1; i >= 0; i--) {
      const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
      const size = r * (.58 + .42 * (1 - i / count));
      c.fillStyle = '#66805235'; circle(c, pt.x + 1, pt.y + 4, size + 1); c.fill();
    }
    if (enemyCue) {
      c.fillStyle = enemyCue.edge;
      for (let i = count - 1; i >= 1; i--) {
        const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
        const size = r * (.58 + .42 * (1 - i / count));
        circle(c, pt.x, pt.y, size + 2.4); c.fill();
      }
    }
    for (let i = count - 1; i >= 1; i--) {
      const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
      const size = r * (.58 + .42 * (1 - i / count));
      const colors = palette ? palette[i % palette.length] : baseColors;
      c.fillStyle = colors[1]; circle(c, pt.x, pt.y + 1.5, size); c.fill();
      c.fillStyle = colors[0]; circle(c, pt.x, pt.y - 1, size); c.fill();
      if (s.treasure) { if (!s.jackpot) { c.fillStyle = '#fff4b3'; star(c, pt.x, pt.y - 1, size * .48); } }
      else if (!player && s.level >= 4 && i % 2 === 0) { c.fillStyle = '#ffffff40'; circle(c, pt.x - size * .2, pt.y - size * .23, size * .45); c.fill(); }
      else { c.fillStyle = '#ffffff1a'; circle(c, pt.x - size * .22, pt.y - size * .25, size * .55); c.fill(); }
    }
    if (s.treasure && s.jackpot) {
      for (let i = 2; i < count; i += 2) {
        const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
        jewel(c, pt.x, pt.y - 1, r * (.58 + .42 * (1 - i / count)) * .66, i % 4 ? '#9bd8cf' : '#e8a8c6');
      }
    }
    if (style?.pattern) {
      const spacing = ['snow','flowers','gems','crystal','stars','galaxy','bolts','gold','royal'].includes(style.pattern) ? 3 : ['dots','stripes'].includes(style.pattern) ? 1 : 2;
      // Paint motifs after the complete body, so adjacent segments cannot hide them.
      for (let i = count - 1; i >= 1; i--) {
        const pt = s.body[i]; if (i % spacing || !this.visible(pt.x, pt.y, 45)) continue;
        this.drawBodyPattern(pt, r * (.58 + .42 * (1 - i / count)), style.pattern, s.body[i - 1]);
      }
    }
    // Body cues must be drawn even when the head is outside the field.
    if (enemyCue) this.drawEnemyBodyMarkers(s, enemyCue);
    if (!this.visible(s.x, s.y)) return;
    c.save(); c.translate(s.x, s.y); c.rotate(s.angle); c.scale(1 + chew * .14, 1 + chew * .24);
    c.fillStyle = baseColors[1]; c.beginPath(); c.ellipse(0, 2, r * 1.13, r, 0, 0, Math.PI * 2); c.fill();
    if (palette) {
      const gradient = c.createLinearGradient(-r, -r, r, r);
      palette.forEach((colors,i) => gradient.addColorStop(i / (palette.length - 1), colors[0])); c.fillStyle = gradient;
    } else c.fillStyle = baseColors[0];
    c.beginPath(); c.ellipse(0, 0, r * 1.13, r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff18'; c.beginPath(); c.ellipse(-r * .16, 0, r * .55, r * .76, 0, 0, Math.PI * 2); c.fill();
    for (const side of [-1, 1]) {
      if (chew > .3) {
        c.strokeStyle = '#59436f'; c.lineWidth = 2; c.beginPath();
        c.moveTo(r*.43, side*r*.48-r*.18); c.quadraticCurveTo(r*.7,side*r*.48,r*.43,side*r*.48+r*.18); c.stroke();
      } else {
        c.fillStyle = '#fffdf3'; circle(c, r * .45, side * r * .48, r * .34); c.fill();
        c.fillStyle = '#3d423c'; circle(c, r * .56, side * r * .48, r * .15); c.fill();
        c.fillStyle = '#fff'; circle(c, r * .59, side * r * .48 - r * .045, r * .045); c.fill();
      }
      if (player) { c.fillStyle = chew > .2 ? '#f6adbb' : '#dba6d544'; c.beginPath(); c.ellipse(r*.04,side*r*.72,r*(.12+chew*.11),r*.12,0,0,Math.PI*2); c.fill(); }
    }
    if (chew > .2) {
      c.fillStyle = '#725277'; c.beginPath(); c.ellipse(r*.89,0,r*.14,r*(.13+chew*.07),0,0,Math.PI*2); c.fill();
      c.fillStyle = '#eea2b0'; c.beginPath(); c.ellipse(r*.92,r*.035,r*.065,r*.1,0,0,Math.PI*2); c.fill();
    } else { c.strokeStyle = baseColors[1]; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(r * .87, -r * .16); c.quadraticCurveTo(r * 1.06, 0, r * .87, r * .16); c.stroke(); }
    c.restore();
    if (s.treasure && s.jackpot) {
      c.save(); c.fillStyle = '#fff2bf'; c.beginPath(); c.ellipse(s.x - r * .12, s.y - r * .85, r * .75, r * .2, 0, 0, Math.PI * 2); c.fill();
      jewel(c, s.x - r * .12, s.y - r * 1.25, r * .8, '#a9cee9'); c.restore();
    }
    if (style?.accessory) this.drawAccessory(s, style.accessory);
    if (!player && !s.treasure && relation(this.simulation.player.level, s.level) === 'danger') {
      c.strokeStyle = '#b96a5c77'; c.lineWidth = 1.8; circle(c, s.x, s.y, r + 5); c.stroke();
    }
  }
  drawBodyPattern(point, r, pattern, toward) {
    const c = this.ctx;
    c.save(); c.translate(point.x, point.y - 1); c.rotate(Math.atan2(toward.y - point.y, toward.x - point.x));
    circle(c, 0, 0, r * .94); c.clip(); c.lineWidth = 1.5; c.lineCap = 'round';
    c.fillStyle = '#fffaf0bb'; c.strokeStyle = '#fffaf0bb';
    if (pattern === 'dots') {
      circle(c, -r*.28, -r*.33, r*.18); c.fill(); circle(c, r*.31, r*.2, r*.14); c.fill();
    } else if (pattern === 'seeds') {
      for (const [x,y] of [[-.3,-.35],[.3,.3]]) { c.beginPath(); c.ellipse(r*x,r*y,r*.1,r*.21,-.3,0,Math.PI*2); c.fill(); }
    } else if (pattern === 'stripes') {
      c.fillStyle = '#715643bb'; c.fillRect(-r*.26,-r,r*.42,r*2);
    } else if (pattern === 'bubbles') {
      circle(c,-r*.27,-r*.2,r*.32); c.stroke(); circle(c,r*.35,r*.25,r*.16); c.fill();
    } else if (pattern === 'snow') {
      for (let k=0;k<6;k++) { const a=k*Math.PI/3;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*r*.65,Math.sin(a)*r*.65);c.stroke(); }
    } else if (pattern === 'flowers') {
      for(let k=0;k<5;k++){const a=k*Math.PI*2/5;circle(c,Math.cos(a)*r*.33,Math.sin(a)*r*.33,r*.24);c.fill();} c.fillStyle='#f9dc88';circle(c,0,0,r*.23);c.fill();
    } else if (pattern === 'lattice') {
      c.lineWidth = 1.4; for(const offset of [-.6,0,.6]) {c.beginPath();c.moveTo(-r,r*offset-r);c.lineTo(r,r*offset+r);c.moveTo(-r,r*offset+r);c.lineTo(r,r*offset-r);c.stroke();}
    } else if (pattern === 'tiger') {
      c.fillStyle='#775439bb'; for(const side of [-1,1]){c.beginPath();c.moveTo(-r*.7,side*r);c.lineTo(r*.3,side*r);c.lineTo(-r*.15,side*r*.12);c.closePath();c.fill();}
    } else if (pattern === 'gems' || pattern === 'crystal') {
      c.beginPath();c.moveTo(0,-r*.73);c.lineTo(r*.5,0);c.lineTo(0,r*.73);c.lineTo(-r*.5,0);c.closePath();
      c.fillStyle=pattern==='crystal'?'#f4f7ff9c':'#ccf1d996';c.fill();c.stroke();c.beginPath();c.moveTo(0,-r*.73);c.lineTo(0,r*.73);c.stroke();
    } else if (pattern === 'stars' || pattern === 'galaxy') {
      c.fillStyle='#ffeeb5';star(c,0,-r*.12,r*.58);
      if(pattern==='galaxy'){c.strokeStyle='#cbbaf0aa';c.beginPath();c.ellipse(0,0,r*.8,r*.3,-.5,0,Math.PI*2);c.stroke();}
    } else if (pattern === 'aurora') {
      c.lineWidth=r*.2; c.beginPath();c.moveTo(-r,-r*.35);c.bezierCurveTo(-r*.3,r*.6,r*.3,-r*.6,r,r*.35);c.stroke();
    } else if (pattern === 'armor' || pattern === 'scales') {
      c.strokeStyle=pattern==='armor'?'#6a899b99':'#326e5899'; c.lineWidth=1.6;
      for(const y of [-.35,.35]){c.beginPath();c.moveTo(-r*.62,r*y);c.quadraticCurveTo(0,r*(y+.6),r*.62,r*y);c.stroke();}
      if(pattern==='armor'){c.fillStyle='#f4fcff';circle(c,0,-r*.55,r*.1);c.fill();}
    } else if (pattern === 'bolts') {
      c.fillStyle='#fff1b8';c.beginPath();c.moveTo(r*.12,-r*.72);c.lineTo(-r*.45,r*.12);c.lineTo(-r*.02,r*.12);c.lineTo(-r*.12,r*.72);c.lineTo(r*.48,-r*.18);c.lineTo(r*.06,-r*.18);c.closePath();c.fill();
    } else if (pattern === 'candy') {
      c.lineWidth=r*.4;c.beginPath();c.moveTo(-r,-r*.3);c.lineTo(r,r*.65);c.moveTo(-r,-r*1.3);c.lineTo(r,-r*.35);c.stroke();
    } else if (pattern === 'gold') {
      c.strokeStyle='#fff0a8';circle(c,0,0,r*.65);c.stroke();c.fillStyle='#fff6c7';star(c,-r*.25,-r*.25,r*.26);
    } else if (pattern === 'feathers') {
      c.fillStyle='#ffefb7';c.beginPath();c.ellipse(0,0,r*.62,r*.26,-.5,0,Math.PI*2);c.fill();c.strokeStyle='#dc9554';c.beginPath();c.moveTo(-r*.45,r*.2);c.lineTo(r*.45,-r*.2);c.stroke();
    } else if (pattern === 'royal') {
      c.strokeStyle='#f9df89';c.lineWidth=2.2;circle(c,0,0,r*.83);c.stroke();c.fillStyle='#fff7c5';star(c,0,0,r*.54);
    }
    c.restore();
  }
  drawAccessory(s, accessory) {
    if (accessory === 'flower' || accessory === 'blossom') { this.drawFlowerHat(s, accessory === 'blossom'); return; }
    const c = this.ctx, r = s.radius;
    c.save(); c.translate(s.x - r*.12, s.y - r*.77); c.lineWidth=1.2; c.lineJoin='round'; c.lineCap='round';
    const crown = royal => {
      c.fillStyle=royal?'#f7d56f':'#edc568';c.strokeStyle='#b68b38';c.beginPath();c.moveTo(-r*.7,0);c.lineTo(-r*.82,-r*.73);c.lineTo(-r*.34,-r*.4);c.lineTo(0,-r);c.lineTo(r*.34,-r*.4);c.lineTo(r*.82,-r*.73);c.lineTo(r*.7,0);c.closePath();c.fill();c.stroke();
      c.fillStyle=royal?'#a283d3':'#ee939d';circle(c,0,-r*.27,r*.14);c.fill();
      if(royal){c.fillStyle='#fff6c4';star(c,0,-r*1.1,r*.23);}
    };
    if(accessory==='leaf'){
      c.fillStyle='#83aa61';for(const side of [-1,1]){c.beginPath();c.ellipse(side*r*.25,-r*.22,r*.5,r*.2,side*.7,0,Math.PI*2);c.fill();}c.strokeStyle='#628444';c.beginPath();c.moveTo(0,0);c.lineTo(r*.12,-r*.55);c.stroke();
    }else if(accessory==='antennae'){
      c.strokeStyle='#786046';for(const side of [-1,1]){c.beginPath();c.moveTo(side*r*.35,0);c.quadraticCurveTo(side*r*.7,-r*.65,side*r*.55,-r*.8);c.stroke();c.fillStyle='#786046';circle(c,side*r*.55,-r*.8,r*.14);c.fill();}
    }else if(accessory==='fin'){
      c.fillStyle='#4d9ebd';c.strokeStyle='#367f9f';c.beginPath();c.moveTo(-r*.65,r*.1);c.lineTo(-r*.2,-r*.72);c.quadraticCurveTo(r*.1,-r*.18,r*.65,r*.1);c.closePath();c.fill();c.stroke();
    }else if(['ice','gem','crystal'].includes(accessory)){
      const colors=accessory==='gem'?['#a9e3c5','#498e75']:['#e5f9ff','#8fb8d4'];
      for(const [x,height] of [[-.45,.55],[0,.94],[.45,.65]]){c.fillStyle=colors[0];c.strokeStyle=colors[1];c.beginPath();c.moveTo(r*(x-.2),r*.07);c.lineTo(r*(x-.2),-r*height*.65);c.lineTo(r*x,-r*height);c.lineTo(r*(x+.2),-r*height*.65);c.lineTo(r*(x+.2),r*.07);c.closePath();c.fill();c.stroke();}
    }else if(accessory==='ears'){
      for(const side of [-1,1]){c.fillStyle='#b77b37';circle(c,side*r*.62,-r*.28,r*.38);c.fill();c.fillStyle='#f5d29c';circle(c,side*r*.62,-r*.3,r*.22);c.fill();}
    }else if(accessory==='star'){
      c.strokeStyle='#9075b8';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-r*.18,-r*.52,0,-r*.8);c.stroke();c.fillStyle='#f6dd8b';star(c,0,-r*.82,r*.38);
    }else if(accessory==='helmet'){
      c.fillStyle='#d5e4eb';c.strokeStyle='#809cac';c.beginPath();c.arc(0,0,r*.77,Math.PI,Math.PI*2);c.closePath();c.fill();c.stroke();c.fillStyle='#91a7d4';pill(c,-r*.14,-r*1.02,r*.28,r*.42,r*.12);c.fill();
    }else if(accessory==='rocket'){
      c.fillStyle='#fff3de';c.strokeStyle='#c27b5a';c.beginPath();c.moveTo(-r*.5,0);c.quadraticCurveTo(-r*.48,-r*.55,0,-r*.96);c.quadraticCurveTo(r*.48,-r*.55,r*.5,0);c.closePath();c.fill();c.stroke();c.fillStyle='#a2cee1';circle(c,0,-r*.35,r*.2);c.fill();c.fillStyle='#d78b6e';c.fillRect(-r*.63,-r*.05,r*1.26,r*.14);
    }else if(accessory==='wizard'){
      c.fillStyle='#665795';c.strokeStyle='#4d4279';c.beginPath();c.moveTo(-r*.75,0);c.lineTo(-r*.18,-r*1.13);c.quadraticCurveTo(r*.2,-r*.77,r*.7,0);c.closePath();c.fill();c.stroke();c.fillStyle='#eadb8a';star(c,0,-r*.37,r*.23);c.fillStyle='#9d8ac9';c.beginPath();c.ellipse(0,0,r*.9,r*.17,0,0,Math.PI*2);c.fill();
    }else if(accessory==='bow'){
      c.fillStyle='#f4cfdb';c.strokeStyle='#bd7bab';for(const side of [-1,1]){c.beginPath();c.moveTo(0,-r*.2);c.quadraticCurveTo(side*r*.85,-r*.95,side*r*.73,-r*.12);c.quadraticCurveTo(side*r*.62,r*.2,0,-r*.2);c.fill();c.stroke();}c.fillStyle='#bb7eb2';circle(c,0,-r*.2,r*.2);c.fill();
    }else if(accessory==='crown'||accessory==='royal'){
      if(accessory==='royal')for(const side of [-1,1]){c.fillStyle='#fff3c7';c.strokeStyle='#d1af68';c.beginPath();c.moveTo(side*r*.35,0);c.quadraticCurveTo(side*r*1.7,-r*.67,side*r*1.3,-r*1.2);c.quadraticCurveTo(side*r*.72,-r*.95,side*r*.35,0);c.fill();c.stroke();}
      crown(accessory==='royal');
    }else if(accessory==='horns'){
      c.fillStyle='#f2dc9a';c.strokeStyle='#b59d65';for(const side of [-1,1]){c.beginPath();c.moveTo(side*r*.22,0);c.quadraticCurveTo(side*r*.75,-r*.5,side*r*.58,-r*1.03);c.quadraticCurveTo(side*r*.12,-r*.53,side*r*.05,0);c.fill();c.stroke();}
    }else if(accessory==='flame'){
      c.fillStyle='#f1bf69';c.strokeStyle='#d99852';c.beginPath();c.moveTo(-r*.65,0);c.quadraticCurveTo(-r*.85,-r*.55,-r*.27,-r*.75);c.lineTo(-r*.16,-r*1.23);c.quadraticCurveTo(r*.35,-r*.8,r*.21,-r*.36);c.lineTo(r*.64,-r*.64);c.quadraticCurveTo(r*.87,-r*.08,r*.53,0);c.closePath();c.fill();c.stroke();c.fillStyle='#fff0a5';c.beginPath();c.ellipse(0,-r*.25,r*.25,r*.44,.15,0,Math.PI*2);c.fill();
    }
    c.restore();
  }
  drawEnemyBodyMarkers(s, cue = ENEMY_CUES[relation(this.simulation.player.level, s.level)]) {
    const c = this.ctx, indices = [];
    let run = [];
    const finishRun = () => {
      if (!run.length) return;
      const regular = run.filter(i => (i - 2) % 4 === 0);
      // A short visible tail between regular marks still gets one clear symbol.
      indices.push(...(regular.length ? regular : [run[Math.floor(run.length / 2)]])); run = [];
    };
    for (let i = 1; i < s.body.length; i++) {
      const point = this.screenPosition(s.body[i]);
      if (point.x >= 0 && point.x <= this.width && point.y >= 0 && point.y <= this.height) run.push(i);
      else finishRun();
    }
    finishRun();
    if (!indices.length) return;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 1.2;
    for (const i of indices) {
      const point = this.screenPosition(s.body[i]), bodyRadius = s.radius * (.58 + .42 * (1 - i / s.body.length));
      const badgeRadius = clamp(bodyRadius * .65 * this.scale, 7.2, 9) / this.scale, margin = badgeRadius * this.scale + 2;
      const x = this.camera.x + (clamp(point.x, margin, this.width - margin) - this.width / 2) / this.scale;
      const y = this.camera.y + (clamp(point.y, margin, this.height - margin) - this.height / 2) / this.scale;
      c.fillStyle = cue.background; c.strokeStyle = cue.edge; circle(c, x, y, badgeRadius); c.fill(); c.stroke();
      c.font = `900 ${badgeRadius * 1.4}px ${FONT}`; c.fillStyle = cue.ink; c.fillText(cue.symbol, x, y + .3);
    }
    c.restore();
  }
  drawFlowerHat(s, blossom = false) {
    const c = this.ctx, r = s.radius; c.save(); c.translate(s.x - r*.12, s.y - r*.74); c.rotate(-.15);
    c.fillStyle = '#e4b867'; c.strokeStyle = '#b58b4b'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0,0,r*.95,r*.25,0,0,Math.PI*2); c.fill(); c.stroke();
    c.fillStyle = '#f3d48e'; pill(c,-r*.58,-r*.52,r*1.16,r*.57,r*.21); c.fill(); c.stroke();
    c.fillStyle = '#b494d7'; pill(c,-r*.59,-r*.15,r*1.18,r*.15,2); c.fill();
    const x = r*.5, y = -r*.22;
    c.fillStyle = blossom ? '#fff0f5' : '#f5abb8';
    for (let i=0;i<6;i++) { const a=i*Math.PI/3; circle(c,x+Math.cos(a)*r*.17,y+Math.sin(a)*r*.17,r*.13); c.fill(); }
    c.fillStyle = '#fff1a9'; circle(c,x,y,r*.12); c.fill(); c.restore();
  }
  drawLabel(s) {
    const c = this.ctx, point = this.screenPosition(s);
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (s.treasure) {
      const x = clamp(point.x - 38, 4, this.width - 80), y = clamp(point.y - point.radius - (s.jackpot ? 41 : 33), 4, this.height - 28);
      c.fillStyle = s.jackpot ? '#f3e7ff' : '#fff5d8'; c.strokeStyle = s.jackpot ? '#ad87ce' : '#d4b469'; c.lineWidth = 1; pill(c, x, y, 76, 24, 11); c.fill(); c.stroke();
      if (s.jackpot) jewel(c, x + 13, y + 12, 7); else { c.fillStyle = '#ba9038'; star(c, x + 13, y + 12, 6); }
      c.fillStyle = s.jackpot ? '#8661ad' : '#ba9038'; c.font = `700 11px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.jackpot ? '大あたり' : 'おたから', x + 45, y + 12); c.restore(); return;
    }
    const mode = relation(this.simulation.player.level, s.level), text = `Lv.${s.level}`;
    c.font = `700 11px ${FONT}`; const w = c.measureText(text).width + 37, x = point.x - w / 2, y = point.y - point.radius - 35;
    c.fillStyle = '#596b4530'; pill(c, x, y + 2, w, 24, 11); c.fill();
    c.fillStyle = mode === 'danger' ? '#fff0e5' : '#f8faee'; pill(c, x, y, w, 24, 11); c.fill();
    c.strokeStyle = mode === 'danger' ? '#ce8d74' : '#adbd97'; c.lineWidth = 1; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = mode === 'danger' ? '#b56b55' : mode === 'edible' ? '#6e9147' : '#99a88b';
    c.font = `900 13px ${FONT}`; c.fillText(mode === 'danger' ? '!' : mode === 'edible' ? '○' : '＝', x + 12, y + 12);
    c.font = `700 11px ${FONT}`; c.fillStyle = '#657851';
    c.fillText(text, x + w / 2 + 9, y + 12); c.restore();
  }
  drawGrowthLabel(s) {
    const c = this.ctx, point = this.screenPosition(s), needed = experienceNeeded(s.level), fraction = `${s.xp} / ${needed}`, title = `あなた  Lv.${s.level}`;
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.font = `700 10px ${FONT}`;
    const countWidth = c.measureText(fraction).width;
    c.font = `700 11px ${FONT}`;
    const w = Math.max(124, c.measureText(title).width + 20, countWidth + 74), h = 40;
    const x = clamp(point.x - w / 2, 6, this.width - w - 6);
    // Keep the small status card inside the field and clear of the corner buttons.
    const touchesControls = x + w > this.width - 126;
    const minY = touchesControls ? 72 : 6, maxY = this.height - 6 - h;
    let y = point.y - point.radius - h - 26;
    if (y < minY) y = point.y + point.radius + 12;
    y = clamp(y, minY, maxY);
    c.fillStyle = '#596b4530'; pill(c, x, y + 2, w, h, 11); c.fill();
    c.fillStyle = '#f5effbf2'; c.strokeStyle = '#b398d5'; c.lineWidth = 1; pill(c, x, y, w, h, 11); c.fill(); c.stroke();
    c.fillStyle = '#7957b0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(title, x + w / 2, y + 11);
    const barX = x + 9, barY = y + 23, barWidth = w - countWidth - 26, progress = clamp(s.xp / needed, 0, 1);
    c.fillStyle = '#dfd4ed'; pill(c, barX, barY, barWidth, 6, 3); c.fill();
    if (progress > 0) { c.fillStyle = progress >= .8 ? '#c5a34d' : '#9476cf'; pill(c, barX, barY, barWidth * progress, 6, 3); c.fill(); }
    c.font = `700 10px ${FONT}`; c.fillStyle = '#7957b0'; c.textAlign = 'right'; c.fillText(fraction, x + w - 8, y + 26);
    c.restore();
  }
  destroy() { this.observer.disconnect(); }
}
