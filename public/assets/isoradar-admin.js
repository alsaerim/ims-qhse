/* ==========================================================================
   ISO Radar — platform console modules (ims_admin.html)
   Platform users · Activity log · Announcements · System health · Settings
   Contracts for the endpoints used here are in docs/api-contract.md; when an
   endpoint is not on the server yet the page says so instead of failing.
   Depends on globals from the host page: API, getToken, showToast, navigate.
   ========================================================================== */
(function () {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); };
  const list = d => Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []);
  const content = () => document.getElementById('content');

  // fetch that reports status (the page's own apiFetch hides 404s as data)
  async function sa(path, method = 'GET', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() } };
    if (body) opts.body = JSON.stringify(body);
    const t0 = performance.now();
    try {
      const r = await fetch(API + path, opts);
      let j = null; try { j = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), data: j && j.data !== undefined ? j.data : j, message: j && (j.message || j.error) };
    } catch (e) {
      return { ok: false, status: 0, ms: Math.round(performance.now() - t0), data: null, message: 'تعذّر الاتصال بالخادم' };
    }
  }

  const pending = (endpoint) => `<div class="card" style="padding:16px;display:flex;gap:12px;align-items:flex-start;background:var(--mz-gold-tint);border-color:#f3dca0 !important;">
      <i class="fas fa-plug-circle-exclamation" style="color:var(--mz-obs);margin-top:3px"></i>
      <div style="font-size:13px"><b>الصفحة جاهزة وتنتظر تفعيلها في الخادم.</b>
      <div style="color:var(--mz-slate);margin-top:4px">المطلوب من الباك إند: <code dir="ltr" style="font-family:var(--mz-mono)">${esc(endpoint)}</code> — التفاصيل في docs/api-contract.md.</div></div></div>`;

  const empty = (icon, title, sub) => `<div style="padding:48px 16px;text-align:center"><i class="fas ${icon}" style="font-size:28px;color:var(--mz-fog);margin-bottom:10px;display:block"></i><div style="font-weight:700">${title}</div><div style="font-size:13px;color:var(--mz-slate);margin-top:4px">${sub}</div></div>`;

  const ROLE = { super_admin: 'مدير المنصة', tenant_admin: 'مدير منظمة', manager: 'مدير', engineer: 'مهندس', auditor: 'مدقق', viewer: 'مشاهد' };
  const roleAr = r => ROLE[String(r || '').toLowerCase()] || esc(r || '—');
  const stBadge = s => String(s || '').toUpperCase() === 'ACTIVE' ? '<span class="badge badge-green">نشط</span>' : '<span class="badge badge-gray">معطّل</span>';

  // ── Platform users ────────────────────────────────────────────────────
  let _users = [];
  async function loadUsers() {
    const r = await sa('/super-admin/users?limit=200');
    _users = r.ok ? list(r.data) : [];
    content().innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:16px">
      ${r.ok ? '' : pending('GET /api/v1/super-admin/users · PUT /api/v1/super-admin/users/:id')}
      <div class="card" style="overflow:hidden">
        <div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--mz-bone)">
          <input class="form-input" style="max-width:320px" placeholder="بحث بالاسم أو البريد أو المنظمة…" oninput="MZA.filterUsers(this.value)" aria-label="بحث"/>
          <span style="margin-inline-start:auto;font-size:13px;color:var(--mz-slate)" id="mza-users-count">${_users.length} مستخدم</span>
        </div>
        <div id="mza-users" style="overflow-x:auto"></div>
      </div></div>`;
    renderUsers(_users);
  }
  function renderUsers(rows) {
    const el = document.getElementById('mza-users');
    if (!rows.length) { el.innerHTML = empty('fa-users', 'لا يوجد مستخدمون للعرض', 'سيظهر هنا مستخدمو جميع المنظمات.'); return; }
    el.innerHTML = `<table class="tbl"><thead><tr><th>المستخدم</th><th>المنظمة</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th><th></th></tr></thead><tbody>
      ${rows.map(u => `<tr><td><div style="font-weight:700">${esc(u.full_name)}</div><div style="font-size:12px;color:var(--mz-slate)" dir="ltr">${esc(u.email)}</div></td>
        <td>${esc(u.tenant_name || u.tenant?.name || '—')}</td><td>${roleAr(u.role)}</td><td>${stBadge(u.status)}</td><td style="font-size:12px">${fmt(u.last_login_at || u.last_login)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="MZA.toggleUser('${esc(u.id)}')">${String(u.status).toUpperCase() === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}</button></td></tr>`).join('')}
    </tbody></table>`;
  }
  function filterUsers(q) {
    q = q.trim().toLowerCase();
    const rows = !q ? _users : _users.filter(u => [u.full_name, u.email, u.tenant_name, u.tenant?.name].some(v => String(v || '').toLowerCase().includes(q)));
    document.getElementById('mza-users-count').textContent = rows.length + ' مستخدم';
    renderUsers(rows);
  }
  async function toggleUser(id) {
    const u = _users.find(x => String(x.id) === String(id)); if (!u) return;
    const next = String(u.status).toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(`${next === 'ACTIVE' ? 'تفعيل' : 'تعطيل'} حساب ${u.full_name}؟`)) return;
    const r = await sa(`/super-admin/users/${id}`, 'PUT', { status: next });
    if (!r.ok) return showToast('تعذّر التحديث: ' + (r.message || r.status), 'error');
    u.status = next; renderUsers(_users); showToast('تم التحديث');
  }

  // ── Activity log ──────────────────────────────────────────────────────
  const ACTION = { create: ['إنشاء', 'badge-green'], update: ['تعديل', 'badge-blue'], delete: ['حذف', 'badge-red'], login: ['دخول', 'badge-gray'], logout: ['خروج', 'badge-gray'], assign_plan: ['تغيير باقة', 'badge-purple'], payment: ['دفع', 'badge-teal'] };
  async function loadActivity() {
    const r = await sa('/super-admin/audit-log?limit=100');
    const rows = r.ok ? list(r.data) : [];
    content().innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:16px">
      ${r.ok ? '' : pending('GET /api/v1/super-admin/audit-log?limit=&tenant_id=&action=')}
      <div class="card" style="overflow-x:auto">${rows.length ? `<table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>المنظمة</th><th>الإجراء</th><th>العنصر</th><th>IP</th></tr></thead><tbody>
        ${rows.map(a => { const k = String(a.action || '').toLowerCase(); const b = ACTION[k] || [esc(a.action || '—'), 'badge-gray'];
          return `<tr><td style="font-size:12px;white-space:nowrap">${fmt(a.created_at)}</td><td>${esc(a.actor_name || a.user_email || '—')}</td><td>${esc(a.tenant_name || '—')}</td>
          <td><span class="badge ${b[1]}">${b[0]}</span></td><td style="font-size:12px">${esc(a.entity_type || '')} ${a.entity_ref ? '· ' + esc(a.entity_ref) : ''}</td><td dir="ltr" style="font-family:var(--mz-mono);font-size:12px">${esc(a.ip_address || '—')}</td></tr>`; }).join('')}
        </tbody></table>` : empty('fa-clock-rotate-left', 'لا يوجد نشاط مسجّل', 'تُسجَّل هنا عمليات الدخول والتعديلات الحساسة عبر المنصة.')}</div></div>`;
  }

  // ── Announcements ─────────────────────────────────────────────────────
  let _ann = [], _annOk = true;
  const LEVEL = { info: ['معلومة', 'badge-blue'], warning: ['تنبيه', 'badge-yellow'], critical: ['هام', 'badge-red'] };
  async function loadAnnouncements() {
    const r = await sa('/super-admin/announcements');
    _annOk = r.ok; _ann = r.ok ? list(r.data) : [];
    content().innerHTML = `<div class="fade-in" style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start" id="mza-ann-grid">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${r.ok ? '' : pending('GET/POST /api/v1/super-admin/announcements · DELETE /api/v1/super-admin/announcements/:id')}
        <div class="card" id="mza-ann-list"></div>
      </div>
      <div class="card" style="padding:20px">
        <div style="font-weight:800;margin-bottom:14px">إعلان جديد</div>
        <label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin-bottom:5px" for="mza-a-title">العنوان</label>
        <input id="mza-a-title" class="form-input" placeholder="صيانة مجدولة يوم الجمعة"/>
        <label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin:12px 0 5px" for="mza-a-body">النص</label>
        <textarea id="mza-a-body" class="form-input" rows="4" placeholder="سيتوقف النظام من 2:00 إلى 3:00 صباحاً."></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div><label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin-bottom:5px" for="mza-a-level">الأهمية</label>
            <select id="mza-a-level" class="form-input"><option value="info">معلومة</option><option value="warning">تنبيه</option><option value="critical">هام</option></select></div>
          <div><label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin-bottom:5px" for="mza-a-aud">الجمهور</label>
            <select id="mza-a-aud" class="form-input"><option value="all">كل المنظمات</option><option value="admins">مدراء المنظمات</option><option value="trial">حسابات التجربة</option></select></div>
        </div>
        <label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin:12px 0 5px" for="mza-a-end">ينتهي في</label>
        <input id="mza-a-end" type="date" class="form-input"/>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px" onclick="MZA.publish()"><i class="fas fa-bullhorn ml-1"></i>نشر الإعلان</button>
      </div></div>`;
    if (window.innerWidth < 980) document.getElementById('mza-ann-grid').style.gridTemplateColumns = '1fr';
    renderAnn();
  }
  function renderAnn() {
    const el = document.getElementById('mza-ann-list');
    if (!_ann.length) { el.innerHTML = empty('fa-bullhorn', 'لا توجد إعلانات', 'الإعلانات المنشورة تظهر لمستخدمي المنظمات داخل التطبيق.'); return; }
    el.innerHTML = _ann.map(a => { const lv = LEVEL[String(a.level || 'info').toLowerCase()] || LEVEL.info;
      return `<div style="padding:16px;border-bottom:1px solid var(--mz-bone);display:flex;gap:12px;align-items:flex-start">
        <span class="badge ${lv[1]}">${lv[0]}</span>
        <div style="flex:1"><div style="font-weight:700">${esc(a.title)}</div><div style="font-size:13px;color:var(--mz-slate);margin-top:4px;white-space:pre-line">${esc(a.body)}</div>
        <div style="font-size:12px;color:var(--mz-ash);margin-top:6px">${fmt(a.created_at)}${a.ends_at ? ' · حتى ' + fmt(a.ends_at) : ''}</div></div>
        <button class="btn btn-sm btn-outline" onclick="MZA.unpublish('${esc(a.id)}')" aria-label="حذف"><i class="fas fa-trash"></i></button></div>`; }).join('');
  }
  async function publish() {
    const body = { title: v('mza-a-title'), body: v('mza-a-body'), level: v('mza-a-level'), audience: v('mza-a-aud'), ends_at: v('mza-a-end') || null };
    if (!body.title || !body.body) return showToast('العنوان والنص مطلوبان', 'error');
    const r = await sa('/super-admin/announcements', 'POST', body);
    if (!r.ok) return showToast(_annOk ? ('تعذّر النشر: ' + (r.message || r.status)) : 'لم يُنشر: هذه الصفحة غير مفعّلة في الخادم بعد', 'error');
    _ann.unshift({ ...body, ...(r.data || {}), created_at: (r.data && r.data.created_at) || new Date().toISOString() });
    ['mza-a-title', 'mza-a-body', 'mza-a-end'].forEach(id => document.getElementById(id).value = '');
    renderAnn(); showToast('تم نشر الإعلان');
  }
  async function unpublish(id) {
    if (!confirm('حذف هذا الإعلان؟')) return;
    const r = await sa(`/super-admin/announcements/${id}`, 'DELETE');
    if (!r.ok) return showToast('تعذّر الحذف: ' + (r.message || r.status), 'error');
    _ann = _ann.filter(a => String(a.id) !== String(id)); renderAnn(); showToast('تم الحذف');
  }

  // ── System health ─────────────────────────────────────────────────────
  async function loadHealth() {
    const checks = await Promise.all([
      ['واجهة API (عام)', '/subscriptions/plans'],
      ['المصادقة والصلاحيات', '/super-admin/stats'],
      ['نقطة الفحص /health', '/health'],
    ].map(async ([name, path]) => ({ name, path, ...(await sa(path)) })));
    const row = c => {
      const ok = c.ok, state = ok ? (c.ms > 1500 ? ['بطيء', 'badge-yellow'] : ['يعمل', 'badge-green']) : c.status === 404 ? ['غير متوفر في الخادم', 'badge-gray'] : ['متوقف', 'badge-red'];
      return `<tr><td style="font-weight:600">${c.name}</td><td dir="ltr" style="font-family:var(--mz-mono);font-size:12px">GET ${esc(c.path)}</td><td><span class="badge ${state[1]}">${state[0]}</span></td><td dir="ltr" style="font-family:var(--mz-mono)">${c.status || '—'}</td><td dir="ltr" style="font-family:var(--mz-mono)">${c.ms} ms</td></tr>`;
    };
    const up = checks.filter(c => c.ok).length;
    content().innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
        <div class="stat-card"><div style="font-size:12px;color:var(--mz-slate)">الفحوصات الناجحة</div><div style="font-size:30px;font-weight:800">${up} / ${checks.length}</div></div>
        <div class="stat-card"><div style="font-size:12px;color:var(--mz-slate)">زمن الاستجابة (API)</div><div style="font-size:30px;font-weight:800" dir="ltr">${checks[0].ms} ms</div></div>
        <div class="stat-card"><div style="font-size:12px;color:var(--mz-slate)">الخادم</div><div style="font-size:13px;font-weight:600;margin-top:8px;word-break:break-all" dir="ltr">${esc(API.replace(/^https?:\/\//, ''))}</div></div>
      </div>
      <div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>الخدمة</th><th>المسار</th><th>الحالة</th><th>HTTP</th><th>الزمن</th></tr></thead><tbody>${checks.map(row).join('')}</tbody></table></div>
      <div><button class="btn btn-outline" onclick="navigate('health')"><i class="fas fa-rotate ml-1"></i>إعادة الفحص</button></div>
    </div>`;
  }

  // ── Settings (real load/save) ─────────────────────────────────────────
  const SETTINGS = [
    ['trial_days', 'فترة التجربة المجانية (أيام)', 'number', 14],
    ['vat_rate', 'ضريبة القيمة المضافة (%)', 'number', 15],
    ['currency', 'عملة الفوترة', 'text', 'SAR'],
    ['due_days', 'مهلة سداد الفاتورة (أيام)', 'number', 7],
    ['support_email', 'بريد الدعم الفني', 'email', ''],
  ];
  async function loadSettings() {
    const r = await sa('/super-admin/settings');
    const s = r.ok && r.data ? r.data : {};
    content().innerHTML = `<div class="fade-in" style="max-width:640px;display:flex;flex-direction:column;gap:16px">
      ${r.ok ? '' : pending('GET /api/v1/super-admin/settings · PUT /api/v1/super-admin/settings')}
      <div class="card" style="padding:20px">
        <div style="font-weight:800;margin-bottom:16px">إعدادات المنصة</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          ${SETTINGS.map(([k, l, t, d]) => `<div><label style="font-size:12px;font-weight:600;color:var(--mz-slate);display:block;margin-bottom:5px" for="mza-s-${k}">${l}</label>
            <input id="mza-s-${k}" class="form-input" type="${t}" value="${esc(s[k] ?? d)}" ${t === 'email' ? 'dir="ltr"' : ''}/></div>`).join('')}
          <label style="display:flex;align-items:center;gap:10px;grid-column:1/-1;margin-top:4px;font-size:14px">
            <span class="toggle"><input type="checkbox" id="mza-s-maint" ${s.maintenance_mode ? 'checked' : ''}/><span class="toggle-slider"></span></span>
            وضع الصيانة (إيقاف الدخول لغير مدراء المنصة)</label>
        </div>
        <div style="margin-top:18px"><button class="btn btn-primary" onclick="MZA.saveSettings(${r.ok})"><i class="fas fa-check ml-1"></i>حفظ الإعدادات</button></div>
      </div>
      <div class="card" style="padding:20px">
        <div style="font-weight:800;margin-bottom:10px">معلومات النظام</div>
        <div style="background:var(--mz-mist);border-radius:9px;padding:12px;font-family:var(--mz-mono);font-size:12px;color:var(--mz-slate);line-height:1.9" dir="ltr">Backend: ${esc(API)}<br>Console: ISO Radar platform v1.0</div>
      </div></div>`;
  }
  async function saveSettings(serverReady) {
    const body = {};
    for (const [k, , t] of SETTINGS) { const x = v('mza-s-' + k); body[k] = t === 'number' ? Number(x) : x; }
    body.maintenance_mode = document.getElementById('mza-s-maint').checked;
    if (body.trial_days < 0 || body.vat_rate < 0 || body.due_days < 0) return showToast('القيم لا يمكن أن تكون سالبة', 'error');
    const r = await sa('/super-admin/settings', 'PUT', body);
    if (!r.ok) return showToast(serverReady ? ('تعذّر الحفظ: ' + (r.message || r.status)) : 'لم تُحفظ: الإعدادات غير مفعّلة في الخادم بعد', 'error');
    showToast('تم حفظ الإعدادات');
  }

  const v = id => (document.getElementById(id)?.value || '').trim();

  // ── Signed-in admin in the sidebar footer (was a hard-coded address) ──
  async function fillMe() {
    const r = await sa('/auth/me');
    if (!r.ok || !r.data) return;
    const n = document.getElementById('mza-me-name'), e = document.getElementById('mza-me-email'), a = document.getElementById('mza-me-avatar');
    if (n) n.textContent = r.data.full_name || 'مدير المنصة';
    if (e) e.textContent = r.data.email || '';
    if (a) a.textContent = (r.data.full_name || 'م').charAt(0);
  }

  // ── Router hook ──────────────────────────────────────────────────────
  const EXTRA = {
    users: ['مستخدمو المنصة', 'جميع المستخدمين عبر المنظمات', loadUsers],
    activity: ['سجل النشاط', 'عمليات الدخول والتعديلات الحساسة', loadActivity],
    announcements: ['الإعلانات', 'رسائل تظهر لمستخدمي المنظمات داخل التطبيق', loadAnnouncements],
    health: ['صحة النظام', 'حالة الخدمات وزمن الاستجابة', loadHealth],
    settings: ['الإعدادات', 'إعدادات الفوترة والمنصة', loadSettings],
  };
  const baseNavigate = window.navigate;
  window.navigate = function (page) {
    const x = EXTRA[page];
    if (!x) return baseNavigate(page);
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', (el.getAttribute('onclick') || '').includes(`'${page}'`)));
    document.getElementById('page-title').textContent = x[0];
    document.getElementById('page-subtitle').textContent = x[1];
    content().innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:50vh"><i class="fas fa-spinner fa-spin" style="font-size:26px;color:var(--mz-brand)"></i></div>';
    x[2]();
  };

  window.MZA = { filterUsers, toggleUser, publish, unpublish, saveSettings, fillMe };
  if (getToken()) fillMe();
})();
