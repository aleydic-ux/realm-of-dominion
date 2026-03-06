const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');

const router = express.Router();

// GET /api/feed - public, returns last 100 entries
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, author_name, message, created_at
       FROM world_feed
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(rows.reverse()); // oldest first for display
  } catch (err) {
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// POST /api/feed/chat - authenticated, post a chat message
router.post('/chat', authenticate, apRegen, async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { message } = req.body;

  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  if (message.trim().length > 300) return res.status(400).json({ error: 'Message too long (max 300 chars)' });

  try {
    await pool.query(
      `INSERT INTO world_feed (type, author_name, province_id, message)
       VALUES ('chat', $1, $2, $3)`,
      [req.province.name, req.province.id, message.trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post message' });
  }
});

module.exports = router;
