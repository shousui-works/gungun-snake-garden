export const CONFIG = Object.freeze({
  worldSize: 1600, foodCount: 80, enemyCount: 4, maxEnemies: 6,
  snakeSpeed: 150, turnSpeed: 5.2,
  playerTurnSpeed: 8.25, inputDeadZone: 12, pointerMoveDeadZone: 6,
  protectionSeconds: 5, respawnSeconds: 3, maxSegments: 40,
  bigFruitChance: .08, bigFruitScale: 1.5, bigFruitXp: 3,
  chewSeconds: .6, comboSeconds: 2.2, comboCap: 8, maxPopups: 12,
  treasureFirstSeconds: 8, treasureIntervalSeconds: 24, treasureLifetime: 24,
  treasureSpeed: 120, treasureTurnSpeed: 6, treasureFruitCount: 8, maxBonusFruit: 16,
  treasureBaseXp: 10, treasureLevelShare: .5, treasureJackpotChance: .15,
  fruitFlightSeconds: .55, bonusFruitLifetime: 22, maxFlowers: 600,
  playerColor: '#9b83db', playerDark: '#7257b1',
  enemyColors: [ ['#79bea6', '#3f8870'], ['#edb674', '#b57d3b'], ['#74b8d5', '#367f9f'], ['#e99691', '#ae555f'], ['#9bbd76', '#638a3f'], ['#c7a0c9', '#936b96'] ],
});
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: 'やさしい', description: 'ゆったり進む・敵はひかえめ', speed: 115, treasureSpeedScale: .75,
    enemyCount: 3, maxEnemies: 4, enemyLevels: Object.freeze([1, 1, 2]),
    protectionSeconds: 8, respawnSeconds: 4.5, strongChance: .15, strongOffsetMax: 1,
    chaseRange: 125, chaseSeconds: .8, chaseCooldown: 7, aiWait: .28, aiJitter: .18,
    lateGame: Object.freeze({ startLevel: 40, chaseRange: 140, chaseSeconds: 1.2, strongEnemies: 1, strongOffsetMax: 2, refreshSeconds: 12, refreshLevelGap: 8 }),
  }),
  normal: Object.freeze({
    label: 'ふつう', description: 'ほどよい速さで楽しもう', speed: 130, treasureSpeedScale: 1,
    enemyCount: 4, maxEnemies: 5, enemyLevels: Object.freeze([1, 1, 2, 3]),
    protectionSeconds: 6, respawnSeconds: 3.5, strongChance: .25, strongOffsetMax: 2,
    chaseRange: 145, chaseSeconds: 1.25, chaseCooldown: 6, aiWait: .25, aiJitter: .15,
    lateGame: Object.freeze({ startLevel: 20, chaseRange: 185, chaseSeconds: 2, strongEnemies: 1, strongOffsetMax: 4, refreshSeconds: 8, refreshLevelGap: 6 }),
  }),
  hard: Object.freeze({
    label: 'むずかしい', description: 'スピーディ・敵も手ごわい', speed: CONFIG.snakeSpeed, treasureSpeedScale: 1,
    enemyCount: CONFIG.enemyCount, maxEnemies: CONFIG.maxEnemies, enemyLevels: Object.freeze([1, 1, 2, 3]),
    protectionSeconds: CONFIG.protectionSeconds, respawnSeconds: CONFIG.respawnSeconds, strongChance: .35, strongOffsetMax: 2,
    chaseRange: 175, chaseSeconds: 2, chaseCooldown: 5, aiWait: .22, aiJitter: .15,
    lateGame: Object.freeze({ startLevel: 20, chaseRange: 230, chaseSeconds: 3, strongEnemies: 2, strongOffsetMax: 5, refreshSeconds: 6, refreshLevelGap: 5 }),
  }),
});
export const FRUITS = Object.freeze({
  apple: Object.freeze({ label: 'りんご', color: '#ed837d', radius: 10 }),
  banana: Object.freeze({ label: 'バナナ', color: '#f2cc5d', radius: 11 }),
  grapes: Object.freeze({ label: 'ぶどう', color: '#a286ca', radius: 10 }),
});
export const FRUIT_KINDS = Object.freeze(Object.keys(FRUITS));
export const RAINBOW_COLORS = Object.freeze([
  ['#ee95a4', '#bd667c'], ['#efb46d', '#b98242'], ['#eed46d', '#b39b3c'],
  ['#9bc685', '#68954e'], ['#84bbd9', '#5286a7'], ['#b298db', '#8062b0'],
]);
const growthStyle = (level, id, label, icon, pattern, accessory, colors = null, palette = null) => Object.freeze({
  level, id, label, icon, pattern, accessory,
  colors: colors && Object.freeze(colors), palette: palette && Object.freeze(palette.map(pair => Object.freeze([...pair]))),
});
export const GROWTH_STYLES = Object.freeze([
  growthStyle(1, 'plain', 'むらさき', 'i-leaf', null, null),
  growthStyle(3, 'dots', 'みずたま', 'i-dots', 'dots', null),
  growthStyle(5, 'flower', 'お花ぼうし', 'i-flower', 'dots', 'flower'),
  growthStyle(8, 'rainbow', 'にじいろ', 'i-rainbow', 'dots', 'flower', null, RAINBOW_COLORS),
  growthStyle(10, 'strawberry', 'いちご', 'i-leaf', 'seeds', 'leaf', ['#ef8b9e', '#ba5069']),
  growthStyle(15, 'bee', 'みつばち', 'i-stripes', 'stripes', 'antennae', ['#efce65', '#b38c32']),
  growthStyle(20, 'ocean', 'うみ', 'i-wave', 'bubbles', 'fin', ['#75c8dc', '#378ba8']),
  growthStyle(25, 'snow', 'ゆき', 'i-snow', 'snow', 'ice', ['#c2e6ef', '#83b9ce']),
  growthStyle(30, 'sakura', 'さくら', 'i-flower', 'flowers', 'blossom', ['#edb2cd', '#be769b']),
  growthStyle(35, 'melon', 'メロン', 'i-leaf', 'lattice', 'leaf', ['#b7d77d', '#7d9e45']),
  growthStyle(40, 'tiger', 'とら', 'i-stripes', 'tiger', 'ears', ['#eeb46c', '#b57a35']),
  growthStyle(45, 'emerald', 'エメラルド', 'i-gem', 'gems', 'gem', ['#77c5ac', '#3d8a71']),
  growthStyle(50, 'star', 'ほし', 'i-star', 'stars', 'star', ['#8ea0dc', '#5969ac']),
  growthStyle(55, 'aurora', 'オーロラ', 'i-rainbow', 'aurora', 'star', null, [['#8ad6bd','#55a58f'],['#91cbdc','#5a94b4'],['#b4a3e1','#8171b5'],['#e1afd5','#b179a6']]),
  growthStyle(60, 'knight', 'ぎんのよろい', 'i-shield', 'armor', 'helmet', ['#bed2db', '#879fab']),
  growthStyle(65, 'rocket', 'ロケット', 'i-bolt', 'bolts', 'rocket', ['#eda286', '#bd6f57']),
  growthStyle(70, 'galaxy', 'うちゅう', 'i-star', 'galaxy', 'wizard', ['#8b86c8', '#575083']),
  growthStyle(75, 'candy', 'キャンディ', 'i-ribbon', 'candy', 'bow', ['#dc9ed3', '#ab66a1']),
  growthStyle(80, 'gold', 'きんの王さま', 'i-crown', 'gold', 'crown', ['#e8c365', '#b48c38']),
  growthStyle(85, 'dragon', 'ドラゴン', 'i-dragon', 'scales', 'horns', ['#86c9aa', '#4c9276']),
  growthStyle(90, 'crystal', 'クリスタル', 'i-gem', 'crystal', 'crystal', null, [['#addcec','#7ca6c8'],['#bdc5ef','#8993cc'],['#d4b6e5','#a086bd']]),
  growthStyle(95, 'phoenix', 'フェニックス', 'i-flame', 'feathers', 'flame', null, [['#efaa79','#bd7650'],['#efca77','#b59649'],['#e78d91','#b45869']]),
  growthStyle(100, 'legend', 'にじの王さま', 'i-crown', 'royal', 'royal', null, RAINBOW_COLORS),
]);
export const EAT_NOTES = Object.freeze([523, 587, 659, 698, 784, 880, 988, 1046]);
