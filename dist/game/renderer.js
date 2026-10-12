import { CONFIG } from './config.js';
import { relation, clamp } from './rules.js';
const FONT = '"Hiragino Maru Gothic ProN", "Yu Gothic", system-ui, sans-serif';
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
function pill(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export class Renderer {
  constructor(canvas, simulation) {
    this.canvas = canvas; this.simulation = simulation; this.ctx = canvas.getContext('2d', { alpha: false }); this.camera = { x: 800, y: 800 }; this.clock = 0;
    this.decorations = Array.from({ length: 135 }, (_, i) => ({ x: ((i * 227 + 61) % 1500) + 50, y: ((i * 379 + 137) % 1500) + 50, type: i % 5, rotation: i * 1.62 }));
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.scale = this.width < 650 ? .83 : 1.08;
    this.simulation.viewport = { width: this.width / this.scale, height: this.height / this.scale };
  }
  resetCamera() { this.camera = { x: this.simulation.player.x, y: this.simulation.player.y }; }
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
    for (const f of sim.food) if (this.visible(f.x, f.y)) this.drawFood(f);
    for (const e of sim.enemies) if (e.active) this.drawSnake(e, false);
    this.drawSnake(p, true);
    for (const e of sim.enemies) if (e.active && this.visible(e.x, e.y)) this.drawLabel(e, false);
    this.drawLabel(p, true);
    for (const pt of sim.particles) {
      c.globalAlpha = Math.max(0, pt.life / pt.maxLife); c.fillStyle = pt.color; circle(c, pt.x, pt.y, pt.radius); c.fill();
    }
    c.globalAlpha = 1;
    for (const pt of sim.popups) {
      c.save(); c.globalAlpha = Math.min(1, pt.life * 3); c.font = `800 ${pt.large ? 24 : 19}px ${FONT}`; c.textAlign = 'center';
      c.lineWidth = 5; c.strokeStyle = '#fdfcf5'; c.strokeText(pt.text, pt.x, pt.y); c.fillStyle = '#7956b7'; c.fillText(pt.text, pt.x, pt.y); c.restore();
    }
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
    const c = this.ctx, bob = Math.sin(this.clock * 2.2 + f.phase) * 1.1;
    c.fillStyle = '#879e6540'; c.beginPath(); c.ellipse(f.x, f.y + 5, 8, 4, 0, 0, Math.PI * 2); c.fill();
    const colors = ['#f3cf61', '#edb784', '#efd475'];
    c.fillStyle = ['#d6b147', '#d59362', '#d6b451'][f.color]; circle(c, f.x, f.y + bob, 8); c.fill();
    c.fillStyle = colors[f.color]; circle(c, f.x, f.y - 1.7 + bob, 7.6); c.fill();
    c.fillStyle = '#fff2c7'; c.beginPath(); c.ellipse(f.x - 2.5, f.y - 4 + bob, 2.4, 1.7, -.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#89a765'; c.beginPath(); c.ellipse(f.x + 3, f.y - 9 + bob, 4.2, 2, -.7, 0, Math.PI * 2); c.fill();
  }
  drawSnake(s, player) {
    const c = this.ctx, r = s.radius, count = s.body.length;
    if (player && this.simulation.protection > 0 && this.simulation.state === 'playing') {
      c.save(); c.strokeStyle = '#faf5c4'; c.lineWidth = 3; c.setLineDash([7, 6]); c.lineDashOffset = -this.clock * 14; circle(c, s.x, s.y, r + 12); c.stroke();
      c.fillStyle = '#fbf3c130'; circle(c, s.x, s.y, r + 12); c.fill(); c.restore();
    }
    for (let i = count - 1; i >= 0; i--) {
      const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
      const size = r * (.58 + .42 * (1 - i / count));
      c.fillStyle = '#66805235'; circle(c, pt.x + 1, pt.y + 4, size + 1); c.fill();
    }
    for (let i = count - 1; i >= 1; i--) {
      const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
      const size = r * (.58 + .42 * (1 - i / count));
      c.fillStyle = s.colors[1]; circle(c, pt.x, pt.y + 1.5, size); c.fill();
      c.fillStyle = s.colors[0]; circle(c, pt.x, pt.y - 1, size); c.fill();
      if (s.level >= 4 && i % 2 === 0) { c.fillStyle = '#ffffff40'; circle(c, pt.x - size * .2, pt.y - size * .23, size * .45); c.fill(); }
      else { c.fillStyle = '#ffffff1a'; circle(c, pt.x - size * .22, pt.y - size * .25, size * .55); c.fill(); }
    }
    if (!this.visible(s.x, s.y)) return;
    c.save(); c.translate(s.x, s.y); c.rotate(s.angle);
    c.fillStyle = s.colors[1]; c.beginPath(); c.ellipse(0, 2, r * 1.13, r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = s.colors[0]; c.beginPath(); c.ellipse(0, 0, r * 1.13, r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff18'; c.beginPath(); c.ellipse(-r * .16, 0, r * .55, r * .76, 0, 0, Math.PI * 2); c.fill();
    for (const side of [-1, 1]) {
      c.fillStyle = '#fffdf3'; circle(c, r * .45, side * r * .48, r * .34); c.fill();
      c.fillStyle = '#3d423c'; circle(c, r * .56, side * r * .48, r * .15); c.fill();
      c.fillStyle = '#fff'; circle(c, r * .59, side * r * .48 - r * .045, r * .045); c.fill();
    }
    c.strokeStyle = s.colors[1]; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(r * .87, -r * .16); c.quadraticCurveTo(r * 1.06, 0, r * .87, r * .16); c.stroke(); c.restore();
    if (!player && relation(this.simulation.player.level, s.level) === 'danger') {
      c.strokeStyle = '#b96a5c77'; c.lineWidth = 1.8; circle(c, s.x, s.y, r + 5); c.stroke();
    }
  }
  drawLabel(s, player) {
    const c = this.ctx, mode = relation(this.simulation.player.level, s.level), text = player ? `あなた  Lv.${s.level}` : `Lv.${s.level}`;
    c.font = `700 10px ${FONT}`; const w = c.measureText(text).width + (player ? 19 : 37), x = s.x - w / 2, y = s.y - s.radius - 35;
    c.fillStyle = '#596b4530'; pill(c, x, y + 2, w, 24, 11); c.fill();
    c.fillStyle = player ? '#f5effb' : mode === 'danger' ? '#fff0e5' : '#f8faee'; pill(c, x, y, w, 24, 11); c.fill();
    c.strokeStyle = player ? '#b398d5' : mode === 'danger' ? '#ce8d74' : '#adbd97'; c.lineWidth = 1; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = player ? '#7957b0' : '#657851';
    if (!player) {
      c.fillStyle = mode === 'danger' ? '#b56b55' : mode === 'edible' ? '#6e9147' : '#99a88b';
      c.font = `900 13px ${FONT}`; c.fillText(mode === 'danger' ? '!' : mode === 'edible' ? '○' : '＝', x + 12, y + 12);
      c.font = `700 10px ${FONT}`; c.fillStyle = '#657851';
    }
    c.fillText(text, x + w / 2 + (player ? 0 : 9), y + 12); c.textBaseline = 'alphabetic';
  }
  destroy() { this.observer.disconnect(); }
}
