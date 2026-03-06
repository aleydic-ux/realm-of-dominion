const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');

const router = express.Router();

router.use(authenticate, apRegen);

// POST /api/alliances - Create alliance
router.post('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: 'Alliance name required' });

  // Check if already in an alliance
  const { rows: existing } = await pool.query(
    'SELECT am.alliance_id FROM alliance_members am WHERE am.province_id = $1', [province.id]
  );
  if (existing.length) return res.status(400).json({ error: 'Already in an alliance' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [age] } = await client.query('SELECT id FROM ages WHERE is_active = true LIMIT 1');
    if (!age) {
      await client.query('ROLLBACK');
      return res.status(503).json({ error: 'No active age' });
    }

    const { rows: [alliance] } = await client.query(
      `INSERT INTO alliances (name, leader_province_id, age_id) VALUES ($1, $2, $3) RETURNING id`,
      [name, province.id, age.id]
    );

    await client.query(
      `INSERT INTO alliance_members (alliance_id, province_id, rank) VALUES ($1, $2, 'leader')`,
      [alliance.id, province.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Alliance created', alliance_id: alliance.id });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Alliance name already taken' });
    console.error('Create alliance error:', err);
    res.status(500).json({ error: 'Failed to create alliance' });
  } finally {
    client.release();
  }
});

// GET /api/alliances/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows: [alliance] } = await pool.query(
      `SELECT a.*, p.name as leader_name FROM alliances a
       JOIN provinces p ON p.id = a.leader_province_id WHERE a.id = $1`, [req.params.id]
    );
    if (!alliance) return res.status(404).json({ error: 'Alliance not found' });

    const { rows: members } = await pool.query(
      `SELECT am.rank, am.joined_at, p.id, p.name, p.race, p.land, p.networth
       FROM alliance_members am
       JOIN provinces p ON p.id = am.province_id
       WHERE am.alliance_id = $1 ORDER BY am.rank, p.networth DESC`, [req.params.id]
    );

    res.json({ alliance, members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load alliance' });
  }
});

// POST /api/alliances/:id/invite
router.post('/:id/invite', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { target_province_id } = req.body;
  if (!target_province_id) return res.status(400).json({ error: 'target_province_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify caller is leader or officer
    const { rows: myMembership } = await client.query(
      `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
      [req.params.id, req.province.id]
    );
    if (!myMembership.length || !['leader','officer'].includes(myMembership[0].rank)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only leaders/officers can invite' });
    }

    // Check alliance size
    const { rows: sizeRows } = await client.query(
      `SELECT COUNT(*) as count FROM alliance_members WHERE alliance_id = $1`, [req.params.id]
    );
    const { rows: [alliance] } = await client.query('SELECT max_members FROM alliances WHERE id = $1', [req.params.id]);
    if (parseInt(sizeRows[0].count) >= alliance.max_members) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Alliance is full (max 12 members)' });
    }

    // Check target not already in alliance
    const { rows: targetMembership } = await client.query(
      `SELECT alliance_id FROM alliance_members WHERE province_id = $1`, [target_province_id]
    );
    if (targetMembership.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Target province is already in an alliance' });
    }

    await client.query(
      `INSERT INTO alliance_members (alliance_id, province_id, rank) VALUES ($1, $2, 'member')`,
      [req.params.id, target_province_id]
    );

    // Drop newbie protection if joining war alliance
    const { rows: [allianceData] } = await client.query('SELECT is_at_war FROM alliances WHERE id = $1', [req.params.id]);
    if (allianceData.is_at_war) {
      await client.query('UPDATE provinces SET protection_ends_at = NOW() WHERE id = $1', [target_province_id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Province invited to alliance' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to invite' });
  } finally {
    client.release();
  }
});

// POST /api/alliances/:id/kick
router.post('/:id/kick', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { target_province_id } = req.body;
  if (!target_province_id) return res.status(400).json({ error: 'target_province_id required' });

  try {
    const { rows: myMembership } = await pool.query(
      `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
      [req.params.id, req.province.id]
    );
    if (!myMembership.length || !['leader','officer'].includes(myMembership[0].rank)) {
      return res.status(403).json({ error: 'Only leaders/officers can kick' });
    }

    const { rows: targetMembership } = await pool.query(
      `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
      [req.params.id, target_province_id]
    );
    if (!targetMembership.length) return res.status(404).json({ error: 'Member not found' });
    if (targetMembership[0].rank === 'leader') return res.status(403).json({ error: 'Cannot kick the leader' });

    await pool.query(
      `DELETE FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
      [req.params.id, target_province_id]
    );

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// POST /api/alliances/:id/deposit
router.post('/:id/deposit', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' });

  const { rows: myMembership } = await pool.query(
    `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length) return res.status(403).json({ error: 'Not a member of this alliance' });

  if (req.province.gold < amount) return res.status(400).json({ error: 'Not enough gold' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE provinces SET gold = gold - $1, updated_at = NOW() WHERE id = $2`,
      [amount, req.province.id]
    );
    await client.query(
      `UPDATE alliances SET bank_gold = bank_gold + $1, updated_at = NOW() WHERE id = $2`,
      [amount, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ message: `Deposited ${amount} gold to alliance bank` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to deposit' });
  } finally {
    client.release();
  }
});

// POST /api/alliances/:id/withdraw
router.post('/:id/withdraw', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { amount, target_province_id } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' });

  const { rows: myMembership } = await pool.query(
    `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length || myMembership[0].rank !== 'leader') {
    return res.status(403).json({ error: 'Only leader can withdraw' });
  }

  const { rows: [alliance] } = await pool.query('SELECT bank_gold FROM alliances WHERE id = $1', [req.params.id]);
  if (alliance.bank_gold < amount) return res.status(400).json({ error: 'Not enough gold in alliance bank' });

  const recipientId = target_province_id || req.province.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE alliances SET bank_gold = bank_gold - $1, updated_at = NOW() WHERE id = $2`,
      [amount, req.params.id]
    );
    await client.query(
      `UPDATE provinces SET gold = gold + $1, updated_at = NOW() WHERE id = $2`,
      [amount, recipientId]
    );
    await client.query('COMMIT');
    res.json({ message: `Withdrew ${amount} gold from alliance bank` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to withdraw' });
  } finally {
    client.release();
  }
});

// POST /api/alliances/:id/war/:target_id
router.post('/:id/war/:target_id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });

  const { rows: myMembership } = await pool.query(
    `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length || myMembership[0].rank !== 'leader') {
    return res.status(403).json({ error: 'Only leader can declare war' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE alliances SET is_at_war = true, updated_at = NOW() WHERE id = $1 OR id = $2`,
      [req.params.id, req.params.target_id]
    );
    await client.query(
      `UPDATE provinces p SET is_in_war = true WHERE p.id IN (
        SELECT province_id FROM alliance_members WHERE alliance_id = $1 OR alliance_id = $2
      )`,
      [req.params.id, req.params.target_id]
    );
    // Drop newbie shield for all war alliance members
    await client.query(
      `UPDATE provinces SET protection_ends_at = NOW() WHERE id IN (
        SELECT province_id FROM alliance_members WHERE alliance_id = $1 OR alliance_id = $2
      ) AND protection_ends_at > NOW()`,
      [req.params.id, req.params.target_id]
    );
    await client.query('COMMIT');
    res.json({ message: 'War declared' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to declare war' });
  } finally {
    client.release();
  }
});

// GET /api/alliances/:id/chat
router.get('/:id/chat', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });

  const { rows: myMembership } = await pool.query(
    `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length) return res.status(403).json({ error: 'Not a member of this alliance' });

  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.body, m.sent_at, p.name as sender_name, p.race as sender_race
       FROM messages m
       JOIN provinces p ON p.id = m.sender_province_id
       WHERE m.alliance_id = $1
       ORDER BY m.sent_at DESC LIMIT 50`, [req.params.id]
    );
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

// POST /api/alliances/:id/chat
router.post('/:id/chat', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

  const { rows: myMembership } = await pool.query(
    `SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length) return res.status(403).json({ error: 'Not a member of this alliance' });

  try {
    const { rows: [msg] } = await pool.query(
      `INSERT INTO messages (alliance_id, sender_province_id, body) VALUES ($1, $2, $3) RETURNING id, sent_at`,
      [req.params.id, req.province.id, body.trim().slice(0, 2000)]
    );

    // Emit via Socket.io (handled in index.js via req.app.get('io'))
    const io = req.app.get('io');
    if (io) {
      io.to(`alliance_${req.params.id}`).emit('chat_message', {
        id: msg.id,
        body: body.trim(),
        sent_at: msg.sent_at,
        sender_name: req.province.name,
        sender_race: req.province.race,
      });
    }

    res.status(201).json({ message: 'Message sent', id: msg.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
