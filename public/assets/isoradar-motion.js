/* ==========================================================================
   ISO Radar — page and tab transitions for the tenant app (ims_qhse_9.html).

   • Page change: the new page eases in (fade + small rise) with its sections
     staggered, once the page's content has actually arrived — not on the
     loading spinner.
   • Tabs (organisation, RCA, Gantt views): the newly shown panel eases in.
   • Modals animate through CSS (isoradar.css, "Motion" block).
   The OS "reduce motion" setting turns all of this off (isoradar.css).
   Depends on globals from the host page: navigate, switchOrgTab, switchRCATab.
   ========================================================================== */
(function () {
  'use strict';
  const content = document.getElementById('app-content');
  if (!content) return;

  const play = (el, cls) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
    el.addEventListener('animationend', function done(e) {
      if (e.target !== el && !el.contains(e.target)) return;
      el.classList.remove(cls);
      el.removeEventListener('animationend', done);
    });
  };

  // ── page transitions ─────────────────────────────────────────────────
  let pendingUntil = 0;
  const isSpinner = () => {
    const first = content.firstElementChild;
    return !!first && content.children.length === 1 && !!first.querySelector('.fa-spinner') && first.textContent.trim() === '';
  };
  new MutationObserver(() => {
    if (Date.now() > pendingUntil || isSpinner()) return;
    pendingUntil = 0;
    play(content, 'ir-enter');
  }).observe(content, { childList: true });

  const wrap = (name, after) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      const r = orig.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) { /* motion is cosmetic */ }
      return r;
    };
  };

  wrap('navigate', () => {
    pendingUntil = Date.now() + 4000;
    play(document.getElementById('page-title'), 'ir-swap');
    play(document.getElementById('page-subtitle'), 'ir-swap');
    // content that rendered synchronously (no fetch) is already in place
    if (!isSpinner()) { pendingUntil = 0; play(content, 'ir-enter'); }
  });

  // ── tab transitions ──────────────────────────────────────────────────
  wrap('switchOrgTab', tab => play(document.getElementById('org-section-' + tab), 'ir-tab-in'));
  wrap('switchRCATab', tab => {
    play(document.getElementById('rpanel-' + tab), 'ir-tab-in');
  });
  wrap('setGanttView', () => play(document.getElementById('gantt-container') || document.querySelector('.gantt-wrap'), 'ir-tab-in'));
})();
