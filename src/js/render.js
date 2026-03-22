import { barColor } from './color.js';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function safeHref(url) {
  try { return /^https?:/.test(new URL(url).protocol) ? url : ''; }
  catch { return ''; }
}

/**
 * Render the story header.
 */
export function renderStory(story) {
  const el = document.createElement('div');
  el.className = 'story-header';

  const href = safeHref(story.url || '');
  const title = esc(story.title || '');
  const domain = href ? esc(new URL(href).hostname.replace('www.', '')) : '';
  const author = esc(story.author || '');

  el.innerHTML = `
    <div class="story-title">
      ${href ? `<a href="${href}" target="_blank">${title}</a>` : title}
      ${domain ? `<span class="story-domain">(${domain})</span>` : ''}
    </div>
    ${story.text && !href ? `<div class="story-text">${story.text}</div>` : ''}
    <div class="story-meta">
      ${story.points} points by ${author} · ${relativeTime(story.created_at_i)} · ${story.commentCount} comments
    </div>
  `;

  return el;
}

/**
 * Recursively render a comment and all its descendants.
 * Each comment is a grid: bar (3px) | row (0fr) | children.
 * Bar mode shows a thin colored strip; card mode shows full content.
 * The transition between modes is driven by CSS grid-template-rows.
 */
export function renderComment(item, depth = 0, authorColors = {}, op = null, tlc = null) {
  if (!item || item.text == null) return null;

  const comment = document.createElement('div');
  comment.className = 'comment';
  if (item.id) comment.dataset.id = item.id;

  const aColor = authorColors[item.author];

  // Bar: thin colored strip visible when comment is collapsed
  const bar = document.createElement('div');
  bar.className = 'comment-bar';
  bar.style.background = barColor(item.text.length);
  if (aColor) bar.style.boxShadow = `inset 8px 0 0 ${aColor}`;
  comment.appendChild(bar);

  // Row: comment content
  const content = document.createElement('div');
  content.className = 'comment-content';
  const isTlc = tlc && item.author === tlc && aColor;
  const isOp = op && item.author === op;
  const authorName = esc(item.author || '[deleted]');
  const tag = isOp ? ` <span class="op-tag">(OP)</span>` : '';
  const nameStyle = (isOp || isTlc) && aColor ? ` style="color:${aColor}"` : '';
  const authorHtml = `<span${nameStyle}>${authorName}</span>${tag}`;
  content.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${authorHtml}</span>
      <span class="comment-time">${relativeTime(item.created_at_i)}</span>
    </div>
    <div class="comment-body">${item.text}</div>
  `;

  const row = document.createElement('div');
  row.className = 'comment-row';
  row.appendChild(content);
  comment.appendChild(row);

  const validChildren = (item.children || []).filter(c => c.text != null);

  if (validChildren.length > 0) {
    comment.classList.add('has-children');

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'comment-children';

    for (const child of validChildren) {
      const childEl = renderComment(child, depth + 1, authorColors, op, tlc);
      if (childEl) childrenContainer.appendChild(childEl);
    }

    comment.appendChild(childrenContainer);
  }

  return comment;
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

    const href = safeHref(story.url || '');
    const domain = href ? esc(new URL(href).hostname.replace('www.', '')) : '';

    row.innerHTML = `
      <div class="story-list-rank">${story.num_comments ?? 0}</div>
      <div class="story-list-content">
        <div class="story-list-title">
          ${esc(story.title)}
          ${domain ? `<span class="story-domain">(${domain})</span>` : ''}
        </div>
        <div class="story-list-meta">
          ${story.points} points by ${esc(story.author)} · ${relativeTime(story.created_at_i)}
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
