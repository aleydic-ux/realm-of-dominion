const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/leaderboard - Overall, military, economic, alliance rankings
router.get('/', async (req, res) => {
  try {
    // Overall networth — LEFT JOIN so bots (null user_id) are included
    const { rows: overall } = await pool.query(
      `SELECT p.id, p.name, p.networth, p.morale,
              p.is_bot, COALESCE(u.username, '[BOT]') as username,
              a.name as alliance_name
       FROM provinces p
       LEFT JOIN users u ON u.id = p.user_id
       JOIN ages ag ON ag.id = p.age_id AND ag.is_active = true
       LEFT JOIN alliance_members am ON am.province_id = p.id
       LEFT JOIN alliances a ON a.id = am.alliance_id
       ORDER BY p.networth DESC
       LIMIT 50`
    );

    // Military score: successful attacks — LEFT JOIN for bots
    const { rows: military } = await pool.query(
      `SELECT p.id, p.name, p.is_bot,
              COALESCE(u.username, '[BOT]') as username,
              COUNT(a.id) as successful_attacks,
              SUM(a.land_gained) as total_land_gained
       FROM provinces p
       LEFT JOIN users u ON u.id = p.user_id
       JOIN ages ag ON ag.id = p.age_id AND ag.is_active = true
       LEFT JOIN attacks a ON a.attacker_province_id = p.id AND a.outcome = 'win'
       GROUP BY p.id, p.name, p.is_bot, u.username
       ORDER BY successful_attacks DESC NULLS LAST
       LIMIT 50`
    );

    // Economic score: marketplace volume — LEFT JOIN for bots
    const { rows: economic } = await pool.query(
      `SELECT p.id, p.name, p.is_bot,
              COALESCE(u.username, '[BOT]') as username,
              COALESCE(SUM(ml.quantity * ml.price_per_unit), 0) as marketplace_volume,
              p.gold
       FROM provinces p
       LEFT JOIN users u ON u.id = p.user_id
       JOIN ages ag ON ag.id = p.age_id AND ag.is_active = true
       LEFT JOIN marketplace_listings ml ON ml.seller_province_id = p.id AND ml.is_sold = true
       GROUP BY p.id, p.name, p.is_bot, u.username, p.gold
       ORDER BY marketplace_volume DESC NULLS LAST
       LIMIT 50`
    );

    // Alliance score: sum of member networths
    const { rows: allianceRanks } = await pool.query(
      `SELECT al.id, al.name, COUNT(am.province_id) as member_count,
              SUM(p.networth) as total_networth
       FROM alliances al
       JOIN alliance_members am ON am.alliance_id = al.id
       JOIN provinces p ON p.id = am.province_id
       JOIN ages ag ON ag.id = al.age_id AND ag.is_active = true
       GROUP BY al.id, al.name
       ORDER BY total_networth DESC
       LIMIT 20`
    );

    res.json({ overall, military, economic, alliances: allianceRanks });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// GET /api/leaderboard/hall-of-fame - Past ages
router.get('/hall-of-fame', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT hf.*, a.name as age_name
       FROM hall_of_fame hf
       JOIN ages a ON a.id = hf.age_id
       ORDER BY hf.age_id DESC, hf.rank ASC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load hall of fame' });
  }
});

module.exports = router;
