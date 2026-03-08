const pool = require('../config/db');

const SEASON_LENGTH_DAYS = parseInt(process.env.SEASON_LENGTH_DAYS || '7');

const SEASON_NAMES = [
  'Age of Iron', 'Age of Steel', 'Age of Fire', 'Age of Shadows',
  'Age of Glory', 'Age of Conquest', 'Age of Ruin', 'Age of Storms',
  'Age of Gold', 'Age of Blood', 'Age of Frost', 'Age of Dawn',
];

const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall',
];
const RACE_BUILDINGS = {
  human: 'royal_bank',
  orc: 'warchief_pit',
  undead: 'crypt',
  elf: 'ancient_grove',
  dwarf: 'runic_forge',
};

let seasonEndInProgress = false;

async function checkAndEndSeason(io) {
  if (seasonEndInProgress) return;

  const { rows: [age] } = await pool.query(
    `SELECT * FROM ages WHERE is_active = true LIMIT 1`
  );
  if (!age) return;
  if (new Date(age.ends_at) > new Date()) return; // still running

  seasonEndInProgress = true;
  console.log(`[season] Season "${age.name}" has ended. Starting rollover...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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

    // 3. Mark old age inactive
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
    const { rows: oldProvinces } = await client.query(
      `SELECT p.id as old_id, p.user_id, p.name, p.race
       FROM provinces p
       WHERE p.age_id = $1`,
      [age.id]
    );

    const protectionEndsAt = new Date(startsAt.getTime() + 72 * 3600000);

    for (const op of oldProvinces) {
      // Insert fresh province
      const { rows: [newProvince] } = await client.query(
        `INSERT INTO provinces (user_id, age_id, name, race, protection_ends_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [op.user_id, newAge.id, op.name, op.race, protectionEndsAt]
      );

      // Init buildings
      const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[op.race]].filter(Boolean);
      for (const bt of buildingTypes) {
        await client.query(
          `INSERT INTO province_buildings (province_id, building_type) VALUES ($1,$2)`,
          [newProvince.id, bt]
        );
      }

      // Init troops
      const { rows: troopTypes } = await client.query(
        `SELECT id FROM troop_types WHERE race = $1`, [op.race]
      );
      for (const tt of troopTypes) {
        await client.query(
          `INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1,$2)`,
          [newProvince.id, tt.id]
        );
      }
    }

    // 6. Post world feed announcement
    await client.query(
      `INSERT INTO world_feed (type, author_name, province_id, message)
       VALUES ('event','World News',NULL,$1)`,
      [`[SEASON END] The ${age.name} has ended! A new era begins — the ${newName}. All kingdoms have been reset. Glory to those who rose above!`]
    );

    await client.query('COMMIT');

    console.log(`[season] Rollover complete. New season: "${newName}" (id=${newAge.id})`);

    // 7. Broadcast to all connected clients
    if (io) {
      io.emit('season_end', {
        old_season: age.name,
        new_season: newName,
        new_ends_at: endsAt.toISOString(),
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[season] Rollover failed:', err);
  } finally {
    client.release();
    seasonEndInProgress = false;
  }
}

function pickNextSeasonName(currentName) {
  const idx = SEASON_NAMES.indexOf(currentName);
  return SEASON_NAMES[(idx + 1) % SEASON_NAMES.length];
}

module.exports = { checkAndEndSeason };
