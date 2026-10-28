/* ISO Radar — marketing site behaviour shared by / (Arabic) and /en (English).
   Element ids are the same on both pages; only the copy below differs. */
(function () {
  var EN = document.documentElement.lang === 'en';
  var T = EN ? {
    fill: 'Please fill in all fields',
    fillReq: 'Please fill in the required fields',
    email: 'Please enter a valid email address',
    pass8: 'Password must be at least 8 characters',
    loading: 'Working…',
    signin: 'Sign in',
    signedIn: 'Signed in! Redirecting…',
    badCreds: 'Incorrect sign-in details',
    offline: "Couldn't reach the server. Check your connection and try again.",
    create: 'Create account free',
    created: 'Done! Redirecting…',
    createFail: "Couldn't create the account",
    welcome: function (n, c) { return 'Welcome <strong>' + n + '</strong>! The <strong>' + c + '</strong> account is ready. Preparing your dashboard…'; },
    save: function (n) { return 'Save SAR ' + n + ' a year'; },
    perMonth: 'SAR / month'
  } : {
    fill: 'يرجى تعبئة جميع الحقول',
    fillReq: 'يرجى تعبئة جميع الحقول المطلوبة',
    email: 'يرجى إدخال بريد إلكتروني صحيح',
    pass8: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    loading: 'جاري...',
    signin: 'دخول',
    signedIn: 'تم الدخول! جاري التحويل...',
    badCreds: 'بيانات الدخول غير صحيحة',
    offline: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.',
    create: 'إنشاء الحساب مجاناً',
    created: 'تم! جاري التحويل...',
    createFail: 'تعذّر إنشاء الحساب',
    welcome: function (n, c) { return 'مرحباً <strong>' + n + '</strong>! تم إنشاء حساب <strong>' + c + '</strong>. جاري تحضير لوحة التحكم...'; },
    save: function (n) { return 'يُوفّر ' + n + ' ر.س سنوياً'; },
    perMonth: 'ر.س / شهر'
  };

  // The app reads this key, so signing in from /en opens the app in English.
  // The Arabic page sets it only on an explicit ?lang=ar (see its <head>), so a
  // signed-out English user who is sent to / keeps their choice.
  if (EN) { try { localStorage.setItem('ir_lang', 'en'); } catch (e) {} }

  var $ = function (id) { return document.getElementById(id); };
  var API = 'https://ims-qhse-backend-production.up.railway.app/api/v1';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var spinner = function () { return '<span style="display:inline-flex;gap:8px;align-items:center;"><svg width="16" height="16" viewBox="0 0 24 24" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="40 20"/></svg>' + T.loading + '</span>'; };
  var icon = function (cls, text) { return '<i class="fas ' + cls + '"></i>' + text; };

  // ── Billing toggle ──
  var PRICES = { starter: [299, 2990], pro: [799, 7990], ent: [1999, 19990] };
  window.setBilling = function (type) {
    var yearly = type === 'yearly';
    Object.keys(PRICES).forEach(function (k) {
      var m = PRICES[k][0], y = PRICES[k][1];
      $('price-' + k).textContent = (yearly ? Math.round(y / 12) : m).toLocaleString('en-US');
      var note = $('yearly-' + k);
      note.textContent = T.save((m * 12 - y).toLocaleString('en-US'));
      note.style.visibility = yearly ? 'visible' : 'hidden';
    });
    $('bill-monthly').classList.toggle('on', !yearly);
    $('bill-yearly').classList.toggle('on', yearly);
    $('bill-monthly').setAttribute('aria-pressed', String(!yearly));
    $('bill-yearly').setAttribute('aria-pressed', String(yearly));
  };

  // ── Modal ──
  var lastFocus = null;
  window.openLogin = function (tab) {
    lastFocus = document.activeElement;
    $('login-overlay').classList.add('open');
    switchTab(tab || 'login');
    setTimeout(function () { $(tab === 'register' ? 'reg-company' : 'login-email').focus(); }, 50);
  };
  window.closeLogin = function () {
    $('login-overlay').classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLogin(); });
  function switchTab(tab) {
    $('form-login').style.display = tab === 'login' ? 'block' : 'none';
    $('form-register').style.display = tab === 'register' ? 'block' : 'none';
    $('tab-login').classList.toggle('active', tab === 'login');
    $('tab-register').classList.toggle('active', tab === 'register');
    $('tab-login').setAttribute('aria-selected', String(tab === 'login'));
    $('tab-register').setAttribute('aria-selected', String(tab === 'register'));
  }
  window.switchTab = switchTab;

  function showErr(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function storeSession(d) {
    localStorage.setItem('ims_token', d.access_token);
    if (d.refresh_token) localStorage.setItem('ims_refresh_token', d.refresh_token);
    if (d.user) localStorage.setItem('ims_user', JSON.stringify(d.user));
    if (d.tenant) localStorage.setItem('ims_tenant', JSON.stringify(d.tenant));
  }

  // ── Login ──
  window.doLogin = function () {
    var email = $('login-email').value.trim();
    var pass = $('login-pass').value;
    var err = $('err-login');
    var btn = document.querySelector('#form-login .btn-login');
    var reset = function () { btn.innerHTML = icon('fa-right-to-bracket', T.signin); btn.disabled = false; };
    if (!email || !pass) { showErr(err, T.fill); return; }
    err.style.display = 'none';
    btn.innerHTML = spinner();
    btn.disabled = true;
    fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: pass }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        // NestJS TransformInterceptor wraps responses: { success, data: { access_token, refresh_token, user, tenant } }
        var d = res.data || res;
        if (d.access_token) {
          storeSession(d);
          btn.innerHTML = icon('fa-circle-check', T.signedIn);
          setTimeout(function () { window.location.href = '/app'; }, 700);
        } else { reset(); showErr(err, d.message || res.message || T.badCreds); }
      })
      .catch(function () { reset(); showErr(err, T.offline); });
  };

  // ── Register ──
  window.doRegister = function () {
    var company = $('reg-company').value.trim();
    var name = $('reg-name').value.trim();
    var email = $('reg-email').value.trim();
    var phone = $('reg-phone').value.trim();
    var pass = $('reg-pass').value;
    var err = $('err-register'), suc = $('suc-register');
    var btn = document.querySelector('#form-register .btn-login');
    var reset = function () { btn.disabled = false; btn.innerHTML = icon('fa-rocket', T.create); };
    if (!company || !name || !email || !pass) { showErr(err, T.fillReq); return; }
    if (email.indexOf('@') < 0) { showErr(err, T.email); return; }
    if (pass.length < 8) { showErr(err, T.pass8); return; }
    err.style.display = 'none';
    suc.style.display = 'none';
    btn.innerHTML = spinner();
    btn.disabled = true;
    fetch(API + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_name: company, full_name: name, email: email, password: pass, phone: phone }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var d = res.data || res;
        if (d.access_token) {
          storeSession(d);
          suc.style.display = 'block';
          // names come from the form: escape before inserting as HTML
          suc.innerHTML = T.welcome(esc(name), esc(company));
          btn.innerHTML = icon('fa-circle-check', T.created);
          setTimeout(function () { window.location.href = '/app'; }, 1500);
        } else { reset(); showErr(err, d.message || res.message || T.createFail); }
      })
      .catch(function () { reset(); showErr(err, T.offline); });
  };

  // ── Auto-redirect if already signed in ──
  (function () {
    var token = null;
    try { token = localStorage.getItem('ims_token'); } catch (e) {}
    if (!token) return;
    fetch(API + '/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.json(); })
      .then(function (res) { if ((res.data && res.data.id) || res.id) window.location.href = '/app'; })
      .catch(function () {});
  })();

  // ── Page chrome: sticky nav border, burger, rotating tabs, role switch, reveal ──
  var nav = $('nav');
  addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
  $('burger').addEventListener('click', function () {
    var open = $('navLinks').classList.toggle('open');
    this.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('#navLinks a').forEach(function (a) { a.addEventListener('click', function () { $('navLinks').classList.remove('open'); }); });

  var tabs = [].slice.call(document.querySelectorAll('.ai-tab'));
  var panes = [].slice.call(document.querySelectorAll('.ai-pane'));
  var cur = 0, timer = null;
  function showTab(i) {
    cur = i;
    tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', String(k === i)); });
    panes.forEach(function (p, k) { p.classList.toggle('on', k === i); });
    clearTimeout(timer);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setTimeout(function () { showTab((cur + 1) % tabs.length); }, 6000);
  }
  tabs.forEach(function (t, i) { t.addEventListener('click', function () { showTab(i); }); });
  if (tabs.length) showTab(0);

  var roleBtns = [].slice.call(document.querySelectorAll('#roleSwitch button'));
  var roleSets = [].slice.call(document.querySelectorAll('.role-cards'));
  roleBtns.forEach(function (b, i) {
    b.addEventListener('click', function () {
      roleBtns.forEach(function (x, k) { x.classList.toggle('on', k === i); x.setAttribute('aria-pressed', String(k === i)); });
      roleSets.forEach(function (s, k) { s.hidden = k !== i; });
    });
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }
})();
