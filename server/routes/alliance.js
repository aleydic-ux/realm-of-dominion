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
      `SELECT am.rank, am.joined_at, am.chat_muted_until, p.id, p.name, p.race, p.land, p.networth
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
      `SELECT m.id, m.body, m.sent_at, p.name as sender_name, p.race as sender_race, p.id as sender_province_id
       FROM messages m
       JOIN provinces p ON p.id = m.sender_province_id
       WHERE m.alliance_id = $1 AND m.deleted = false
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
    `SELECT rank, chat_muted_until FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
    [req.params.id, req.province.id]
  );
  if (!myMembership.length) return res.status(403).json({ error: 'Not a member of this alliance' });

  // Check mute status
  if (myMembership[0].chat_muted_until && new Date(myMembership[0].chat_muted_until) > new Date()) {
    return res.status(403).json({ error: 'You are muted in this alliance chat' });
  }

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

// DELETE /api/alliances/:id/chat/:msgId — officer/leader soft-deletes a message
router.delete('/:id/chat/:msgId', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [req.params.id, req.province.id]
  );
  if (!me || !['leader', 'officer'].includes(me.rank)) {
    return res.status(403).json({ error: 'Only officers can delete messages' });
  }
  try {
    await pool.query('UPDATE messages SET deleted = true WHERE id = $1 AND alliance_id = $2', [parseInt(req.params.msgId), parseInt(req.params.id)]);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/alliances/:id/mute — officer/leader mutes a member (hours=0 = unmute)
router.post('/:id/mute', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const allianceId = parseInt(req.params.id);
  const { target_province_id, hours = 1 } = req.body;
  if (!target_province_id) return res.status(400).json({ error: 'target_province_id required' });
  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [allianceId, req.province.id]
  );
  if (!me || !['leader', 'officer'].includes(me.rank)) {
    return res.status(403).json({ error: 'Only officers can mute members' });
  }
  try {
    const muteUntil = hours > 0 ? new Date(Date.now() + hours * 3600000) : null;
    await pool.query(
      'UPDATE alliance_members SET chat_muted_until = $1 WHERE alliance_id = $2 AND province_id = $3',
      [muteUntil, allianceId, parseInt(target_province_id)]
    );
    res.json({ message: hours > 0 ? `Muted for ${hours}h` : 'Unmuted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mute member' });
  }
});

// ─── Alliance buff definitions ────────────────────────────────────────────────
const ALLIANCE_BUFFS = {
  gold_rush: {
    name: 'Gold Rush',
    description: '+15% gold income for all members for 24 hours',
    cost: 5000,
    durationHours: 24,
    modifier_key: 'gold_income_pct',
    modifier_value: 0.15,
  },
  war_drums: {
    name: 'War Drums',
    description: '+20% troop attack for all members for 12 hours',
    cost: 8000,
    durationHours: 12,
    modifier_key: 'attack_pct',
    modifier_value: 0.20,
  },
  iron_pact: {
    name: 'Iron Pact',
    description: '+20% troop defense for all members for 12 hours',
    cost: 8000,
    durationHours: 12,
    modifier_key: 'defense_pct',
    modifier_value: 0.20,
  },
  scholars_call: {
    name: "Scholar's Call",
    description: '+25% research speed for all members for 48 hours',
    cost: 6000,
    durationHours: 48,
    modifier_key: 'research_speed_pct',
    modifier_value: 0.25,
  },
};

// POST /api/alliances/:id/leave — leave an alliance
router.post('/:id/leave', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const allianceId = parseInt(req.params.id);
  const provinceId = req.province.id;

  try {
    const { rows: [membership] } = await pool.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [allianceId, provinceId]
    );
    if (!membership) return res.status(403).json({ error: 'Not a member of this alliance' });

    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) as count FROM alliance_members WHERE alliance_id = $1',
      [allianceId]
    );

    if (membership.rank === 'leader' && parseInt(count) > 1) {
      return res.status(400).json({ error: 'Transfer leadership before leaving' });
    }

    await pool.query(
      'DELETE FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [allianceId, provinceId]
    );
    await pool.query('UPDATE provinces SET is_in_war = false WHERE id = $1', [provinceId]);

    // Disband if last member
    if (parseInt(count) <= 1) {
      await pool.query('DELETE FROM alliances WHERE id = $1', [allianceId]);
    }

    res.json({ message: 'Left alliance' });
  } catch (err) {
    console.error('Leave alliance error:', err);
    res.status(500).json({ error: 'Failed to leave alliance' });
  }
});

// POST /api/alliances/:id/promote — promote member to officer
router.post('/:id/promote', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { province_id } = req.body;
  if (!province_id) return res.status(400).json({ error: 'province_id required' });

  try {
    const { rows: [me] } = await pool.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [req.params.id, req.province.id]
    );
    if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can promote' });

    const { rows: [target] } = await pool.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [req.params.id, province_id]
    );
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Cannot promote the leader' });

    await pool.query(
      "UPDATE alliance_members SET rank = 'officer' WHERE alliance_id = $1 AND province_id = $2",
      [req.params.id, province_id]
    );
    res.json({ message: 'Member promoted to officer' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote' });
  }
});

// POST /api/alliances/:id/demote — demote officer to member
router.post('/:id/demote', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { province_id } = req.body;
  if (!province_id) return res.status(400).json({ error: 'province_id required' });

  try {
    const { rows: [me] } = await pool.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [req.params.id, req.province.id]
    );
    if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can demote' });

    await pool.query(
      "UPDATE alliance_members SET rank = 'member' WHERE alliance_id = $1 AND province_id = $2",
      [req.params.id, province_id]
    );
    res.json({ message: 'Member demoted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to demote' });
  }
});

// POST /api/alliances/:id/transfer-leader — transfer leadership to a member
router.post('/:id/transfer-leader', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { province_id } = req.body;
  if (!province_id) return res.status(400).json({ error: 'province_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [me] } = await client.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [req.params.id, req.province.id]
    );
    if (!me || me.rank !== 'leader') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only leader can transfer leadership' });
    }
    const { rows: [target] } = await client.query(
      'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
      [req.params.id, province_id]
    );
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target member not found' });
    }
    await client.query(
      "UPDATE alliance_members SET rank = 'officer' WHERE alliance_id = $1 AND province_id = $2",
      [req.params.id, req.province.id]
    );
    await client.query(
      "UPDATE alliance_members SET rank = 'leader' WHERE alliance_id = $1 AND province_id = $2",
      [req.params.id, province_id]
    );
    await client.query(
      'UPDATE alliances SET leader_province_id = $1, updated_at = NOW() WHERE id = $2',
      [province_id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Leadership transferred' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to transfer leadership' });
  } finally {
    client.release();
  }
});

// POST /api/alliances/:id/peace — end all wars for this alliance
router.post('/:id/peace', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [req.params.id, req.province.id]
  );
  if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can sue for peace' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: enemies } = await client.query(
      "SELECT target_alliance_id FROM alliance_diplomacy WHERE alliance_id = $1 AND status = 'war'",
      [req.params.id]
    );
    const { rows: enemies2 } = await client.query(
      "SELECT alliance_id as target_alliance_id FROM alliance_diplomacy WHERE target_alliance_id = $1 AND status = 'war'",
      [req.params.id]
    );
    const allEnemyIds = [...enemies, ...enemies2].map(r => r.target_alliance_id);
    const allIds = [parseInt(req.params.id), ...allEnemyIds];

    await client.query('UPDATE alliances SET is_at_war = false, updated_at = NOW() WHERE id = ANY($1)', [allIds]);
    await client.query(
      'UPDATE provinces SET is_in_war = false WHERE id IN (SELECT province_id FROM alliance_members WHERE alliance_id = ANY($1))',
      [allIds]
    );
    await client.query(
      "UPDATE alliance_diplomacy SET status = 'peace', updated_at = NOW() WHERE alliance_id = $1 OR target_alliance_id = $1",
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Peace declared — all wars ended' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Peace error:', err);
    res.status(500).json({ error: 'Failed to declare peace' });
  } finally {
    client.release();
  }
});

// POST /api/alliances/:id/nap/:target_id — establish Non-Aggression Pact (48h)
router.post('/:id/nap/:target_id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const allianceId = parseInt(req.params.id);
  const targetId = parseInt(req.params.target_id);

  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [allianceId, req.province.id]
  );
  if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can set NAP' });
  if (allianceId === targetId) return res.status(400).json({ error: 'Cannot NAP yourself' });

  const { rows: [target] } = await pool.query('SELECT id FROM alliances WHERE id = $1', [targetId]);
  if (!target) return res.status(404).json({ error: 'Target alliance not found' });

  const expiresAt = new Date(Date.now() + 48 * 3600000);
  try {
    await pool.query(
      `INSERT INTO alliance_diplomacy (alliance_id, target_alliance_id, status, expires_at)
       VALUES ($1, $2, 'nap', $3), ($2, $1, 'nap', $3)
       ON CONFLICT (alliance_id, target_alliance_id) DO UPDATE
       SET status = 'nap', expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [allianceId, targetId, expiresAt]
    );
    res.json({ message: 'Non-Aggression Pact established for 48 hours', expires_at: expiresAt });
  } catch (err) {
    console.error('NAP error:', err);
    res.status(500).json({ error: 'Failed to establish NAP' });
  }
});

// POST /api/alliances/:id/declare-war/:target_id — declare war + record in alliance_diplomacy
router.post('/:id/declare-war/:target_id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const allianceId = parseInt(req.params.id);
  const targetId = parseInt(req.params.target_id);

  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [allianceId, req.province.id]
  );
  if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can declare war' });
  if (allianceId === targetId) return res.status(400).json({ error: 'Cannot declare war on yourself' });

  const { rows: [targetAlliance] } = await pool.query('SELECT id FROM alliances WHERE id = $1', [targetId]);
  if (!targetAlliance) return res.status(404).json({ error: 'Target alliance not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE alliances SET is_at_war = true, updated_at = NOW() WHERE id = $1 OR id = $2',
      [allianceId, targetId]
    );
    await client.query(
      'UPDATE provinces SET is_in_war = true WHERE id IN (SELECT province_id FROM alliance_members WHERE alliance_id = $1 OR alliance_id = $2)',
      [allianceId, targetId]
    );
    await client.query(
      `UPDATE provinces SET protection_ends_at = NOW()
       WHERE id IN (SELECT province_id FROM alliance_members WHERE alliance_id = $1 OR alliance_id = $2)
         AND protection_ends_at > NOW()`,
      [allianceId, targetId]
    );
    await client.query(
      `INSERT INTO alliance_diplomacy (alliance_id, target_alliance_id, status)
       VALUES ($1, $2, 'war'), ($2, $1, 'war')
       ON CONFLICT (alliance_id, target_alliance_id) DO UPDATE SET status = 'war', updated_at = NOW()`,
      [allianceId, targetId]
    );
    await client.query('COMMIT');
    res.json({ message: 'War declared' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Declare war error:', err);
    res.status(500).json({ error: 'Failed to declare war' });
  } finally {
    client.release();
  }
});

// GET /api/alliances/:id/buffs — active buffs + purchasable catalogue
router.get('/:id/buffs', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows: activeBuffs } = await pool.query(
      `SELECT buff_key, buff_name, expires_at FROM alliance_buffs
       WHERE alliance_id = $1 AND expires_at > NOW() ORDER BY expires_at DESC`,
      [req.params.id]
    );
    const catalogue = Object.entries(ALLIANCE_BUFFS).map(([key, b]) => ({
      key, name: b.name, description: b.description,
      cost: b.cost, duration_hours: b.durationHours,
    }));
    res.json({ active: activeBuffs, catalogue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load buffs' });
  }
});

// POST /api/alliances/:id/buff — purchase an alliance buff from bank
router.post('/:id/buff', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const { buff_key } = req.body;
  if (!buff_key) return res.status(400).json({ error: 'buff_key required' });

  const buffDef = ALLIANCE_BUFFS[buff_key];
  if (!buffDef) return res.status(400).json({ error: 'Unknown buff' });

  const { rows: [me] } = await pool.query(
    'SELECT rank FROM alliance_members WHERE alliance_id = $1 AND province_id = $2',
    [req.params.id, req.province.id]
  );
  if (!me || me.rank !== 'leader') return res.status(403).json({ error: 'Only leader can purchase buffs' });

  const { rows: [alliance] } = await pool.query(
    'SELECT bank_gold FROM alliances WHERE id = $1', [req.params.id]
  );
  if (!alliance) return res.status(404).json({ error: 'Alliance not found' });
  if (alliance.bank_gold < buffDef.cost) {
    return res.status(400).json({ error: `Not enough gold in bank (need ${buffDef.cost.toLocaleString()})` });
  }

  const expiresAt = new Date(Date.now() + buffDef.durationHours * 3600000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE alliances SET bank_gold = bank_gold - $1, updated_at = NOW() WHERE id = $2',
      [buffDef.cost, req.params.id]
    );
    await client.query(
      'INSERT INTO alliance_buffs (alliance_id, buff_key, buff_name, expires_at) VALUES ($1, $2, $3, $4)',
      [req.params.id, buff_key, buffDef.name, expiresAt]
    );

    // Apply to every current member via active_effects
    const { rows: members } = await client.query(
      'SELECT province_id FROM alliance_members WHERE alliance_id = $1', [req.params.id]
    );
    for (const { province_id } of members) {
      await client.query(
        `INSERT INTO active_effects
           (province_id, item_key, effect_type, modifier_key, modifier_value, stacks, expires_at)
         VALUES ($1, $2, 'alliance_buff', $3, $4, 1, $5)`,
        [province_id, `alliance_${buff_key}`, buffDef.modifier_key, buffDef.modifier_value, expiresAt]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `${buffDef.name} activated!`, expires_at: expiresAt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buff purchase error:', err);
    res.status(500).json({ error: 'Failed to purchase buff' });
  } finally {
    client.release();
  }
});

module.exports = router;
