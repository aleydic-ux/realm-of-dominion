const pool = require('../config/db');
const { checkAndEndSeason } = require('../services/seasonEngine');

const MAX_AP = parseInt(process.env.MAX_AP || '20');
const AP_REGEN_MINUTES = parseInt(process.env.AP_REGEN_MINUTES || '15');

const PROVINCE_QUERY = `SELECT p.* FROM provinces p
  JOIN ages a ON a.id = p.age_id
  WHERE p.user_id = $1 AND a.is_active = true`;

/**
 * Recalculates AP lazily based on elapsed time.
 * Updates DB if AP was gained.
 * Attaches province to req.province (requires req.user to be set).
 * If no province found, attempts season rollover + age recovery.
 */
async function apRegen(req, res, next) {
  if (!req.user) return next();

  try {
    let { rows } = await pool.query(PROVINCE_QUERY, [req.user.id]);

    // No province found — try recovery
    if (!rows.length) {
      try {
        const io = req.app.get('io');
        await checkAndEndSeason(io);
      } catch (e) {
        console.error('apRegen season check:', e.message);
      }

      // Ensure an active age exists
      const { rows: [activeAge] } = await pool.query(
        'SELECT id FROM ages WHERE is_active = true LIMIT 1'
      );
      if (!activeAge) {
        // Reactivate the age that provinces belong to
        await pool.query(`
          UPDATE ages SET is_active = true, ends_at = NOW() + INTERVAL '7 days'
          WHERE id = (
            SELECT age_id FROM provinces WHERE age_id IS NOT NULL
            GROUP BY age_id ORDER BY COUNT(*) DESC LIMIT 1
          )
        `);
        // If still no age, create a fresh one
        const { rows: [check] } = await pool.query(
          'SELECT id FROM ages WHERE is_active = true LIMIT 1'
        );
        if (!check) {
          await pool.query(
            `INSERT INTO ages (name, starts_at, ends_at, is_active)
             VALUES ('Age of Iron', NOW(), NOW() + INTERVAL '7 days', true)`
          );
        }
      }

      // Re-query for province after recovery
      ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));
    }

    if (!rows.length) {
      req.province = null;
      return next();
    }

    const province = rows[0];
    const minutesElapsed = (Date.now() - new Date(province.ap_last_regen).getTime()) / 60000;
    const apGained = Math.floor(minutesElapsed / AP_REGEN_MINUTES);

    if (apGained > 0) {
      const newAP = Math.min(MAX_AP, province.action_points + apGained);
      await pool.query(
        'UPDATE provinces SET action_points = $1, ap_last_regen = NOW(), updated_at = NOW() WHERE id = $2',
        [newAP, province.id]
      );
      province.action_points = newAP;
      province.ap_last_regen = new Date();
    }

    req.province = province;
    next();
  } catch (err) {
    console.error('apRegen error:', err);
    next(err);
  }
}

module.exports = apRegen;
