const pool = require('../config/db');

/**
 * Lazily checks if any deployed troops have returned for a province.
 * Should be called on dashboard load.
 */
async function checkAndReturnTroops(provinceId) {
  const client = await pool.connect();
  try {
    // Find all attacks where troops haven't returned yet but it's time
    const { rows: pendingReturns } = await client.query(
      `SELECT id, troops_deployed, attacker_losses
       FROM attacks
       WHERE attacker_province_id = $1
         AND troops_returned = false
         AND troops_return_at <= NOW()`,
      [provinceId]
    );

    if (!pendingReturns.length) return 0;

    let returned = 0;
    for (const attack of pendingReturns) {
      const deployed = attack.troops_deployed || {};
      const losses = attack.attacker_losses || {};

      // Calculate survivors: deployed - losses
      const survivors = {};
      for (const [troopTypeId, count] of Object.entries(deployed)) {
        const lost = losses[troopTypeId] || 0;
        const surviving = Math.max(0, count - lost);
        if (surviving > 0) survivors[troopTypeId] = surviving;
      }

      // Move survivors from count_deployed to count_home
      for (const [troopTypeId, count] of Object.entries(survivors)) {
        await client.query(
          `UPDATE province_troops
           SET count_deployed = GREATEST(0, count_deployed - $1),
               count_home = count_home + $1,
               updated_at = NOW()
           WHERE province_id = $2 AND troop_type_id = $3`,
          [count, provinceId, parseInt(troopTypeId)]
        );
      }

      // Mark attack as returned
      await client.query(
        'UPDATE attacks SET troops_returned = true WHERE id = $1',
        [attack.id]
      );
      returned++;
    }

    return returned;
  } finally {
    client.release();
  }
}

module.exports = { checkAndReturnTroops };
