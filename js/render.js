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
 * Each comment is a grid: bar (2px) | row (0fr) | children.
 * Bar mode shows a thin colored strip; card mode shows full content.
 * The transition between modes is driven by CSS grid-template-rows.
 */
export function renderComment(item, depth = 0) {
  if (!item || item.text == null) return null;

  const comment = document.createElement('div');
  comment.className = 'comment';

  // Bar: thin colored strip visible when comment is collapsed
  const bar = document.createElement('div');
  bar.className = 'comment-bar';
  const intensity = 0.06 + Math.min(Math.sqrt(item.text.length) * 0.008, 0.3);
  bar.style.background = `rgba(0, 0, 0, ${intensity})`;
  comment.appendChild(bar);

  // Row: comment content
  const content = document.createElement('div');
  content.className = 'comment-content';
  content.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${item.author || '[deleted]'}</span>
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
      const childEl = renderComment(child, depth + 1);
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
