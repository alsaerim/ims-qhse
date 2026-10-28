/* ==========================================================================
   ISO Radar — bilingual runtime (Arabic default, English on demand)

   The pages are authored in Arabic. In English mode this file:
     • switches <html> to lang="en" dir="ltr" (layout CSS in isoradar.css),
     • translates every Arabic text node and placeholder/title/aria-label
       from the dictionary in assets/i18n/en.js — including content the
       pages build later (a MutationObserver translates new nodes),
     • translates dynamic phrases through regex patterns (counts, dates),
     • wraps alert/confirm so their messages are translated too.
   Language choice: ?lang=en|ar  >  localStorage("ir_lang")  >  "ar".
   Load order: i18n/en.js, then this file, both early in <head>.
   ========================================================================== */
(function () {
  'use strict';
  const KEY = 'ir_lang';
  const qs = new URLSearchParams(location.search).get('lang');
  let lang = 'ar';
  try {
    if (qs === 'en' || qs === 'ar') localStorage.setItem(KEY, qs);
    lang = localStorage.getItem(KEY) || 'ar';
  } catch (e) { lang = qs || 'ar'; }

  const html = document.documentElement;
  const I18N = window.IR_I18N = {
    lang,
    isEn: lang === 'en',
    set(next) {
      try { localStorage.setItem(KEY, next); } catch (e) {}
      const u = new URL(location.href); u.searchParams.delete('lang');
      location.replace(u.toString());
    },
    toggle() { I18N.set(lang === 'en' ? 'ar' : 'en'); },
    /** translate a string (used by pages for alerts, titles, JS text) */
    t(s) { return lang === 'en' ? translate(s) : s; },
  };

  // language button (any element with [data-lang-toggle] works too)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-lang-toggle]');
    if (b) { e.preventDefault(); I18N.toggle(); }
  });

  if (lang !== 'en') { html.setAttribute('data-lang', 'ar'); return; }

  html.setAttribute('lang', 'en');
  html.setAttribute('dir', 'ltr');
  html.setAttribute('data-lang', 'en');

  const DICT = window.IR_EN || {};
  const PATTERNS = (window.IR_EN_PATTERNS || []).map(([re, to]) => [new RegExp(re, 'u'), to]);
  const AR = /[؀-ۿ]/;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  // longest keys first so phrases win over their own sub-words
  const LONG_KEYS = Object.keys(DICT).filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
  const MISSING = I18N.missing = new Set();

  function translate(raw) {
    if (!raw || !AR.test(raw)) return raw;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    const s = norm(raw);
    let hit = DICT[s];
    if (hit === undefined) {
      // try without surrounding punctuation / emoji / bullets
      const m = s.match(/^([\s•·•:|,،.\-—–()\[\]✅❌⚠️📸🔴🟢🟡⭐👑]*)(.*?)([\s·:|,،.!?؟\-—–()\[\]]*)$/u);
      if (m && DICT[m[2]] !== undefined) hit = m[1] + DICT[m[2]] + m[3];
    }
    if (hit === undefined) {
      for (const [re, to] of PATTERNS) { if (re.test(s)) { hit = s.replace(re, to); break; } }
    }
    if (hit === undefined) {
      // phrase-level fallback: replace known sub-phrases inside a longer string
      let out = s, changed = false;
      for (const k of LONG_KEYS) { if (out.includes(k)) { out = out.split(k).join(DICT[k]); changed = true; } }
      if (changed) hit = out;
    }
    if (hit === undefined) { MISSING.add(s); return raw; }
    return lead + hit + trail;
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];

  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.('[data-no-i18n]')) return;
    fixAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 ? (SKIP.has(n.nodeName) || n.hasAttribute('data-no-i18n') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT,
    });
    let n; while ((n = tw.nextNode())) fixText(n);
    root.querySelectorAll('*').forEach(fixAttrs);
  }
  function fixText(n) {
    const v = n.nodeValue;
    if (v && AR.test(v) && !(n.parentElement && SKIP.has(n.parentElement.nodeName))) {
      const t = translate(v); if (t !== v) n.nodeValue = t;
    }
  }
  function fixAttrs(el) {
    for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v && AR.test(v)) { const t = translate(v); if (t !== v) el.setAttribute(a, t); } }
    if ((el.tagName === 'INPUT') && /^(button|submit)$/i.test(el.type) && AR.test(el.value)) el.value = translate(el.value);
  }

  // dialogs
  const _alert = window.alert.bind(window), _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
  window.alert = m => _alert(translate(String(m)));
  window.confirm = m => _confirm(translate(String(m)));
  window.prompt = (m, d) => _prompt(translate(String(m)), d);

  // initial pass + live translation of everything the pages render later
  let queued = new Set(), scheduled = false;
  const flush = () => { scheduled = false; const q = queued; queued = new Set(); q.forEach(walk); if (AR.test(document.title)) document.title = translate(document.title); };
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData' || m.type === 'attributes') queued.add(m.target);
      else m.addedNodes.forEach(n => queued.add(n));
    }
    if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
  });
  const start = () => {
    walk(document.body);
    document.title = translate(document.title);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
