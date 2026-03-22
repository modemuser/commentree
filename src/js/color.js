/**
 * Bar color calculation — shared between standalone and extension.
 */

export function barColor(textLen, score, dark) {
  const textFactor = Math.min(Math.sqrt(textLen) * 0.01, 0.25);
  const s = score || 0;
  const scoreFactor = s > 0 ? Math.min(Math.sqrt(s) * 0.015, 0.3) : 0;
  const downFactor = s < 0 ? Math.min(Math.sqrt(-s) * 0.15, 0.7) : 0;
  if (dark) {
    const i = Math.max(0.01, 0.04 + textFactor * 0.5 + scoreFactor * 0.5 - downFactor * 0.5);
    return `rgba(255, 255, 255, ${i})`;
  }
  const i = Math.max(0.02, 0.08 + textFactor + scoreFactor - downFactor);
  return `rgba(0, 0, 0, ${i})`;
}
