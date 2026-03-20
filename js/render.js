/**
 * Render the story header.
 */
export function renderStory(story) {
  const el = document.createElement('div');
  el.className = 'story-header';

  const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : '';

  el.innerHTML = `
    <div class="story-title">
      ${story.url ? `<a href="${story.url}" target="_blank">${story.title}</a>` : story.title}
      ${domain ? `<span class="story-domain">(${domain})</span>` : ''}
    </div>
    <div class="story-meta">
      ${story.points} points by ${story.author} · ${relativeTime(story.created_at_i)} · ${story.commentCount} comments
    </div>
  `;

  return el;
}

/**
 * Recursively render a comment and all its descendants.
 * Children are nested inside, controlled by JS expand/collapse.
 */
export function renderComment(item, depth = 0) {
  if (!item || item.text == null) return null;

  const comment = document.createElement('div');
  comment.className = 'comment';

  // Row: content + tree preview
  const row = document.createElement('div');
  row.className = 'comment-row';

  const content = document.createElement('div');
  content.className = 'comment-content';
  content.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${item.author || '[deleted]'}</span>
      <span class="comment-time">${relativeTime(item.created_at_i)}</span>
    </div>
    <div class="comment-body">${item.text}</div>
  `;

  row.appendChild(content);

  // Tree preview (always render for alignment)
  const validChildren = (item.children || []).filter(c => c.text != null);
  const preview = validChildren.length > 0
    ? renderTreePreview(validChildren)
    : document.createElement('div');
  preview.classList.add('tree-preview');
  row.appendChild(preview);

  comment.appendChild(row);

  // Children container
  if (validChildren.length > 0) {
    // "More below" indicator
    const peek = document.createElement('div');
    peek.className = 'comment-peek';
    comment.appendChild(peek);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'comment-children';

    const childrenInner = document.createElement('div');
    childrenInner.className = 'comment-children-inner';

    for (const child of validChildren) {
      const childEl = renderComment(child, depth + 1);
      if (childEl) childrenInner.appendChild(childEl);
    }

    childrenContainer.appendChild(childrenInner);
    comment.appendChild(childrenContainer);

    comment.classList.add('has-children');
  }

  return comment;
}

/**
 * Render compact tree preview — canvas with bars for each descendant.
 */
function renderTreePreview(children) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-preview';

  const bars = [];
  // Track which bar range belongs to each direct child index
  const childRanges = []; // [{ start, end }] per direct child

  function collectBars(items, depth) {
    for (const item of items) {
      if (item.text == null) continue;
      bars.push(depth);
      const validChildren = (item.children || []).filter(c => c.text != null);
      if (validChildren.length > 0) {
        collectBars(validChildren, depth + 1);
      }
    }
  }

  let barIndex = 0;
  for (const child of children) {
    if (child.text == null) continue;
    const start = barIndex;
    collectBars([child], 0);
    childRanges.push({ start, end: bars.length });
    barIndex = bars.length;
  }

  if (bars.length === 0) return wrapper;

  // Store data on wrapper for re-rendering with highlights
  wrapper._treeData = { bars, childRanges };

  const canvas = document.createElement('canvas');
  canvas.className = 'tree-canvas';
  wrapper.appendChild(canvas);

  const badge = document.createElement('div');
  badge.className = 'tree-count';
  badge.textContent = `${bars.length}`;
  wrapper.appendChild(badge);

  paintTreeCanvas(canvas, bars, new Set());

  return wrapper;
}

/**
 * Paint/repaint a tree canvas, dimming bars NOT in highlightSet.
 * If highlightSet is empty, all bars are drawn at full opacity.
 */
function paintTreeCanvas(canvas, bars, highlightSet) {
  const barH = 1.5;
  const maxH = 50;
  const scale = bars.length * barH > maxH ? maxH / (bars.length * barH) : 1;
  const w = 40;
  const h = Math.min(maxH, Math.ceil(bars.length * barH));

  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  const hasHighlight = highlightSet.size > 0;

  for (let i = 0; i < bars.length; i++) {
    const depth = bars[i];
    const indent = depth * 3;
    const barW = 12;
    const x = indent;
    const y = i * barH * scale;

    if (hasHighlight && highlightSet.has(i)) {
      ctx.fillStyle = '#e00000';
    } else {
      ctx.fillStyle = '#ff6600';
    }
    ctx.fillRect(x, y, barW, Math.max(1, barH * scale - 0.5));
  }
}

/**
 * Update tree preview highlighting for a comment and all its ancestors.
 * Walks the DOM descendant tree in DFS order (matching bar order) and
 * highlights every bar whose comment has the 'expanded' class.
 */
export function updateTreeHighlights(commentEl) {
  let el = commentEl;
  while (el) {
    updateSingleTree(el);
    el = el.parentElement?.closest?.('.comment');
  }
}

function updateSingleTree(commentEl) {
  const preview = commentEl.querySelector(':scope > .comment-row .tree-preview');
  if (!preview?._treeData) return;

  const { bars } = preview._treeData;
  const canvas = preview.querySelector('.tree-canvas');
  if (!canvas) return;

  const childrenInner = commentEl.querySelector(':scope > .comment-children > .comment-children-inner');
  if (!childrenInner) {
    paintTreeCanvas(canvas, bars, new Set());
    return;
  }

  const highlightSet = new Set();
  let barIdx = 0;

  function walk(container, visible) {
    for (const child of container.children) {
      if (!child.classList.contains('comment')) continue;
      if (barIdx >= bars.length) return;

      if (visible) highlightSet.add(barIdx);
      barIdx++;

      const inner = child.querySelector(':scope > .comment-children > .comment-children-inner');
      if (inner) walk(inner, visible && child.classList.contains('expanded'));
    }
  }

  walk(childrenInner, commentEl.classList.contains('expanded'));
  paintTreeCanvas(canvas, bars, highlightSet);
}

/**
 * Render the front page story list.
 */
export function renderFrontPage(stories) {
  const list = document.createElement('div');
  list.className = 'story-list';

  for (const story of stories) {
    const row = document.createElement('a');
    row.className = 'story-list-item';
    row.href = `?id=${story.objectID}`;

    const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : '';

    row.innerHTML = `
      <div class="story-list-rank">${story.num_comments ?? 0}</div>
      <div class="story-list-content">
        <div class="story-list-title">
          ${story.title}
          ${domain ? `<span class="story-domain">(${domain})</span>` : ''}
        </div>
        <div class="story-list-meta">
          ${story.points} points by ${story.author} · ${relativeTime(story.created_at_i)}
        </div>
      </div>
    `;

    list.appendChild(row);
  }

  return list;
}

function relativeTime(unixSeconds) {
  if (!unixSeconds) return '';
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
