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

let mouseX = -1, mouseY = -1;
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

export function setupInteractions() {
  const collapseTimers = new Map();
  let pendingExpand = null; // { comment, timer }

  // Find the outermost unexpanded ancestor of a comment
  function outermostUnexpanded(comment) {
    let target = comment;
    while (target) {
      const parent = target.parentElement?.closest('.comment');
      if (!parent || parent.classList.contains('expanded')) break;
      target = parent;
    }
    return target?.classList.contains('has-children') && !target.classList.contains('expanded') ? target : null;
  }

  // Schedule expanding the next level in, if mouse is still in the area
  function scheduleNextLevel(expandedComment) {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el || !expandedComment.contains(el)) return;
    const inner = el.closest('.comment');
    if (!inner) return;
    const next = outermostUnexpanded(inner);
    if (!next || !expandedComment.contains(next)) return;
    scheduleExpand(next);
  }

  function scheduleExpand(comment) {
    if (pendingExpand && pendingExpand.comment === comment) return;
    if (pendingExpand) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }
    const timer = setTimeout(() => {
      pendingExpand = null;
      comment.classList.add('expanded');
      // After expanding, try the next level in
      requestAnimationFrame(() => scheduleNextLevel(comment));
    }, EXPAND_DELAY);
    pendingExpand = { comment, timer };
  }

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.comment-row');
    const childrenArea = !row && e.target.closest?.('.comment-children');
    if (!row && !childrenArea) return;
    const comment = row ? row.parentElement : childrenArea.parentElement;
    if (!comment) return;

    cancelCollapseChain(comment, collapseTimers);

    const target = outermostUnexpanded(comment);
    if (target) {
      scheduleExpand(target);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const comment = e.target.closest?.('.comment');
    if (!comment?.classList.contains('has-children')) return;

    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    if (pendingExpand && pendingExpand.comment === comment) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }

    scheduleCollapse(comment, collapseTimers);
  });

  // Desktop: click to pin/unpin (single pinned comment, ancestors stay open)
  const isTouch = matchMedia('(pointer: coarse)').matches;

  if (!isTouch) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const row = e.target.closest?.('.comment-row');
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains('has-children')) return;

      if (comment.classList.contains('pinned')) {
        unpinAll();
        history.replaceState(null, '', location.pathname + location.search);
      } else if (comment.classList.contains('expanded')) {
        pinComment(comment);
      }
    });
  }

  function unpinAll() {
    const container = document.getElementById('container');
    container.querySelectorAll('.pinned').forEach(el => el.classList.remove('pinned'));
    container.querySelectorAll('.pinned-ancestor').forEach(el => el.classList.remove('pinned-ancestor'));
  }

  function pinComment(comment) {
    unpinAll();
    comment.classList.add('pinned');
    if (!comment.classList.contains('expanded')) {
      comment.classList.add('expanded');
    }
    // Mark ancestors as pinned-ancestor so they stay expanded
    let ancestor = comment.parentElement?.closest?.('.comment');
    while (ancestor) {
      ancestor.classList.add('pinned-ancestor');
      if (!ancestor.classList.contains('expanded')) {
        ancestor.classList.add('expanded');
      }
      ancestor = ancestor.parentElement?.closest?.('.comment');
    }
    // Update URL hash
    const id = comment.dataset.id;
    if (id) history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  }

  // Restore pin from URL hash on load
  if (location.hash) {
    const id = location.hash.slice(1);
    const target = document.querySelector(`.comment[data-id="${id}"]`);
    if (target) pinComment(target);
  }

  // Touch: tap comment row or bars to toggle
  if (isTouch) {
    document.addEventListener('click', (e) => {
      // Don't intercept link clicks
      if (e.target.closest('a')) return;

      // Tap bars area to expand parent comment
      const childrenArea = e.target.closest?.('.comment-children');
      if (childrenArea) {
        const comment = childrenArea.parentElement;
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
    if (pendingExpand) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }

    const expanded = [];
    container.querySelectorAll('.comment.expanded:not(.pinned):not(.pinned-ancestor)').forEach(el => {
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
  if (comment.classList.contains('pinned') || comment.classList.contains('pinned-ancestor')) return;

  // Always strip expanded from all descendants first (except pinned/ancestors)
  comment.querySelectorAll('.expanded:not(.pinned):not(.pinned-ancestor)').forEach(desc => {
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
  if (comment.classList.contains('pinned') || comment.classList.contains('pinned-ancestor')) return;
  const toCollapse = [];
  comment.querySelectorAll('.expanded:not(.pinned):not(.pinned-ancestor)').forEach(desc => {
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
