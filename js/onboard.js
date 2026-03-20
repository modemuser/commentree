/**
 * First-visit onboarding: guide cursor to the left margin.
 * Phase 1: "move cursor here" rotated in left gutter.
 * Phase 2: crossfade to "expand comment trees" + arrows on cards.
 * Dismissed after first comment expansion.
 */

const STORAGE_KEY = 'commentree_onboarded';

export function setupOnboarding() {
  if (sessionStorage.getItem(STORAGE_KEY)) return;
  sessionStorage.setItem(STORAGE_KEY, '1');

  const container = document.getElementById('container');

  const hint = document.createElement('div');
  hint.className = 'onboard-hint';
  hint.textContent = 'move cursor here';
  document.body.appendChild(hint);

  // Fade in after brief delay
  requestAnimationFrame(() => {
    setTimeout(() => hint.classList.add('visible'), 800);
  });

  function positionHint() {
    const rect = container.getBoundingClientRect();
    hint.style.left = rect.left / 2 + 'px';
  }
  positionHint();
  window.addEventListener('resize', positionHint);

  let phase = 1;
  let arrows = [];

  function showArrows() {
    const comments = container.querySelectorAll(':scope > .comment.has-children > .comment-row');

    for (const row of comments) {
      const arrow = document.createElement('div');
      arrow.className = 'onboard-arrow';
      arrow.textContent = '\u2192';
      const rect = row.getBoundingClientRect();
      arrow.style.position = 'absolute';
      arrow.style.top = (rect.top + window.scrollY + rect.height / 2 - 16) + 'px';
      arrow.style.left = (rect.left - 40) + 'px';
      document.body.appendChild(arrow);
      arrows.push(arrow);
    }
  }

  function removeArrows() {
    for (const a of arrows) a.remove();
    arrows = [];
  }

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    document.querySelectorAll('.onboard-hint').forEach(el => {
      el.classList.add('slow-fade');
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 1600);
    });
    removeArrows();
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('resize', positionHint);
    observer.disconnect();
  }

  function onMove(e) {
    if (phase === 1) {
      const rect = container.getBoundingClientRect();
      if (rect.left > 40 && e.clientX < rect.left) {
        phase = 2;

        // Crossfade: fade out text 1, immediately show text 2 behind it
        const hint2 = document.createElement('div');
        hint2.className = 'onboard-hint';
        hint2.textContent = 'expand comment trees';
        hint2.style.left = hint.style.left;
        document.body.appendChild(hint2);
        requestAnimationFrame(() => hint2.classList.add('visible'));

        // Fade out text 1
        hint.classList.remove('visible');
        setTimeout(() => hint.remove(), 1200);

        // Hold text 2, then fade out
        setTimeout(() => {
          hint2.classList.add('slow-fade');
          hint2.classList.remove('visible');
          setTimeout(() => hint2.remove(), 1600);
        }, 2500);

        showArrows();
      }
    }
  }

  document.addEventListener('mousemove', onMove);

  // Dismiss when any comment gets expanded
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target.classList?.contains('expanded')) {
        dismiss();
        return;
      }
    }
  });

  observer.observe(container, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });
}
