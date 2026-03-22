import { fetchThread, fetchFrontPage } from './api.js';
import { renderStory, renderComment, renderFrontPage } from './render.js';
import { setupInteractions } from './interact.js';
import { setupOnboarding } from './onboard.js';

function countDescendants(item) {
  let count = 0;
  for (const child of item.children || []) {
    if (child.text != null) count++;
    count += countDescendants(child);
  }
  return count;
}

async function loadThread(threadId) {
  const container = document.getElementById('container');
  container.innerHTML = '<div id="loading">Loading thread...</div>';

  try {
    const raw = await fetchThread(threadId);
    container.innerHTML = '';

    // Back link
    const back = document.createElement('a');
    back.href = './';
    back.className = 'back-link';
    back.textContent = '\u2190 front page';
    container.appendChild(back);

    const story = {
      title: raw.title,
      url: raw.url,
      author: raw.author,
      points: raw.points,
      created_at_i: raw.created_at_i,
      commentCount: countDescendants(raw),
    };
    container.appendChild(renderStory(story));

    const topLevel = (raw.children || []).filter(c => c.text != null);
    for (const child of topLevel) {
      const el = renderComment(child);
      if (el) container.appendChild(el);
    }

    setupInteractions(container);
    setupOnboarding(container);
    document.title = `${story.title} — commentree`;
  } catch (err) {
    container.textContent = `Failed to load: ${err.message}`;
  }
}

async function loadFrontPage() {
  const container = document.getElementById('container');
  container.innerHTML = '<div id="loading">Loading front page...</div>';

  try {
    const stories = await fetchFrontPage();
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'site-header';
    header.innerHTML = '<h1>commentree</h1><p>Hacker News, with tree previews</p>';
    container.appendChild(header);

    container.appendChild(renderFrontPage(stories));
    setupOnboarding(container, '', false);
    document.title = 'commentree';
  } catch (err) {
    container.textContent = `Failed to load: ${err.message}`;
  }
}

// Route based on ?id= param
const params = new URLSearchParams(window.location.search);
const threadId = params.get('id');

if (threadId) {
  loadThread(threadId);
} else {
  loadFrontPage();
}
