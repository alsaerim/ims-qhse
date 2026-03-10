const express = require('express');
const router = express.Router();
const pool = require('../database');

// ── جلب كل تحليلات RCA ──
router.get('/', async (req, res) => {
  try {
    const { status, project_id } = req.query;
    let query = `
      SELECT r.*,
             p.name as project_name,
             u.full_name as assigned_name,
             n.ref_number as nc_ref,
             n.title as nc_description
      FROM rca_tickets r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN users u ON r.assigned_to = u.id
      LEFT JOIN nonconformances n ON r.nc_id = n.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    if (project_id) {
      params.push(project_id);
      query += ` AND r.project_id = $${params.length}`;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── جلب RCA واحدة ──
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*,
              p.name as project_name,
              u.full_name as assigned_name,
              n.ref_number as nc_ref,
              n.title as nc_description
       FROM rca_tickets r
       LEFT JOIN projects p ON r.project_id = p.id
       LEFT JOIN users u ON r.assigned_to = u.id
       LEFT JOIN nonconformances n ON r.nc_id = n.id
       WHERE r.id = $1`,
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

// ── تعديل RCA ──
router.put('/:id', async (req, res) => {
  try {
    const {
      title, status, methodology,
      why_1, why_2, why_3, why_4, why_5,
      root_cause, target_date, assigned_to
    } = req.body;

    const result = await pool.query(
      `UPDATE rca_tickets SET
        title=$1, status=$2, methodology=$3,
        why_1=$4, why_2=$5, why_3=$6,
        why_4=$7, why_5=$8, root_cause=$9,
        target_date=$10, assigned_to=$11
       WHERE id=$12 RETURNING *`,
      [title, status, methodology,
       why_1, why_2, why_3,
       why_4, why_5, root_cause,
       target_date, assigned_to, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── إغلاق RCA ──
router.put('/:id/close', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE rca_tickets SET
        status='closed'
       WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── حذف RCA ──
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rca_tickets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;