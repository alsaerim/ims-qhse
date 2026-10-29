/* ==========================================================================
   ISO Radar — isometric scroll world for the landing hero (ims_landing*.html).

   Mode: HTML / SVG (scroll-world-storytelling). The story lives in the page
   as ordinary sections ([data-beat]); this file draws one isometric site —
   a "compliance campus" around a radar tower — and moves it through the
   beats as the reader scrolls. Native scrolling, nothing is hijacked.

   Beats  1 hook      the site appears
          2 old way   scattered sheets, red findings on three buildings
          3 field     an inspection on site (phone, GPS pulse)
          4 mechanism findings link to the tower and turn gold (RCA)
          5 proof     the four supported standards rise around the tower
          6 payoff    everything turns teal, the radar sweeps

   Without JavaScript the sections read as a normal page. Reduced motion keeps
   every state change and drops the interpolation (CSS).
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-iso-world]');
  if (!root) return;
  var stage = root.querySelector('.iso-stage');
  var host = root.querySelector('[data-iso-canvas]');
  var beats = [].slice.call(root.querySelectorAll('[data-beat]'));
  if (!stage || !host || !beats.length) return;

  // ── isometric projection ────────────────────────────────────────────
  var U = 24, C = Math.cos(Math.PI / 6);
  function P(x, y, z) { return [(x - y) * C * U, (x + y) * 0.5 * U - z * U]; }
  function xy(x, y, z) { var p = P(x, y, z); return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
  function pts(list) { return list.map(function (p) { return xy(p[0], p[1], p[2]); }).join(' '); }

  // [top, left face, right face]
  var MAT = {
    ground: ['#ffffff', '#e4eaf1', '#d2dbe5'],
    ink:    ['#2f4d75', '#142D4E', '#0c1d35'],
    slate:  ['#dfe5ec', '#c4cdd7', '#a9b3bf'],
    paper:  ['#ffffff', '#eef2f6', '#dfe5ec'],
    teal:   ['#4fc4b7', '#22A699', '#17796f'],
    gold:   ['#ecc677', '#D9A441', '#b5852c'],
    blue:   ['#5b8fd0', '#1d5fa8', '#164a84'],
  };
  var EDGE = ' stroke="rgba(12,29,53,.14)" stroke-width=".6" stroke-linejoin="round"';

  function box(x, y, z, w, d, h, m) {
    var c = MAT[m];
    return '<g class="iso-box">' +
      '<polygon fill="' + c[1] + '"' + EDGE + ' points="' + pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/>' +
      '<polygon fill="' + c[2] + '"' + EDGE + ' points="' + pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]) + '"/>' +
      '<polygon fill="' + c[0] + '"' + EDGE + ' points="' + pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/>' +
      '</g>';
  }
  // windows on the front-left face (y + d)
  function windows(x, y, z, w, d, h, cols, rows, fill) {
    var out = '', gw = w / cols, gh = h / rows, yy = y + d + 0.001;
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
      var x0 = x + c * gw + gw * 0.25, x1 = x0 + gw * 0.5, z0 = z + r * gh + gh * 0.3, z1 = z0 + gh * 0.45;
      out += '<polygon fill="' + fill + '" points="' + pts([[x0, yy, z0], [x1, yy, z0], [x1, yy, z1], [x0, yy, z1]]) + '"/>';
    }
    return out;
  }
  function at(x, y, z) { return 'translate(' + xy(x, y, z) + ')'; }

  // ── the site ────────────────────────────────────────────────────────
  var BUILDINGS = [
    { id: 'factory',   x: 1.0, y: 1.2, w: 3.0, d: 2.2, h: 1.7, m: 'ink',   win: [4, 2, '#3f6390'] },
    { id: 'office',    x: 8.2, y: 1.0, w: 2.2, d: 2.0, h: 2.8, m: 'slate', win: [3, 4, '#ffffff'] },
    { id: 'warehouse', x: 1.0, y: 7.6, w: 2.8, d: 3.0, h: 1.3, m: 'slate', win: [2, 1, '#8b95a1'] },
    { id: 'lab',       x: 8.0, y: 8.0, w: 2.6, d: 2.2, h: 1.5, m: 'ink',   win: [3, 2, '#3f6390'] },
  ];
  var byId = function (id) { return BUILDINGS.filter(function (b) { return b.id === id; })[0]; };
  var TOWER = { x: 6, y: 6, top: 4.2 };
  var FINDINGS = ['factory', 'warehouse', 'lab'];
  var STANDARDS = [
    { code: '9001',  x: 3.9, y: 4.0, m: 'teal', ink: '#0c1d35' },
    { code: '45001', x: 6.9, y: 3.9, m: 'ink',  ink: '#ffffff' },
    { code: '14001', x: 3.9, y: 6.9, m: 'gold', ink: '#0c1d35' },
    { code: '27001', x: 6.9, y: 6.9, m: 'blue', ink: '#ffffff' },
  ];
  var PAPERS = [[4.4, 1.4, 2.8], [6.8, 2.0, 3.4], [1.6, 4.9, 2.6], [9.4, 4.8, 3.1], [5.2, 9.6, 2.5], [7.6, 10.2, 2.9]];

  function draw() {
    var s = '';
    // ground slab + grid
    s += box(0, 0, -0.5, 12, 12, 0.5, 'ground');
    var grid = '';
    for (var i = 1; i < 12; i++) grid += 'M' + xy(i, 0, 0) + 'L' + xy(i, 12, 0) + 'M' + xy(0, i, 0) + 'L' + xy(12, i, 0);
    s += '<path d="' + grid + '" stroke="rgba(20,45,78,.07)" stroke-width="1" fill="none"/>';

    // radar rings on the ground (payoff)
    // (reveal classes go on an inner group: a CSS transform would replace the SVG transform attribute)
    s += '<g transform="' + at(TOWER.x + 0.25, TOWER.y + 0.25, 0) + ' scale(1 .5)"><g class="iso-el b6 iso-rings">' +
      [70, 130, 190].map(function (r, k) { return '<circle r="' + r + '" fill="none" stroke="#22A699" stroke-width="2" style="--k:' + k + '"/>'; }).join('') + '</g></g>';

    // standards (proof) — tiles that rise around the tower
    STANDARDS.forEach(function (t, k) {
      var c = P(t.x + 0.65, t.y + 0.65, 0.35);
      s += '<g class="iso-el b5 iso-std" style="--d:' + (k * 0.12) + 's">' + box(t.x, t.y, 0, 1.3, 1.3, 0.35, t.m) +
        '<text class="iso-std-code" transform="matrix(.866 .5 -.866 .5 ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ')" text-anchor="middle" dominant-baseline="middle" fill="' + t.ink + '">' + t.code + '</text></g>';
    });

    // solids, painted back to front
    var solids = BUILDINGS.map(function (b) {
      var top = [[b.x, b.y, b.h + 0.002], [b.x + b.w, b.y, b.h + 0.002], [b.x + b.w, b.y + b.d, b.h + 0.002], [b.x, b.y + b.d, b.h + 0.002]];
      return { k: b.x + b.y, svg: '<g class="iso-el b1 iso-bld">' + box(b.x, b.y, 0, b.w, b.d, b.h, b.m) +
        windows(b.x, b.y, 0, b.w, b.d, b.h, b.win[0], b.win[1], b.win[2]) + '<polygon class="iso-ok" points="' + pts(top) + '"/></g>' };
    });
    solids.push({ k: 5.2, svg: '<g class="iso-el b1">' + box(3.3, 1.5, 1.7, 0.45, 0.45, 1.2, 'slate') + '</g>' }); // chimney
    solids.push({ k: TOWER.x + TOWER.y + 0.1, svg: '<g class="iso-el b1 iso-tower">' +
      box(TOWER.x - 0.55, TOWER.y - 0.55, 0, 1.6, 1.6, 0.6, 'ink') +
      box(TOWER.x, TOWER.y, 0.6, 0.5, 0.5, TOWER.top - 0.6, 'paper') +
      '<g transform="' + at(TOWER.x + 0.25, TOWER.y + 0.25, TOWER.top) + ' scale(1 .5)">' +
        '<g class="iso-sweep"><path d="M0 0L64 0A64 64 0 0 0 45.3 -45.3Z" fill="url(#iso-sweep-g)"/></g>' +
        '<circle r="20" fill="#22A699"/><circle r="20" fill="none" stroke="#ffffff" stroke-width="3" opacity=".7"/><circle r="5" fill="#ffffff"/>' +
      '</g></g>' });
    // the inspector's phone with a GPS pulse (field)
    solids.push({ k: 13.9, svg: '<g class="iso-el b3 iso-phone">' +
      '<g transform="' + at(4.4, 9.65, 0) + ' scale(1 .5)"><circle class="iso-pulse" r="30" fill="none" stroke="#22A699" stroke-width="3"/><circle class="iso-pulse" r="30" fill="none" stroke="#22A699" stroke-width="3" style="animation-delay:.9s"/></g>' +
      box(4.3, 9.2, 0, 0.2, 0.9, 1.7, 'ink') +
      '<polygon fill="#e3f5f2" points="' + pts([[4.501, 9.3, 0.2], [4.501, 10.0, 0.2], [4.501, 10.0, 1.55], [4.501, 9.3, 1.55]]) + '"/>' +
      '<path d="M' + xy(4.501, 9.45, 1.0) + 'L' + xy(4.501, 9.6, 0.82) + 'L' + xy(4.501, 9.88, 1.2) + '" fill="none" stroke="#17796f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</g>' });
    solids.sort(function (a, b) { return a.k - b.k; });
    s += solids.map(function (o) { return o.svg; }).join('');

    // links from the findings to the tower (mechanism)
    var tt = P(TOWER.x + 0.25, TOWER.y + 0.25, TOWER.top);
    FINDINGS.forEach(function (id, k) {
      var b = byId(id), a = P(b.x + b.w / 2, b.y + b.d / 2, b.h);
      // bow each link sideways (perpendicular to its run) so links stacked over the mast still read as arcs
      var dx = tt[0] - a[0], dy = tt[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, side = k % 2 ? -1 : 1;
      var mx = (a[0] + tt[0]) / 2 - dy / len * 70 * side, my = (a[1] + tt[1]) / 2 + dx / len * 70 * side - 24;
      s += '<path class="iso-el b4 iso-link" style="--d:' + (k * 0.15) + 's" pathLength="1" fill="none" stroke="#17796f" stroke-width="2" stroke-linecap="round" d="M' +
        a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + tt[0].toFixed(1) + ' ' + tt[1].toFixed(1) + '"/>';
    });

    // findings: red (found) → gold (root cause under analysis) → teal (closed)
    FINDINGS.forEach(function (id, k) {
      var b = byId(id);
      s += '<g transform="' + at(b.x + b.w / 2, b.y + b.d / 2, b.h + 1.3) + '"><g class="iso-el b2 iso-pin" style="--d:' + (k * 0.1) + 's">' +
        '<path class="iso-pin-body" d="M0 16L-7 5A10 10 0 1 1 7 5Z"/>' +
        '<path class="iso-pin-mark" d="M0 -6V1M0 4.5V5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path class="iso-pin-check" d="M-4 -1L-1 2L4.5 -4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></g>';
    });

    // scattered sheets (old way)
    PAPERS.forEach(function (p, k) {
      s += '<g class="iso-paper" style="--d:' + (k * 0.07) + 's;--b:' + (k % 3) + '">' + box(p[0], p[1], p[2], 1.3, 0.95, 0.05, 'paper') +
        '<path d="M' + xy(p[0] + 0.15, p[1] + 0.2, p[2] + 0.05) + 'L' + xy(p[0] + 0.7, p[1] + 0.2, p[2] + 0.05) +
        'M' + xy(p[0] + 0.2, p[1] + 0.5, p[2] + 0.06) + 'L' + xy(p[0] + 0.8, p[1] + 0.5, p[2] + 0.06) + 'M' + xy(p[0] + 0.2, p[1] + 0.72, p[2] + 0.06) + 'L' + xy(p[0] + 0.95, p[1] + 0.72, p[2] + 0.06) +
        '" stroke="#A7B0BC" stroke-width="1.6" stroke-linecap="round" fill="none"/></g>';
    });

    host.innerHTML =
      '<svg viewBox="-255 -115 510 410" aria-hidden="true" focusable="false">' +
      '<defs><radialGradient id="iso-sweep-g" cx="0" cy="0" r="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#22A699" stop-opacity=".55"/><stop offset="1" stop-color="#22A699" stop-opacity="0"/></radialGradient></defs>' +
      '<g class="iso-cam">' + s + '</g></svg>';
  }

  // ── camera per beat: focus point (grid units) and zoom ──────────────
  var CAM = {
    1: { x: 6, y: 6, z: 1.2, s: 1 },
    2: { x: 6, y: 6, z: 1.6, s: 1.04 },
    3: { x: 4, y: 8.4, z: 1, s: 1.32 },
    4: { x: 6, y: 5.6, z: 2, s: 1.1 },
    5: { x: 6, y: 6, z: 0.8, s: 1.3 },
    6: { x: 6, y: 6, z: 1.2, s: 0.96 },
  };
  var dots = [];
  var cam = null;
  function setBeat(n) {
    for (var i = 1; i <= 6; i++) stage.classList.toggle('is-b' + i, i <= n);
    stage.setAttribute('data-beat', n);
    beats.forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-beat') === n); });
    dots.forEach(function (d, i) { d.setAttribute('aria-current', i + 1 === n ? 'step' : 'false'); });
    // translate(t) scale(s) about the user-space origin: the focus point lands where the site's centre sits at beat 1
    var c = CAM[n] || CAM[1], f = P(c.x, c.y, c.z), mid = P(6, 6, 1.2);
    cam = cam || host.querySelector('.iso-cam');
    if (cam) {
      cam.style.setProperty('--cx', (mid[0] - c.s * f[0]).toFixed(1) + 'px');
      cam.style.setProperty('--cy', (mid[1] - c.s * f[1]).toFixed(1) + 'px');
      cam.style.setProperty('--cs', c.s);
    }
  }

  // ── step dots: jump to a beat ───────────────────────────────────────
  var nav = stage.querySelector('[data-iso-dots]');
  if (nav) {
    beats.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', (b.querySelector('h1,h2') || b).textContent.trim());
      btn.addEventListener('click', function () {
        var top = b.getBoundingClientRect().top + window.pageYOffset - window.innerHeight * 0.18;
        window.scrollTo({ top: top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      nav.appendChild(btn);
      dots.push(btn);
    });
  }

  draw();
  root.classList.add('iso-ready');
  setBeat(1);

  // ── scroll conductor: the beat crossing the reading line is active ──
  if ('IntersectionObserver' in window) {
    var narrow = matchMedia('(max-width: 900px)');
    var io = null;
    var observe = function () {
      if (io) io.disconnect();
      // on narrow screens the reading line sits below the sticky stage
      var margin = narrow.matches ? '-72% 0px -27% 0px' : '-48% 0px -51% 0px';
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setBeat(+e.target.getAttribute('data-beat')); });
      }, { rootMargin: margin });
      beats.forEach(function (b) { io.observe(b); });
    };
    observe();
    if (narrow.addEventListener) narrow.addEventListener('change', observe);
  } else {
    setBeat(6);
  }
})();
