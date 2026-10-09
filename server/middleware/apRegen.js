const pool = require('../config/db');
const { checkAndEndSeason } = require('../services/seasonEngine');
const { startingBuildings } = require('../constants/races');

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
 * Final fallback: auto-creates a fresh province for the user.
 */
async function apRegen(req, res, next) {
  if (!req.user) return next();

  try {
    let { rows } = await pool.query(PROVINCE_QUERY, [req.user.id]);

    // No province found — try recovery
    if (!rows.length) {
      console.log(`[apRegen] No province for user ${req.user.id} — starting recovery`);

      try {
        const io = req.app.get('io');
        await checkAndEndSeason(io);
      } catch (e) {
        console.error('[apRegen] season check failed:', e.message);
      }

      // Ensure an active age exists
      let { rows: [activeAge] } = await pool.query(
        'SELECT id FROM ages WHERE is_active = true LIMIT 1'
      );
      if (!activeAge) {
        console.log('[apRegen] No active age — attempting reactivation');
        // Reactivate the most-used age
        await pool.query(`
          UPDATE ages SET is_active = true, ends_at = NOW() + INTERVAL '7 days'
          WHERE id = (
            SELECT age_id FROM provinces WHERE age_id IS NOT NULL
            GROUP BY age_id ORDER BY COUNT(*) DESC LIMIT 1
          )
        `);
        ({ rows: [activeAge] } = await pool.query(
          'SELECT id FROM ages WHERE is_active = true LIMIT 1'
        ));
        // If still no age, create a fresh one
        if (!activeAge) {
          console.log('[apRegen] Creating fresh age');
          const { rows: [newAge] } = await pool.query(
            `INSERT INTO ages (name, starts_at, ends_at, is_active)
             VALUES ('Age of Iron', NOW(), NOW() + INTERVAL '7 days', true) RETURNING id`
          );
          activeAge = newAge;
        }
      }

      if (activeAge) {
        // Re-query for province after age recovery
        ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));

        // Still no province in active age — reassign orphaned province
        if (!rows.length) {
          console.log(`[apRegen] Attempting orphan recovery for user ${req.user.id}, age ${activeAge.id}`);
          const { rows: [orphan] } = await pool.query(
            'SELECT id, name, race FROM provinces WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
          );
          if (orphan) {
            console.log(`[apRegen] Reassigning province ${orphan.id} to age ${activeAge.id}`);
            await pool.query(
              'UPDATE provinces SET age_id = $1, updated_at = NOW() WHERE id = $2',
              [activeAge.id, orphan.id]
            );
            ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));
          } else {
            // No province at all — create a fresh one for the user
            console.warn(`[apRegen] User ${req.user.id} has no province anywhere — auto-creating`);
            const { rows: [user] } = await pool.query(
              'SELECT username FROM users WHERE id = $1', [req.user.id]
            );
            const provinceName = user ? `${user.username}'s Kingdom` : 'Kingdom';
            const race = 'human';
            const protectionEndsAt = new Date(Date.now() + 72 * 3600000);
            const { rows: [newProvince] } = await pool.query(
              `INSERT INTO provinces (user_id, age_id, name, race, protection_ends_at)
               VALUES ($1,$2,$3,$4,$5) RETURNING id`,
              [req.user.id, activeAge.id, provinceName, race, protectionEndsAt]
            );
            const buildingTypes = startingBuildings(race);
            for (const bt of buildingTypes) {
              await pool.query(
                'INSERT INTO province_buildings (province_id, building_type) VALUES ($1,$2)',
                [newProvince.id, bt]
              );
            }
            const { rows: troopTypes } = await pool.query(
              'SELECT id FROM troop_types WHERE race = $1', [race]
            );
            for (const tt of troopTypes) {
              await pool.query(
                'INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1,$2)',
                [newProvince.id, tt.id]
              );
            }
            ({ rows } = await pool.query(PROVINCE_QUERY, [req.user.id]));
          }
        }
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
