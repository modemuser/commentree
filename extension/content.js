/**
 * commentree — Chrome extension content script.
 * Keeps HN's page intact. Parses the flat comment table into a nested tree,
 * replaces just the comment-tree section, and adds bar↔card expand/collapse.
 */

(function () {
  'use strict';

  const commentTree = document.querySelector('table.comment-tree');
  if (!commentTree) return; // Not a thread page

  // ── Parse flat HN comments into tree ────────────────────────

  function parseComments() {
    const rows = commentTree.querySelectorAll('tr.athing.comtr');
    const flat = [];

    for (const row of rows) {
      if (row.classList.contains('noshow')) continue;

      const indentTd = row.querySelector('td.ind');
      const depth = parseInt(indentTd?.getAttribute('indent') || '0', 10);
      const bodyEl = row.querySelector('div.commtext');

      if (!bodyEl) continue;
      const commentDiv = bodyEl.closest('.comment');
      if (commentDiv?.classList.contains('noshow')) continue;

      // Clone the original HN row markup (vote links + content), minus indent td
      const innerTable = row.querySelector(':scope > td > table');
      const clonedTable = innerTable.cloneNode(true);
      const clonedInd = clonedTable.querySelector('td.ind');
      if (clonedInd) clonedInd.remove();
      const clonedTogg = clonedTable.querySelector('a.togg');
      if (clonedTogg) clonedTogg.remove();

      flat.push({
        depth,
        rowNode: clonedTable,
        text: bodyEl?.innerHTML || null,
        children: [],
      });
    }

    // Rebuild tree from flat depth-first list
    const roots = [];
    const stack = [];

    for (const item of flat) {
      while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
        stack.pop();
      }
      if (stack.length === 0) {
        roots.push(item);
      } else {
        stack[stack.length - 1].node.children.push(item);
      }
      stack.push({ node: item, depth: item.depth });
    }

    return roots;
  }

  // ── Render nested comments with bar↔card grid ─────────────

  function renderComment(item) {
    if (!item || item.text == null) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'ct-comment';

    // Bar: thin colored strip visible when comment is collapsed
    const bar = document.createElement('div');
    bar.className = 'ct-comment-bar';
    const intensity = 0.06 + Math.min(Math.sqrt(item.text.length) * 0.008, 0.3);
    bar.style.background = `rgba(0, 0, 0, ${intensity})`;
    wrapper.appendChild(bar);

    // Row: the cloned HN table (vote + content), intact
    const row = document.createElement('div');
    row.className = 'ct-comment-row';
    row.appendChild(item.rowNode);
    wrapper.appendChild(row);

    const validChildren = (item.children || []).filter(c => c.text != null);

    if (validChildren.length > 0) {
      wrapper.classList.add('ct-has-children');

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'ct-children';

      for (const child of validChildren) {
        const childEl = renderComment(child);
        if (childEl) childrenContainer.appendChild(childEl);
      }

      wrapper.appendChild(childrenContainer);
    }

    return wrapper;
  }

  // ── Replace comment tree ────────────────────────────────────

  const comments = parseComments();

  const container = document.createElement('div');
  container.id = 'ct-container';

  for (const child of comments) {
    const el = renderComment(child);
    if (el) container.appendChild(el);
  }

  commentTree.replaceWith(container);

  // ── Interactions (expand/collapse) ──────────────────────────

  const COLLAPSE_DELAY = 400;
  const EXPAND_DELAY = 150;
  const STAGGER_DELAY = 80;

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

  const collapseTimers = new Map();
  let pendingExpand = null;
  let mouseX = -1, mouseY = -1;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function outermostUnexpanded(comment) {
    let target = comment;
    while (target) {
      const parent = target.parentElement?.closest('.ct-comment');
      if (!parent || parent.classList.contains('ct-expanded')) break;
      target = parent;
    }
    return target?.classList.contains('ct-has-children') && !target.classList.contains('ct-expanded') ? target : null;
  }

  function scheduleNextLevel(expandedComment) {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el || !expandedComment.contains(el)) return;
    const inner = el.closest('.ct-comment');
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
      comment.classList.add('ct-expanded');
      requestAnimationFrame(() => scheduleNextLevel(comment));
    }, EXPAND_DELAY);
    pendingExpand = { comment, timer };
  }

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.ct-comment-row');
    const childrenArea = !row && e.target.closest?.('.ct-children');
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
    const comment = e.target.closest?.('.ct-comment');
    if (!comment?.classList.contains('ct-has-children')) return;

    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    if (pendingExpand && pendingExpand.comment === comment) {
      clearTimeout(pendingExpand.timer);
      pendingExpand = null;
    }

    scheduleCollapse(comment, collapseTimers);
  });

  // Desktop: click to pin/unpin (single pinned comment, ancestors stay open)
  if (!matchMedia('(pointer: coarse)').matches) {
    function unpinAll() {
      container.querySelectorAll('.ct-pinned').forEach(el => el.classList.remove('ct-pinned'));
      container.querySelectorAll('.ct-pinned-ancestor').forEach(el => el.classList.remove('ct-pinned-ancestor'));
    }

    function pinComment(comment) {
      unpinAll();
      comment.classList.add('ct-pinned');
      if (!comment.classList.contains('ct-expanded')) {
        comment.classList.add('ct-expanded');
      }
      let ancestor = comment.parentElement?.closest?.('.ct-comment');
      while (ancestor) {
        ancestor.classList.add('ct-pinned-ancestor');
        if (!ancestor.classList.contains('ct-expanded')) {
          ancestor.classList.add('ct-expanded');
        }
        ancestor = ancestor.parentElement?.closest?.('.ct-comment');
      }
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const row = e.target.closest?.('.ct-comment-row');
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains('ct-has-children')) return;

      if (comment.classList.contains('ct-pinned')) {
        unpinAll();
      } else if (comment.classList.contains('ct-expanded')) {
        pinComment(comment);
      }
    });
  }

  // Touch: tap to toggle
  if (matchMedia('(pointer: coarse)').matches) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;

      // Tap anywhere in the children/bars area to expand the top-level ancestor
      const childrenArea = e.target.closest?.('.ct-children');
      if (childrenArea) {
        let comment = childrenArea.parentElement;
        // Walk up from bar-mode to the first card-mode ancestor
        while (comment) {
          const parent = comment.parentElement?.closest('.ct-comment');
          if (!parent || parent.classList.contains('ct-expanded')) break;
          comment = parent;
        }
        if (comment?.classList.contains('ct-has-children') && !comment.classList.contains('ct-expanded')) {
          comment.classList.add('ct-expanded');
          return;
        }
      }

      const row = e.target.closest?.('.ct-comment-row');
      if (!row) return;
      const comment = row.parentElement;
      if (!comment?.classList.contains('ct-has-children')) return;

      if (comment.classList.contains('ct-expanded')) {
        // If children are expanded, collapse them first (one level at a time)
        const expandedChildren = comment.querySelectorAll(':scope > .ct-children > .ct-comment.ct-expanded');
        if (expandedChildren.length > 0) {
          expandedChildren.forEach(child => {
            child.querySelectorAll('.ct-expanded').forEach(desc => desc.classList.remove('ct-expanded'));
            child.classList.remove('ct-expanded');
          });
          beginCollapse();
        } else {
          beginCollapse();
          comment.classList.remove('ct-expanded');
        }
      } else {
        comment.classList.add('ct-expanded');
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
    container.querySelectorAll('.ct-comment.ct-expanded:not(.ct-pinned):not(.ct-pinned-ancestor)').forEach(el => {
      let depth = 0;
      let parent = el.parentElement?.closest?.('.ct-comment');
      while (parent) { depth++; parent = parent.parentElement?.closest?.('.ct-comment'); }
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
          if (comment.classList.contains('ct-expanded')) {
            collapseSingle(comment);
          }
        }, delay);
        collapseTimers.set(comment, timer);
      }
    });
  });

  function scheduleCollapse(comment, timers, delay) {
    if (timers.has(comment)) return;
    const timer = setTimeout(() => {
      timers.delete(comment);
      collapseTree(comment, timers);
    }, delay || COLLAPSE_DELAY);
    timers.set(comment, timer);
  }

  function cancelCollapseChain(comment, timers) {
    let el = comment;
    while (el) {
      if (timers.has(el)) {
        clearTimeout(timers.get(el));
        timers.delete(el);
      }
      el = el.parentElement?.closest?.('.ct-comment');
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
    if (comment.classList.contains('ct-pinned') || comment.classList.contains('ct-pinned-ancestor')) return;

    // Always strip expanded from all descendants first (except pinned/ancestors)
    comment.querySelectorAll('.ct-expanded:not(.ct-pinned):not(.ct-pinned-ancestor)').forEach(desc => {
      desc.classList.remove('ct-expanded');
    });

    const row = comment.querySelector(':scope > .ct-comment-row');
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) return;
    beginCollapse();
    comment.classList.remove('ct-expanded');
  }

  function collapseTree(comment, timers) {
    if (comment.classList.contains('ct-pinned') || comment.classList.contains('ct-pinned-ancestor')) return;
    const toCollapse = [];
    comment.querySelectorAll('.ct-expanded:not(.ct-pinned):not(.ct-pinned-ancestor)').forEach(desc => {
      if (timers.has(desc)) {
        clearTimeout(timers.get(desc));
        timers.delete(desc);
      }
      toCollapse.push(desc);
    });
    toCollapse.push(comment);

    toCollapse.sort((a, b) => {
      let dA = 0, el = a;
      while ((el = el.parentElement?.closest?.('.ct-comment'))) dA++;
      let dB = 0; el = b;
      while ((el = el.parentElement?.closest?.('.ct-comment'))) dB++;
      return dB - dA;
    });

    for (const el of toCollapse) {
      if (el.classList.contains('ct-expanded')) collapseSingle(el);
    }
  }

  // ── Onboarding + info button ──────────────────────────────

  const isTouch = matchMedia('(pointer: coarse)').matches;

  function showOnboarding() {
    document.querySelector('.ct-onboard-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ct-onboard-overlay';

    if (isTouch) {
      overlay.innerHTML = `
        <div class="ct-onboard-content">
          <p class="ct-onboard-title">commentree</p>
          <p>Tap a comment to expand its reply tree.</p>
          <p>Tap again to collapse.</p>
          <p class="ct-onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
          <p class="ct-onboard-dismiss">tap anywhere to start</p>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('ct-visible'));
      overlay.addEventListener('click', () => dismissOnboarding(overlay));
    } else {
      overlay.innerHTML = `
        <div class="ct-onboard-content">
          <p class="ct-onboard-title">commentree</p>
          <p>Explore and read comment trees with your mouse cursor, hover to expand.</p>
          <p>Each line represents a comment — darker lines mean longer comments.</p>
          <p>Best to interact with the tree from the left.</p>
          <p class="ct-onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
          <p class="ct-onboard-dismiss">move your cursor to the left margin to begin</p>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('ct-visible'));

      overlay.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        dismissOnboarding(overlay);
        document.removeEventListener('mousemove', onMove);
      });

      function onMove(e) {
        const rect = container.getBoundingClientRect();
        if (e.clientX < rect.left) {
          dismissOnboarding(overlay);
          document.removeEventListener('mousemove', onMove);
        }
      }
      document.addEventListener('mousemove', onMove);
    }
  }

  function dismissOnboarding(overlay) {
    localStorage.setItem('commentree_onboarded', '1');
    overlay.classList.remove('ct-visible');
    setTimeout(() => overlay.remove(), 500);
  }

  // Info button
  const infoBtn = document.createElement('button');
  infoBtn.className = 'ct-info-btn';
  infoBtn.textContent = '?';
  infoBtn.addEventListener('click', showOnboarding);
  document.body.appendChild(infoBtn);

  // Show onboarding on first visit
  if (!localStorage.getItem('commentree_onboarded')) {
    showOnboarding();
  }
})();
