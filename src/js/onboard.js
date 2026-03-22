/**
 * First-visit onboarding overlay + info button.
 * @param {HTMLElement} container - the root container element
 * @param {string} p - CSS class prefix ('' for standalone, 'ct-' for extension)
 */

const STORAGE_KEY = 'commentree_onboarded';

export function setupOnboarding(container, p = '', autoShow = true) {
  const isTouch = matchMedia('(pointer: coarse)').matches;

  const btn = document.createElement('button');
  btn.className = `${p}info-btn`;
  btn.textContent = 'i';
  btn.addEventListener('click', () => {
    const overlay = document.querySelector(`.${p}onboard-overlay`);
    if (overlay) {
      dismiss(overlay, p);
    } else {
      showOverlay(container, isTouch, p, btn);
    }
  });
  document.body.appendChild(btn);

  if (autoShow && !localStorage.getItem(STORAGE_KEY)) {
    showOverlay(container, isTouch, p, btn);
  }
}

function showOverlay(container, isTouch, p, btn) {
  document.querySelector(`.${p}onboard-overlay`)?.remove();

  btn.textContent = '×';
  btn.classList.add(`${p}info-btn-close`);

  const overlay = document.createElement('div');
  overlay.className = `${p}onboard-overlay`;

  if (isTouch) {
    overlay.innerHTML = `
      <div class="${p}onboard-content">
        <p class="${p}onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Tap a comment to expand its reply tree.</p>
        <p>Tap again to collapse.</p>
        <p class="${p}onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a> · on <a href="https://github.com/modemuser/commentree" target="_blank">github</a> · powered by <a href="https://hn.algolia.com/api" target="_blank">algolia</a></p>
        <p class="${p}onboard-dismiss">tap anywhere to start</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add(`${p}visible`));
    overlay.addEventListener('click', () => dismiss(overlay, p));
  } else {
    overlay.innerHTML = `
      <div class="${p}onboard-content">
        <p class="${p}onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Explore with your mouse cursor, hover to expand.</p>
        <p>Each line represents a comment — darker lines mean longer comments.</p>
        <p>Best to interact with the tree from the left.</p>
        <p class="${p}onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a> · on <a href="https://github.com/modemuser/commentree" target="_blank">github</a> · powered by <a href="https://hn.algolia.com/api" target="_blank">algolia</a></p>
        <p class="${p}onboard-dismiss">move your cursor to the left margin to begin</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add(`${p}visible`));

    overlay.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      dismiss(overlay, p);
      document.removeEventListener('mousemove', onMove);
    });

    function onMove(e) {
      const rect = container.getBoundingClientRect();
      if (e.clientX < rect.left) {
        dismiss(overlay, p);
        document.removeEventListener('mousemove', onMove);
      }
    }
    document.addEventListener('mousemove', onMove);
  }
}

function dismiss(overlay, p) {
  localStorage.setItem(STORAGE_KEY, '1');
  overlay.classList.remove(`${p}visible`);
  setTimeout(() => overlay.remove(), 500);
  const btn = document.querySelector(`.${p}info-btn`);
  if (btn) {
    btn.textContent = 'i';
    btn.classList.remove(`${p}info-btn-close`);
  }
}
