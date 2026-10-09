const pool = require('../config/db');
const { checkAndEndSeason, recoverProvince } = require('../services/seasonEngine');

const MAX_AP = parseInt(process.env.MAX_AP || '20');
const AP_REGEN_MINUTES = parseInt(process.env.AP_REGEN_MINUTES || '15');

const PROVINCE_QUERY = `SELECT p.* FROM provinces p
  JOIN ages a ON a.id = p.age_id
  WHERE p.user_id = $1 AND a.is_active = true`;

/**
 * Recalculates AP lazily based on elapsed time.
 * Updates DB if AP was gained.
 * Attaches province to req.province (requires req.user to be set).
 * If no province is found: runs a due season rollover, then gives the user a fresh
 * province in the active age (see seasonEngine.recoverProvince).
 */
async function apRegen(req, res, next) {
  if (!req.user) return next();

  try {
    let { rows } = await pool.query(PROVINCE_QUERY, [req.user.id]);

    // No province found — try recovery
    if (!rows.length) {
      console.log(`[apRegen] No province for user ${req.user.id} — starting recovery`);

      try {
        await checkAndEndSeason(req.app.get('io'));
      } catch (e) {
        console.error('[apRegen] season check failed:', e.message);
      }
      ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));

      if (!rows.length) {
        await recoverProvince(req.user.id);
        ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));
      }

      if (rows.length) {
        console.log(`[apRegen] Recovery successful for user ${req.user.id}`);
      } else {
        console.error(`[apRegen] Recovery FAILED for user ${req.user.id} — no province after all attempts`);
      }
    }

    if (!rows.length) {
      req.province = null;
      return next();
    }

    const province = rows[0];

    // Regen computed and applied in one statement relative to the current row, so a
    // concurrent AP spend can't be overwritten by a stale absolute value. The WHERE
    // makes parallel requests grant each regen window only once.
    const { rows: [regen] } = await pool.query(
      `UPDATE provinces
       SET action_points = LEAST($1, action_points
             + FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(ap_last_regen, 'epoch'))) / 60 / $2)::int),
           ap_last_regen = NOW(), updated_at = NOW()
       WHERE id = $3 AND COALESCE(ap_last_regen, 'epoch') <= NOW() - make_interval(mins => $2)
       RETURNING action_points, ap_last_regen`,
      [MAX_AP, AP_REGEN_MINUTES, province.id]
    );
    if (regen) {
      province.action_points = regen.action_points;
      province.ap_last_regen = regen.ap_last_regen;
    }

    req.province = province;
    next();
  } catch (err) {
    console.error('apRegen error:', err);
    next(err);
  }
}

module.exports = apRegen;
