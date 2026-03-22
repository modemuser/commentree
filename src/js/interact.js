/**
 * Hover to expand, scroll floor enforcement on collapse.
 * @param {string} p - CSS class prefix ('' for standalone, 'ct-' for extension)
 * @param {HTMLElement} container - the root container element
 */

const COLLAPSE_DELAY = 400;
const EXPAND_DELAY = 200;
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

export function setupInteractions(container, p = '') {
  const CLS = {
    comment:    `${p}comment`,
    hasChildren:`${p}has-children`,
    expanded:   `${p}expanded`,
    pinned:     `${p}pinned`,
    pinnedAnc:  `${p}pinned-ancestor`,
    row:        `${p}comment-row`,
    children:   `${p}comment-children`,
    bar:        `${p}comment-bar`,
  };
  // For extension: .ct-children instead of .ct-comment-children
  const childrenCls = p === 'ct-' ? 'ct-children' : CLS.children;

  const collapseTimers = new Map();
  let pendingExpand = null;

  function outermostUnexpanded(comment) {
    let target = comment;
    while (target) {
      const parent = target.parentElement?.closest(`.${CLS.comment}`);
      if (!parent || parent.classList.contains(CLS.expanded)) break;
      target = parent;
    }
    return target?.classList.contains(CLS.hasChildren) && !target.classList.contains(CLS.expanded) ? target : null;
  }

  function scheduleExpand(comment) {
    if (pendingExpand && pendingExpand.comment === comment) return;
    if (pendingExpand) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }
    const timer = setTimeout(() => {
      pendingExpand = null;
      comment.classList.add(CLS.expanded);
    }, EXPAND_DELAY);
    pendingExpand = { comment, timer };
  }

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.(`.${CLS.row}`);
    const childrenArea = !row && e.target.closest?.(`.${childrenCls}`);
    if (!row && !childrenArea) return;
    const comment = row ? row.parentElement : childrenArea.parentElement;
    if (!comment) return;

    cancelCollapseChain(comment);

    const target = outermostUnexpanded(comment);
    if (target) scheduleExpand(target);
  });

  document.addEventListener('mouseout', (e) => {
    const comment = e.target.closest?.(`.${CLS.comment}`);
    if (!comment?.classList.contains(CLS.hasChildren)) return;

    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    if (pendingExpand && pendingExpand.comment === comment) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }

    scheduleCollapse(comment);
  });

  // Desktop: click to pin/unpin
  const isTouch = matchMedia('(pointer: coarse)').matches;

  if (!isTouch) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const row = e.target.closest?.(`.${CLS.row}`);
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains(CLS.hasChildren)) return;

      if (comment.classList.contains(CLS.pinned)) {
        unpinAll();
        history.replaceState(null, '', location.pathname + location.search);
      } else if (comment.classList.contains(CLS.expanded)) {
        pinComment(comment);
      }
    });
  }

  function unpinAll() {
    container.querySelectorAll(`.${CLS.pinned}`).forEach(el => el.classList.remove(CLS.pinned));
    container.querySelectorAll(`.${CLS.pinnedAnc}`).forEach(el => el.classList.remove(CLS.pinnedAnc));
  }

  function pinComment(comment) {
    unpinAll();
    comment.classList.add(CLS.pinned);
    if (!comment.classList.contains(CLS.expanded)) {
      comment.classList.add(CLS.expanded);
    }
    let ancestor = comment.parentElement?.closest?.(`.${CLS.comment}`);
    while (ancestor) {
      ancestor.classList.add(CLS.pinnedAnc);
      if (!ancestor.classList.contains(CLS.expanded)) {
        ancestor.classList.add(CLS.expanded);
      }
      ancestor = ancestor.parentElement?.closest?.(`.${CLS.comment}`);
    }
    const id = comment.dataset.id;
    if (id) history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  }

  // Restore pin from URL hash on load
  if (location.hash) {
    const id = location.hash.slice(1);
    const target = document.querySelector(`.${CLS.comment}[data-id="${id}"]`);
    if (target) pinComment(target);
  }

  // Touch: tap to toggle
  if (isTouch) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;

      const childrenArea = e.target.closest?.(`.${childrenCls}`);
      if (childrenArea) {
        let comment = childrenArea.parentElement;
        while (comment) {
          const parent = comment.parentElement?.closest(`.${CLS.comment}`);
          if (!parent || parent.classList.contains(CLS.expanded)) break;
          comment = parent;
        }
        if (comment?.classList.contains(CLS.hasChildren) && !comment.classList.contains(CLS.expanded)) {
          comment.classList.add(CLS.expanded);
          return;
        }
      }

      const row = e.target.closest?.(`.${CLS.row}`);
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains(CLS.hasChildren)) return;

      if (comment.classList.contains(CLS.expanded)) {
        const expandedChildren = comment.querySelectorAll(`:scope > .${childrenCls} > .${CLS.comment}.${CLS.expanded}`);
        if (expandedChildren.length > 0) {
          expandedChildren.forEach(child => {
            child.querySelectorAll(`.${CLS.expanded}`).forEach(desc => desc.classList.remove(CLS.expanded));
            child.classList.remove(CLS.expanded);
          });
          beginCollapse();
        } else {
          beginCollapse();
          comment.classList.remove(CLS.expanded);
        }
      } else {
        comment.classList.add(CLS.expanded);
      }
    });
  }

  // Collapse all on mouseleave
  container.addEventListener('mouseleave', () => {
    if (pendingExpand) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }

    const expanded = [];
    container.querySelectorAll(`.${CLS.comment}.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach(el => {
      let depth = 0;
      let parent = el.parentElement?.closest?.(`.${CLS.comment}`);
      while (parent) { depth++; parent = parent.parentElement?.closest?.(`.${CLS.comment}`); }
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
          if (comment.classList.contains(CLS.expanded)) {
            collapseSingle(comment);
          }
        }, delay);
        collapseTimers.set(comment, timer);
      }
    });
  });

  function scheduleCollapse(comment, delay = COLLAPSE_DELAY) {
    if (collapseTimers.has(comment)) return;
    const timer = setTimeout(() => {
      collapseTimers.delete(comment);
      collapseTree(comment);
    }, delay);
    collapseTimers.set(comment, timer);
  }

  function cancelCollapseChain(comment) {
    let el = comment;
    while (el) {
      if (collapseTimers.has(el)) {
        clearTimeout(collapseTimers.get(el));
        collapseTimers.delete(el);
      }
      el = el.parentElement?.closest?.(`.${CLS.comment}`);
    }
  }

  function collapseSingle(comment) {
    if (comment.classList.contains(CLS.pinned) || comment.classList.contains(CLS.pinnedAnc)) return;

    comment.querySelectorAll(`.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach(desc => {
      desc.classList.remove(CLS.expanded);
    });

    const row = comment.querySelector(`:scope > .${CLS.row}`);
    if (!row) return;

    const rowRect = row.getBoundingClientRect();
    if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) return;

    beginCollapse();
    comment.classList.remove(CLS.expanded);
  }

  function collapseTree(comment) {
    if (comment.classList.contains(CLS.pinned) || comment.classList.contains(CLS.pinnedAnc)) return;
    const toCollapse = [];
    comment.querySelectorAll(`.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach(desc => {
      if (collapseTimers.has(desc)) {
        clearTimeout(collapseTimers.get(desc));
        collapseTimers.delete(desc);
      }
      toCollapse.push(desc);
    });
    toCollapse.push(comment);

    toCollapse.sort((a, b) => {
      let dA = 0, el = a;
      while ((el = el.parentElement?.closest?.(`.${CLS.comment}`))) dA++;
      let dB = 0; el = b;
      while ((el = el.parentElement?.closest?.(`.${CLS.comment}`))) dB++;
      return dB - dA;
    });

    for (const el of toCollapse) {
      if (el.classList.contains(CLS.expanded)) collapseSingle(el);
    }
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
