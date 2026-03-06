const pool = require('../config/db');

const MAX_AP = parseInt(process.env.MAX_AP || '20');
const AP_REGEN_MINUTES = parseInt(process.env.AP_REGEN_MINUTES || '15');

/**
 * Recalculates AP lazily based on elapsed time.
 * Updates DB if AP was gained.
 * Attaches province to req.province (requires req.user to be set).
 */
async function apRegen(req, res, next) {
  if (!req.user) return next();

  try {
    const { rows } = await pool.query(
      `SELECT p.* FROM provinces p
       JOIN ages a ON a.id = p.age_id
       WHERE p.user_id = $1 AND a.is_active = true`,
      [req.user.id]
    );

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
