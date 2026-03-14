const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall',
];
const RACE_BUILDINGS = {
  human: 'royal_bank',
  orc: 'warchief_pit',
  undead: 'crypt',
  elf: 'ancient_grove',
  dwarf: 'runic_forge',
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, province_name, race } = req.body;

  if (!username || !email || !password || !province_name || !race) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['human','orc','undead','elf','dwarf'].includes(race)) {
    return res.status(400).json({ error: 'Invalid race' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check uniqueness
    const existing = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    // Get active age
    const { rows: ages } = await client.query(
      'SELECT id FROM ages WHERE is_active = true LIMIT 1'
    );
    if (!ages.length) {
      await client.query('ROLLBACK');
      return res.status(503).json({ error: 'No active age. Game has not started yet.' });
    }
    const ageId = ages[0].id;

    // Create user
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, username, email`,
      [username, email, hash]
    );

    // Calculate late-join bonus
    const { rows: [activeAge] } = await client.query(
      'SELECT starts_at FROM ages WHERE id = $1', [ageId]
    );
    const msPerDay = 86400000;
    const daysLate = activeAge?.starts_at
      ? Math.floor((Date.now() - new Date(activeAge.starts_at).getTime()) / msPerDay)
      : 0;
    const joinedOnDay = daysLate + 1;
    const applyBonus = daysLate > 0 && daysLate <= 4;

    // Create province with 24-hour newbie shield
    const protectionEndsAt = new Date(Date.now() + parseInt(process.env.NEWBIE_PROTECTION_HOURS || 24) * 3600000);
    const { rows: [province] } = await client.query(
      `INSERT INTO provinces (user_id, age_id, name, race, protection_ends_at, joined_on_day, late_join_bonus_applied, late_join_bonus_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [user.id, ageId, province_name, race, protectionEndsAt, joinedOnDay, applyBonus, applyBonus ? new Date() : null]
    );

    // Apply late-join resource bonus (gold, food, mana, industry_points, population, gems)
    let lateJoinBonus = null;
    if (applyBonus) {
      lateJoinBonus = {
        gold: daysLate * 8000,
        food: daysLate * 2500,
        mana: daysLate * 1500,
        industry_points: daysLate * 3000,
        population: daysLate * 150,
        gems: daysLate * 3,
      };
      await client.query(
        `UPDATE provinces SET
           gold = gold + $1, food = food + $2, mana = mana + $3,
           industry_points = industry_points + $4, population = population + $5,
           gems = gems + $6,
           updated_at = NOW()
         WHERE id = $7`,
        [lateJoinBonus.gold, lateJoinBonus.food, lateJoinBonus.mana,
         lateJoinBonus.industry_points, lateJoinBonus.population, lateJoinBonus.gems, province.id]
      );
    }

    // Init buildings (universal + race-specific)
    const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]];
    for (const bt of buildingTypes) {
      await client.query(
        'INSERT INTO province_buildings (province_id, building_type) VALUES ($1, $2)',
        [province.id, bt]
      );
    }

    // Init troops (only this race's troop types)
    const { rows: troopTypes } = await client.query(
      'SELECT id FROM troop_types WHERE race = $1', [race]
    );
    for (const tt of troopTypes) {
      await client.query(
        'INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1, $2)',
        [province.id, tt.id]
      );
    }

    await client.query('COMMIT');

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({
      token, user: { id: user.id, username, email }, province_id: province.id,
      late_join: applyBonus ? { joined_on_day: joinedOnDay, days_late: daysLate, bonus: lateJoinBonus } : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash, is_active FROM users WHERE username = $1',
      [username]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  // JWT is stateless; client should discard the token
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [userResult, provinceResult] = await Promise.all([
      pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id]),
      pool.query(
        `SELECT p.id, p.name, p.race, p.land, p.gold, p.food, p.mana, p.industry_points,
                p.population, p.morale, p.action_points, p.networth, p.protection_ends_at,
                a.name as age_name
         FROM provinces p
         JOIN ages a ON a.id = p.age_id
         WHERE p.user_id = $1 AND a.is_active = true`,
        [req.user.id]
      ),
    ]);
    if (!userResult.rows.length) return res.status(401).json({ error: 'User not found' });
    res.json({ user: userResult.rows[0], province: provinceResult.rows[0] || null });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to load user data' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  // Always return the same response to prevent user enumeration
  const generic = { message: "If that email exists, a reset link has been sent." };

  if (!email) return res.json(generic);

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (rows.length) {
      const user = rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      sendPasswordResetEmail(email, rawToken).catch(err =>
        console.error('[forgot-password] Email send failed:', err.message)
      );
    }
    res.json(generic);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json(generic);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }
    const { id: tokenId, user_id } = rows[0];
    const newHash = await bcrypt.hash(password, 12);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Reset failed. Please try again.' });
  }
});

module.exports = router;
