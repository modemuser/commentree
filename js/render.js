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
 * Children are nested inside but hidden until hover.
 */
export function renderComment(item) {
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

  // Tree preview for descendants (always render for alignment)
  const validChildren = (item.children || []).filter(c => c.text != null);
  const preview = validChildren.length > 0
    ? renderTreePreview(validChildren)
    : document.createElement('div');
  preview.classList.add('tree-preview');
  row.appendChild(preview);

  comment.appendChild(row);

  // Children container (hidden, revealed on hover via CSS)
  if (validChildren.length > 0) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'comment-children';

    for (const child of validChildren) {
      const childEl = renderComment(child);
      if (childEl) childrenContainer.appendChild(childEl);
    }

    comment.appendChild(childrenContainer);
  }

  return comment;
}

/**
 * Render a compact tree preview showing the shape of the subtree.
 * Each descendant becomes a tiny bar, indented by relative depth.
 */
function renderTreePreview(children) {
  const preview = document.createElement('div');
  preview.className = 'tree-preview';

  // Collect all bars first so we can scale to fit
  const bars = [];

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

  collectBars(children, 0);

  if (bars.length === 0) return preview;

  // Render as a single canvas for compactness
  const canvas = document.createElement('canvas');
  const barH = 1.5;
  const maxH = 60; // max preview height in px
  const scale = bars.length * barH > maxH ? maxH / (bars.length * barH) : 1;
  const w = 50;
  const h = Math.min(maxH, Math.ceil(bars.length * barH));

  canvas.width = w * 2; // 2x for retina
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.className = 'tree-canvas';

  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  for (let i = 0; i < bars.length; i++) {
    const depth = bars[i];
    const indent = depth * 3;
    const barW = 12; // fixed width — both edges jagged
    const x = indent;
    const y = i * barH * scale;
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(x, y, barW, Math.max(1, barH * scale - 0.5));
  }

  preview.appendChild(canvas);

  // Count badge
  const badge = document.createElement('div');
  badge.className = 'tree-count';
  badge.textContent = `${bars.length}`;
  preview.appendChild(badge);

  return preview;
}

function relativeTime(unixSeconds) {
  if (!unixSeconds) return '';
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
