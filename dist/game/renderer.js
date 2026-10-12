import { CONFIG, RAINBOW_COLORS } from './config.js';
import { relation, clamp, appearanceFor } from './rules.js';
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
      c.save(); c.globalAlpha = Math.min(1, pt.life * 3); c.font = `800 ${pt.large ? 23 : pt.bite ? 16 : 19}px ${FONT}`; c.textAlign = 'center';
      c.lineWidth = 5; c.strokeStyle = '#fdfcf5'; c.strokeText(pt.text, pt.x, pt.y); c.fillStyle = pt.bite ? '#b56c57' : '#7956b7'; c.fillText(pt.text, pt.x, pt.y); c.restore();
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
    c.save(); c.translate(f.x, f.y + bob); c.scale(f.large ? CONFIG.bigFruitScale : 1, f.large ? CONFIG.bigFruitScale : 1);
    if (f.large) {
      c.fillStyle = '#fff3ba65'; circle(c, 0, 0, 17 + Math.sin(this.clock * 2 + f.phase)); c.fill();
      c.strokeStyle = '#fff8d8b0'; c.lineWidth = 1.2; circle(c, 0, 0, 17); c.stroke();
      c.fillStyle = '#fff9d8'; c.beginPath(); c.moveTo(15,-19); c.lineTo(17,-14); c.lineTo(22,-12); c.lineTo(17,-10); c.lineTo(15,-5); c.lineTo(13,-10); c.lineTo(8,-12); c.lineTo(13,-14); c.closePath(); c.fill();
    }
    c.fillStyle = '#78975a38'; c.beginPath(); c.ellipse(0, 10, 10, 3.7, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = 1.2; c.lineJoin = 'round'; c.lineCap = 'round';
    if (f.kind === 'banana') {
      c.fillStyle = '#f2cd62'; c.strokeStyle = '#c99e42'; c.beginPath();
      c.moveTo(-11,-7); c.quadraticCurveTo(-3,8,12,-5); c.quadraticCurveTo(10,8,1,11); c.quadraticCurveTo(-12,12,-11,-7); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#fff0b5'; c.lineWidth = 2; c.beginPath(); c.moveTo(-7,-1); c.quadraticCurveTo(-3,9,7,3); c.stroke();
      c.strokeStyle = '#8a7951'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-11,-7); c.lineTo(-10,-5); c.moveTo(12,-5); c.lineTo(11,-3); c.stroke();
    } else if (f.kind === 'grapes') {
      c.strokeStyle = '#63874e'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0,-9); c.quadraticCurveTo(-3,-13,1,-16); c.stroke();
      c.fillStyle = '#81a764'; c.beginPath(); c.ellipse(5,-12,5,2.4,-.5,0,Math.PI*2); c.fill();
      for (const [x,y] of [[0,6],[-3,0],[4,0],[-5,-6],[3,-6]]) {
        c.fillStyle = '#a286ca'; c.strokeStyle = '#8063a8'; c.lineWidth = .8; circle(c,x,y,4.4); c.fill(); c.stroke();
        c.fillStyle = '#d7c8eb'; circle(c,x-1.2,y-1.5,1.2); c.fill();
      }
    } else {
      c.strokeStyle = '#886443'; c.lineWidth = 2; c.beginPath(); c.moveTo(0,-7); c.quadraticCurveTo(-2,-12,1,-15); c.stroke();
      c.fillStyle = '#85ac68'; c.beginPath(); c.ellipse(5,-11,5,2.6,-.4,0,Math.PI*2); c.fill();
      c.fillStyle = '#ed837d'; c.strokeStyle = '#c26763'; c.lineWidth = 1.1; c.beginPath();
      c.moveTo(0,-7); c.bezierCurveTo(-13,-13,-14,6,-5,9); c.quadraticCurveTo(0,11,4,9); c.bezierCurveTo(14,7,13,-12,0,-7); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#ffbdb0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-6,-3); c.quadraticCurveTo(-8,-1,-7,3); c.stroke();
    }
    c.restore();
  }
  drawSnake(s, player) {
    const c = this.ctx, r = s.radius, count = s.body.length, style = player ? appearanceFor(s.level).id : 'plain';
    const rainbow = style === 'rainbow', hat = style === 'flower' || rainbow;
    const chew = player && s.chewTimer > 0 ? Math.sin((1 - s.chewTimer / CONFIG.chewSeconds) * Math.PI) : 0;
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
    for (let i = count - 1; i >= 1; i--) {
      const pt = s.body[i]; if (!this.visible(pt.x, pt.y, 45)) continue;
      const size = r * (.58 + .42 * (1 - i / count));
      const colors = rainbow ? RAINBOW_COLORS[i % RAINBOW_COLORS.length] : s.colors;
      c.fillStyle = colors[1]; circle(c, pt.x, pt.y + 1.5, size); c.fill();
      c.fillStyle = colors[0]; circle(c, pt.x, pt.y - 1, size); c.fill();
      if (player && style !== 'plain') {
        c.fillStyle = '#fffaf0bb'; circle(c, pt.x - size * .28, pt.y - size * .33, size * .18); c.fill();
        circle(c, pt.x + size * .31, pt.y + size * .2, size * .14); c.fill();
      } else if (!player && s.level >= 4 && i % 2 === 0) { c.fillStyle = '#ffffff40'; circle(c, pt.x - size * .2, pt.y - size * .23, size * .45); c.fill(); }
      else { c.fillStyle = '#ffffff1a'; circle(c, pt.x - size * .22, pt.y - size * .25, size * .55); c.fill(); }
    }
    if (!this.visible(s.x, s.y)) return;
    c.save(); c.translate(s.x, s.y); c.rotate(s.angle); c.scale(1 + chew * .14, 1 + chew * .24);
    c.fillStyle = s.colors[1]; c.beginPath(); c.ellipse(0, 2, r * 1.13, r, 0, 0, Math.PI * 2); c.fill();
    if (rainbow) {
      const gradient = c.createLinearGradient(-r, -r, r, r);
      RAINBOW_COLORS.forEach((colors,i) => gradient.addColorStop(i / (RAINBOW_COLORS.length - 1), colors[0])); c.fillStyle = gradient;
    } else c.fillStyle = s.colors[0];
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
    } else { c.strokeStyle = s.colors[1]; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(r * .87, -r * .16); c.quadraticCurveTo(r * 1.06, 0, r * .87, r * .16); c.stroke(); }
    c.restore();
    if (hat) this.drawFlowerHat(s);
    if (!player && relation(this.simulation.player.level, s.level) === 'danger') {
      c.strokeStyle = '#b96a5c77'; c.lineWidth = 1.8; circle(c, s.x, s.y, r + 5); c.stroke();
    }
  }
  drawFlowerHat(s) {
    const c = this.ctx, r = s.radius; c.save(); c.translate(s.x - r*.12, s.y - r*.74); c.rotate(-.15);
    c.fillStyle = '#e4b867'; c.strokeStyle = '#b58b4b'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0,0,r*.95,r*.25,0,0,Math.PI*2); c.fill(); c.stroke();
    c.fillStyle = '#f3d48e'; pill(c,-r*.58,-r*.52,r*1.16,r*.57,r*.21); c.fill(); c.stroke();
    c.fillStyle = '#b494d7'; pill(c,-r*.59,-r*.15,r*1.18,r*.15,2); c.fill();
    const x = r*.5, y = -r*.22;
    c.fillStyle = '#f5abb8';
    for (let i=0;i<6;i++) { const a=i*Math.PI/3; circle(c,x+Math.cos(a)*r*.17,y+Math.sin(a)*r*.17,r*.13); c.fill(); }
    c.fillStyle = '#fff1a9'; circle(c,x,y,r*.12); c.fill(); c.restore();
  }
  drawLabel(s, player) {
    const c = this.ctx, mode = relation(this.simulation.player.level, s.level), text = player ? `あなた  Lv.${s.level}` : `Lv.${s.level}`;
    c.font = `700 10px ${FONT}`; const w = c.measureText(text).width + (player ? 19 : 37), x = s.x - w / 2, y = s.y - s.radius - (player && s.level >= 5 ? 43 : 35);
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
