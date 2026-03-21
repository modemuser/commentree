/**
 * commentree — Chrome extension content script.
 * Keeps HN's page intact. Parses the flat comment table into a nested tree,
 * replaces just the comment-tree section, and adds tree previews + expand/collapse.
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
      const defaultTd = row.querySelector('td.default');
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

  // ── Tree preview (canvas) ───────────────────────────────────

  function countDescendants(item) {
    let count = 0;
    for (const c of item.children || []) {
      if (c.text != null) count += 1 + countDescendants(c);
    }
    return count;
  }

  const _pendingCanvases = [];

  function renderTreePreview(children) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ct-tree-preview';

    const bars = [];

    function countDesc(item) {
      let count = 0;
      for (const c of item.children || []) {
        if (c.text == null) continue;
        count += 1 + countDesc(c);
      }
      return count;
    }

    function collectBars(items, depth) {
      for (const item of items) {
        if (item.text == null) continue;
        const valid = (item.children || []).filter(c => c.text != null);
        bars.push({ depth, descendants: countDesc(item), textLen: item.text.length });
        if (valid.length > 0) collectBars(valid, depth + 1);
      }
    }

    collectBars(children, 0);
    if (bars.length === 0) return wrapper;

    const canvas = document.createElement('canvas');
    canvas.className = 'ct-tree-canvas';
    wrapper.appendChild(canvas);

    // Queue for batch painting — prevents cascading width growth
    _pendingCanvases.push({ canvas, wrapper, bars });

    return wrapper;
  }

  function flushTreeCanvases() {
    if (_pendingCanvases.length === 0) return;
    requestAnimationFrame(() => {
      const items = _pendingCanvases.splice(0);
      // Read pass: measure all widths first
      const widths = items.map(({ wrapper }) => wrapper.offsetWidth || 300);
      // Write pass: paint all canvases
      for (let i = 0; i < items.length; i++) {
        const { canvas, bars } = items[i];
        paintTreeCanvas(canvas, bars, widths[i]);
      }
    });
  }

  function paintTreeCanvas(canvas, bars, w) {
    const barH = 2;
    const maxH = 24;
    const scale = bars.length * barH > maxH ? maxH / (bars.length * barH) : 1;
    w = w || 200;
    const h = Math.min(maxH, Math.ceil(bars.length * barH));

    canvas.width = w * 2;
    canvas.height = h * 2;
    // Do NOT set canvas.style.width — let CSS width:100% handle it
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    for (let i = 0; i < bars.length; i++) {
      const { depth, descendants, textLen } = bars[i];
      const indent = depth * 6;
      const barW = w - indent;
      const x = indent;
      const y = i * barH * scale;
      const barHeight = Math.max(1, barH * scale - 0.5);
      const intensity = 0.12 + Math.sqrt(textLen) * 0.006 + Math.sqrt(descendants) * 0.07;
      ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
      ctx.fillRect(x, y, barW, barHeight);
    }
  }

  // ── Render nested comments using HN's original markup ───────

  function renderComment(item) {
    if (!item || item.text == null) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'ct-comment';

    // The comment row is the cloned HN table (vote + content), intact
    const row = document.createElement('div');
    row.className = 'ct-comment-row';
    row.appendChild(item.rowNode);
    wrapper.appendChild(row);

    const validChildren = (item.children || []).filter(c => c.text != null);

    if (validChildren.length > 0) {
      wrapper.classList.add('ct-has-children');

      // Tree preview strip
      const preview = renderTreePreview(validChildren);
      wrapper.appendChild(preview);

      // Children container with expand/collapse
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'ct-children';

      const childrenInner = document.createElement('div');
      childrenInner.className = 'ct-children-inner';

      for (const child of validChildren) {
        const childEl = renderComment(child);
        if (childEl) childrenInner.appendChild(childEl);
      }

      childrenContainer.appendChild(childrenInner);
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

  // Measure vote column width so tree previews align with comment body
  const firstDefault = container.querySelector('.ct-comment-row td.default');
  if (firstDefault) {
    const rowLeft = firstDefault.closest('.ct-comment-row').getBoundingClientRect().left;
    const tdLeft = firstDefault.getBoundingClientRect().left;
    container.style.setProperty('--vote-col-w', `${tdLeft - rowLeft}px`);
  }

  flushTreeCanvases();

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
  const expandTimers = new Map();

  document.addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.ct-comment-row');
    if (!row) return;
    const comment = row.parentElement;
    if (!comment?.classList.contains('ct-has-children')) return;

    cancelCollapseChain(comment, collapseTimers);

    if (!comment.classList.contains('ct-expanded') && !expandTimers.has(comment)) {
      const timer = setTimeout(() => {
        expandTimers.delete(comment);
        comment.classList.add('ct-expanded');
      }, EXPAND_DELAY);
      expandTimers.set(comment, timer);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const comment = e.target.closest?.('.ct-comment');
    if (!comment?.classList.contains('ct-has-children')) return;

    const related = e.relatedTarget;
    if (related && comment.contains(related)) return;

    if (expandTimers.has(comment)) {
      clearTimeout(expandTimers.get(comment));
      expandTimers.delete(comment);
    }

    scheduleCollapse(comment, collapseTimers);
  });

  // Touch: tap to toggle
  if (matchMedia('(pointer: coarse)').matches) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;

      const preview = e.target.closest?.('.ct-tree-preview');
      if (preview) {
        const comment = preview.parentElement;
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
        comment.querySelectorAll('.ct-expanded').forEach(desc => desc.classList.remove('ct-expanded'));
        beginCollapse();
        comment.classList.remove('ct-expanded');
      } else {
        comment.classList.add('ct-expanded');
      }
    });
  }

  // Collapse all on mouseleave
  container.addEventListener('mouseleave', () => {
    for (const [, timer] of expandTimers) clearTimeout(timer);
    expandTimers.clear();

    const expanded = [];
    container.querySelectorAll('.ct-comment.ct-expanded').forEach(el => {
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
    const row = comment.querySelector(':scope > .ct-comment-row');
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) return;
    beginCollapse();
    comment.classList.remove('ct-expanded');
  }

  function collapseTree(comment, timers) {
    const toCollapse = [];
    comment.querySelectorAll('.ct-expanded').forEach(desc => {
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

  // ── Onboarding ────────────────────────────────────────────────

  const ONBOARD_KEY = 'commentree_onboarded';

  if (!sessionStorage.getItem(ONBOARD_KEY)) {
    sessionStorage.setItem(ONBOARD_KEY, '1');

    const hint = document.createElement('div');
    hint.className = 'ct-onboard-hint';
    hint.textContent = 'move cursor here';
    document.body.appendChild(hint);

    requestAnimationFrame(() => {
      setTimeout(() => hint.classList.add('ct-visible'), 800);
    });

    function positionHint() {
      const rect = container.getBoundingClientRect();
      hint.style.left = rect.left / 2 + 'px';
    }
    positionHint();
    window.addEventListener('resize', positionHint);

    let phase = 1;
    let arrows = [];

    function showArrows() {
      const topComments = container.querySelectorAll(':scope > .ct-comment.ct-has-children > .ct-comment-row');
      for (const row of topComments) {
        const arrow = document.createElement('div');
        arrow.className = 'ct-onboard-arrow';
        arrow.textContent = '\u2192';
        const rect = row.getBoundingClientRect();
        arrow.style.top = (rect.top + window.scrollY + rect.height / 2 - 16) + 'px';
        arrow.style.left = (rect.left - 40) + 'px';
        document.body.appendChild(arrow);
        arrows.push(arrow);
      }
    }

    function removeArrows() {
      for (const a of arrows) a.remove();
      arrows = [];
    }

    function dismiss() {
      document.querySelectorAll('.ct-onboard-hint').forEach(el => {
        el.classList.add('ct-slow-fade');
        el.classList.remove('ct-visible');
        setTimeout(() => el.remove(), 1600);
      });
      removeArrows();
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', positionHint);
      observer.disconnect();
    }

    function onMove(e) {
      if (phase === 1) {
        const rect = container.getBoundingClientRect();
        if (rect.left > 40 && e.clientX < rect.left) {
          phase = 2;

          const hint2 = document.createElement('div');
          hint2.className = 'ct-onboard-hint';
          hint2.textContent = 'expand comment trees';
          hint2.style.left = hint.style.left;
          document.body.appendChild(hint2);
          requestAnimationFrame(() => hint2.classList.add('ct-visible'));

          hint.classList.remove('ct-visible');
          setTimeout(() => hint.remove(), 1200);

          setTimeout(() => {
            hint2.classList.add('ct-slow-fade');
            hint2.classList.remove('ct-visible');
            setTimeout(() => hint2.remove(), 1600);
          }, 2500);

          showArrows();
        }
      }
    }

    document.addEventListener('mousemove', onMove);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target.classList?.contains('ct-expanded')) {
          dismiss();
          return;
        }
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  }
})();
