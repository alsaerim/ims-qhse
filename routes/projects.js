const express = require('express');
const router = express.Router();
const pool = require('../database');

// ── جلب كل المشاريع ──
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── جلب مشروع واحد ──
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── إضافة مشروع جديد ──
router.post('/', async (req, res) => {
  try {
    const {
      code, name, client_name, city, status,
      iso_9001, iso_45001, iso_14001, manager_id,
      start_date, end_date, description
    } = req.body;

    const result = await pool.query(
      `INSERT INTO projects 
        (code, name, client_name, city, status, iso_9001, iso_45001, iso_14001, manager_id, start_date, end_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [code, name, client_name, city, status || 'active',
       iso_9001, iso_45001, iso_14001, manager_id,
       start_date, end_date, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── تعديل مشروع ──
router.put('/:id', async (req, res) => {
  try {
    const {
      code, name, client_name, city, status,
      iso_9001, iso_45001, iso_14001, manager_id,
      start_date, end_date, description
    } = req.body;

    const result = await pool.query(
      `UPDATE projects SET
        code=$1, name=$2, client_name=$3, city=$4, status=$5,
        iso_9001=$6, iso_45001=$7, iso_14001=$8, manager_id=$9,
        start_date=$10, end_date=$11, description=$12
       WHERE id=$13 RETURNING *`,
      [code, name, client_name, city, status,
       iso_9001, iso_45001, iso_14001, manager_id,
       start_date, end_date, description, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── حذف مشروع ──
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;