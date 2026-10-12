import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { GameAudio } from './audio.js';
import { DIFFICULTIES } from './config.js';
import { experienceNeeded, appearanceFor, nextAppearance } from './rules.js';

const $ = id => document.getElementById(id);
const storage = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Saving is optional. */ } },
};
const bestValue = Number(storage.get('snake-garden-best', '1'));
let best = Number.isFinite(bestValue) && bestValue > 0 ? Math.floor(bestValue) : 1;
const audio = new GameAudio(storage.get('snake-garden-sound', 'on') !== 'off');
const savedDifficulty = storage.get('snake-garden-difficulty', 'normal');
let selectedDifficulty = Object.hasOwn(DIFFICULTIES, savedDifficulty) ? savedDifficulty : 'normal';
const sim = new Simulation(Math.random, selectedDifficulty);
try { sim.restoreGarden(JSON.parse(storage.get('snake-garden-garden', '[]'))); } catch { /* A damaged save never prevents play. */ }
const renderer = new Renderer($('game-canvas'), sim);
const input = new InputController($('game-canvas'), sim, () => {
  if (sim.state === 'playing') pause(); else if (sim.state === 'paused') resume();
}, () => renderer.screenPosition(sim.player), angle => renderer.showDirection(angle));
let lastStatus = 0, previous = 0, frameId = 0, bestAtStart = best, savedGardenRevision = sim.gardenRevision, lastGardenSave = 0;
function saveGarden() {
  if (savedGardenRevision === sim.gardenRevision) return;
  storage.set('snake-garden-garden', JSON.stringify(sim.flowers.map(({ x, y, kind, rotation, scale }) => ({ x, y, kind, rotation, scale }))));
  savedGardenRevision = sim.gardenRevision;
}
function showMenu(id) {
  $('overlay').classList.toggle('hidden', !id);
  for (const menu of ['start-menu', 'pause-menu', 'end-menu']) $(menu).classList.toggle('hidden', id !== menu);
  $('pause-button').disabled = sim.state !== 'playing';
  $('pause-button').classList.toggle('hidden', Boolean(id));
  $('legend').classList.toggle('hidden', Boolean(id));
  $('appearance-badge').classList.toggle('hidden', Boolean(id));
}
function announce(text) {
  $('announcement').textContent = text;
}
function updateStatus() {
  const p = sim.player, needed = experienceNeeded(p.level);
  $('level').textContent = p.level; $('xp-text').textContent = `${p.xp} / ${needed}`;
  $('xp-fill').style.width = `${p.xp / needed * 100}%`;
  const progress = document.querySelector('.progress'); progress.setAttribute('aria-valuemax', needed); progress.setAttribute('aria-valuenow', p.xp);
  if (p.level > best) { best = p.level; storage.set('snake-garden-best', best); }
  $('best-level').textContent = `Lv. ${best}`;
  const style = appearanceFor(p.level), nextStyle = nextAppearance(p.level);
  $('appearance-name').textContent = style.label;
  $('appearance-icon').setAttribute('href', `#${style.icon}`);
  $('next-appearance').textContent = nextStyle ? `つぎの へんしん Lv.${nextStyle.level}` : 'ぜんぶ へんしん！';
  $('appearance-badge').setAttribute('aria-label', `${style.label}のヘビ。${nextStyle ? `レベル${nextStyle.level}で${nextStyle.label}に変身` : 'すべての変身を達成'}`);
  $('garden-text').textContent = `お花 ${sim.flowers.length}本 ・ おたから ${sim.treasuresCaught}ひき`;
  $('pause-difficulty').textContent = sim.settings.label;
}
function difficultyUi() {
  for (const choice of document.querySelectorAll('input[name="difficulty"]')) choice.checked = choice.value === selectedDifficulty;
  $('difficulty-hint').textContent = DIFFICULTIES[selectedDifficulty].description;
}
function soundUi() {
  $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
  $('sound-button').setAttribute('aria-label', audio.enabled ? '音をオフにする' : '音をオンにする');
  $('sound-button').querySelector('use').setAttribute('href', audio.enabled ? '#i-sound' : '#i-mute');
}
function start() {
  bestAtStart = best; input.clear(); sim.reset(selectedDifficulty); sim.start(); renderer.resetCamera();
  audio.init(); audio.play('start'); showMenu(null); updateStatus();
  document.activeElement?.blur(); announce(`★ はじめの${sim.settings.protectionSeconds}びょうは まもられるよ`);
}
function chooseAgain() {
  input.clear(); saveGarden(); sim.reset(selectedDifficulty); renderer.resetCamera(); updateStatus();
  $('announcement').textContent = ''; showMenu('start-menu'); $('start-button').focus({ preventScroll: true });
}
function pause() {
  if (sim.state !== 'playing') return;
  sim.pause(); input.clear(); updateStatus(); saveGarden(); showMenu('pause-menu'); $('resume-button').focus({ preventScroll: true });
}
function resume() {
  if (sim.state !== 'paused') return;
  input.clear(); sim.resume(); audio.init(); showMenu(null); document.activeElement?.blur(); previous = performance.now();
}
function finish() {
  input.clear(); updateStatus(); saveGarden(); $('announcement').textContent = '';
  $('result-level').textContent = sim.player.level;
  $('end-eyebrow').textContent = sim.player.level > bestAtStart ? '★ さいこうレベル 更新！' : 'よく そだったね！';
  $('result-stats').textContent = `${sim.settings.label} ・ エサ ${sim.foodEaten}こ ・ ヘビ ${sim.enemiesEaten}ひき ぱくっ！`;
  $('garden-stats').textContent = `お花を ${sim.flowersPlanted}本 さかせたよ！ おたから ${sim.treasuresCaught}ひき`;
  showMenu('end-menu'); $('again-button').focus({ preventScroll: true });
}
$('start-button').addEventListener('click', start);
$('again-button').addEventListener('click', start);
$('restart-button').addEventListener('click', start);
$('pause-button').addEventListener('click', pause);
$('resume-button').addEventListener('click', resume);
$('pause-choose-button').addEventListener('click', chooseAgain);
$('end-choose-button').addEventListener('click', chooseAgain);
for (const choice of document.querySelectorAll('input[name="difficulty"]')) choice.addEventListener('change', () => {
  if (!choice.checked || !Object.hasOwn(DIFFICULTIES, choice.value)) return;
  selectedDifficulty = choice.value; storage.set('snake-garden-difficulty', selectedDifficulty); difficultyUi();
});
$('sound-button').addEventListener('click', () => { audio.enabled = !audio.enabled; if (audio.enabled) audio.init(); storage.set('snake-garden-sound', audio.enabled ? 'on' : 'off'); soundUi(); });
document.addEventListener('visibilitychange', () => { input.clear(); previous = 0; if (document.hidden) pause(); });
window.addEventListener('blur', pause);
function frame(now) {
  const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
  sim.step(dt, input.getAngle());
  for (const event of sim.events.splice(0)) {
    audio.play(event.type, event);
    if (event.type === 'level') { updateStatus(); announce(event.style ? `★ ${event.style.label}に へんしん！` : `レベル ${event.level}！ ぐんぐん そだったね`); }
    if (event.type === 'treasure-appear') announce('金色の おたからヘビ！ 追いかけてみよう');
    if (event.type === 'treasure') { updateStatus(); announce('おたから！ フルーツが いっぱい'); }
    if (event.type === 'over') finish();
  }
  if (now - lastStatus > 120) { updateStatus(); lastStatus = now; }
  if (now - lastGardenSave > 2000) { saveGarden(); lastGardenSave = now; }
  renderer.draw(dt); frameId = requestAnimationFrame(frame);
}
soundUi(); difficultyUi(); updateStatus(); showMenu('start-menu'); frameId = requestAnimationFrame(frame);
window.addEventListener('pagehide', saveGarden);
window.addEventListener('unload', () => { saveGarden(); cancelAnimationFrame(frameId); renderer.destroy(); input.destroy(); audio.destroy(); });
