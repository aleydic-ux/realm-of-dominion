const pool = require('../config/db');

/**
 * Checks if the active age has ended, records hall of fame, and prepares for next age.
 * Should be called lazily (e.g., on province dashboard load or a periodic check).
 */
async function checkEndOfAge() {
  const client = await pool.connect();
  try {
    const { rows: [age] } = await client.query(
      'SELECT * FROM ages WHERE is_active = true LIMIT 1'
    );
    if (!age) return false;
    if (new Date(age.ends_at) > new Date()) return false;

    // Age has ended — record hall of fame
    console.log(`Age "${age.name}" has ended. Recording hall of fame...`);

    await client.query('BEGIN');

    // Overall top 50 by networth
    const { rows: overall } = await client.query(
      `SELECT p.id, u.username, p.name, p.race, p.networth, p.land,
              (SELECT COUNT(*) FROM attacks WHERE attacker_province_id = p.id AND outcome = 'win') as successful_attacks
       FROM provinces p JOIN users u ON u.id = p.user_id
       WHERE p.age_id = $1 ORDER BY p.networth DESC LIMIT 50`,
      [age.id]
    );

    for (let i = 0; i < overall.length; i++) {
      const p = overall[i];
      await client.query(
        `INSERT INTO hall_of_fame (age_id, province_id, username, province_name, race, final_networth, final_land, successful_attacks, category, rank)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'overall',$9)
         ON CONFLICT DO NOTHING`,
        [age.id, p.id, p.username, p.name, p.race, p.networth, p.land, p.successful_attacks, i + 1]
      );
    }

    // Deactivate age
    await client.query('UPDATE ages SET is_active = false WHERE id = $1', [age.id]);

    // Create next age automatically so the game continues
    const ageLengthDays = parseInt(process.env.AGE_LENGTH_DAYS || '90');
    const nextAgeNum = age.id + 1;
    await client.query(
      `INSERT INTO ages (name, starts_at, ends_at, is_active)
       VALUES ($1, NOW(), NOW() + INTERVAL '${ageLengthDays} days', true)`,
      [`Age ${nextAgeNum}`]
    );

    await client.query('COMMIT');
    console.log(`Hall of fame recorded. Age ended. New age started (${ageLengthDays} days).`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('End of age error:', err);
    return false;
  } finally {
    client.release();
  }
}

module.exports = { checkEndOfAge };
