/**
 * Hover to expand, scroll floor enforcement on collapse.
 */

const COLLAPSE_DELAY = 400;
const EXPAND_DELAY = 150;
const STAGGER_DELAY = 80;

// Scroll floor: prevents viewport from jumping up during collapses
let scrollFloor = 0;
let collapseActive = 0;
let collapseTimer = null;

window.addEventListener('scroll', () => {
  if (collapseActive === 0) {
    scrollFloor = window.scrollY;
  } else if (window.scrollY < scrollFloor) {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(scrollFloor, maxScroll));
  }
});

export function setupInteractions() {
  const collapseTimers = new Map();
  const expandTimers = new Map();

  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest?.('.comment-row') || e.target.closest?.('.tree-preview');
    if (!trigger) return;
    const comment = trigger.parentElement;
    if (!comment?.classList.contains('has-children')) return;

    cancelCollapseChain(comment, collapseTimers);

    if (!comment.classList.contains('expanded') && !expandTimers.has(comment)) {
      const timer = setTimeout(() => {
        expandTimers.delete(comment);
        comment.classList.add('expanded');
      }, EXPAND_DELAY);
      expandTimers.set(comment, timer);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const comment = e.target.closest?.('.comment');
    if (!comment?.classList.contains('has-children')) return;

    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    if (expandTimers.has(comment)) {
      clearTimeout(expandTimers.get(comment));
      expandTimers.delete(comment);
    }

    scheduleCollapse(comment, collapseTimers);
  });

  // Touch: tap comment row to toggle, tap tree preview to expand
  const isTouch = matchMedia('(pointer: coarse)').matches;

  if (isTouch) {
    document.addEventListener('click', (e) => {
      // Don't intercept link clicks
      if (e.target.closest('a')) return;

      // Tap tree preview to expand parent comment
      const preview = e.target.closest?.('.tree-preview');
      if (preview) {
        const comment = preview.parentElement;
        if (comment?.classList.contains('has-children') && !comment.classList.contains('expanded')) {
          comment.classList.add('expanded');
          return;
        }
      }

      // Tap comment row to toggle
      const row = e.target.closest?.('.comment-row');
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains('has-children')) return;

      if (comment.classList.contains('expanded')) {
        // Collapse this comment and descendants
        comment.querySelectorAll('.expanded').forEach(desc => {
          desc.classList.remove('expanded');
        });
        beginCollapse();
        comment.classList.remove('expanded');
      } else {
        comment.classList.add('expanded');
      }
    });
  }

  const container = document.getElementById('container');
  container.addEventListener('mouseleave', () => {
    for (const [, timer] of expandTimers) clearTimeout(timer);
    expandTimers.clear();

    const expanded = [];
    container.querySelectorAll('.comment.expanded').forEach(el => {
      let depth = 0;
      let parent = el.parentElement?.closest?.('.comment');
      while (parent) { depth++; parent = parent.parentElement?.closest?.('.comment'); }
      expanded.push({ el, depth });
    });

    expanded.sort((a, b) => b.depth - a.depth);

    const byDepth = new Map();
    for (const { el, depth } of expanded) {
      if (!byDepth.has(depth)) byDepth.set(depth, []);
      byDepth.get(depth).push(el);
    }

    const depths = [...byDepth.keys()].sort((a, b) => b - a);
    depths.forEach((depth, i) => {
      const comments = byDepth.get(depth);
      const delay = COLLAPSE_DELAY + i * STAGGER_DELAY;

      for (const comment of comments) {
        if (collapseTimers.has(comment)) {
          clearTimeout(collapseTimers.get(comment));
          collapseTimers.delete(comment);
        }

        const timer = setTimeout(() => {
          collapseTimers.delete(comment);
          if (comment.classList.contains('expanded')) {
            collapseSingle(comment);
          }
        }, delay);
        collapseTimers.set(comment, timer);
      }
    });
  });
}

function scheduleCollapse(comment, timers, delay = COLLAPSE_DELAY) {
  if (timers.has(comment)) return;

  const timer = setTimeout(() => {
    timers.delete(comment);
    collapse(comment, timers);
  }, delay);

  timers.set(comment, timer);
}

function cancelCollapseChain(comment, timers) {
  let el = comment;
  while (el) {
    if (timers.has(el)) {
      clearTimeout(timers.get(el));
      timers.delete(el);
    }
    el = el.parentElement?.closest?.('.comment');
  }
}

function beginCollapse() {
  collapseActive++;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    collapseActive = 0;
    scrollFloor = window.scrollY;
  }, 500);
}

function collapseSingle(comment) {
  const row = comment.querySelector(':scope > .comment-row');
  if (!row) return;

  const rowRect = row.getBoundingClientRect();
  if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) return;

  beginCollapse();
  comment.classList.remove('expanded');
}

function collapse(comment, timers) {
  const toCollapse = [];
  comment.querySelectorAll('.expanded').forEach(desc => {
    if (timers.has(desc)) {
      clearTimeout(timers.get(desc));
      timers.delete(desc);
    }
    toCollapse.push(desc);
  });
  toCollapse.push(comment);

  toCollapse.sort((a, b) => {
    let dA = 0, el = a;
    while ((el = el.parentElement?.closest?.('.comment'))) dA++;
    let dB = 0; el = b;
    while ((el = el.parentElement?.closest?.('.comment'))) dB++;
    return dB - dA;
  });

  for (const el of toCollapse) {
    if (el.classList.contains('expanded')) {
      collapseSingle(el);
    }
  }
}
