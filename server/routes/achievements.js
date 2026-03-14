const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { ACHIEVEMENTS } = require('../services/achievementEngine');

const router = express.Router();
router.use(authenticate, apRegen);

// GET /api/achievements — all achievements + unlock status + progress for current player
router.get('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const provinceId = req.province.id;
  try {
    const [unlockedRes, statsRes, provinceRes] = await Promise.all([
      pool.query(
        'SELECT achievement_key, unlocked_at FROM user_achievements WHERE province_id = $1',
        [provinceId]
      ),
      pool.query('SELECT * FROM user_stats WHERE province_id = $1', [provinceId]),
      pool.query('SELECT land, gold, mana FROM provinces WHERE id = $1', [provinceId]),
    ]);

    const unlocked = {};
    for (const row of unlockedRes.rows) {
      unlocked[row.achievement_key] = row.unlocked_at;
    }
    const stats = statsRes.rows[0] || {};
    const province = provinceRes.rows[0] || {};

    const achievements = ACHIEVEMENTS.map(ach => {
      const unlockedAt = unlocked[ach.key] || null;
      let progress = null;
      if (!unlockedAt && ach.progress) {
        progress = ach.progress({ stats, province });
      }
      return {
        key: ach.key,
        name: ach.name,
        description: ach.description,
        category: ach.category,
        icon: ach.icon,
        unlocked_at: unlockedAt,
        progress,
      };
    });

    res.json({ achievements, stats });
  } catch (err) {
    console.error('Achievements error:', err);
    res.status(500).json({ error: 'Failed to load achievements' });
  }
});

module.exports = router;
