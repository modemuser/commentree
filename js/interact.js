/**
 * Hover to expand, scroll compensation on collapse.
 */

const COLLAPSE_DELAY = 400;
const EXPAND_DELAY = 150;

export function setupInteractions() {
  const collapseTimers = new Map(); // comment element -> timer id
  const expandTimers = new Map(); // comment element -> timer id

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.comment-row');
    if (!row) return;
    const comment = row.parentElement;
    if (!comment?.classList.contains('has-children')) return;

    // Cancel any pending collapse on this and ancestor comments
    cancelCollapseChain(comment, collapseTimers);

    // Schedule expand with delay
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

    // Check if we're moving to something still inside this comment
    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    // Cancel pending expand
    if (expandTimers.has(comment)) {
      clearTimeout(expandTimers.get(comment));
      expandTimers.delete(comment);
    }

    // Schedule collapse with delay
    scheduleCollapse(comment, collapseTimers);
  });

}

function scheduleCollapse(comment, timers, delay = COLLAPSE_DELAY) {
  // Don't collapse if pinned
  if (comment.classList.contains('pinned')) return;

  const timer = setTimeout(() => {
    timers.delete(comment);
    collapse(comment, timers);
  }, delay);

  timers.set(comment, timer);
}

function cancelCollapseChain(comment, timers) {
  // Cancel collapse for this comment and all ancestors
  let el = comment;
  while (el) {
    if (timers.has(el)) {
      clearTimeout(timers.get(el));
      timers.delete(el);
    }
    el = el.parentElement?.closest?.('.comment');
  }
}

function collapse(comment, timers) {
  // Measure height before collapse for scroll compensation
  const childrenEl = comment.querySelector(':scope > .comment-children');
  if (!childrenEl) return;

  const rect = comment.getBoundingClientRect();
  const viewportY = window.scrollY;

  // Only compensate if the collapse happens above or at the viewport
  const collapseTop = rect.top + window.scrollY;
  const heightBefore = childrenEl.scrollHeight;

  comment.classList.remove('expanded');

  // Also collapse any expanded descendants
  comment.querySelectorAll('.expanded').forEach(desc => {
    desc.classList.remove('expanded');
    if (timers.has(desc)) {
      clearTimeout(timers.get(desc));
      timers.delete(desc);
    }
  });

  // Update parent's tree highlight (this comment is no longer expanded)
  const parentComment = comment.parentElement?.closest?.('.comment');
  if (parentComment) updateTreeHighlights(parentComment);
  // Clear own highlight since no children are expanded
  updateTreeHighlights(comment);

  // Scroll compensation: if collapse happened above viewport center,
  // adjust scroll so content under cursor stays in place
  if (collapseTop < viewportY + window.innerHeight / 2) {
    requestAnimationFrame(() => {
      const heightAfter = childrenEl.scrollHeight;
      const delta = heightBefore - heightAfter;
      if (delta > 0) {
        window.scrollBy(0, -delta);
      }
    });
  }
}
