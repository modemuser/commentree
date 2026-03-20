import { fetchThread } from './api.js';
import { renderStory, renderComment } from './render.js';

const DEFAULT_THREAD = '47440430';

function countDescendants(item) {
  let count = 0;
  for (const child of item.children || []) {
    if (child.text != null) count++;
    count += countDescendants(child);
  }
  return count;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const threadId = params.get('id') || DEFAULT_THREAD;

  const container = document.getElementById('container');
  const loading = document.getElementById('loading');

  try {
    loading.textContent = `Loading thread ${threadId}...`;
    const raw = await fetchThread(threadId);

    loading.remove();

    // Story header
    const story = {
      title: raw.title,
      url: raw.url,
      author: raw.author,
      points: raw.points,
      created_at_i: raw.created_at_i,
      commentCount: countDescendants(raw),
    };
    container.appendChild(renderStory(story));

    // Top-level comments
    const topLevel = (raw.children || []).filter(c => c.text != null);
    for (const child of topLevel) {
      const el = renderComment(child);
      if (el) container.appendChild(el);
    }

    document.title = `${story.title} — commentree`;
  } catch (err) {
    loading.textContent = `Failed to load: ${err.message}`;
    console.error(err);
  }
}

init();
