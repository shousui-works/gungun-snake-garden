import { CONFIG, FRUITS, GROWTH_STYLES, EAT_NOTES } from './config.js';
export const experienceNeeded = level => 5 + 2 * (level - 1);
export function addExperience(level, xp, amount) {
  xp += amount;
  let gained = 0;
  while (xp >= experienceNeeded(level)) { xp -= experienceNeeded(level); level++; gained++; }
  return { level, xp, gained };
}
export const relation = (playerLevel, enemyLevel) => playerLevel > enemyLevel ? 'edible' : playerLevel < enemyLevel ? 'danger' : 'equal';
export const radiusFor = level => 13 + Math.min(level, 14) * .8;
export const segmentCount = level => Math.min(40, 6 + level * 2);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDifference = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const fruitRadius = fruit => (FRUITS[fruit.kind] || FRUITS.apple).radius * (fruit.large ? CONFIG.bigFruitScale : 1);
export const fruitExperience = fruit => fruit.bonus && Number.isSafeInteger(fruit.rewardXp) && fruit.rewardXp > 0 ? fruit.rewardXp : fruit.large ? CONFIG.bigFruitXp : 1;
export function treasureExperience(level, jackpot = false) {
  const normal = Math.max(CONFIG.treasureBaseXp, Math.ceil(experienceNeeded(level) * CONFIG.treasureLevelShare));
  return normal * (jackpot ? 2 : 1);
}
export function treasureFruitRewards(level, jackpot = false, count = CONFIG.treasureFruitCount) {
  count = clamp(Math.floor(count), 0, CONFIG.treasureFruitCount);
  const total = treasureExperience(level, jackpot), weight = count + CONFIG.bigFruitXp - 1;
  let previous = 0, accumulatedWeight = 0;
  return Array.from({ length: count }, (_, i) => {
    accumulatedWeight += i === 0 ? CONFIG.bigFruitXp : 1;
    const accumulated = Math.floor(total * accumulatedWeight / weight), amount = accumulated - previous;
    previous = accumulated; return amount;
  });
}
export const appearanceFor = level => GROWTH_STYLES.findLast(style => level >= style.level) || GROWTH_STYLES[0];
export const nextAppearance = level => GROWTH_STYLES.find(style => style.level > level) || null;
export const unlockedAppearances = (before, after) => GROWTH_STYLES.filter(style => style.level > before && style.level <= after);
export const eatPitch = combo => EAT_NOTES[clamp(Math.floor(combo) - 1, 0, EAT_NOTES.length - 1)];
