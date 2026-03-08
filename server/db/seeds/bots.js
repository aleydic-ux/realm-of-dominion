/**
 * Seed bot provinces into the currently active age.
 * Run once: node server/db/seeds/bots.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall', 'arcane_sanctum',
];
const RACE_BUILDINGS = {
  human: 'royal_bank', orc: 'warchief_pit', undead: 'crypt',
  elf: 'ancient_grove', dwarf: 'runic_forge',
};
const BOT_RACES = ['human', 'orc', 'undead', 'elf', 'dwarf'];
const BOT_NAMES = [
  'Ironhold', 'Grimveil', 'Thornshire', 'Embervast', 'Coldmere',
  'Duskfall', 'Ravenmark', 'Stonehaven', 'Ashwood', 'Bleakspire',
  'Crestmoor', 'Darkwater', 'Evenmire', 'Frostgate', 'Gilden Peak',
  'Hollow Crown', 'Ironsong', 'Jadehaven', 'Killmore Keep', 'Lionspire',
];

const BOT_CONFIGS = [
  { difficulty: 'easy',   count: 4 },
  { difficulty: 'medium', count: 3 },
  { difficulty: 'hard',   count: 3 },
];

async function seedBots() {
  const client = await pool.connect();
  try {
    const { rows: [age] } = await client.query(
      `SELECT * FROM ages WHERE is_active = true LIMIT 1`
    );
    if (!age) {
      console.error('No active age found. Run db:seed:age first.');
      process.exit(1);
    }

    // Check if bots already exist for this age
    const { rows: existing } = await client.query(
      `SELECT COUNT(*) as count FROM provinces WHERE age_id = $1 AND is_bot = true`,
      [age.id]
    );
    if (parseInt(existing[0].count) > 0) {
      console.log(`Bots already seeded for age "${age.name}" (${existing[0].count} bots). Skipping.`);
      process.exit(0);
    }

    await client.query('BEGIN');

    const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let nameIdx = 0;
    let totalSpawned = 0;

    for (const { difficulty, count } of BOT_CONFIGS) {
      for (let i = 0; i < count; i++) {
        const name = shuffledNames[nameIdx++ % shuffledNames.length];
        const race = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];

        const { rows: [newBot] } = await client.query(
          `INSERT INTO provinces (user_id, age_id, name, race, is_bot, bot_difficulty)
           VALUES (NULL, $1, $2, $3, true, $4) RETURNING id`,
          [age.id, name, race, difficulty]
        );

        const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]].filter(Boolean);
        for (const bt of buildingTypes) {
          await client.query(
            `INSERT INTO province_buildings (province_id, building_type) VALUES ($1, $2)`,
            [newBot.id, bt]
          );
        }

        const { rows: troopTypes } = await client.query(
          `SELECT id FROM troop_types WHERE race = $1`, [race]
        );
        for (const tt of troopTypes) {
          await client.query(
            `INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1, $2)`,
            [newBot.id, tt.id]
          );
        }

        console.log(`  Spawned [${difficulty}] ${name} (${race}) — id ${newBot.id}`);
        totalSpawned++;
      }
    }

    await client.query('COMMIT');
    console.log(`\nDone. Spawned ${totalSpawned} bots for age "${age.name}" (id=${age.id}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bot seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBots();
