/**
 * commentree — Chrome extension entry point.
 * Parses HN/Reddit comment DOM into a tree and renders with bar↔card layout.
 * Interactions and onboarding are imported from shared source.
 */

import { setupInteractions } from '../src/js/interact.js';
import { setupOnboarding } from '../src/js/onboard.js';
import { barColor } from '../src/js/color.js';

(function () {
  'use strict';

  const P = 'ct-'; // CSS class prefix

  const commentTree = document.querySelector('table.comment-tree');
  const redditCommentArea = document.querySelector('.commentarea > .sitetable.nestedlisting');

  if (!commentTree && !redditCommentArea) return;

  // ── Parse HN flat comments into tree ────────────────────────

  function parseHNComments() {
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

  // ── Parse old Reddit nested comments into tree ──────────────

  function parseRedditComments() {
    const roots = [];
    const topLevel = redditCommentArea.querySelectorAll(':scope > .thing');

    for (const thing of topLevel) {
      const item = parseRedditComment(thing);
      if (item) roots.push(item);
    }

    return roots;
  }

  function parseRedditComment(thing) {
    if (thing.dataset.type !== 'comment') return null;

    const entry = thing.querySelector(':scope > .entry');
    if (!entry) return null;

    const bodyEl = entry.querySelector('.usertext-body .md');
    const text = bodyEl?.innerHTML || null;
    if (text == null) return null;

    const rowNode = document.createElement('div');
    rowNode.style.display = 'flex';
    rowNode.style.alignItems = 'flex-start';
    const midcol = thing.querySelector(':scope > .midcol');
    if (midcol) rowNode.appendChild(midcol.cloneNode(true));
    rowNode.appendChild(entry.cloneNode(true));

    const children = [];
    const childSitetable = thing.querySelector(':scope > .child > .sitetable');
    if (childSitetable) {
      for (const childThing of childSitetable.querySelectorAll(':scope > .thing')) {
        const child = parseRedditComment(childThing);
        if (child) children.push(child);
      }
    }

    const scoreEl = entry.querySelector('.score.unvoted');
    const score = scoreEl ? parseInt(scoreEl.getAttribute('title') || '0', 10) : 0;

    return { rowNode, text, children, score };
  }

  // ── Detect dark mode ───────────────────────────────────────

  let isDarkMode = document.documentElement.classList.contains('res-nightmode');

  // ── Render nested comments with bar↔card grid ──────────────

  function renderComment(item) {
    if (!item || item.text == null) return null;

    const wrapper = document.createElement('div');
    wrapper.className = `${P}comment`;

    const bar = document.createElement('div');
    bar.className = `${P}comment-bar`;
    bar.dataset.textLen = item.text.length;
    bar.dataset.score = item.score || 0;
    bar.style.background = barColor(item.text.length, item.score, isDarkMode);
    wrapper.appendChild(bar);

    const row = document.createElement('div');
    row.className = `${P}comment-row`;
    row.appendChild(item.rowNode);
    wrapper.appendChild(row);

    const validChildren = (item.children || []).filter(c => c.text != null);

    if (validChildren.length > 0) {
      wrapper.classList.add(`${P}has-children`);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = `${P}children`;

      for (const child of validChildren) {
        const childEl = renderComment(child);
        if (childEl) childrenContainer.appendChild(childEl);
      }

      wrapper.appendChild(childrenContainer);
    }

    return wrapper;
  }

  // ── Replace comment tree ──────────────────────────────────

  const comments = commentTree ? parseHNComments() : parseRedditComments();

  const container = document.createElement('div');
  container.id = `${P}container`;

  for (const child of comments) {
    const el = renderComment(child);
    if (el) container.appendChild(el);
  }

  (commentTree || redditCommentArea).replaceWith(container);

  // ── Watch for RES dark mode toggle ────────────────────────

  new MutationObserver(() => {
    const dark = document.documentElement.classList.contains('res-nightmode');
    if (dark === isDarkMode) return;
    isDarkMode = dark;
    container.querySelectorAll(`.${P}comment-bar`).forEach(bar => {
      bar.style.background = barColor(
        parseInt(bar.dataset.textLen, 10),
        parseInt(bar.dataset.score, 10),
        isDarkMode
      );
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ── Interactions and onboarding (from shared source) ──────

  setupInteractions(container, P);
  setupOnboarding(container, P);
})();
