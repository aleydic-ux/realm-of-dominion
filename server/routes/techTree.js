const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

const router = express.Router();

// GET /api/tech-tree - All technologies (filtered by race if query param)
router.get('/', authenticate, async (req, res) => {
  const { race } = req.query;
  try {
    let query = 'SELECT * FROM tech_tree';
    const params = [];
    if (race) {
      query += ' WHERE race = $1 OR race IS NULL';
      params.push(race);
    }
    query += ' ORDER BY COALESCE(race, \'zzz\'), tier, name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tech tree' });
  }
});

module.exports = router;
