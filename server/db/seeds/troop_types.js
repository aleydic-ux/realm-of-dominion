require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const troops = [
  // Human Troops (food upkeep scales by tier: T1=1, T2=1, T3=2, T4=3, T5=4)
  { race: 'human', tier: 1, name: 'Militia',        offense: 2,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'human', tier: 2, name: 'Footsoldier',    offense: 4,  defense: 4,  gold: 15,   food: 1, hours: 1/3600, special: 'None', requires: null },
  { race: 'human', tier: 3, name: 'Knight',         offense: 8,  defense: 3,  gold: 100,  food: 1, hours: 1/3600, special: '+10% plunder gold on raid', requires: null },
  { race: 'human', tier: 4, name: 'Arcane Archer',  offense: 7,  defense: 2,  gold: 450,  food: 2, hours: 1/3600, special: 'Bypasses 10% of enemy defense value', requires: 'war_hall:3' },
  { race: 'human', tier: 5, name: 'Royal Guard',    offense: 0,  defense: 18, gold: 800,  food: 2, hours: 1/3600, special: 'Defense only - cannot be sent on offense', requires: 'war_hall:5' },

  // Orc Troops (food upkeep scales by tier)
  { race: 'orc', tier: 1, name: 'Grunt',            offense: 4,  defense: 1,  gold: 1,    food: 1, hours: 1/3600, special: 'None', requires: null },
  { race: 'orc', tier: 2, name: 'Berserker',        offense: 10, defense: 0,  gold: 15,   food: 1, hours: 1/3600, special: 'Double attack; dies if defending', requires: null },
  { race: 'orc', tier: 3, name: 'Warchief',         offense: 6,  defense: 5,  gold: 100,  food: 1, hours: 1/3600, special: '+5% to all attack units in same army', requires: null },
  { race: 'orc', tier: 4, name: 'Siege Breaker',    offense: 5,  defense: 2,  gold: 500,  food: 2, hours: 1/3600, special: 'Destroys one enemy building level on win', requires: 'war_hall:3' },
  { race: 'orc', tier: 5, name: 'Wyvern Rider',     offense: 14, defense: 4,  gold: 900,  food: 2, hours: 1/3600, special: 'Immune to non-ranged defenders', requires: 'war_hall:5' },

  // Undead Troops (food_upkeep = 0, racial trait)
  { race: 'undead', tier: 1, name: 'Skeleton',      offense: 2,  defense: 2,  gold: 1,    food: 0, hours: 1/3600, special: 'Raised free from fallen enemies (10% base chance)', requires: null },
  { race: 'undead', tier: 2, name: 'Ghoul',         offense: 5,  defense: 1,  gold: 15,   food: 0, hours: 1/3600, special: '2x return speed (half the normal return time)', requires: null },
  { race: 'undead', tier: 3, name: 'Death Knight',  offense: 9,  defense: 4,  gold: 100,  food: 0, hours: 1/3600, special: 'Drains enemy morale -5 on successful attack', requires: null },
  { race: 'undead', tier: 4, name: 'Banshee',       offense: 3,  defense: 6,  gold: 600,  food: 0, hours: 1/3600, special: 'Reduces enemy troop morale -10% per wave sent', requires: 'war_hall:3' },
  { race: 'undead', tier: 5, name: 'Lich',          offense: 12, defense: 2,  gold: 1200, food: 0, hours: 1/3600, special: 'Destroys 10% of enemy mana stores on attack', requires: 'war_hall:5' },

  // Elf Troops (food upkeep scales by tier)
  { race: 'elf', tier: 1, name: 'Forest Scout',     offense: 1,  defense: 2,  gold: 1,    food: 1, hours: 1/3600, special: 'Returns enemy troop count before attack resolves', requires: null },
  { race: 'elf', tier: 2, name: 'Elven Archer',     offense: 5,  defense: 6,  gold: 15,   food: 1, hours: 1/3600, special: '+20% effectiveness vs cavalry-type units', requires: null },
  { race: 'elf', tier: 3, name: 'Blade Dancer',     offense: 9,  defense: 5,  gold: 100,  food: 1, hours: 1/3600, special: 'Evades 15% of enemy counterattack casualties', requires: null },
  { race: 'elf', tier: 4, name: 'Treant',           offense: 0,  defense: 25, gold: 700,  food: 2, hours: 1/3600, special: 'Defense only; cannot attack', requires: 'war_hall:3' },
  { race: 'elf', tier: 5, name: 'Archmage',         offense: 22, defense: 3,  gold: 1400, food: 2, hours: 1/3600, special: 'Casts spell on attack reducing enemy DEF by 15%', requires: 'war_hall:5' },

  // Dwarf Troops (food upkeep scales by tier)
  { race: 'dwarf', tier: 1, name: 'Tunnel Rat',     offense: 4,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: 'Bypasses walls entirely on attack', requires: null },
  { race: 'dwarf', tier: 2, name: 'Shield Bearer',  offense: 0,  defense: 8,  gold: 15,   food: 1, hours: 1/3600, special: 'Every 100 reduces army damage taken by 5%', requires: null },
  { race: 'dwarf', tier: 3, name: 'Runic Warrior',  offense: 7,  defense: 7,  gold: 100,  food: 1, hours: 1/3600, special: 'Gets +3 ATK/DEF per level of Runic Forge', requires: null },
  { race: 'dwarf', tier: 4, name: 'Ironclad',       offense: 9,  defense: 5,  gold: 650,  food: 2, hours: 1/3600, special: 'Destroys enemy wall effectiveness by 20% on win', requires: 'war_hall:3' },
  { race: 'dwarf', tier: 5, name: 'Siege Engineer', offense: 13, defense: 2,  gold: 1100, food: 2, hours: 1/3600, special: '+50% effectiveness vs fortified provinces', requires: 'war_hall:5' },

  // Serpathi Troops (spy/subterfuge)
  { race: 'serpathi', tier: 1, name: 'Shadow Lurker',   offense: 2,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'serpathi', tier: 2, name: 'Venom Striker',   offense: 5,  defense: 3,  gold: 15,   food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'serpathi', tier: 3, name: 'Thornblade',      offense: 8,  defense: 5,  gold: 100,  food: 1, hours: 1/3600, special: 'Evades 15% of counterattack casualties', requires: null },
  { race: 'serpathi', tier: 4, name: 'Cobra Assassin',  offense: 7,  defense: 7,  gold: 600,  food: 2, hours: 1/3600, special: 'Drains enemy morale -3', requires: 'war_hall:3' },
  { race: 'serpathi', tier: 5, name: 'Serpent Hydra',   offense: 16, defense: 5,  gold: 1200, food: 2, hours: 1/3600, special: 'Ignores 20% of wall bonus', requires: 'war_hall:5' },

  // Ironveil Troops (industrial)
  { race: 'ironveil', tier: 1, name: 'Gear Grunt',        offense: 3,  defense: 3,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'ironveil', tier: 2, name: 'Steam Trooper',     offense: 5,  defense: 5,  gold: 15,   food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'ironveil', tier: 3, name: 'Clockwork Knight',  offense: 7,  defense: 7,  gold: 100,  food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'ironveil', tier: 4, name: 'Siege Automaton',   offense: 9,  defense: 4,  gold: 650,  food: 2, hours: 1/3600, special: null, requires: 'war_hall:3' },
  { race: 'ironveil', tier: 5, name: 'War Colossus',      offense: 13, defense: 7,  gold: 1100, food: 2, hours: 1/3600, special: 'Destroys 15% watchtower effectiveness on win', requires: 'war_hall:5' },

  // Ashborn Troops (rage/raid)
  { race: 'ashborn', tier: 1, name: 'Ashwalker',     offense: 4,  defense: 2,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'ashborn', tier: 2, name: 'Ember Raider',  offense: 6,  defense: 2,  gold: 15,   food: 1, hours: 1/3600, special: '+10% raid loot', requires: null },
  { race: 'ashborn', tier: 3, name: 'Flame Warden',  offense: 5,  defense: 6,  gold: 100,  food: 1, hours: 1/3600, special: 'Drains enemy morale -3 on win', requires: null },
  { race: 'ashborn', tier: 4, name: 'Cinderborn',    offense: 9,  defense: 3,  gold: 650,  food: 2, hours: 1/3600, special: null, requires: 'war_hall:3' },
  { race: 'ashborn', tier: 5, name: 'Infernal Drake',offense: 15, defense: 4,  gold: 1100, food: 2, hours: 1/3600, special: 'Burns 15% enemy food on win', requires: 'war_hall:5' },

  // Tidewarden Troops (economy/diplomacy)
  { race: 'tidewarden', tier: 1, name: 'Tide Watcher',    offense: 1,  defense: 4,  gold: 1,    food: 1, hours: 1/3600, special: null, requires: null },
  { race: 'tidewarden', tier: 2, name: 'Current Dancer',  offense: 4,  defense: 5,  gold: 15,   food: 1, hours: 1/3600, special: '2x army return speed', requires: null },
  { race: 'tidewarden', tier: 3, name: 'Deep Raider',     offense: 8,  defense: 4,  gold: 100,  food: 1, hours: 1/3600, special: '+10% gold from raids', requires: null },
  { race: 'tidewarden', tier: 4, name: 'Leviathan Guard', offense: 0,  defense: 18, gold: 700,  food: 2, hours: 1/3600, special: 'Defense only; cannot attack', requires: 'war_hall:3' },
  { race: 'tidewarden', tier: 5, name: 'Kraken Lord',     offense: 16, defense: 8,  gold: 1200, food: 2, hours: 1/3600, special: null, requires: 'war_hall:5' },
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const t of troops) {
      const result = await client.query(
        `INSERT INTO troop_types (race, name, tier, offense_power, defense_power, gold_cost, food_upkeep, training_time_hours, special_ability, requires_building)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
         WHERE NOT EXISTS (SELECT 1 FROM troop_types WHERE race = $1::varchar AND name = $2::varchar)`,
        [t.race, t.name, t.tier, t.offense, t.defense, t.gold, t.food, t.hours, t.special, t.requires]
      );
      if (result.rowCount > 0) inserted++;
    }
    if (inserted > 0) {
      console.log(`Seeded ${inserted} missing troop types.`);
    } else {
      console.log('All troop types already present, nothing to seed.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
