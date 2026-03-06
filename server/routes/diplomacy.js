const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');

const router = express.Router();

router.use(authenticate, apRegen);

// POST /api/diplomacy/set - Set relation status to target province
router.post('/set', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { target_province_id, status } = req.body;

  if (!target_province_id || !status) return res.status(400).json({ error: 'target_province_id and status required' });
  if (!['ally','neutral','enemy'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (parseInt(target_province_id) === req.province.id) return res.status(400).json({ error: 'Cannot set relation with yourself' });

  // Check target exists
  const { rows: [target] } = await pool.query('SELECT id FROM provinces WHERE id = $1', [target_province_id]);
  if (!target) return res.status(404).json({ error: 'Target province not found' });

  try {
    await pool.query(
      `INSERT INTO diplomatic_relations (province_id, target_province_id, status, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (province_id, target_province_id) DO UPDATE SET status = $3, updated_at = NOW()`,
      [req.province.id, target_province_id, status]
    );
    res.json({ message: `Relation set to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set relation' });
  }
});

// GET /api/diplomacy/relations - All diplomatic relations
router.get('/relations', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT dr.status, dr.pact_expires_at, dr.updated_at,
              p.id as target_id, p.name as target_name, p.race as target_race
       FROM diplomatic_relations dr
       JOIN provinces p ON p.id = dr.target_province_id
       WHERE dr.province_id = $1`, [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load relations' });
  }
});

// POST /api/diplomacy/pact - Establish neutral pact with target
router.post('/pact', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { target_province_id } = req.body;

  if (!target_province_id) return res.status(400).json({ error: 'target_province_id required' });

  try {
    await pool.query(
      `INSERT INTO diplomatic_relations (province_id, target_province_id, status, pact_expires_at, updated_at)
       VALUES ($1, $2, 'pact', NULL, NOW())
       ON CONFLICT (province_id, target_province_id) DO UPDATE SET status = 'pact', pact_expires_at = NULL, updated_at = NOW()`,
      [req.province.id, target_province_id]
    );
    // Mutual pact
    await pool.query(
      `INSERT INTO diplomatic_relations (province_id, target_province_id, status, pact_expires_at, updated_at)
       VALUES ($1, $2, 'pact', NULL, NOW())
       ON CONFLICT (province_id, target_province_id) DO UPDATE SET status = 'pact', pact_expires_at = NULL, updated_at = NOW()`,
      [target_province_id, req.province.id]
    );
    res.json({ message: 'Neutral pact established' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to establish pact' });
  }
});

// DELETE /api/diplomacy/pact/:target_id - Begin 12-hour pact termination
router.delete('/pact/:target_id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { target_id } = req.params;

  const { rows: [relation] } = await pool.query(
    `SELECT * FROM diplomatic_relations WHERE province_id = $1 AND target_province_id = $2 AND status = 'pact'`,
    [req.province.id, target_id]
  );
  if (!relation) return res.status(404).json({ error: 'No active pact with this province' });

  const pactExpiresAt = new Date(Date.now() + 12 * 3600000); // 12 hours

  try {
    await pool.query(
      `UPDATE diplomatic_relations SET pact_expires_at = $1, updated_at = NOW()
       WHERE province_id = $2 AND target_province_id = $3`,
      [pactExpiresAt, req.province.id, target_id]
    );
    res.json({ message: 'Pact termination initiated (12-hour notice period)', expires_at: pactExpiresAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to terminate pact' });
  }
});

module.exports = router;
