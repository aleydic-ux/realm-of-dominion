const pool = require('../config/db');
const { startingBuildings } = require('../constants/races');
const { spawnBots } = require('./botEngine');

const SEASON_LENGTH_DAYS = parseInt(process.env.SEASON_LENGTH_DAYS || '7');

const SEASON_NAMES = [
  'Age of Iron', 'Age of Steel', 'Age of Fire', 'Age of Shadows',
  'Age of Glory', 'Age of Conquest', 'Age of Ruin', 'Age of Storms',
  'Age of Gold', 'Age of Blood', 'Age of Frost', 'Age of Dawn',
];

// Advisory lock key: at most one rollover runs at a time, across all server instances
const SEASON_LOCK_KEY = 4207001;
// Protection for provinces carried into a new season (new players use NEWBIE_PROTECTION_HOURS)
const CARRYOVER_PROTECTION_HOURS = 24;

// In-process short-circuit; set before any await so concurrent callers can't both pass.
// The advisory lock in rollover() is what guarantees a single rollover across instances.
let rolloverInProgress = false;

async function checkAndEndSeason(io) {
  if (rolloverInProgress) return;
  rolloverInProgress = true;
  try {
    const { rows: [due] } = await pool.query(
      'SELECT id FROM ages WHERE is_active = true AND ends_at <= NOW()'
    );
    if (due) await rollover(io);
  } finally {
    rolloverInProgress = false;
  }
}

async function rollover(io) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Another instance (or an overlapping deploy) is already rolling over: skip, don't wait
    const { rows: [{ locked }] } = await client.query(
      'SELECT pg_try_advisory_xact_lock($1) AS locked', [SEASON_LOCK_KEY]
    );
    if (!locked) {
      await client.query('ROLLBACK');
      return;
    }

    // Re-check under the lock: a rollover that just committed leaves a fresh, unexpired age
    const { rows: [age] } = await client.query(
      'SELECT * FROM ages WHERE is_active = true AND ends_at <= NOW() FOR UPDATE'
    );
    if (!age) {
      await client.query('ROLLBACK');
      return;
    }
    console.log(`[season] Season "${age.name}" has ended. Starting rollover...`);

    // 1. Record top 10 overall (by networth) to hall of fame
    const { rows: topOverall } = await client.query(
      `SELECT p.id, p.name, p.race, p.networth, p.land, u.username,
              COUNT(a.id) FILTER (WHERE a.outcome = 'win') as successful_attacks
       FROM provinces p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN attacks a ON a.attacker_province_id = p.id
       WHERE p.age_id = $1
       GROUP BY p.id, p.name, p.race, p.networth, p.land, u.username
       ORDER BY p.networth DESC
       LIMIT 10`,
      [age.id]
    );

    for (let i = 0; i < topOverall.length; i++) {
      const p = topOverall[i];
      await client.query(
        `INSERT INTO hall_of_fame
           (age_id, province_id, username, province_name, race, final_networth, final_land, successful_attacks, category, rank)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'overall',$9)`,
        [age.id, p.id, p.username, p.name, p.race, p.networth, p.land, p.successful_attacks, i + 1]
      );
    }

    // 2. Record top 5 military (by successful attacks)
    const { rows: topMilitary } = await client.query(
      `SELECT p.id, p.name, p.race, p.networth, p.land, u.username,
              COUNT(a.id) FILTER (WHERE a.outcome = 'win') as successful_attacks
       FROM provinces p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN attacks a ON a.attacker_province_id = p.id
       WHERE p.age_id = $1
       GROUP BY p.id, p.name, p.race, p.networth, p.land, u.username
       ORDER BY successful_attacks DESC NULLS LAST
       LIMIT 5`,
      [age.id]
    );

    for (let i = 0; i < topMilitary.length; i++) {
      const p = topMilitary[i];
      await client.query(
        `INSERT INTO hall_of_fame
           (age_id, province_id, username, province_name, race, final_networth, final_land, successful_attacks, category, rank)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'military',$9)`,
        [age.id, p.id, p.username, p.name, p.race, p.networth, p.land, p.successful_attacks, i + 1]
      );
    }

    // 3. Mark old age inactive (before creating the new one: only one may be active)
    await client.query(
      `UPDATE ages SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [age.id]
    );

    // 4. Create the new age (7-day season)
    const newName = pickNextSeasonName(age.name);
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + SEASON_LENGTH_DAYS * 24 * 60 * 60 * 1000);
    const { rows: [newAge] } = await client.query(
      `INSERT INTO ages (name, starts_at, ends_at, is_active) VALUES ($1,$2,$3,true) RETURNING id`,
      [newName, startsAt, endsAt]
    );

    // 5. Create fresh provinces for all users (carry over same race & name)
    // Exclude bots — they are spawned fresh below via spawnBots
    const { rows: oldProvinces } = await client.query(
      `SELECT p.id as old_id, p.user_id, p.name, p.race
       FROM provinces p
       WHERE p.age_id = $1 AND p.is_bot = false AND p.user_id IS NOT NULL`,
      [age.id]
    );

    const protectionEndsAt = new Date(startsAt.getTime() + CARRYOVER_PROTECTION_HOURS * 3600000);

    for (const op of oldProvinces) {
      await createProvince(client, {
        userId: op.user_id, ageId: newAge.id, name: op.name, race: op.race, protectionEndsAt,
      });
    }

    // 6. Spawn bot provinces for the new season
    await spawnBots(client, newAge.id, protectionEndsAt);

    // 7. Post world feed announcement
    await client.query(
      `INSERT INTO world_feed (type, author_name, province_id, message)
       VALUES ('event','World News',NULL,$1)`,
      [`[SEASON END] The ${age.name} has ended! A new era begins — the ${newName}. All kingdoms have been reset. Glory to those who rose above!`]
    );

    await client.query('COMMIT');

    console.log(`[season] Rollover complete. New season: "${newName}" (id=${newAge.id})`);

    // 8. Broadcast to all connected clients
    if (io) {
      io.emit('season_end', {
        old_season: age.name,
        new_season: newName,
        new_ends_at: endsAt.toISOString(),
      });
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[season] Rollover failed:', err);
  } finally {
    client.release();
  }
}

// Fresh province with starting buildings and troops. Returns null if the user already
// has a province in this age (unique on user_id, age_id), so concurrent calls are safe.
async function createProvince(db, { userId, ageId, name, race, protectionEndsAt }) {
  const { rows: [province] } = await db.query(
    `INSERT INTO provinces (user_id, age_id, name, race, protection_ends_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, age_id) DO NOTHING
     RETURNING id`,
    [userId, ageId, name, race, protectionEndsAt]
  );
  if (!province) return null;

  for (const bt of startingBuildings(race)) {
    await db.query(
      'INSERT INTO province_buildings (province_id, building_type) VALUES ($1,$2)',
      [province.id, bt]
    );
  }
  const { rows: troopTypes } = await db.query('SELECT id FROM troop_types WHERE race = $1', [race]);
  for (const tt of troopTypes) {
    await db.query(
      'INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1,$2)',
      [province.id, tt.id]
    );
  }
  return province;
}

// Returns the active age, starting a new one if none exists. Race-free: the partial
// unique index (migration 051) allows only one active age, so a concurrent insert no-ops.
async function ensureActiveAge(db = pool) {
  const { rows: [last] } = await db.query('SELECT name FROM ages ORDER BY id DESC LIMIT 1');
  await db.query(
    `INSERT INTO ages (name, starts_at, ends_at, is_active)
     SELECT $1, NOW(), NOW() + make_interval(days => $2), true
     WHERE NOT EXISTS (SELECT 1 FROM ages WHERE is_active = true)
     ON CONFLICT (is_active) WHERE is_active DO NOTHING`,
    [last ? pickNextSeasonName(last.name) : SEASON_NAMES[0], SEASON_LENGTH_DAYS]
  );
  const { rows: [age] } = await db.query('SELECT * FROM ages WHERE is_active = true');
  return age;
}

// A player with no province in the active age gets a fresh one with their last name and
// race, like a rollover carry-over. Old-season provinces are never moved into the active
// age: that would carry a whole season's progress past the reset.
async function recoverProvince(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const age = await ensureActiveAge(client);

    const { rows: [last] } = await client.query(
      'SELECT name, race FROM provinces WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    let name = last?.name;
    const race = last?.race || 'human';
    if (!name) {
      const { rows: [user] } = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
      name = user ? `${user.username}'s Kingdom` : 'Kingdom';
    }
    const hours = last ? CARRYOVER_PROTECTION_HOURS : parseInt(process.env.NEWBIE_PROTECTION_HOURS || '24');

    const created = await createProvince(client, {
      userId, ageId: age.id, name, race, protectionEndsAt: new Date(Date.now() + hours * 3600000),
    });
    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function pickNextSeasonName(currentName) {
  const idx = SEASON_NAMES.indexOf(currentName);
  return SEASON_NAMES[(idx + 1) % SEASON_NAMES.length];
}

module.exports = { checkAndEndSeason, ensureActiveAge, recoverProvince };
