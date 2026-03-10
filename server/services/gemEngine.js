const pool = require('../config/db');

/**
 * Award gems to a province with a transaction record.
 * @param {number} provinceId
 * @param {number} amount - positive integer
 * @param {string} reason - human-readable reason
 */
async function awardGems(provinceId, amount, reason) {
  if (amount <= 0) return;
  try {
    await pool.query(
      'UPDATE provinces SET gems = gems + $1, updated_at = NOW() WHERE id = $2',
      [amount, provinceId]
    );
    await pool.query(
      'INSERT INTO gem_transactions (province_id, amount, reason) VALUES ($1, $2, $3)',
      [provinceId, amount, reason]
    );
  } catch (err) {
    console.error('[gems] Failed to award gems:', err.message);
  }
}

/**
 * Check and award land milestone gems (every 250 acres).
 * Call after any land change.
 */
async function checkLandMilestone(provinceId, newLand) {
  const milestoneInterval = 250;
  const currentMilestone = Math.floor(newLand / milestoneInterval);
  if (currentMilestone < 1) return;

  // Check how many milestones have already been awarded
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as cnt FROM gem_transactions
       WHERE province_id = $1 AND reason LIKE 'Land milestone:%'`,
      [provinceId]
    );
    const alreadyAwarded = parseInt(rows[0].cnt) || 0;
    if (currentMilestone > alreadyAwarded) {
      const newMilestones = currentMilestone - alreadyAwarded;
      for (let i = 0; i < newMilestones; i++) {
        const milestone = (alreadyAwarded + i + 1) * milestoneInterval;
        await awardGems(provinceId, 10, `Land milestone: ${milestone} acres`);
      }
    }
  } catch (err) {
    console.error('[gems] Land milestone check failed:', err.message);
  }
}

module.exports = { awardGems, checkLandMilestone };
