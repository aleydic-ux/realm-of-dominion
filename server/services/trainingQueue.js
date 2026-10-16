// Troop training queue (Phase 2 B1). Every order is a batch with its own timer; a batch takes
// the same time whatever its size, set by the unit's tier, so gold limits army size while losses
// still take hours to replace. province_troops.count_training mirrors the queued total per type,
// and training_completes_at the type's next batch, for display.

// Base hours per batch by tier, before barracks/race speed
const TIER_BATCH_HOURS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const MAX_QUEUED_BATCHES = 10;

function batchHours(tier, barracksLevel, raceSpeedMultiplier) {
  const base = TIER_BATCH_HOURS[tier] || TIER_BATCH_HOURS[1];
  return base / ((1 + barracksLevel * 0.10) * raceSpeedMultiplier);
}

// Adds a batch. Returns an error string if the queue is full, else null.
// Run inside the caller's transaction, after the province row is locked (the gold payment
// UPDATE does that), so the count check can't race.
async function queueBatch(db, { provinceId, troopTypeId, quantity, completesAt }) {
  const { rows: [{ queued }] } = await db.query(
    'SELECT COUNT(*)::int AS queued FROM training_queue WHERE province_id = $1', [provinceId]
  );
  if (queued >= MAX_QUEUED_BATCHES) return `Training queue is full (${MAX_QUEUED_BATCHES} batches)`;

  await db.query(
    `INSERT INTO training_queue (province_id, troop_type_id, quantity, completes_at) VALUES ($1, $2, $3, $4)`,
    [provinceId, troopTypeId, quantity, completesAt]
  );
  await db.query(
    `UPDATE province_troops
     SET count_training = count_training + $1,
         training_completes_at = LEAST(COALESCE(training_completes_at, $2), $2),
         updated_at = NOW()
     WHERE province_id = $3 AND troop_type_id = $4`,
    [quantity, completesAt, provinceId, troopTypeId]
  );
  return null;
}

// Moves every finished batch home. Safe to run concurrently: DELETE ... RETURNING hands each
// batch to exactly one caller. Returns the number of batches completed.
async function completeTraining(db, provinceId, now = new Date()) {
  const { rowCount } = await db.query(
    `WITH done AS (
       DELETE FROM training_queue WHERE province_id = $1 AND completes_at <= $2
       RETURNING troop_type_id, quantity
     ), totals AS (
       SELECT troop_type_id, SUM(quantity)::int AS qty FROM done GROUP BY troop_type_id
     )
     UPDATE province_troops pt
     SET count_home = pt.count_home + totals.qty,
         count_training = GREATEST(0, pt.count_training - totals.qty),
         training_completes_at = (
           SELECT MIN(tq.completes_at) FROM training_queue tq
           WHERE tq.province_id = pt.province_id AND tq.troop_type_id = pt.troop_type_id AND tq.completes_at > $2
         ),
         updated_at = NOW()
     FROM totals
     WHERE pt.province_id = $1 AND pt.troop_type_id = totals.troop_type_id`,
    [provinceId, now]
  );
  return rowCount;
}

module.exports = { TIER_BATCH_HOURS, MAX_QUEUED_BATCHES, batchHours, queueBatch, completeTraining };
