/**
 * First-visit onboarding overlay + info button.
 */

const STORAGE_KEY = 'commentree_onboarded';

export function setupOnboarding() {
  const container = document.getElementById('container');
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // Info button — always present
  const btn = document.createElement('button');
  btn.className = 'info-btn';
  btn.textContent = 'i';
  btn.addEventListener('click', () => showOverlay(container, isTouch));
  document.body.appendChild(btn);

  // Show onboarding on first visit
  if (!localStorage.getItem(STORAGE_KEY)) {
    showOverlay(container, isTouch);
  }
}

function showOverlay(container, isTouch) {
  // Remove any existing overlay
  document.querySelector('.onboard-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'onboard-overlay';

  if (isTouch) {
    overlay.innerHTML = `
      <div class="onboard-overlay-content">
        <p class="onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Tap a comment to expand its reply tree.</p>
        <p>Tap again to collapse.</p>
        <p class="onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
        <p class="onboard-dismiss">tap anywhere to start</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.addEventListener('click', () => dismiss(overlay));
  } else {
    overlay.innerHTML = `
      <div class="onboard-overlay-content">
        <p class="onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Explore with your mouse cursor, hover to expand.</p>
        <p>Each line represents a comment — darker lines mean longer comments.</p>
        <p>Best to interact with the tree from the left.</p>
        <p class="onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
        <p class="onboard-dismiss">move your cursor to the left margin to begin</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    overlay.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      dismiss(overlay);
      document.removeEventListener('mousemove', onMove);
    });

    function onMove(e) {
      const rect = container.getBoundingClientRect();
      if (e.clientX < rect.left) {
        dismiss(overlay);
        document.removeEventListener('mousemove', onMove);
      }
    }
    document.addEventListener('mousemove', onMove);
  }
}

function dismiss(overlay) {
  localStorage.setItem(STORAGE_KEY, '1');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 500);
}
