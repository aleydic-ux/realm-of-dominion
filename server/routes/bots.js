const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const { spawnSingleBot, respawnWipedBots } = require('../services/botEngine');

const router = express.Router();

// Admin guard: require Bearer token + ADMIN_SECRET env var match
function adminOnly(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET not configured' });
  if (header.slice(7) !== secret) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// GET /api/bots/status — list all active bots with last action info
router.get('/status', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.race, p.bot_personality, p.bot_aggression_level,
              p.land, p.gold, p.is_bot, p.bot_last_action_at, p.bot_spawn_at,
              p.action_points,
              a.name as age_name,
              (SELECT COUNT(*) FROM bot_action_log WHERE bot_id = p.id) as total_actions,
              (SELECT action_type FROM bot_action_log WHERE bot_id = p.id ORDER BY created_at DESC LIMIT 1) as last_action_type
       FROM provinces p
       JOIN ages a ON a.id = p.age_id
       WHERE p.is_bot = true
       ORDER BY p.bot_last_action_at DESC NULLS LAST`
    );
    res.json({ bots: rows, count: rows.length });
  } catch (err) {
    console.error('[admin/bots] status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bot status' });
  }
});

// POST /api/bots/spawn — spawn a new bot in the current active age
router.post('/spawn', adminOnly, async (req, res) => {
  try {
    const { personality = 'economic' } = req.body;
    const validPersonalities = ['passive', 'economic', 'aggressive', 'adaptive'];
    if (!validPersonalities.includes(personality)) {
      return res.status(400).json({ error: `Invalid personality. Must be one of: ${validPersonalities.join(', ')}` });
    }

    const { rows: [age] } = await pool.query(`SELECT id FROM ages WHERE is_active = true LIMIT 1`);
    if (!age) return res.status(400).json({ error: 'No active age found' });

    const botId = await spawnSingleBot(age.id, personality);
    const { rows: [bot] } = await pool.query('SELECT id, name, race, bot_personality FROM provinces WHERE id = $1', [botId]);
    res.status(201).json({ message: 'Bot spawned', bot });
  } catch (err) {
    console.error('[admin/bots] spawn error:', err.message);
    res.status(500).json({ error: 'Failed to spawn bot' });
  }
});

// POST /api/bots/reset/:id — respawn (reset) a specific bot to starting values
router.post('/reset/:id', adminOnly, async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    const { rows: [bot] } = await pool.query(
      `SELECT id, name, is_bot FROM provinces WHERE id = $1`, [botId]
    );
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    if (!bot.is_bot) return res.status(400).json({ error: 'Province is not a bot' });

    await pool.query(
      `UPDATE provinces SET
         land = 100, gold = 5000, food = 2000, mana = 500,
         industry_points = 1000, population = 500, morale = 100,
         action_points = 20, bot_spawn_at = NOW(), bot_last_action_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [botId]
    );
    await pool.query(
      `UPDATE province_troops SET count_home = 0, count_training = 0, count_deployed = 0,
         training_completes_at = NULL, updated_at = NOW()
       WHERE province_id = $1`,
      [botId]
    );
    res.json({ message: `Bot "${bot.name}" reset to starting values` });
  } catch (err) {
    console.error('[admin/bots] reset error:', err.message);
    res.status(500).json({ error: 'Failed to reset bot' });
  }
});

// DELETE /api/bots/:id — retire (delete) a bot province
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    const { rows: [bot] } = await pool.query(
      `SELECT id, name, is_bot FROM provinces WHERE id = $1`, [botId]
    );
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    if (!bot.is_bot) return res.status(400).json({ error: 'Province is not a bot' });

    await pool.query(`DELETE FROM provinces WHERE id = $1`, [botId]);
    res.json({ message: `Bot "${bot.name}" retired and removed` });
  } catch (err) {
    console.error('[admin/bots] delete error:', err.message);
    res.status(500).json({ error: 'Failed to retire bot' });
  }
});

// GET /api/bots/log/:id — view action log for a specific bot
router.get('/log/:id', adminOnly, async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT * FROM bot_action_log WHERE bot_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [botId, limit]
    );
    res.json({ bot_id: botId, actions: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bot log' });
  }
});

module.exports = router;
