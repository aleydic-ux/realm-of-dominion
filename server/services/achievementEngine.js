const pool = require('../config/db');

// Static achievement definitions
const ACHIEVEMENTS = [
  // ─── Combat ───────────────────────────────────────────────────────────────
  {
    key: 'first_blood',
    name: 'First Blood',
    description: 'Win your first battle',
    category: 'Combat',
    icon: '⚔️',
    events: ['attack_won'],
    check: ({ stats }) => (stats.attacks_won || 0) >= 1,
  },
  {
    key: 'warlord',
    name: 'Warlord',
    description: 'Win 10 battles',
    category: 'Combat',
    icon: '🗡️',
    events: ['attack_won'],
    check: ({ stats }) => (stats.attacks_won || 0) >= 10,
    progress: ({ stats }) => ({ current: stats.attacks_won || 0, max: 10 }),
  },
  {
    key: 'conqueror',
    name: 'Conqueror',
    description: 'Win 50 battles',
    category: 'Combat',
    icon: '👑',
    events: ['attack_won'],
    check: ({ stats }) => (stats.attacks_won || 0) >= 50,
    progress: ({ stats }) => ({ current: stats.attacks_won || 0, max: 50 }),
  },
  {
    key: 'defender',
    name: 'Iron Shield',
    description: 'Repel 5 attacks',
    category: 'Combat',
    icon: '🛡️',
    events: ['attack_defended'],
    check: ({ stats }) => (stats.attacks_defended || 0) >= 5,
    progress: ({ stats }) => ({ current: stats.attacks_defended || 0, max: 5 }),
  },
  {
    key: 'land_grabber',
    name: 'Land Grabber',
    description: 'Conquer 500 acres through attacks',
    category: 'Combat',
    icon: '🏔️',
    events: ['attack_won'],
    check: ({ stats }) => (stats.land_conquered || 0) >= 500,
    progress: ({ stats }) => ({ current: stats.land_conquered || 0, max: 500 }),
  },
  {
    key: 'pillager',
    name: 'Pillager',
    description: 'Plunder 50,000 gold in total',
    category: 'Combat',
    icon: '💰',
    events: ['attack_won'],
    check: ({ stats }) => (stats.gold_plundered || 0) >= 50000,
    progress: ({ stats }) => ({ current: stats.gold_plundered || 0, max: 50000 }),
  },

  // ─── Growth ───────────────────────────────────────────────────────────────
  {
    key: 'landlord',
    name: 'Landlord',
    description: 'Reach 500 acres',
    category: 'Growth',
    icon: '🌿',
    events: ['attack_won', 'explore'],
    check: ({ province }) => (province.land || 0) >= 500,
    progress: ({ province }) => ({ current: Math.min(province.land || 0, 500), max: 500 }),
  },
  {
    key: 'domain',
    name: 'Domain',
    description: 'Reach 1,000 acres',
    category: 'Growth',
    icon: '🏰',
    events: ['attack_won', 'explore'],
    check: ({ province }) => (province.land || 0) >= 1000,
    progress: ({ province }) => ({ current: Math.min(province.land || 0, 1000), max: 1000 }),
  },
  {
    key: 'vast_empire',
    name: 'Vast Empire',
    description: 'Reach 2,500 acres',
    category: 'Growth',
    icon: '🌍',
    events: ['attack_won', 'explore'],
    check: ({ province }) => (province.land || 0) >= 2500,
    progress: ({ province }) => ({ current: Math.min(province.land || 0, 2500), max: 2500 }),
  },
  {
    key: 'wealthy',
    name: 'Wealthy Province',
    description: 'Accumulate 50,000 gold at once',
    category: 'Growth',
    icon: '💎',
    events: ['resource_check'],
    check: ({ province }) => (province.gold || 0) >= 50000,
  },

  // ─── Research ─────────────────────────────────────────────────────────────
  {
    key: 'scholar',
    name: 'Scholar',
    description: 'Complete your first research',
    category: 'Research',
    icon: '📚',
    events: ['research_complete'],
    check: ({ stats }) => (stats.research_completed || 0) >= 1,
  },
  {
    key: 'enlightened',
    name: 'Enlightened',
    description: 'Complete 5 researches',
    category: 'Research',
    icon: '🔬',
    events: ['research_complete'],
    check: ({ stats }) => (stats.research_completed || 0) >= 5,
    progress: ({ stats }) => ({ current: stats.research_completed || 0, max: 5 }),
  },
  {
    key: 'arcane_mastery',
    name: 'Arcane Mastery',
    description: 'Complete 10 researches',
    category: 'Research',
    icon: '✨',
    events: ['research_complete'],
    check: ({ stats }) => (stats.research_completed || 0) >= 10,
    progress: ({ stats }) => ({ current: stats.research_completed || 0, max: 10 }),
  },

  // ─── Military ─────────────────────────────────────────────────────────────
  {
    key: 'commander',
    name: 'Commander',
    description: 'Train 100 troops',
    category: 'Military',
    icon: '⚔️',
    events: ['troops_trained'],
    check: ({ stats }) => (stats.troops_trained || 0) >= 100,
    progress: ({ stats }) => ({ current: Math.min(stats.troops_trained || 0, 100), max: 100 }),
  },
  {
    key: 'legion',
    name: 'Legion',
    description: 'Train 1,000 troops',
    category: 'Military',
    icon: '🪖',
    events: ['troops_trained'],
    check: ({ stats }) => (stats.troops_trained || 0) >= 1000,
    progress: ({ stats }) => ({ current: Math.min(stats.troops_trained || 0, 1000), max: 1000 }),
  },

  // ─── Buildings ────────────────────────────────────────────────────────────
  {
    key: 'builder',
    name: 'Builder',
    description: 'Upgrade any building to level 5',
    category: 'Buildings',
    icon: '🏗️',
    events: ['building_upgraded'],
    check: ({ eventData }) => (eventData.level || 0) >= 5,
  },
  {
    key: 'master_builder',
    name: 'Master Builder',
    description: 'Upgrade any building to level 10',
    category: 'Buildings',
    icon: '🏯',
    events: ['building_upgraded'],
    check: ({ eventData }) => (eventData.level || 0) >= 10,
  },
];

/**
 * Check and award achievements for a province after an event.
 * @param {number} provinceId
 * @param {string} event  — e.g. 'attack_won', 'research_complete', 'explore', 'troops_trained', 'building_upgraded', 'resource_check'
 * @param {object} eventData — extra data relevant to the event (e.g. { level: 5 })
 */
async function checkAchievements(provinceId, event, eventData = {}) {
  try {
    const relevantAchs = ACHIEVEMENTS.filter(a => a.events.includes(event));
    if (!relevantAchs.length) return;

    const [statsRes, provinceRes, unlockedRes] = await Promise.all([
      pool.query('SELECT * FROM user_stats WHERE province_id = $1', [provinceId]),
      pool.query('SELECT land, gold, mana FROM provinces WHERE id = $1', [provinceId]),
      pool.query('SELECT achievement_key FROM user_achievements WHERE province_id = $1', [provinceId]),
    ]);

    const stats = statsRes.rows[0] || {};
    const province = provinceRes.rows[0] || {};
    const unlocked = new Set(unlockedRes.rows.map(r => r.achievement_key));

    for (const ach of relevantAchs) {
      if (unlocked.has(ach.key)) continue;
      const earned = ach.check({ stats, province, eventData });
      if (!earned) continue;

      await pool.query(
        'INSERT INTO user_achievements (province_id, achievement_key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [provinceId, ach.key]
      );
      await pool.query(
        `INSERT INTO notifications (province_id, type, title, message, metadata)
         VALUES ($1, 'achievement', $2, $3, $4)`,
        [
          provinceId,
          `Achievement Unlocked: ${ach.name}`,
          ach.description,
          JSON.stringify({ achievement_key: ach.key, icon: ach.icon }),
        ]
      );
    }
  } catch (err) {
    console.error('[achievements] Check failed:', err.message);
  }
}

/**
 * Increment a stat counter for a province, upserting the row if needed.
 * @param {number} provinceId
 * @param {string} field  — column name in user_stats
 * @param {number} amount — default 1
 */
async function incrementStat(provinceId, field, amount = 1) {
  // Whitelist to prevent SQL injection
  const ALLOWED = new Set([
    'attacks_won', 'attacks_lost', 'attacks_defended',
    'land_conquered', 'gold_plundered', 'troops_trained',
    'research_completed', 'spells_cast', 'buildings_upgraded',
  ]);
  if (!ALLOWED.has(field)) return;
  try {
    await pool.query(
      `INSERT INTO user_stats (province_id, ${field}, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (province_id) DO UPDATE
       SET ${field} = user_stats.${field} + $2, updated_at = NOW()`,
      [provinceId, amount]
    );
  } catch (err) {
    console.error('[stats] Increment failed:', err.message);
  }
}

module.exports = { ACHIEVEMENTS, checkAchievements, incrementStat };
