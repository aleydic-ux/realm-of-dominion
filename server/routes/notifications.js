const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');

const router = express.Router();
router.use(authenticate, apRegen);

// GET /api/notifications - List notifications (newest first)
router.get('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, message, metadata, is_read, created_at
       FROM notifications
       WHERE province_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE province_id = $1 AND is_read = false`,
      [req.province.id]
    );
    res.json({ count: parseInt(count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load unread count' });
  }
});

// PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND province_id = $2`,
      [req.params.id, req.province.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE province_id = $1 AND is_read = false`,
      [req.province.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND province_id = $2`,
      [req.params.id, req.province.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
