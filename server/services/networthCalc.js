const pool = require('../config/db');

/**
 * Calculates and stores networth for a province.
 * networth = (land * 150)
 *          + (SUM of all building_level * 500)
 *          + (SUM of all troops at home * troop.gold_cost * 0.5)
 *          + (gold * 0.1)
 *          + (completed_techs * 1000)
 */
async function calculateAndStoreNetworth(provinceId) {
  const client = await pool.connect();
  try {
    const { rows: [province] } = await client.query(
      'SELECT land, gold FROM provinces WHERE id = $1', [provinceId]
    );

    const { rows: buildings } = await client.query(
      'SELECT SUM(level) as total_levels FROM province_buildings WHERE province_id = $1',
      [provinceId]
    );

    const { rows: troops } = await client.query(
      `SELECT SUM(pt.count_home * tt.gold_cost) as troop_value
       FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1`,
      [provinceId]
    );

    const { rows: research } = await client.query(
      `SELECT COUNT(*) as completed FROM province_research
       WHERE province_id = $1 AND status = 'complete'`,
      [provinceId]
    );

    const landValue = province.land * 150;
    const buildingValue = parseInt(buildings[0].total_levels || 0) * 500;
    const troopValue = Math.floor(parseFloat(troops[0].troop_value || 0) * 0.5);
    const goldValue = Math.floor(province.gold * 0.1);
    const techValue = parseInt(research[0].completed) * 1000;

    const networth = landValue + buildingValue + troopValue + goldValue + techValue;

    await client.query(
      'UPDATE provinces SET networth = $1, updated_at = NOW() WHERE id = $2',
      [networth, provinceId]
    );

    return networth;
  } finally {
    client.release();
  }
}

module.exports = { calculateAndStoreNetworth };
