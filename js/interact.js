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
  let mouseX = -1, mouseY = -1;
  let expandedAtX = -1, expandedAtY = -1;

  const container = document.getElementById('container');

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function mouseMoved() {
    return mouseX !== expandedAtX || mouseY !== expandedAtY;
  }

  function markExpanded() {
    expandedAtX = mouseX;
    expandedAtY = mouseY;
  }

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.comment-row');
    const childrenArea = !row && e.target.closest?.('.comment-children');
    if (!row && !childrenArea) return;
    let comment = row ? row.parentElement : childrenArea.parentElement;

    while (comment) {
      const parent = comment.parentElement?.closest('.comment');
      if (!parent || parent.classList.contains('expanded')) break;
      comment = parent;
    }
    if (!comment) return;

    cancelCollapseChain(comment, collapseTimers);

    if (comment.classList.contains('has-children') &&
        !comment.classList.contains('expanded') &&
        !expandTimers.has(comment)) {
      const timer = setTimeout(() => {
        expandTimers.delete(comment);
        if (!mouseMoved()) return;
        markExpanded();
        comment.classList.add('expanded');
      }, EXPAND_DELAY);
      expandTimers.set(comment, timer);
    } else if (comment.classList.contains('expanded') && mouseMoved()) {
      const el = document.elementFromPoint(mouseX, mouseY);
      if (!el) return;
      const child = el.closest('.comment.has-children:not(.expanded)');
      if (!child || child.parentElement?.closest('.comment') !== comment) return;
      markExpanded();
      cancelCollapseChain(child, collapseTimers);
      child.classList.add('expanded');
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

  // Touch: tap comment row or bars to toggle
  const isTouch = matchMedia('(pointer: coarse)').matches;

  if (isTouch) {
    document.addEventListener('click', (e) => {
      // Don't intercept link clicks
      if (e.target.closest('a')) return;

      // Tap anywhere in the children/bars area to expand the top-level ancestor
      const childrenArea = e.target.closest?.('.comment-children');
      if (childrenArea) {
        let comment = childrenArea.parentElement;
        while (comment) {
          const parent = comment.parentElement?.closest('.comment');
          if (!parent || parent.classList.contains('expanded')) break;
          comment = parent;
        }
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
        // If children are expanded, collapse them first (one level at a time)
        const expandedChildren = comment.querySelectorAll(':scope > .comment-children > .comment.expanded');
        if (expandedChildren.length > 0) {
          expandedChildren.forEach(child => {
            child.querySelectorAll('.expanded').forEach(desc => desc.classList.remove('expanded'));
            child.classList.remove('expanded');
          });
          beginCollapse();
        } else {
          beginCollapse();
          comment.classList.remove('expanded');
        }
      } else {
        comment.classList.add('expanded');
      }
    });
  }

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
  // Always strip expanded from all descendants first
  comment.querySelectorAll('.expanded').forEach(desc => {
    desc.classList.remove('expanded');
  });

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
