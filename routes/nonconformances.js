const express = require('express');
const router = express.Router();
const pool = require('../database');

// ── جلب كل عدم المطابقات ──
router.get('/', async (req, res) => {
  try {
    const { status, type, project_id } = req.query;
    let query = `
      SELECT n.*,
             p.name as project_name,
             u.full_name as assigned_name,
             r.ref_number as rca_ref,
             r.status as rca_status
      FROM nonconformances n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN users u ON n.assigned_to = u.id
      LEFT JOIN rca_tickets r ON r.nc_id = n.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND n.status = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND n.type = $${params.length}`;
    }
    if (project_id) {
      params.push(project_id);
      query += ` AND n.project_id = $${params.length}`;
    }

    query += ' ORDER BY n.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── جلب عدم مطابقة واحدة ──
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*,
              p.name as project_name,
              u.full_name as assigned_name,
              r.ref_number as rca_ref,
              r.status as rca_status
       FROM nonconformances n
       LEFT JOIN projects p ON n.project_id = p.id
       LEFT JOIN users u ON n.assigned_to = u.id
       LEFT JOIN rca_tickets r ON r.nc_id = n.id
       WHERE n.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── إضافة عدم مطابقة جديدة ──
router.post('/', async (req, res) => {
  try {
    const {
      title, description, type, category,
      iso_standard, project_id, assigned_to,
      due_date, location
    } = req.body;

    // توليد رقم مرجعي تلقائي
    const count = await pool.query('SELECT COUNT(*) FROM nonconformances');
    const ref_number = `NC-${new Date().getFullYear()}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

    // إضافة عدم المطابقة
    const ncResult = await pool.query(
      `INSERT INTO nonconformances
        (ref_number, title, description, type, category,
         iso_standard, project_id, assigned_to, due_date, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [ref_number, title, description, type, category,
       iso_standard, project_id, assigned_to, due_date, location]
    );

    const nc = ncResult.rows[0];

    // إنشاء RCA تلقائياً
    const rcaCount = await pool.query('SELECT COUNT(*) FROM rca_tickets');
    const rca_ref = `RCA-${new Date().getFullYear()}-${String(parseInt(rcaCount.rows[0].count) + 1).padStart(3, '0')}`;

    await pool.query(
      `INSERT INTO rca_tickets
        (ref_number, title, status, methodology, nc_id, project_id, assigned_to)
       VALUES ($1,$2,'open','5_whys',$3,$4,$5)`,
      [rca_ref, `تحليل: ${title}`, nc.id, project_id, assigned_to]
    );

    res.status(201).json({ ...nc, rca_ref });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── تعديل عدم مطابقة ──
router.put('/:id', async (req, res) => {
  try {
    const {
      title, description, type, category,
      status, iso_standard, project_id,
      assigned_to, due_date, location
    } = req.body;

    const result = await pool.query(
      `UPDATE nonconformances SET
        title=$1, description=$2, type=$3, category=$4,
        status=$5, iso_standard=$6, project_id=$7,
        assigned_to=$8, due_date=$9, location=$10
       WHERE id=$11 RETURNING *`,
      [title, description, type, category,
       status, iso_standard, project_id,
       assigned_to, due_date, location, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── حذف عدم مطابقة ──
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM nonconformances WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;