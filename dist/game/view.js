export const VIEW_MODES = Object.freeze({
  wide: Object.freeze({ label: '広く見る', description: 'まわりを 広く見わたせるよ' }),
  large: Object.freeze({ label: '大きく見る', description: 'ヘビやフルーツが 大きく見えるよ' }),
});
export const viewModeFor = value => Object.hasOwn(VIEW_MODES, value) ? value : 'wide';
export function viewScaleFor(width, height, mode = 'wide') {
  const shortSide = Math.min(Math.max(0, width), Math.max(0, height));
  // Keep small-screen sprites readable while opening up the narrower axis.
  const wideScale = Math.max(.72, Math.min(1.12, shortSide / 500));
  return viewModeFor(mode) === 'large' ? Math.min(1.5, wideScale * 1.35) : wideScale;
}
