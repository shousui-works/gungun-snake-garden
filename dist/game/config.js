export const CONFIG = Object.freeze({
  worldSize: 1600, foodCount: 80, enemyCount: 4, maxEnemies: 6,
  playerSpeed: 100, enemySpeed: 88, turnSpeed: 3.1,
  playerTurnSpeed: 5.5, inputDeadZone: 12, pointerMoveDeadZone: 6,
  protectionSeconds: 5, respawnSeconds: 3, maxSegments: 40,
  bigFruitChance: .08, bigFruitScale: 1.5, bigFruitXp: 3,
  chewSeconds: .6, comboSeconds: 2.2, comboCap: 8, maxPopups: 12,
  treasureFirstSeconds: 8, treasureIntervalSeconds: 24, treasureLifetime: 24,
  treasureSpeed: 80, treasureFruitCount: 8, maxBonusFruit: 16,
  fruitFlightSeconds: .55, bonusFruitLifetime: 22, maxFlowers: 600,
  playerColor: '#9b83db', playerDark: '#7257b1',
  enemyColors: [ ['#79bea6', '#3f8870'], ['#edb674', '#b57d3b'], ['#74b8d5', '#367f9f'], ['#e99691', '#ae555f'], ['#9bbd76', '#638a3f'], ['#c7a0c9', '#936b96'] ],
});
export const FRUITS = Object.freeze({
  apple: Object.freeze({ label: 'りんご', color: '#ed837d', radius: 10 }),
  banana: Object.freeze({ label: 'バナナ', color: '#f2cc5d', radius: 11 }),
  grapes: Object.freeze({ label: 'ぶどう', color: '#a286ca', radius: 10 }),
});
export const FRUIT_KINDS = Object.freeze(Object.keys(FRUITS));
export const GROWTH_STYLES = Object.freeze([
  Object.freeze({ level: 1, id: 'plain', label: 'むらさき', icon: 'i-leaf' }),
  Object.freeze({ level: 3, id: 'dots', label: 'みずたま', icon: 'i-dots' }),
  Object.freeze({ level: 5, id: 'flower', label: 'お花ぼうし', icon: 'i-flower' }),
  Object.freeze({ level: 8, id: 'rainbow', label: 'にじいろ', icon: 'i-rainbow' }),
]);
export const RAINBOW_COLORS = Object.freeze([
  ['#ee95a4', '#bd667c'], ['#efb46d', '#b98242'], ['#eed46d', '#b39b3c'],
  ['#9bc685', '#68954e'], ['#84bbd9', '#5286a7'], ['#b298db', '#8062b0'],
]);
export const EAT_NOTES = Object.freeze([523, 587, 659, 698, 784, 880, 988, 1046]);
