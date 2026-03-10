const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { ENHANCEMENTS, ENHANCEMENT_LIST } = require('../config/enhancements');

const router = express.Router();
router.use(authenticate, apRegen);

// GET /api/gems/balance — gem balance + recent transactions
router.get('/balance', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows: transactions } = await pool.query(
      `SELECT amount, reason, created_at FROM gem_transactions
       WHERE province_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.province.id]
    );
    res.json({ gems: req.province.gems || 0, transactions });
  } catch (err) {
    console.error('Gem balance error:', err);
    res.status(500).json({ error: 'Failed to load gem balance' });
  }
});

// GET /api/gems/enhancements — full tree with locked/unlocked/active states
router.get('/enhancements', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const provinceId = req.province.id;
  try {
    const [unlocksRes, buffsRes] = await Promise.all([
      pool.query('SELECT enhancement_id FROM gem_unlocks WHERE province_id = $1', [provinceId]),
      pool.query(
        `SELECT enhancement_id, expires_at, used_at FROM gem_buffs
         WHERE province_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY used_at DESC`,
        [provinceId]
      ),
    ]);

    const unlocked = new Set(unlocksRes.rows.map(r => r.enhancement_id));
    const activeBuffs = {};
    for (const b of buffsRes.rows) {
      if (!activeBuffs[b.enhancement_id]) activeBuffs[b.enhancement_id] = b;
    }

    const tree = ENHANCEMENT_LIST.map(e => ({
      ...e,
      unlocked: unlocked.has(e.id),
      active: !!activeBuffs[e.id],
      active_expires_at: activeBuffs[e.id]?.expires_at || null,
      can_unlock: !unlocked.has(e.id) && (!e.requires || unlocked.has(e.requires)),
    }));

    res.json({ gems: req.province.gems || 0, enhancements: tree });
  } catch (err) {
    console.error('Enhancements error:', err);
    res.status(500).json({ error: 'Failed to load enhancements' });
  }
});

// POST /api/gems/unlock — unlock an enhancement
router.post('/unlock', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { enhancement_id } = req.body;
  const enhancement = ENHANCEMENTS[enhancement_id];
  if (!enhancement) return res.status(400).json({ error: 'Unknown enhancement' });

  const provinceId = req.province.id;
  const gems = req.province.gems || 0;

  if (gems < enhancement.unlock_cost) {
    return res.status(400).json({ error: `Not enough gems (need ${enhancement.unlock_cost}, have ${gems})` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if already unlocked
    const { rows: existing } = await client.query(
      'SELECT id FROM gem_unlocks WHERE province_id = $1 AND enhancement_id = $2',
      [provinceId, enhancement_id]
    );
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already unlocked' });
    }

    // Check prerequisite
    if (enhancement.requires) {
      const { rows: prereq } = await client.query(
        'SELECT id FROM gem_unlocks WHERE province_id = $1 AND enhancement_id = $2',
        [provinceId, enhancement.requires]
      );
      if (!prereq.length) {
        await client.query('ROLLBACK');
        const prereqEnhancement = ENHANCEMENTS[enhancement.requires];
        return res.status(400).json({ error: `Requires "${prereqEnhancement?.name || enhancement.requires}" first` });
      }
    }

    // Deduct gems + record
    await client.query(
      'UPDATE provinces SET gems = gems - $1, updated_at = NOW() WHERE id = $2',
      [enhancement.unlock_cost, provinceId]
    );
    await client.query(
      'INSERT INTO gem_transactions (province_id, amount, reason) VALUES ($1, $2, $3)',
      [provinceId, -enhancement.unlock_cost, `Unlock: ${enhancement.name}`]
    );
    await client.query(
      'INSERT INTO gem_unlocks (province_id, enhancement_id) VALUES ($1, $2)',
      [provinceId, enhancement_id]
    );

    await client.query('COMMIT');
    res.json({ message: `Unlocked ${enhancement.name}`, gems: gems - enhancement.unlock_cost });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Gem unlock error:', err);
    res.status(500).json({ error: 'Failed to unlock enhancement' });
  } finally {
    client.release();
  }
});

// POST /api/gems/use — activate an unlocked enhancement
router.post('/use', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { enhancement_id } = req.body;
  const enhancement = ENHANCEMENTS[enhancement_id];
  if (!enhancement) return res.status(400).json({ error: 'Unknown enhancement' });

  const provinceId = req.province.id;
  const gems = req.province.gems || 0;

  if (gems < enhancement.use_cost) {
    return res.status(400).json({ error: `Not enough gems (need ${enhancement.use_cost}, have ${gems})` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify unlocked
    const { rows: unlock } = await client.query(
      'SELECT id FROM gem_unlocks WHERE province_id = $1 AND enhancement_id = $2',
      [provinceId, enhancement_id]
    );
    if (!unlock.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Enhancement not unlocked' });
    }

    // Check if already active (for duration-based buffs)
    if (enhancement.duration_hours) {
      const { rows: active } = await client.query(
        `SELECT id FROM gem_buffs WHERE province_id = $1 AND enhancement_id = $2 AND expires_at > NOW()`,
        [provinceId, enhancement_id]
      );
      if (active.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This enhancement is already active' });
      }
    }

    // Once-per-season check
    if (enhancement.once_per_season) {
      const { rows: used } = await client.query(
        `SELECT gb.id FROM gem_buffs gb
         JOIN provinces p ON p.id = gb.province_id
         JOIN ages a ON a.id = p.age_id AND a.is_active = true
         WHERE gb.province_id = $1 AND gb.enhancement_id = $2`,
        [provinceId, enhancement_id]
      );
      if (used.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This enhancement can only be used once per Season' });
      }
    }

    // Deduct gems
    await client.query(
      'UPDATE provinces SET gems = gems - $1, updated_at = NOW() WHERE id = $2',
      [enhancement.use_cost, provinceId]
    );
    await client.query(
      'INSERT INTO gem_transactions (province_id, amount, reason) VALUES ($1, $2, $3)',
      [provinceId, -enhancement.use_cost, `Use: ${enhancement.name}`]
    );

    // Create buff
    const expiresAt = enhancement.duration_hours
      ? new Date(Date.now() + enhancement.duration_hours * 3600000)
      : null;
    await client.query(
      'INSERT INTO gem_buffs (province_id, enhancement_id, expires_at) VALUES ($1, $2, $3)',
      [provinceId, enhancement_id, expiresAt]
    );

    await client.query('COMMIT');
    res.json({
      message: `${enhancement.name} activated${enhancement.duration_hours ? ` for ${enhancement.duration_hours} hours` : ''}!`,
      gems: gems - enhancement.use_cost,
      expires_at: expiresAt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Gem use error:', err);
    res.status(500).json({ error: 'Failed to use enhancement' });
  } finally {
    client.release();
  }
});

// GET /api/gems/buffs/active — all active buffs
router.get('/buffs/active', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT enhancement_id, expires_at, used_at FROM gem_buffs
       WHERE province_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY used_at DESC`,
      [req.province.id]
    );
    // Enrich with enhancement data
    const buffs = rows.map(r => ({
      ...r,
      name: ENHANCEMENTS[r.enhancement_id]?.name || r.enhancement_id,
      effect: ENHANCEMENTS[r.enhancement_id]?.effect || null,
    }));
    res.json(buffs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load active buffs' });
  }
});

module.exports = router;
