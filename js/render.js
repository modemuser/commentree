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
  comment.appendChild(row);

  const validChildren = (item.children || []).filter(c => c.text != null);

  // Children container
  if (validChildren.length > 0) {
    // Tree preview strip below comment row
    const preview = renderTreePreview(validChildren);
    preview.classList.add('tree-preview');
    comment.appendChild(preview);

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

  const bars = []; // { depth, descendants, textLen }

  function countDescendants(item) {
    let count = 0;
    for (const c of item.children || []) {
      if (c.text == null) continue;
      count += 1 + countDescendants(c);
    }
    return count;
  }

  function collectBars(items, depth) {
    for (const item of items) {
      if (item.text == null) continue;
      const validChildren = (item.children || []).filter(c => c.text != null);
      bars.push({ depth, descendants: countDescendants(item), textLen: item.text.length });
      if (validChildren.length > 0) {
        collectBars(validChildren, depth + 1);
      }
    }
  }

  collectBars(children, 0);
  if (bars.length === 0) return wrapper;

  const canvas = document.createElement('canvas');
  canvas.className = 'tree-canvas';
  wrapper.appendChild(canvas);

  // Paint once visible so we can measure width
  requestAnimationFrame(() => {
    canvas._displayWidth = wrapper.offsetWidth || 300;
    paintTreeCanvas(canvas, bars);
  });

  return wrapper;
}

/**
 * Paint/repaint a tree canvas as a wide horizontal strip with vertical fade.
 */
function paintTreeCanvas(canvas, bars) {
  const barH = 2;
  const maxH = 24;
  const scale = bars.length * barH > maxH ? maxH / (bars.length * barH) : 1;
  const w = canvas._displayWidth || 200;
  const h = Math.min(maxH, Math.ceil(bars.length * barH));

  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
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

    // Continuous darkening: text length dominates, descendants add a hint
    const intensity = 0.12 + Math.sqrt(textLen) * 0.006 + Math.sqrt(descendants) * 0.07;

    ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
    ctx.fillRect(x, y, barW, barHeight);
  }
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
