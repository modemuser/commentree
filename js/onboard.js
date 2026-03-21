/**
 * First-visit onboarding overlay.
 * Mouse: fullscreen overlay explaining cursor navigation, dismissed when cursor enters left margin.
 * Touch: fullscreen overlay explaining tap interaction, dismissed on tap.
 */

const STORAGE_KEY = 'commentree_onboarded';

export function setupOnboarding() {
  if (sessionStorage.getItem(STORAGE_KEY)) return;
  sessionStorage.setItem(STORAGE_KEY, '1');

  const container = document.getElementById('container');
  if (matchMedia('(pointer: coarse)').matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'onboard-overlay';

  {
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
