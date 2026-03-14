const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');

const router = express.Router();
router.use(authenticate, apRegen);

// GET /api/mail — inbox
router.get('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province' });
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.subject, m.body, m.read_at, m.created_at,
              p.id as sender_id, p.name as sender_name
       FROM mail m JOIN provinces p ON p.id = m.sender_province_id
       WHERE m.recipient_province_id = $1 AND m.deleted_by_recipient = false
       ORDER BY m.created_at DESC LIMIT 50`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load inbox' });
  }
});

// GET /api/mail/unread-count
router.get('/unread-count', async (req, res) => {
  if (!req.province) return res.json({ count: 0 });
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM mail WHERE recipient_province_id = $1 AND read_at IS NULL AND deleted_by_recipient = false',
      [req.province.id]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch {
    res.json({ count: 0 });
  }
});

// GET /api/mail/sent — sent box
router.get('/sent', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province' });
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.subject, m.body, m.read_at, m.created_at,
              p.id as recipient_id, p.name as recipient_name
       FROM mail m JOIN provinces p ON p.id = m.recipient_province_id
       WHERE m.sender_province_id = $1 AND m.deleted_by_sender = false
       ORDER BY m.created_at DESC LIMIT 50`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sent mail' });
  }
});

// POST /api/mail — send
router.post('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province' });
  const { recipient_province_id, subject, body } = req.body;
  if (!recipient_province_id || !body?.trim()) {
    return res.status(400).json({ error: 'recipient_province_id and body required' });
  }
  const recipId = parseInt(recipient_province_id);
  if (recipId === req.province.id) return res.status(400).json({ error: 'Cannot mail yourself' });
  try {
    const { rows: [recip] } = await pool.query('SELECT id, name FROM provinces WHERE id = $1', [recipId]);
    if (!recip) return res.status(404).json({ error: 'Province not found' });

    await pool.query(
      'INSERT INTO mail (sender_province_id, recipient_province_id, subject, body) VALUES ($1,$2,$3,$4)',
      [req.province.id, recipId, (subject || 'No subject').slice(0, 100), body.trim().slice(0, 4000)]
    );

    // Notification for recipient
    await pool.query(
      `INSERT INTO notifications (province_id, type, title, message)
       VALUES ($1, 'mail', 'New Mail', $2)`,
      [recipId, `Message from ${req.province.name}: ${(subject || 'No subject').slice(0, 60)}`]
    ).catch(() => {});

    res.json({ message: `Mail sent to ${recip.name}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send mail' });
  }
});

// PATCH /api/mail/:id/read — mark as read
router.patch('/:id/read', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province' });
  await pool.query(
    'UPDATE mail SET read_at = NOW() WHERE id = $1 AND recipient_province_id = $2 AND read_at IS NULL',
    [parseInt(req.params.id), req.province.id]
  ).catch(() => {});
  res.json({ ok: true });
});

// DELETE /api/mail/:id — soft delete (from whichever side called)
router.delete('/:id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province' });
  const mailId = parseInt(req.params.id);
  const pid = req.province.id;
  await Promise.all([
    pool.query('UPDATE mail SET deleted_by_sender = true WHERE id = $1 AND sender_province_id = $2', [mailId, pid]),
    pool.query('UPDATE mail SET deleted_by_recipient = true WHERE id = $1 AND recipient_province_id = $2', [mailId, pid]),
  ]).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
