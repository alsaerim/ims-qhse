/* ==========================================================================
   ISO Radar — compliance modules for the tenant app (ims_qhse_9.html)
   Incidents · Document control · Training & competence · My profile,
   plus sidebar shortcuts to the risk register and annual plan (Org tabs).

   Each register is described declaratively and rendered by one engine
   (list + search + status filter + add/edit/delete). API contracts are in
   docs/api-contract.md; until an endpoint exists on the server the page
   shows a clear "waiting for the server" state instead of failing.
   Depends on globals from the host page: apiFetch, showToast, navigate.
   ========================================================================== */
(function () {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const today = () => new Date().toISOString().slice(0, 10);
  const daysUntil = v => v ? Math.ceil((new Date(v) - new Date()) / 86400000) : null;
  const asList = d => Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []);

  const ISO = [['ISO_9001', 'ISO 9001 — الجودة'], ['ISO_45001', 'ISO 45001 — السلامة'], ['ISO_14001', 'ISO 14001 — البيئة'], ['ISO_27001', 'ISO 27001 — أمن المعلومات']];

  // ── Register definitions ─────────────────────────────────────────────
  const REGISTERS = {
    incidents: {
      title: ['الحوادث والإصابات', 'تسجيل الحوادث وشبه الحوادث والتحقيق فيها — ISO 45001 بند 10.2'],
      endpoint: '/api/incidents',
      icon: 'fa-person-falling-burst',
      noun: 'حادث',
      refPrefix: 'INC',
      columns: ['ref_number', 'title', 'type', 'severity', 'occurred_at', 'status'],
      search: ['ref_number', 'title', 'location'],
      statuses: { reported: ['مُبلَّغ', 'badge-yellow'], investigating: ['قيد التحقيق', 'badge-blue'], closed: ['مغلق', 'badge-green'] },
      fields: [
        { k: 'title', l: 'وصف مختصر', req: true, ph: 'انزلاق عامل عند مدخل المستودع' },
        { k: 'type', l: 'النوع', type: 'select', req: true, opts: [['near_miss', 'شبه حادث'], ['first_aid', 'إسعاف أولي'], ['medical', 'علاج طبي'], ['lost_time', 'إصابة مضيعة للوقت'], ['property_damage', 'ضرر بالممتلكات'], ['environmental', 'حادث بيئي']] },
        { k: 'severity', l: 'الخطورة', type: 'select', req: true, opts: [['low', 'منخفضة'], ['medium', 'متوسطة'], ['high', 'عالية'], ['critical', 'حرجة']] },
        { k: 'occurred_at', l: 'تاريخ الوقوع', type: 'date', req: true, def: today },
        { k: 'location', l: 'الموقع', ph: 'المستودع — البوابة 2' },
        { k: 'description', l: 'ما الذي حدث؟', type: 'textarea', full: true },
        { k: 'immediate_action', l: 'الإجراء الفوري المتخذ', type: 'textarea', full: true },
        { k: 'status', l: 'الحالة', type: 'select', opts: [['reported', 'مُبلَّغ'], ['investigating', 'قيد التحقيق'], ['closed', 'مغلق']], def: () => 'reported' },
      ],
      labels: {
        type: { near_miss: 'شبه حادث', first_aid: 'إسعاف أولي', medical: 'علاج طبي', lost_time: 'مضيعة للوقت', property_damage: 'ضرر ممتلكات', environmental: 'بيئي' },
        severity: { low: ['منخفضة', 'badge-gray'], medium: ['متوسطة', 'badge-yellow'], high: ['عالية', 'badge-red'], critical: ['حرجة', 'badge-red'] },
      },
      summary: rows => [
        ['إجمالي الحوادث', rows.length],
        ['شبه حوادث', rows.filter(r => r.type === 'near_miss').length],
        ['قيد التحقيق', rows.filter(r => r.status === 'investigating').length],
        ['حرجة / عالية', rows.filter(r => ['high', 'critical'].includes(r.severity)).length],
      ],
    },

    documents: {
      title: ['ضبط الوثائق والسجلات', 'السياسات والإجراءات والنماذج: الإصدار والاعتماد والمراجعة — ISO 9001 بند 7.5'],
      endpoint: '/api/documents',
      icon: 'fa-folder-tree',
      noun: 'وثيقة',
      columns: ['code', 'title', 'doc_type', 'version', 'review_date', 'status'],
      search: ['code', 'title', 'owner'],
      statuses: { draft: ['مسودة', 'badge-gray'], under_review: ['قيد المراجعة', 'badge-yellow'], approved: ['معتمدة', 'badge-green'], obsolete: ['ملغاة', 'badge-red'] },
      fields: [
        { k: 'code', l: 'رمز الوثيقة', req: true, ph: 'QP-07-01' },
        { k: 'title', l: 'العنوان', req: true, ph: 'إجراء ضبط المنتج غير المطابق' },
        { k: 'doc_type', l: 'النوع', type: 'select', req: true, opts: [['policy', 'سياسة'], ['manual', 'دليل'], ['procedure', 'إجراء'], ['work_instruction', 'تعليمات عمل'], ['form', 'نموذج'], ['record', 'سجل']] },
        { k: 'iso_standard', l: 'المعيار', type: 'select', opts: ISO },
        { k: 'version', l: 'الإصدار', ph: '1.0', def: () => '1.0' },
        { k: 'owner', l: 'المالك / المسؤول', ph: 'مدير الجودة' },
        { k: 'effective_date', l: 'تاريخ السريان', type: 'date' },
        { k: 'review_date', l: 'تاريخ المراجعة القادمة', type: 'date' },
        { k: 'status', l: 'الحالة', type: 'select', opts: [['draft', 'مسودة'], ['under_review', 'قيد المراجعة'], ['approved', 'معتمدة'], ['obsolete', 'ملغاة']], def: () => 'draft' },
        { k: 'file_url', l: 'رابط الملف', ph: 'https://…', full: true },
      ],
      labels: {
        doc_type: { policy: 'سياسة', manual: 'دليل', procedure: 'إجراء', work_instruction: 'تعليمات عمل', form: 'نموذج', record: 'سجل' },
      },
      summary: rows => [
        ['إجمالي الوثائق', rows.length],
        ['معتمدة', rows.filter(r => r.status === 'approved').length],
        ['قيد المراجعة', rows.filter(r => r.status === 'under_review').length],
        ['مراجعتها خلال 30 يوماً', rows.filter(r => { const d = daysUntil(r.review_date); return d !== null && d <= 30; }).length],
      ],
    },

    training: {
      title: ['التدريب والكفاءات', 'سجلات التدريب والشهادات وتواريخ انتهائها — ISO 9001 / 45001 بند 7.2'],
      endpoint: '/api/trainings',
      icon: 'fa-user-graduate',
      noun: 'سجل تدريب',
      columns: ['employee_name', 'course', 'provider', 'completed_at', 'expires_at', 'status'],
      search: ['employee_name', 'course', 'provider'],
      // status derives from the expiry date when the server does not send one
      derive: r => { if (r.status) return r; const d = daysUntil(r.expires_at); return { ...r, status: d === null ? 'valid' : d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'valid' }; },
      statuses: { valid: ['سارية', 'badge-green'], expiring: ['تنتهي قريباً', 'badge-yellow'], expired: ['منتهية', 'badge-red'] },
      fields: [
        { k: 'employee_name', l: 'الموظف', req: true, ph: 'محمد الزهراني' },
        { k: 'course', l: 'الدورة / الشهادة', req: true, ph: 'السلامة من الحرائق' },
        { k: 'provider', l: 'الجهة المدرّبة', ph: 'الدفاع المدني' },
        { k: 'iso_standard', l: 'المعيار', type: 'select', opts: ISO },
        { k: 'completed_at', l: 'تاريخ الإتمام', type: 'date', req: true, def: today },
        { k: 'expires_at', l: 'تاريخ الانتهاء', type: 'date' },
        { k: 'certificate_url', l: 'رابط الشهادة', ph: 'https://…', full: true },
      ],
      labels: {},
      summary: rows => [
        ['إجمالي السجلات', rows.length],
        ['سارية', rows.filter(r => r.status === 'valid').length],
        ['تنتهي خلال 30 يوماً', rows.filter(r => r.status === 'expiring').length],
        ['منتهية', rows.filter(r => r.status === 'expired').length],
      ],
    },
  };

  const COL_LABEL = {
    ref_number: 'المرجع', title: 'العنوان', type: 'النوع', severity: 'الخطورة', occurred_at: 'تاريخ الوقوع', status: 'الحالة',
    code: 'الرمز', doc_type: 'النوع', version: 'الإصدار', review_date: 'المراجعة القادمة',
    employee_name: 'الموظف', course: 'الدورة', provider: 'الجهة', completed_at: 'الإتمام', expires_at: 'الانتهاء',
  };
  const DATE_COLS = new Set(['occurred_at', 'review_date', 'completed_at', 'expires_at', 'effective_date']);

  // ── State ────────────────────────────────────────────────────────────
  const state = { key: null, rows: [], offline: false, q: '', status: '' };

  function cell(def, row, col) {
    const v = row[col];
    if (col === 'status') { const s = def.statuses[String(v || '').toLowerCase()]; return s ? `<span class="badge ${s[1]}">${s[0]}</span>` : esc(v || '—'); }
    if (DATE_COLS.has(col)) {
      if (col === 'review_date' || col === 'expires_at') {
        const d = daysUntil(v);
        const warn = d !== null && d <= 30;
        return `<span class="${warn ? 'font-bold' : ''}" style="${warn ? 'color:var(--mz-nc)' : ''}">${fmtDate(v)}</span>`;
      }
      return fmtDate(v);
    }
    const lab = def.labels[col];
    if (lab) { const x = lab[String(v || '').toLowerCase()]; if (Array.isArray(x)) return `<span class="badge ${x[1]}">${x[0]}</span>`; return esc(x || v || '—'); }
    if (col === 'ref_number' || col === 'code') return `<span style="font-family:var(--mz-mono);font-size:12px;color:var(--mz-assure)">${esc(v || '—')}</span>`;
    if (col === 'title' || col === 'course' || col === 'employee_name') return `<span class="font-semibold text-slate-800">${esc(v || '—')}</span>`;
    return esc(v || '—');
  }

  function visibleRows() {
    const def = REGISTERS[state.key];
    const q = state.q.trim().toLowerCase();
    return state.rows.filter(r => (!state.status || r.status === state.status) &&
      (!q || def.search.some(k => String(r[k] || '').toLowerCase().includes(q))));
  }

  function renderTable() {
    const def = REGISTERS[state.key];
    const rows = visibleRows();
    const host = document.getElementById('mz-table');
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = `<div class="p-10 text-center">
        <i class="fas ${def.icon} text-3xl mb-3 block" style="color:var(--mz-fog)"></i>
        <div class="font-bold text-slate-800 mb-1">${state.rows.length ? 'لا توجد نتائج مطابقة' : 'لا توجد ' + def.noun + ' مسجّلة بعد'}</div>
        <div class="text-sm text-slate-500 mb-4">${state.rows.length ? 'غيّر كلمة البحث أو فلتر الحالة.' : 'ابدأ بإضافة أول ' + def.noun + '.'}</div>
        ${state.rows.length ? '' : `<button class="btn btn-primary text-sm" onclick="MZ.openForm()"><i class="fas fa-plus ml-1"></i>إضافة ${def.noun}</button>`}
      </div>`;
      return;
    }
    host.innerHTML = `<table class="w-full text-sm">
      <thead><tr class="border-b border-slate-100">${def.columns.map(c => `<th class="text-right p-3 text-xs">${COL_LABEL[c] || c}</th>`).join('')}<th class="p-3 text-xs text-right">إجراءات</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="table-row border-b border-slate-50">
        ${def.columns.map(c => `<td class="p-3">${cell(def, r, c)}</td>`).join('')}
        <td class="p-3 whitespace-nowrap">
          <button class="text-slate-500 hover:text-slate-800 p-1" title="تعديل" aria-label="تعديل" onclick="MZ.openForm('${esc(r.id)}')"><i class="fas fa-pen"></i></button>
          <button class="text-slate-500 p-1" style="margin-right:6px" title="حذف" aria-label="حذف" onclick="MZ.remove('${esc(r.id)}')"><i class="fas fa-trash" style="color:var(--mz-nc)"></i></button>
        </td></tr>`).join('')}</tbody></table>`;
  }

  async function loadRegister(key) {
    const def = REGISTERS[key];
    Object.assign(state, { key, rows: [], offline: false, q: '', status: '' });
    const content = document.getElementById('app-content');
    let rows = [];
    try {
      rows = asList(await apiFetch(def.endpoint));
    } catch (e) {
      state.offline = true; // endpoint not on the server yet, or unreachable
    }
    state.rows = rows.map(r => def.derive ? def.derive(r) : r);

    const stats = def.summary(state.rows);
    content.innerHTML = `<div class="fade-in space-y-4">
      ${state.offline ? `<div class="card p-4 flex items-start gap-3" style="border-color:#f3dca0 !important;background:var(--mz-gold-tint)">
          <i class="fas fa-plug-circle-exclamation mt-1" style="color:var(--mz-obs)"></i>
          <div class="text-sm"><b>الوحدة جاهزة وتنتظر تفعيلها في الخادم.</b>
          <div class="text-slate-600 mt-1">الواجهة مكتملة، والمطلوب من الباك إند: <code dir="ltr" style="font-family:var(--mz-mono)">GET/POST/PUT/DELETE /api/v1${esc(def.endpoint.replace('/api', ''))}</code> — التفاصيل في docs/api-contract.md.</div></div></div>` : ''}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${stats.map(([l, v]) => `<div class="stat-card"><div class="text-xs text-slate-500 mb-1">${l}</div><div class="text-3xl font-black" style="color:var(--mz-onyx)">${v}</div></div>`).join('')}
      </div>
      <div class="card overflow-hidden">
        <div class="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div class="relative flex-1" style="min-width:200px">
            <i class="fas fa-magnifying-glass absolute text-slate-400" style="top:50%;transform:translateY(-50%);right:12px;font-size:13px"></i>
            <input id="mz-q" class="form-input" style="padding-right:34px" placeholder="بحث…" oninput="MZ.setQuery(this.value)" aria-label="بحث"/>
          </div>
          <select class="form-input" style="width:auto" onchange="MZ.setStatus(this.value)" aria-label="فلتر الحالة">
            <option value="">كل الحالات</option>
            ${Object.entries(def.statuses).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}
          </select>
          <button class="btn btn-primary text-sm" onclick="MZ.openForm()"><i class="fas fa-plus ml-1"></i>إضافة ${def.noun}</button>
        </div>
        <div id="mz-table" style="overflow-x:auto"></div>
      </div>
    </div>`;
    renderTable();
  }

  // ── Form modal ───────────────────────────────────────────────────────
  function ensureModal() {
    let m = document.getElementById('mz-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'mz-modal';
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.addEventListener('click', e => { if (e.target === m) closeForm(); });
    document.body.appendChild(m);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) closeForm(); });
    return m;
  }

  function fieldHtml(f, v) {
    const id = 'mzf-' + f.k;
    const req = f.req ? ' <span style="color:var(--mz-nc)">*</span>' : '';
    const val = v ?? (f.def ? f.def() : '');
    let input;
    if (f.type === 'select') input = `<select class="form-input" id="${id}">${f.req ? '' : '<option value="">—</option>'}${f.opts.map(([k, l]) => `<option value="${k}" ${String(val).toLowerCase() === k.toLowerCase() ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea class="form-input" id="${id}" rows="3" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    else input = `<input class="form-input" id="${id}" type="${f.type || 'text'}" value="${esc(f.type === 'date' && val ? String(val).slice(0, 10) : val)}" placeholder="${esc(f.ph || '')}"/>`;
    return `<div class="${f.full ? 'sm:col-span-2' : ''}"><label class="text-sm font-medium text-slate-700 block mb-1" for="${id}">${f.l}${req}</label>${input}</div>`;
  }

  function openForm(id) {
    const def = REGISTERS[state.key];
    const row = id ? state.rows.find(r => String(r.id) === String(id)) : null;
    const m = ensureModal();
    m.innerHTML = `<div class="modal-content mx-4" style="max-width:640px">
      <div class="modal-header"><div class="modal-title"><i class="fas ${def.icon} ml-2"></i>${row ? 'تعديل' : 'إضافة'} ${def.noun}</div>
        <button onclick="MZ.closeForm()" class="text-white opacity-80 hover:opacity-100 text-xl" aria-label="إغلاق"><i class="fas fa-xmark"></i></button></div>
      <div class="modal-body"><div id="mz-form-err" class="hidden mb-3 p-3 rounded-lg text-sm" style="background:var(--mz-nc-bg);color:var(--mz-nc)" role="alert"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${def.fields.map(f => fieldHtml(f, row ? row[f.k] : undefined)).join('')}</div></div>
      <div class="modal-footer"><button class="btn btn-outline" onclick="MZ.closeForm()">إلغاء</button>
        <button class="btn btn-primary" id="mz-save" onclick="MZ.save(${row ? `'${esc(row.id)}'` : ''})"><i class="fas fa-check ml-1"></i>حفظ</button></div>
    </div>`;
    m.classList.add('open');
    setTimeout(() => { const first = m.querySelector('input,select,textarea'); if (first) first.focus(); }, 30);
  }
  function closeForm() { document.getElementById('mz-modal')?.classList.remove('open'); }

  async function save(id) {
    const def = REGISTERS[state.key];
    const body = {};
    for (const f of def.fields) {
      const v = document.getElementById('mzf-' + f.k)?.value?.trim() ?? '';
      if (f.req && !v) return formError(`الحقل «${f.l}» مطلوب.`);
      body[f.k] = v || null;
    }
    const btn = document.getElementById('mz-save');
    btn.disabled = true;
    try {
      const saved = id ? await apiFetch(`${def.endpoint}/${id}`, 'PUT', body) : await apiFetch(def.endpoint, 'POST', body);
      let rec = { ...body, ...(saved && typeof saved === 'object' ? saved : {}) };
      if (!rec.id) rec.id = id || ('tmp-' + Date.now());
      if (def.refPrefix && !rec.ref_number) rec.ref_number = `${def.refPrefix}-${new Date().getFullYear()}-${String(state.rows.length + 1).padStart(3, '0')}`;
      if (def.derive) rec = def.derive(rec);
      state.rows = id ? state.rows.map(r => String(r.id) === String(id) ? rec : r) : [rec, ...state.rows];
      closeForm();
      showToast('تم الحفظ', 'success');
      loadRegisterKeepRows();
    } catch (e) {
      formError(state.offline ? 'لم يُحفظ: هذه الوحدة غير مفعّلة في الخادم بعد.' : ('تعذّر الحفظ: ' + (e.message || 'خطأ غير معروف')));
    } finally { btn.disabled = false; }
  }
  function formError(msg) { const el = document.getElementById('mz-form-err'); el.textContent = msg; el.classList.remove('hidden'); }

  async function remove(id) {
    const def = REGISTERS[state.key];
    const row = state.rows.find(r => String(r.id) === String(id));
    if (!confirm(`حذف ${def.noun} «${row?.title || row?.course || row?.code || ''}»؟ لا يمكن التراجع.`)) return;
    try {
      await apiFetch(`${def.endpoint}/${id}`, 'DELETE');
      state.rows = state.rows.filter(r => String(r.id) !== String(id));
      showToast('تم الحذف', 'success');
      loadRegisterKeepRows();
    } catch (e) { showToast('تعذّر الحذف: ' + (e.message || ''), 'error'); }
  }

  // re-render summary + table from the rows already in memory
  function loadRegisterKeepRows() {
    const rows = state.rows, key = state.key, offline = state.offline;
    const _api = window.apiFetch;
    window.apiFetch = async () => rows; // render from memory, no refetch
    loadRegister(key).finally(() => { window.apiFetch = _api; state.offline = offline; });
  }

  // ── My profile ───────────────────────────────────────────────────────
  async function loadProfile() {
    const content = document.getElementById('app-content');
    let me = (window.state && window.state.currentUser) || null;
    try { me = await apiFetch('/api/auth/me'); } catch (e) { /* keep cached user */ }
    me = me || {};
    const roleAr = { super_admin: 'مدير المنصة', tenant_admin: 'مدير المنظمة', manager: 'مدير', engineer: 'مهندس', auditor: 'مدقق', viewer: 'مشاهد' }[String(me.role || '').toLowerCase()] || me.role || '—';
    content.innerHTML = `<div class="fade-in grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="card p-6 text-center">
        <div class="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black text-white" style="background:var(--mz-ink)">${esc((me.full_name || 'م').charAt(0))}</div>
        <div class="font-black text-lg" style="color:var(--mz-onyx)">${esc(me.full_name || '—')}</div>
        <div class="text-sm text-slate-500 mb-3" dir="ltr">${esc(me.email || '')}</div>
        <span class="badge badge-blue">${esc(roleAr)}</span>
        <div class="text-xs text-slate-500 mt-4">${me.tenant?.name ? 'المنظمة: ' + esc(me.tenant.name) : ''}</div>
      </div>
      <div class="lg:col-span-2 space-y-5">
        <div class="card p-6">
          <h3 class="font-bold text-slate-800 mb-4">البيانات الشخصية</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-name">الاسم الكامل</label><input id="pf-name" class="form-input" value="${esc(me.full_name || '')}"/></div>
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-phone">الجوال</label><input id="pf-phone" class="form-input" dir="ltr" value="${esc(me.phone || '')}"/></div>
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-dept">القسم</label><input id="pf-dept" class="form-input" value="${esc(me.department || '')}"/></div>
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-job">المسمى الوظيفي</label><input id="pf-job" class="form-input" value="${esc(me.job_title || '')}"/></div>
          </div>
          <div class="mt-4"><button class="btn btn-primary" onclick="MZ.saveProfile('${esc(me.id || '')}')"><i class="fas fa-check ml-1"></i>حفظ البيانات</button></div>
        </div>
        <div class="card p-6">
          <h3 class="font-bold text-slate-800 mb-1">كلمة المرور</h3>
          <p class="text-sm text-slate-500 mb-4">8 أحرف على الأقل. ستبقى مسجّلاً على هذا الجهاز.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-pw1">كلمة المرور الجديدة</label><input id="pf-pw1" type="password" class="form-input" autocomplete="new-password"/></div>
            <div><label class="text-sm font-medium text-slate-700 block mb-1" for="pf-pw2">تأكيد كلمة المرور</label><input id="pf-pw2" type="password" class="form-input" autocomplete="new-password"/></div>
          </div>
          <div class="mt-4"><button class="btn btn-outline" onclick="MZ.savePassword('${esc(me.id || '')}')"><i class="fas fa-key ml-1"></i>تغيير كلمة المرور</button></div>
        </div>
      </div>
    </div>`;
  }

  async function saveProfile(id) {
    if (!id) return showToast('تعذّر تحديد المستخدم الحالي', 'error');
    const body = { full_name: val('pf-name'), phone: val('pf-phone'), department: val('pf-dept'), job_title: val('pf-job') };
    if (!body.full_name) return showToast('الاسم مطلوب', 'error');
    try {
      await apiFetch(`/api/users/${id}`, 'PUT', body);
      const el = document.getElementById('user-name'); if (el) el.textContent = body.full_name;
      showToast('تم حفظ البيانات', 'success');
    } catch (e) { showToast('تعذّر الحفظ: ' + (e.message || ''), 'error'); }
  }
  async function savePassword(id) {
    const a = val('pf-pw1'), b = val('pf-pw2');
    if (a.length < 8) return showToast('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error');
    if (a !== b) return showToast('كلمتا المرور غير متطابقتين', 'error');
    try {
      await apiFetch(`/api/users/${id}`, 'PUT', { password: a });
      document.getElementById('pf-pw1').value = document.getElementById('pf-pw2').value = '';
      showToast('تم تغيير كلمة المرور', 'success');
    } catch (e) { showToast('تعذّر التغيير: ' + (e.message || ''), 'error'); }
  }
  const val = id => (document.getElementById(id)?.value || '').trim();

  // ── Router hook ──────────────────────────────────────────────────────
  const EXTRA = {
    incidents: () => loadRegister('incidents'),
    documents: () => loadRegister('documents'),
    training: () => loadRegister('training'),
    profile: loadProfile,
    // shortcuts into existing Organization tabs
    risks: () => openOrgTab('risks'),
    annual: () => openOrgTab('annual'),
  };
  const TITLES = {
    incidents: REGISTERS.incidents.title, documents: REGISTERS.documents.title, training: REGISTERS.training.title,
    profile: ['ملفي الشخصي', 'بياناتك وكلمة المرور'],
    risks: ['سجل المخاطر', 'تقييم المخاطر ومصفوفة الاحتمالية والتأثير'],
    annual: ['الخطة السنوية', 'مبادرات الجودة والسلامة على مدار العام'],
  };
  // these two live as tabs of the Organization page; the header names the tab, not the page
  function openOrgTab(tab) {
    baseNavigate('org');
    setTimeout(() => {
      if (window.switchOrgTab) switchOrgTab(tab);
      const [t, s] = TITLES[tab];
      document.getElementById('page-title').textContent = t;
      document.getElementById('page-subtitle').textContent = s;
    }, 400);
  }

  const baseNavigate = window.navigate;
  window.navigate = function (page) {
    if (!EXTRA[page]) return baseNavigate(page);
    if (page === 'risks' || page === 'annual') { EXTRA[page](); markActive(page); return; }
    window.currentPage = page;
    markActive(page);
    const [t, s] = TITLES[page];
    document.getElementById('page-title').textContent = t;
    document.getElementById('page-subtitle').textContent = s;
    document.getElementById('app-content').innerHTML = '<div class="flex justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl" style="color:var(--mz-brand)"></i></div>';
    EXTRA[page]();
  };
  function markActive(page) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', (el.getAttribute('onclick') || '').includes(`'${page}'`)));
  }

  window.MZ = {
    openForm, closeForm, save, remove,
    setQuery: v => { state.q = v; renderTable(); },
    setStatus: v => { state.status = v; renderTable(); },
    saveProfile, savePassword,
    registers: REGISTERS,
  };
})();
