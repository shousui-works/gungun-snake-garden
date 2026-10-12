import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { GameAudio } from './audio.js';
import { experienceNeeded } from './rules.js';

const $ = id => document.getElementById(id);
const storage = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Saving is optional. */ } },
};
const bestValue = Number(storage.get('snake-garden-best', '1'));
let best = Number.isFinite(bestValue) && bestValue > 0 ? Math.floor(bestValue) : 1;
const audio = new GameAudio(storage.get('snake-garden-sound', 'on') !== 'off');
const sim = new Simulation();
const renderer = new Renderer($('game-canvas'), sim);
const input = new InputController($('controls'), sim, () => {
  if (sim.state === 'playing') pause(); else if (sim.state === 'paused') resume();
});
let announcementUntil = 0, lastHud = 0, previous = 0, frameId = 0, bestAtStart = best;
function showMenu(id) {
  $('overlay').classList.toggle('hidden', !id);
  for (const menu of ['start-menu', 'pause-menu', 'end-menu']) $(menu).classList.toggle('hidden', id !== menu);
  $('pause-button').disabled = sim.state !== 'playing';
  $('legend').classList.toggle('hidden', Boolean(id));
}
function announce(text, seconds = 2.5) {
  $('announcement').textContent = text; announcementUntil = sim.time + seconds;
  $('announcement').classList.add('visible');
}
function updateHud() {
  const p = sim.player, needed = experienceNeeded(p.level);
  $('level').textContent = p.level; $('xp-text').textContent = `${p.xp} / ${needed}`;
  $('xp-fill').style.width = `${p.xp / needed * 100}%`;
  const progress = document.querySelector('.progress'); progress.setAttribute('aria-valuemax', needed); progress.setAttribute('aria-valuenow', p.xp);
  $('shield').classList.toggle('hidden', sim.protection <= 0 || sim.state !== 'playing');
  $('shield').textContent = `★ まもられているよ ${Math.ceil(sim.protection)}`;
  if (p.level > best) { best = p.level; storage.set('snake-garden-best', best); }
  $('best-level').textContent = `Lv. ${best}`;
}
function soundUi() {
  $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
  $('sound-button').setAttribute('aria-label', audio.enabled ? '音をオフにする' : '音をオンにする');
  $('sound-button').querySelector('use').setAttribute('href', audio.enabled ? '#i-sound' : '#i-mute');
}
function start() {
  bestAtStart = best; input.clear(); sim.reset(); sim.start(); renderer.resetCamera();
  audio.init(); audio.play('start'); showMenu(null); updateHud();
  document.activeElement?.blur(); announce('★ はじめの5びょうは まもられるよ', 5);
}
function pause() {
  if (sim.state !== 'playing') return;
  sim.pause(); input.clear(); showMenu('pause-menu'); $('resume-button').focus({ preventScroll: true });
}
function resume() {
  if (sim.state !== 'paused') return;
  input.clear(); sim.resume(); audio.init(); showMenu(null); document.activeElement?.blur(); previous = performance.now();
}
function finish() {
  input.clear(); updateHud(); $('announcement').classList.remove('visible');
  $('result-level').textContent = sim.player.level;
  $('end-eyebrow').textContent = sim.player.level > bestAtStart ? '★ さいこうレベル 更新！' : 'よく そだったね！';
  $('result-stats').textContent = `エサ ${sim.foodEaten}こ ・ ヘビ ${sim.enemiesEaten}ひき ぱくっ！`;
  showMenu('end-menu'); $('again-button').focus({ preventScroll: true });
}
$('start-button').addEventListener('click', start);
$('again-button').addEventListener('click', start);
$('restart-button').addEventListener('click', start);
$('pause-button').addEventListener('click', pause);
$('resume-button').addEventListener('click', resume);
$('sound-button').addEventListener('click', () => { audio.enabled = !audio.enabled; if (audio.enabled) audio.init(); storage.set('snake-garden-sound', audio.enabled ? 'on' : 'off'); soundUi(); });
document.addEventListener('visibilitychange', () => { input.clear(); previous = 0; if (document.hidden) pause(); });
window.addEventListener('blur', pause);
function frame(now) {
  const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
  sim.step(dt, input.getAngle());
  for (const event of sim.events.splice(0)) {
    audio.play(event.type);
    if (event.type === 'level') { updateHud(); announce(`レベル ${event.level}！ ぐんぐん そだったね`, 2.3); }
    if (event.type === 'over') finish();
  }
  if (sim.state === 'playing' && sim.time > announcementUntil) $('announcement').classList.remove('visible');
  if (now - lastHud > 120) { updateHud(); lastHud = now; }
  renderer.draw(dt); frameId = requestAnimationFrame(frame);
}
soundUi(); updateHud(); showMenu('start-menu'); frameId = requestAnimationFrame(frame);
window.addEventListener('unload', () => { cancelAnimationFrame(frameId); renderer.destroy(); input.destroy(); audio.destroy(); });
