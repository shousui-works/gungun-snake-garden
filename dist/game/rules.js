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
