/* ==========================================================================
   ISO Radar — saves the web task board (Kanban / Gantt) to the server.

   The board in ims_qhse_9.html edits window.MOCK_DB.tasks in memory. This
   file wraps its handlers so every change is also written to /api/tasks:
   create, move between columns, edit, comment, attach, delete.
   Images attached to a task are stored through /api/uploads/photo and only
   their signed URL is kept on the task, so task bodies stay small.
   Depends on globals from the host page: apiFetch, showToast, openTaskDetail.
   ========================================================================== */
(function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const tasks = () => (window.MOCK_DB && window.MOCK_DB.tasks) || [];
  const find = id => tasks().find(t => t.id === id);

  // comments show the author's name; the page never sets _currentUser itself
  if (!window._currentUser) {
    try { window._currentUser = JSON.parse(localStorage.getItem('ims_user') || 'null'); } catch (e) {}
  }

  /** Server rows → board rows (the board says "inprogress"). */
  window.IR_TASKS_FROM_SERVER = list => (Array.isArray(list) ? list : []).map(t => ({
    ...t,
    status: t.status === 'in_progress' ? 'inprogress' : t.status,
    assigned_to: t.assigned_to || t.assigned_to_id || '',
    comments: Array.isArray(t.comments) ? t.comments : [],
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
  }));

  async function uploadImage(dataUrl, taskId) {
    const r = await apiFetch('/api/uploads/photo', 'POST', { image_base64: dataUrl, entity_type: 'task', entity_id: taskId });
    return r && r.url;
  }

  /** Replaces inline image data with uploaded URLs; drops non-image files the server cannot store. */
  async function externalise(list, taskId) {
    const out = [];
    for (const a of list || []) {
      if (a && typeof a.data === 'string' && a.data.startsWith('data:')) {
        if (!/^data:image\/(png|jpe?g|webp);/i.test(a.data)) {
          showToast('⚠️ يُحفظ على الخادم الصور فقط (JPG / PNG / WEBP) — لم يُحفظ ' + (a.name || 'الملف'), 'warning');
          continue;
        }
        const url = await uploadImage(a.data, taskId);
        out.push({ name: a.name, type: a.type, url, data: url, uploaded_at: a.uploaded_at || new Date().toISOString() });
      } else if (a) {
        out.push(a);
      }
    }
    return out;
  }

  function payload(t) {
    return {
      title: t.title,
      description: t.description || '',
      status: t.status || 'todo',
      priority: t.priority || 'medium',
      due_date: t.due_date || null,
      assigned_to: UUID.test(t.assigned_to || '') ? t.assigned_to : undefined,
      project_id: UUID.test(t.project_id || '') ? t.project_id : undefined,
      project_name: t.project_name || '',
      comments: (t.comments || []).map(c => ({
        id: String(c.id || ''), text: c.text || '', user_id: String(c.user_id || ''), user_name: c.user_name || '',
        created_at: c.created_at, attachments: c.attachments || [],
      })),
      attachments: t.attachments || [],
    };
  }

  const fail = e => showToast('❌ تعذّر حفظ المهمة على الخادم: ' + ((e && e.message) || ''), 'error');

  async function save(id) {
    const t = find(id);
    if (!t) return;
    try {
      if (!UUID.test(t.id)) return create(t);
      t.attachments = await externalise(t.attachments, t.id);
      for (const c of t.comments || []) c.attachments = await externalise(c.attachments, t.id);
      await apiFetch('/api/tasks/' + t.id, 'PUT', payload(t));
    } catch (e) { fail(e); }
  }

  async function create(t) {
    try {
      const body = payload(t);
      const pendingFiles = { attachments: body.attachments, comments: body.comments };
      body.attachments = []; body.comments = [];
      const saved = await apiFetch('/api/tasks', 'POST', body);
      if (saved && saved.id) {
        t.id = saved.id;
        t.assigned_name = saved.assigned_name || t.assigned_name;
        if (pendingFiles.attachments.length || pendingFiles.comments.length) await save(t.id);
        if (typeof refreshKanbanBoard === 'function') refreshKanbanBoard();
      }
    } catch (e) { fail(e); }
  }

  const wrap = (name, before, after) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      const ctx = before ? before.apply(this, arguments) : undefined;
      const result = orig.apply(this, arguments);
      try { after.call(this, ctx, ...arguments); } catch (e) { console.warn('[tasks-sync]', name, e); }
      return result;
    };
  };

  // new task: the board pushes a row with a temporary id — create it on the server
  wrap('submitNewTask', () => new Set(tasks().map(t => t.id)), before => {
    tasks().filter(t => !before.has(t.id)).forEach(create);
  });
  wrap('moveTask', null, (_, id) => save(id));
  wrap('onColDrop', e => (e && e.dataTransfer && e.dataTransfer.getData('text/plain')) || window._dragTaskId, id => id && save(id));
  wrap('submitTaskEdit', null, (_, id) => save(id));
  wrap('submitComment', null, (_, id) => save(id));
  wrap('removeAttachment', null, (_, id) => save(id));
  wrap('deleteTask', null, async (_, id) => {
    if (find(id) || !UUID.test(id)) return; // cancelled, or never reached the server
    try { await apiFetch('/api/tasks/' + id, 'DELETE'); } catch (e) { fail(e); }
  });

  // attachments: read the files, then save (which uploads the images)
  window.handleFileUpload = function (taskId, input) {
    const t = find(taskId);
    if (!t || !input || !input.files || !input.files.length) return;
    t.attachments = t.attachments || [];
    const files = Array.from(input.files);
    let pending = files.length;
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { showToast('❌ ' + file.name + ' أكبر من 5MB', 'error'); if (--pending === 0) done(); return; }
      const reader = new FileReader();
      reader.onload = e => {
        t.attachments.push({ name: file.name, type: file.type, data: e.target.result, uploaded_at: new Date().toISOString() });
        if (--pending === 0) done();
      };
      reader.readAsDataURL(file);
    });
    async function done() {
      await save(taskId);
      showToast('✅ تم حفظ المرفقات', 'success');
      if (typeof openTaskDetail === 'function') openTaskDetail(taskId);
    }
  };
})();
