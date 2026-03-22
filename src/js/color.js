/**
 * Color utilities — shared between standalone and extension.
 */

/**
 * Build a color map for a thread. OP gets a distinct color,
 * top commenters get assigned palette colors, the rest get null.
 */
const OP_COLOR = '#4363d8';
const TLC_COLOR = '#e6194b';

export function buildAuthorColors(branch, op) {
  const tlc = branch.author;
  const counts = {};
  (function walk(node) {
    if (node.author && node.text != null) {
      counts[node.author] = (counts[node.author] || 0) + 1;
    }
    for (const c of node.children || []) walk(c);
  })(branch);

  const map = {};
  if (op) map[op] = OP_COLOR;
  if (tlc && tlc !== op && (counts[tlc] || 0) >= 2) map[tlc] = TLC_COLOR;
  return map;
}

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
