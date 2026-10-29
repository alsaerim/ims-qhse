/* ==========================================================================
   ISO Radar — accessibility layer for the tenant app (ims_qhse_9.html).

   The pages are rendered as HTML strings by many loaders; rather than touch
   each template, this file repairs what assistive technology needs as content
   appears (WCAG 2.2):
   • dialogs (.modal.open): role/aria-modal/label, focus moves in, Tab stays
     inside, Escape closes, focus returns to the opener          2.1.2 2.4.3 4.1.2
   • clickable non-buttons ([onclick] divs, rows, cards): focusable and
     operable with Enter / Space                                  2.1.1
   • icon-only buttons get a name; fields get their visible label 1.3.1 4.1.2
   • a "skip to content" link                                     2.4.1
   Sidebar items have their own key handling (isoradar-motion.js).
   Styles: .ir-skip and the target-size rules in isoradar-app.css.
   ========================================================================== */
(function () {
  'use strict';
  const content = document.getElementById('app-content');
  if (!content) return;
  const ar = () => document.documentElement.lang !== 'en';

  // ── names for icon-only buttons, by icon ────────────────────────────
  const ICON_NAMES = {
    'fa-eye': ['عرض التفاصيل', 'View details'], 'fa-edit': ['تعديل', 'Edit'], 'fa-pen': ['تعديل', 'Edit'],
    'fa-pen-to-square': ['تعديل', 'Edit'], 'fa-trash': ['حذف', 'Delete'], 'fa-trash-alt': ['حذف', 'Delete'],
    'fa-trash-can': ['حذف', 'Delete'], 'fa-times': ['إغلاق', 'Close'], 'fa-xmark': ['إغلاق', 'Close'],
    'fa-cog': ['الإعدادات', 'Settings'], 'fa-gear': ['الإعدادات', 'Settings'], 'fa-unlink': ['فصل الربط', 'Disconnect'],
    'fa-download': ['تنزيل', 'Download'], 'fa-file-pdf': ['تصدير PDF', 'Export PDF'], 'fa-print': ['طباعة', 'Print'],
    'fa-plus': ['إضافة', 'Add'], 'fa-sign-out-alt': ['تسجيل الخروج', 'Sign out'], 'fa-right-from-bracket': ['تسجيل الخروج', 'Sign out'],
    'fa-bars': ['القائمة', 'Menu'], 'fa-bell': ['الإشعارات', 'Notifications'], 'fa-ellipsis-v': ['خيارات', 'Options'],
    'fa-ellipsis-vertical': ['خيارات', 'Options'], 'fa-chevron-left': ['التالي', 'Next'], 'fa-chevron-right': ['السابق', 'Previous'],
    'fa-copy': ['نسخ', 'Copy'], 'fa-sync': ['تحديث', 'Refresh'], 'fa-rotate': ['تحديث', 'Refresh'], 'fa-paperclip': ['إرفاق ملف', 'Attach file'],
    'fa-paper-plane': ['إرسال', 'Send'], 'fa-search': ['بحث', 'Search'], 'fa-magnifying-glass': ['بحث', 'Search'],
  };
  function nameIconButtons(root) {
    root.querySelectorAll('button, a[href], [role="button"], [data-ir-click]').forEach(b => {
      if (b.getAttribute('aria-label') || b.textContent.trim()) return;
      if (b.title) { b.setAttribute('aria-label', b.title); return; }
      // picture areas that open a hidden file input (e.g. the organisation logo)
      if (/-input'\)\.click\(\)/.test(b.getAttribute('onclick') || '')) { b.setAttribute('aria-label', ar() ? 'رفع صورة' : 'Upload image'); return; }
      const icon = b.querySelector('i[class*="fa-"]');
      if (!icon) return;
      const key = [...icon.classList].find(c => ICON_NAMES[c]);
      if (key) b.setAttribute('aria-label', ICON_NAMES[key][ar() ? 0 : 1]);
      icon.setAttribute('aria-hidden', 'true');
    });
  }

  // ── fields: tie them to their visible label, else describe them ─────
  let uid = 0;
  const FIELD_NAMES = {
    'trend-date-from': ['من شهر', 'From month'], 'trend-date-to': ['إلى شهر', 'To month'],
    'iso-chart-metric': ['مقياس توزيع المعايير', 'Standards chart metric'],
  };
  function labelFields(root) {
    root.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(f => {
      if (f.closest('label') || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby')) return;
      if (f.id && document.querySelector('label[for="' + CSS.escape(f.id) + '"]')) return;
      // a <label> just before the field (or the only loose label in its wrapper) names it
      let lab = f.previousElementSibling;
      if (!lab || lab.tagName !== 'LABEL') {
        const loose = f.parentElement ? f.parentElement.querySelectorAll(':scope > label:not([for])') : [];
        lab = loose.length === 1 ? loose[0] : null;
      }
      if (lab && lab.tagName === 'LABEL' && !lab.htmlFor) {
        if (!f.id) f.id = 'ir-f' + (++uid);
        lab.htmlFor = f.id;
        return;
      }
      const known = FIELD_NAMES[f.id];
      const text = known ? known[ar() ? 0 : 1]
        : f.placeholder || f.title || (f.tagName === 'SELECT' && f.options[0] ? f.options[0].textContent.replace(/^[-\s]+|[-\s]+$/g, '') : '');
      if (text) f.setAttribute('aria-label', text);
    });
  }

  // ── clickable non-buttons become keyboard operable ──────────────────
  const NATIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|OPTION|SUMMARY)$/;
  function operable(root) {
    root.querySelectorAll('[onclick]').forEach(el => {
      if (NATIVE.test(el.tagName) || el.hasAttribute('data-ir-click') || el.classList.contains('nav-item')) return;
      if (/^\s*event\.stopPropagation\(\);?\s*$/.test(el.getAttribute('onclick') || '')) return; // shields its children only
      if (el.classList.contains('modal')) return;                                               // backdrop click-to-close
      el.setAttribute('data-ir-click', '');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      // rows and cards that hold their own buttons stay plain focusable; leaf elements act as buttons
      if (!el.getAttribute('role') && !el.querySelector('button, a[href], input, select, textarea')) el.setAttribute('role', 'button');
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute('data-ir-click')) return;
    e.preventDefault();
    el.click();
  });

  // ── dialogs ─────────────────────────────────────────────────────────
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const openers = new WeakMap();
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const openModals = () => [...document.querySelectorAll('.modal.open')];
  // only unambiguous dismiss controls: an ✕ icon, a close…() handler, or a button labelled exactly "Cancel"
  // (never a match inside longer text such as "إلغاء الاشتراك" — cancel subscription)
  const isClose = b => !!b.querySelector('.fa-times, .fa-xmark')
    || /\bclose[A-Za-z]*\(/.test(b.getAttribute('onclick') || '')
    || /^(إلغاء|إغلاق|cancel|close)$/i.test((b.getAttribute('aria-label') || b.textContent).trim());

  function onOpen(m) {
    if (!m.hasAttribute('role')) m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    openers.set(m, document.activeElement);
    // content is often injected right after the class flips
    setTimeout(() => {
      repair(m);
      const title = m.querySelector('.modal-title, h2, h3');
      if (title && !m.getAttribute('aria-labelledby')) {
        if (!title.id) title.id = 'ir-dlg' + (++uid);
        m.setAttribute('aria-labelledby', title.id);
      }
      if (m.contains(document.activeElement)) return;
      const items = [...m.querySelectorAll(FOCUSABLE)].filter(visible);
      const first = items.find(el => !(el.tagName === 'BUTTON' && isClose(el))) || items[0];
      if (first) first.focus({ preventScroll: true });
    }, 60);
  }
  function onClose(m) {
    const back = openers.get(m);
    openers.delete(m);
    if (back && back.isConnected && typeof back.focus === 'function' && !openModals().length) back.focus({ preventScroll: true });
  }
  function closeTop() {
    const m = openModals().pop();
    if (!m) return false;
    // prefer the dialog's own close control so its clean-up runs
    const btn = [...m.querySelectorAll('button')].find(isClose);
    if (btn) btn.click();
    if (m.classList.contains('open')) m.classList.remove('open');
    return true;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (closeTop()) e.preventDefault(); return; }
    if (e.key !== 'Tab') return;
    const m = openModals().pop();
    if (!m) return;
    const items = [...m.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!m.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  new MutationObserver(records => {
    records.forEach(r => {
      const m = r.target;
      if (!m.classList || !m.classList.contains('modal')) return;
      const was = (r.oldValue || '').split(/\s+/).includes('open'), is = m.classList.contains('open');
      if (is && !was) onOpen(m);
      if (was && !is) onClose(m);
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });

  // ── skip link ───────────────────────────────────────────────────────
  const skip = document.createElement('a');
  skip.className = 'ir-skip';
  skip.href = '#app-content';
  skip.textContent = ar() ? 'تخطَّ إلى المحتوى' : 'Skip to content';
  skip.addEventListener('click', e => { e.preventDefault(); content.tabIndex = -1; content.focus(); });
  document.body.prepend(skip);

  // ── apply as content appears ────────────────────────────────────────
  function repair(root) { nameIconButtons(root); labelFields(root); operable(root); }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    // a timer, not requestAnimationFrame: frames are paused while the tab is hidden
    setTimeout(() => { queued = false; repair(document.body); }, 30);
  }).observe(document.body, { childList: true, subtree: true });
  repair(document.body);
})();
