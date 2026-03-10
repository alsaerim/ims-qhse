const express = require('express');
const router = express.Router();
const pool = require('../database');

// ── جلب كل التفتيشات ──
router.get('/', async (req, res) => {
  try {
    const { status, iso_standard, project_id } = req.query;
    let query = `
      SELECT i.*, 
             p.name as project_name,
             u.full_name as assigned_name
      FROM inspections i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }
    if (iso_standard) {
      params.push(iso_standard);
      query += ` AND i.iso_standard = $${params.length}`;
    }
    if (project_id) {
      params.push(project_id);
      query += ` AND i.project_id = $${params.length}`;
    }

    query += ' ORDER BY i.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── جلب تفتيش واحد ──
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, 
              p.name as project_name,
              u.full_name as assigned_name
       FROM inspections i
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN users u ON i.assigned_to = u.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'التفتيش غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── إضافة تفتيش جديد ──
router.post('/', async (req, res) => {
  try {
    const {
      title, type, iso_standard, project_id,
      assigned_to, location_name, scheduled_at
    } = req.body;

    // توليد رقم مرجعي تلقائي
    const count = await pool.query('SELECT COUNT(*) FROM inspections');
    const ref_number = `INS-${new Date().getFullYear()}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO inspections
        (ref_number, title, type, iso_standard, project_id,
         assigned_to, location_name, scheduled_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING *`,
      [ref_number, title, type, iso_standard, project_id,
       assigned_to, location_name, scheduled_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── تعديل تفتيش ──
router.put('/:id', async (req, res) => {
  try {
    const {
      title, type, status, result: inspResult,
      compliance_score, iso_standard, project_id,
      assigned_to, location_name, scheduled_at, completed_at
    } = req.body;

    const result = await pool.query(
      `UPDATE inspections SET
        title=$1, type=$2, status=$3, result=$4,
        compliance_score=$5, iso_standard=$6, project_id=$7,
        assigned_to=$8, location_name=$9,
        scheduled_at=$10, completed_at=$11
       WHERE id=$12 RETURNING *`,
      [title, type, status, inspResult,
       compliance_score, iso_standard, project_id,
       assigned_to, location_name,
       scheduled_at, completed_at, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'التفتيش غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── حذف تفتيش ──
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inspections WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;