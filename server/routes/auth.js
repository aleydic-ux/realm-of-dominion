const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

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

    // Create province with 12-hour newbie shield
    const protectionEndsAt = new Date(Date.now() + parseInt(process.env.NEWBIE_PROTECTION_HOURS || 12) * 3600000);
    const { rows: [province] } = await client.query(
      `INSERT INTO provinces (user_id, age_id, name, race, protection_ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, ageId, province_name, race, protectionEndsAt]
    );

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

    res.status(201).json({ token, user: { id: user.id, username, email }, province_id: province.id });
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
        `SELECT p.id, p.name, p.race, p.land, p.gold, p.food, p.mana, p.production_points,
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

module.exports = router;
