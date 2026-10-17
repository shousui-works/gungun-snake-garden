import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { GameAudio } from './audio.js';
import { DIFFICULTIES } from './config.js';
import { experienceNeeded, appearanceFor, nextAppearance } from './rules.js';
import { RankingClient, normalizePlayerName, formatRecordDate } from './ranking.js';
import { VIEW_MODES, viewModeFor } from './view.js';

const $ = id => document.getElementById(id);
const storage = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Saving is optional. */ } },
};
const ranking = new RankingClient(storage);
let activeRun = null, completedRun = null, currentMenu = 'start-menu', rankingReturn = 'start-menu', rankingFocus = null;
let rankingDifficulty = 'normal', boardRequest = null, boardVersion = 0, submitting = false;
const bestValue = Number(storage.get('snake-garden-best', '1'));
let best = Number.isFinite(bestValue) && bestValue > 0 ? Math.floor(bestValue) : 1;
const audio = new GameAudio(storage.get('snake-garden-sound', 'on') !== 'off');
const savedDifficulty = storage.get('snake-garden-difficulty', 'normal');
let selectedDifficulty = Object.hasOwn(DIFFICULTIES, savedDifficulty) ? savedDifficulty : 'normal';
const sim = new Simulation(Math.random, selectedDifficulty);
try { sim.restoreGarden(JSON.parse(storage.get('snake-garden-garden', '[]'))); } catch { /* A damaged save never prevents play. */ }
let selectedView = viewModeFor(storage.get('snake-garden-view', 'wide'));
const renderer = new Renderer($('game-canvas'), sim, selectedView);
const input = new InputController($('game-canvas'), sim, () => {
  if (currentMenu === 'ranking-menu') { closeRanking(); return; }
  if (sim.state === 'playing') pause(); else if (sim.state === 'paused') resume();
}, () => renderer.screenPosition(sim.player), angle => renderer.showDirection(angle));
let lastStatus = 0, previous = 0, frameId = 0, bestAtStart = best, savedGardenRevision = sim.gardenRevision, lastGardenSave = 0;
function saveGarden() {
  if (savedGardenRevision === sim.gardenRevision) return;
  storage.set('snake-garden-garden', JSON.stringify(sim.flowers.map(({ x, y, kind, rotation, scale }) => ({ x, y, kind, rotation, scale }))));
  savedGardenRevision = sim.gardenRevision;
}
function showMenu(id) {
  currentMenu = id;
  $('overlay').classList.toggle('hidden', !id);
  for (const menu of ['start-menu', 'pause-menu', 'end-menu', 'ranking-menu']) $(menu).classList.toggle('hidden', id !== menu);
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
function viewUi() {
  for (const choice of document.querySelectorAll('input[name="view-mode"]')) choice.checked = choice.value === selectedView;
  $('view-hint').textContent = VIEW_MODES[selectedView].description;
}
function start() {
  activeRun = ranking.begin(selectedDifficulty); completedRun = null;
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
  completedRun = { run: activeRun, level: sim.player.level, xp: sim.player.xp, seconds: sim.time };
  $('record-button').disabled = false; $('record-button').textContent = 'とうろく'; $('record-status').textContent = ''; submitting = false;
  const nickname = storage.get('snake-garden-nickname', '');
  $('nickname').value = normalizePlayerName(nickname) || `${['りんご', 'バナナ', 'ぶどう'][Math.floor(Math.random() * 3)]}ヘビ${Math.floor(Math.random() * 90) + 10}`;
  showMenu('end-menu'); $('again-button').focus({ preventScroll: true });
}
function appendRecordTime(container, recordedAt) {
  const formatted = formatRecordDate(recordedAt);
  if (!formatted) return;
  const time = document.createElement('time'); time.className = 'ranking-date';
  time.dateTime = recordedAt; time.textContent = formatted;
  time.setAttribute('aria-label', `自己ベストの登録日時 ${formatted} 日本時間`);
  container.append(time);
}
function displayBoard(data) {
  $('ranking-list').replaceChildren();
  for (const row of data.entries) {
    const item = document.createElement('div'); item.className = `ranking-row${row.isYou ? ' is-you' : ''}`;
    const rank = document.createElement('span'); rank.className = `ranking-place place-${row.rank}`; rank.textContent = row.rank;
    const name = document.createElement('span'); name.className = 'ranking-name'; name.textContent = row.name;
    if (row.isYou) { const you = document.createElement('small'); you.textContent = 'あなた'; name.append(you); }
    appendRecordTime(name, row.recordedAt);
    const score = document.createElement('span'); score.className = 'ranking-score';
    const level = document.createElement('strong'); level.textContent = `Lv. ${row.level}`;
    const xp = document.createElement('small'); xp.textContent = `経験値 ${row.xp} / ${experienceNeeded(row.level)}`;
    score.append(level, xp); item.append(rank, name, score); $('ranking-list').append(item);
  }
  $('ranking-personal').classList.toggle('hidden', !data.personal);
  $('ranking-delete-button').classList.toggle('hidden', !data.personal);
  $('ranking-delete-confirm').classList.add('hidden');
  if (data.personal) {
    $('ranking-personal').textContent = `あなたの自己ベスト ${data.personal.rank}位 ・ Lv. ${data.personal.level} ・ 経験値 ${data.personal.xp}`;
    appendRecordTime($('ranking-personal'), data.personal.recordedAt);
  }
  $('ranking-message').textContent = data.entries.length ? '' : 'まだ記録がないよ。最初のヘビになろう！';
}
async function loadBoard() {
  boardRequest?.abort(); const controller = new AbortController(); boardRequest = controller;
  const version = ++boardVersion;
  $('ranking-list').replaceChildren(); $('ranking-personal').classList.add('hidden');
  $('ranking-delete-button').classList.add('hidden'); $('ranking-delete-confirm').classList.add('hidden');
  $('ranking-message').textContent = '記録を よんでいるよ…'; $('ranking-list').setAttribute('aria-busy', 'true');
  for (const choice of document.querySelectorAll('input[name="ranking-difficulty"]')) choice.checked = choice.value === rankingDifficulty;
  try { const data = await ranking.load(rankingDifficulty, controller.signal); if (version === boardVersion && currentMenu === 'ranking-menu') displayBoard(data); }
  catch { if (!controller.signal.aborted && version === boardVersion) $('ranking-message').textContent = '今は記録をよめないよ。「こうしん」で もう一度ためしてね。'; }
  finally { if (version === boardVersion) $('ranking-list').setAttribute('aria-busy', 'false'); }
}
function openRanking(event) {
  rankingReturn = currentMenu; rankingFocus = event.currentTarget;
  rankingDifficulty = sim.state === 'ready' ? selectedDifficulty : sim.difficulty;
  showMenu('ranking-menu'); loadBoard(); $('ranking-close-button').focus({ preventScroll: true });
}
function closeRanking() {
  boardRequest?.abort(); boardVersion++; showMenu(rankingReturn); rankingFocus?.focus({ preventScroll: true });
}
const rankingErrors = {
  invalid_name: 'ニックネームを 1〜12文字で入れてね。',
  run_unavailable: 'このプレイの記録を登録できなかったよ。ネットにつないで、次のプレイでまたためしてね。',
  expired_run: 'この記録の登録期限がすぎたよ。また あそぼう！',
  invalid_score: 'この記録は登録できなかったよ。次のプレイでまたためしてね。',
};
$('record-form').addEventListener('submit', async event => {
  event.preventDefault(); if (submitting || !completedRun || completedRun.saved) return;
  if (!normalizePlayerName($('nickname').value)) { $('record-status').textContent = rankingErrors.invalid_name; $('nickname').focus(); return; }
  const result = completedRun; submitting = true; $('record-button').disabled = true; $('record-button').textContent = '登録中…';
  $('record-status').textContent = '';
  try {
    const data = await ranking.submit(result, $('nickname').value); result.saved = true;
    if (completedRun === result) { $('record-button').textContent = '登録ずみ'; $('record-status').textContent = `登録できたよ！ 自己ベストは ${data.personal.rank}位`; }
  } catch (error) {
    if (completedRun === result) { $('record-button').disabled = false; $('record-button').textContent = 'もう一度'; $('record-status').textContent = rankingErrors[error.message] || '通信できなかったよ。ネットにつないで もう一度ためしてね。'; }
  } finally { if (completedRun === result) submitting = false; }
});
for (const id of ['start-ranking-button', 'pause-ranking-button', 'end-ranking-button']) $(id).addEventListener('click', openRanking);
$('ranking-close-button').addEventListener('click', closeRanking);
$('ranking-refresh-button').addEventListener('click', loadBoard);
$('ranking-delete-button').addEventListener('click', () => { $('ranking-delete-button').classList.add('hidden'); $('ranking-delete-confirm').classList.remove('hidden'); $('ranking-delete-no').focus({ preventScroll: true }); });
$('ranking-delete-no').addEventListener('click', () => { $('ranking-delete-confirm').classList.add('hidden'); $('ranking-delete-button').classList.remove('hidden'); $('ranking-delete-button').focus({ preventScroll: true }); });
$('ranking-delete-yes').addEventListener('click', async () => {
  const mode = rankingDifficulty, version = boardVersion; $('ranking-delete-yes').disabled = true;
  try { const data = await ranking.remove(mode); if (version === boardVersion && currentMenu === 'ranking-menu') { displayBoard(data); $('ranking-message').textContent = '自分の記録を 消したよ。'; $('ranking-close-button').focus({ preventScroll: true }); } }
  catch { if (version === boardVersion) $('ranking-message').textContent = '記録を消せなかったよ。もう一度ためしてね。'; }
  finally { $('ranking-delete-yes').disabled = false; }
});
for (const choice of document.querySelectorAll('input[name="ranking-difficulty"]')) choice.addEventListener('change', () => { if (choice.checked) { rankingDifficulty = choice.value; loadBoard(); } });
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
for (const choice of document.querySelectorAll('input[name="view-mode"]')) choice.addEventListener('change', () => {
  if (!choice.checked || !Object.hasOwn(VIEW_MODES, choice.value)) return;
  input.clear(); selectedView = choice.value; storage.set('snake-garden-view', selectedView); renderer.setViewMode(selectedView); viewUi();
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
    if (event.type === 'treasure-appear') announce(event.jackpot ? '大あたり！ 宝石の おたからヘビ！' : '金色の おたからヘビ！ 追いかけてみよう');
    if (event.type === 'treasure') { updateStatus(); announce(event.jackpot ? '大あたり！ ごうかな おたからフルーツ！' : 'おたから！ フルーツを あつめよう'); }
    if (event.type === 'over') finish();
  }
  if (now - lastStatus > 120) { updateStatus(); lastStatus = now; }
  if (now - lastGardenSave > 2000) { saveGarden(); lastGardenSave = now; }
  renderer.draw(dt); frameId = requestAnimationFrame(frame);
}
soundUi(); difficultyUi(); viewUi(); updateStatus(); showMenu('start-menu'); frameId = requestAnimationFrame(frame);
window.addEventListener('pagehide', saveGarden);
window.addEventListener('unload', () => { saveGarden(); cancelAnimationFrame(frameId); renderer.destroy(); input.destroy(); audio.destroy(); });
