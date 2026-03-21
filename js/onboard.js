/**
 * First-visit onboarding overlay.
 * Mouse: fullscreen overlay explaining cursor navigation, dismissed when cursor enters left margin.
 * Touch: fullscreen overlay explaining tap interaction, dismissed on tap.
 */

const STORAGE_KEY = 'commentree_onboarded';

export function setupOnboarding() {
  // if (sessionStorage.getItem(STORAGE_KEY)) return;
  // sessionStorage.setItem(STORAGE_KEY, '1');

  const container = document.getElementById('container');
  const isTouch = matchMedia('(pointer: coarse)').matches;

  const overlay = document.createElement('div');
  overlay.className = 'onboard-overlay';

  if (isTouch) {
    overlay.innerHTML = `
      <div class="onboard-overlay-content">
        <p class="onboard-title">commentree</p>
        <p>Tap a comment to expand its reply tree.</p>
        <p>Tap again to collapse.</p>
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
        <p>Navigate the comment tree with your cursor.</p>
        <p>Move to the left margin to expand replies.</p>
        <p class="onboard-dismiss">move your cursor to the left to begin</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

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
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 500);
}
