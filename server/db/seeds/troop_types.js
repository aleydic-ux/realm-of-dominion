require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const troops = [
  // Human Troops
  { race: 'human', tier: 1, name: 'Militia',        offense: 2,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'human', tier: 2, name: 'Footsoldier',    offense: 4,  defense: 4,  gold: 15,   food: 1, hours: 1/3600, special: 'None', requires: null },
  { race: 'human', tier: 3, name: 'Knight',         offense: 8,  defense: 3,  gold: 100,  food: 1, hours: 1/3600, special: '+10% plunder gold on raid', requires: null },
  { race: 'human', tier: 4, name: 'Arcane Archer',  offense: 7,  defense: 2,  gold: 450,  food: 1, hours: 1/3600, special: 'Bypasses 10% of enemy defense value', requires: 'war_hall:3' },
  { race: 'human', tier: 5, name: 'Royal Guard',    offense: 0,  defense: 18, gold: 800,  food: 1, hours: 1/3600, special: 'Defense only - cannot be sent on offense', requires: 'war_hall:5' },

  // Orc Troops
  { race: 'orc', tier: 1, name: 'Grunt',            offense: 4,  defense: 1,  gold: 1,    food: 1, hours: 1/3600, special: 'None', requires: null },
  { race: 'orc', tier: 2, name: 'Berserker',        offense: 10, defense: 0,  gold: 15,   food: 1, hours: 1/3600, special: 'Double attack; dies if defending', requires: null },
  { race: 'orc', tier: 3, name: 'Warchief',         offense: 6,  defense: 5,  gold: 100,  food: 1, hours: 1/3600, special: '+5% to all attack units in same army', requires: null },
  { race: 'orc', tier: 4, name: 'Siege Breaker',    offense: 5,  defense: 2,  gold: 500,  food: 1, hours: 1/3600, special: 'Destroys one enemy building level on win', requires: 'war_hall:3' },
  { race: 'orc', tier: 5, name: 'Wyvern Rider',     offense: 14, defense: 4,  gold: 900,  food: 1, hours: 1/3600, special: 'Immune to non-ranged defenders', requires: 'war_hall:5' },

  // Undead Troops (food_upkeep = 0)
  { race: 'undead', tier: 1, name: 'Skeleton',      offense: 2,  defense: 2,  gold: 1,    food: 0, hours: 1/3600, special: 'Raised free from fallen enemies (10% base chance)', requires: null },
  { race: 'undead', tier: 2, name: 'Ghoul',         offense: 5,  defense: 1,  gold: 15,   food: 0, hours: 1/3600, special: '2x return speed (half the normal return time)', requires: null },
  { race: 'undead', tier: 3, name: 'Death Knight',  offense: 9,  defense: 4,  gold: 100,  food: 0, hours: 1/3600, special: 'Drains enemy morale -5 on successful attack', requires: null },
  { race: 'undead', tier: 4, name: 'Banshee',       offense: 3,  defense: 6,  gold: 600,  food: 0, hours: 1/3600, special: 'Reduces enemy troop morale -10% per wave sent', requires: 'war_hall:3' },
  { race: 'undead', tier: 5, name: 'Lich',          offense: 12, defense: 2,  gold: 1200, food: 0, hours: 1/3600, special: 'Destroys 10% of enemy mana stores on attack', requires: 'war_hall:5' },

  // Elf Troops
  { race: 'elf', tier: 1, name: 'Forest Scout',     offense: 1,  defense: 2,  gold: 1,    food: 1, hours: 1/3600, special: 'Returns enemy troop count before attack resolves', requires: null },
  { race: 'elf', tier: 2, name: 'Elven Archer',     offense: 5,  defense: 6,  gold: 15,   food: 1, hours: 1/3600, special: '+20% effectiveness vs cavalry-type units', requires: null },
  { race: 'elf', tier: 3, name: 'Blade Dancer',     offense: 9,  defense: 5,  gold: 100,  food: 1, hours: 1/3600, special: 'Evades 15% of enemy counterattack casualties', requires: null },
  { race: 'elf', tier: 4, name: 'Treant',           offense: 0,  defense: 25, gold: 700,  food: 1, hours: 1/3600, special: 'Defense only; cannot attack', requires: 'war_hall:3' },
  { race: 'elf', tier: 5, name: 'Archmage',         offense: 11, defense: 3,  gold: 1400, food: 1, hours: 1/3600, special: 'Casts spell on attack reducing enemy DEF by 15%', requires: 'war_hall:5' },

  // Dwarf Troops
  { race: 'dwarf', tier: 1, name: 'Tunnel Rat',     offense: 4,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: 'Bypasses walls entirely on attack', requires: null },
  { race: 'dwarf', tier: 2, name: 'Shield Bearer',  offense: 0,  defense: 8,  gold: 15,   food: 1, hours: 1/3600, special: 'Every 100 reduces army damage taken by 5%', requires: null },
  { race: 'dwarf', tier: 3, name: 'Runic Warrior',  offense: 7,  defense: 7,  gold: 100,  food: 1, hours: 1/3600, special: 'Gets +3 ATK/DEF per level of Runic Forge', requires: null },
  { race: 'dwarf', tier: 4, name: 'Ironclad',       offense: 9,  defense: 5,  gold: 650,  food: 1, hours: 1/3600, special: 'Destroys enemy wall effectiveness by 20% on win', requires: 'war_hall:3' },
  { race: 'dwarf', tier: 5, name: 'Siege Engineer', offense: 13, defense: 2,  gold: 1100, food: 1, hours: 1/3600, special: '+50% effectiveness vs fortified provinces', requires: 'war_hall:5' },
];

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM troop_types');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('troop_types already seeded, skipping.');
      return;
    }

    for (const t of troops) {
      await client.query(
        `INSERT INTO troop_types (race, name, tier, offense_power, defense_power, gold_cost, food_upkeep, training_time_hours, special_ability, requires_building)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [t.race, t.name, t.tier, t.offense, t.defense, t.gold, t.food, t.hours, t.special, t.requires]
      );
    }
    console.log(`Seeded ${troops.length} troop types.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
