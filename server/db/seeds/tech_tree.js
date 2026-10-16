require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// effect_json schema: { modifier_type, target, value, scope }
const techs = [
  // Universal Technologies
  {
    race: null, tier: 1, name: 'Iron Working', gold: 1000, mana: 0, hours: 6, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'troop_defense', value: 0.10, scope: 'all' },
    desc: '+10% all troop defense'
  },
  {
    race: null, tier: 1, name: 'Crop Rotation', gold: 800, mana: 0, hours: 4, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'food_production', value: 0.15, scope: 'all' },
    desc: '+15% food production'
  },
  {
    race: null, tier: 1, name: 'Cartography', gold: 600, mana: 0, hours: 3, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'explore_yield', value: 0.2, scope: 'all' },
    desc: '+20% land from exploring'
  },
  {
    race: null, tier: 2, name: 'Siege Doctrine', gold: 2000, mana: 100, hours: 12, lib: 2, prereq: 'Iron Working',
    effect: { modifier_type: 'multiplier', target: 'siege_attack', value: 0.15, scope: 'all' },
    desc: '+15% attack power on Conquest and Raze attacks'
  },
  {
    race: null, tier: 2, name: 'Fortification', gold: 1800, mana: 100, hours: 10, lib: 2, prereq: 'Iron Working',
    effect: { modifier_type: 'multiplier', target: 'wall_effectiveness', value: 0.20, scope: 'all' },
    desc: '+20% wall effectiveness'
  },
  {
    race: null, tier: 1, name: 'Scouting Network', gold: 700, mana: 0, hours: 4, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'watchtower_bonus', value: 0.20, scope: 'all' },
    desc: '+20% watchtower effectiveness (defense and spy detection)'
  },
  {
    race: null, tier: 2, name: 'Advanced Metallurgy', gold: 2200, mana: 100, hours: 12, lib: 2, prereq: 'Iron Working',
    effect: { modifier_type: 'multiplier', target: 'troop_attack', value: 0.15, scope: 'all' },
    desc: '+15% all troop attack power'
  },
  {
    race: null, tier: 2, name: 'Economic Reform', gold: 2500, mana: 0, hours: 10, lib: 2, prereq: 'Crop Rotation',
    effect: { modifier_type: 'multiplier', target: 'gold_income', value: 0.20, scope: 'all' },
    desc: '+20% gold income from all sources'
  },
  {
    race: null, tier: 3, name: 'Grand Fortification', gold: 4000, mana: 200, hours: 18, lib: 3, prereq: 'Fortification',
    effect: { modifier_type: 'multiplier', target: 'wall_effectiveness', value: 0.30, scope: 'all' },
    desc: '+30% wall effectiveness (stacks with Fortification)'
  },
  {
    race: null, tier: 1, name: 'Population Boom', gold: 900, mana: 0, hours: 5, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'population_food', value: -0.25, scope: 'all' },
    desc: 'Your population eats 25% less food'
  },

  // Human Tech Tree
  {
    race: 'human', tier: 1, name: 'Diplomacy I', gold: 1200, mana: 0, hours: 8, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'alliance_bonus', value: 0.10, scope: 'all' },
    desc: '+10% strength for alliance buffs'
  },
  {
    race: 'human', tier: 2, name: 'Diplomacy II', gold: 2500, mana: 150, hours: 16, lib: 2, prereq: 'Diplomacy I',
    effect: { modifier_type: 'multiplier', target: 'enemy_attack', value: 0.15, scope: 'all' },
    desc: '+15% attack power against provinces you have marked as enemies'
  },
  {
    race: 'human', tier: 3, name: 'Diplomacy III', gold: 5000, mana: 300, hours: 24, lib: 3, prereq: 'Diplomacy II',
    effect: { modifier_type: 'multiplier', target: 'alliance_bonus', value: 0.25, scope: 'all' },
    desc: '+25% strength for alliance buffs (stacks with Diplomacy I)'
  },
  {
    race: 'human', tier: 1, name: 'Merchant Guild', gold: 1000, mana: 0, hours: 6, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'marketplace_sale', value: 0.20, scope: 'all' },
    desc: '+20% marketplace sale earnings'
  },
  {
    race: 'human', tier: 2, name: 'Chivalric Code', gold: 2200, mana: 100, hours: 12, lib: 2, prereq: 'Iron Working',
    effect: { modifier_type: 'multiplier', target: 'troop_attack', value: 0.2, scope: 'troop_name:Knight', attack_morale_bonus: 10 },
    desc: 'Knights +20% ATK, +10 army morale when attacking'
  },
  {
    race: 'human', tier: 3, name: 'Arcane Study', gold: 4500, mana: 400, hours: 20, lib: 3, prereq: 'Diplomacy II',
    effect: { modifier_type: 'unlock', target: 'spell_clarity', value: 1, scope: 'all' },
    desc: 'Unlocks spell: Clarity (+5% attack, defense, gold, food and mana for 4h)'
  },
  {
    race: 'human', tier: 2, name: 'Imperial Taxation', gold: 3000, mana: 0, hours: 10, lib: 2, prereq: 'Merchant Guild',
    effect: { modifier_type: 'multiplier', target: 'gold_income', value: 0.25, scope: 'all', morale_cap: 90 },
    desc: '+25% gold income, but morale recovers only to 90%'
  },

  // Orc Tech Tree
  {
    race: 'orc', tier: 1, name: 'Blood Frenzy', gold: 1000, mana: 0, hours: 6, lib: 2, prereq: null,
    effect: { modifier_type: 'unlock', target: 'berserker_survives_defense', value: 0.50, scope: 'all' },
    desc: 'Berserkers defend at half their attack power instead of not at all'
  },
  {
    race: 'orc', tier: 1, name: 'Shamanic Ritual', gold: 800, mana: 50, hours: 5, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'mana_regen', value: 0.20, scope: 'all' },
    desc: '+20% mana regen'
  },
  {
    race: 'orc', tier: 2, name: 'Warchief Dominance', gold: 2500, mana: 100, hours: 14, lib: 2, prereq: 'Blood Frenzy',
    effect: { modifier_type: 'flat', target: 'warchief_bonus', value: 0.05, scope: 'all' },
    desc: 'Warchief army bonus doubles (+10% instead of +5%)'
  },
  {
    race: 'orc', tier: 2, name: 'Pillage Mastery', gold: 2000, mana: 0, hours: 10, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'raid_resources', value: 0.30, scope: 'all' },
    desc: '+30% resources stolen on successful raid'
  },
  {
    race: 'orc', tier: 3, name: 'Iron Hide', gold: 4000, mana: 200, hours: 20, lib: 3, prereq: 'Blood Frenzy',
    effect: { modifier_type: 'multiplier', target: 'attacker_casualties', value: -0.15, scope: 'all' },
    desc: 'All troops -15% casualties on failed attacks'
  },

  // Undead Tech Tree
  {
    race: 'undead', tier: 1, name: 'Dark Necromancy I', gold: 1200, mana: 100, hours: 8, lib: 2, prereq: null,
    effect: { modifier_type: 'flat', target: 'skeleton_raise_chance', value: 0.10, scope: 'all' },
    desc: '+10% chance to raise Skeletons after a win'
  },
  {
    race: 'undead', tier: 2, name: 'Dark Necromancy II', gold: 2500, mana: 200, hours: 16, lib: 2, prereq: 'Dark Necromancy I',
    effect: { modifier_type: 'multiplier', target: 'skeleton_raise_count', value: 0.5, scope: 'all' },
    desc: 'Raise 50% more troops'
  },
  {
    race: 'undead', tier: 3, name: 'Dark Necromancy III', gold: 5000, mana: 400, hours: 28, lib: 3, prereq: 'Dark Necromancy II',
    effect: { modifier_type: 'flat', target: 'skeleton_raise_chance', value: 0.15, scope: 'all', raise_unit: 'Ghoul' },
    desc: '+15% raise chance, and raises Ghouls (T2) instead of Skeletons'
  },
  {
    race: 'undead', tier: 2, name: 'Plague Carrier', gold: 2000, mana: 150, hours: 12, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'enemy_food', value: -0.10, scope: 'all' },
    desc: 'Winning attacks burn 10% of enemy food'
  },
  {
    race: 'undead', tier: 2, name: 'Soul Drain', gold: 2200, mana: 200, hours: 14, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'enemy_gold_income', value: -0.05, scope: 'all' },
    desc: 'Winning attacks with Banshees cut enemy gold income 5% for 12 hours'
  },
  {
    race: 'undead', tier: 3, name: 'Phylactery', gold: 4500, mana: 500, hours: 24, lib: 3, prereq: 'Soul Drain',
    effect: { modifier_type: 'multiplier', target: 'lich_casualties', value: -0.5, scope: 'all' },
    desc: 'Liches suffer half casualties'
  },
  {
    race: 'undead', tier: 3, name: 'Endless Legion', gold: 4000, mana: 300, hours: 20, lib: 3, prereq: 'Dark Necromancy II',
    effect: { modifier_type: 'flat', target: 'skeleton_bonus', value: 1, scope: 'all' },
    desc: 'Skeletons +1 ATK and +1 DEF'
  },

  // Elf Tech Tree
  {
    race: 'elf', tier: 1, name: 'Arcane Mastery I', gold: 1500, mana: 200, hours: 8, lib: 2, prereq: null,
    effect: { modifier_type: 'unlock', target: 'spell_weaken', value: 0.10, scope: 'all' },
    desc: 'Unlocks spell: Weaken (-10% enemy attack for 4h)'
  },
  {
    race: 'elf', tier: 2, name: 'Arcane Mastery II', gold: 3000, mana: 400, hours: 16, lib: 2, prereq: 'Arcane Mastery I',
    effect: { modifier_type: 'unlock', target: 'spell_drain', value: 0.05, scope: 'all' },
    desc: 'Unlocks spell: Drain (steal 5% of enemy gold and mana)'
  },
  {
    race: 'elf', tier: 3, name: 'Arcane Mastery III', gold: 6000, mana: 600, hours: 28, lib: 3, prereq: 'Arcane Mastery II',
    effect: { modifier_type: 'unlock', target: 'spell_shatter', value: 1, scope: 'all' },
    desc: 'Unlocks spell: Shatter (knock an enemy building down a level)'
  },
  {
    race: 'elf', tier: 1, name: 'Nature Bond', gold: 800, mana: 100, hours: 6, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'ancient_grove_output', value: 1.0, scope: 'all' },
    desc: 'Ancient Grove output doubled'
  },
  {
    race: 'elf', tier: 2, name: 'Farsight', gold: 1800, mana: 150, hours: 10, lib: 2, prereq: null,
    effect: { modifier_type: 'unlock', target: 'scout_reveals_tech', value: 1, scope: 'all' },
    desc: 'Successful spy recon also reveals the target\'s research'
  },
  {
    race: 'elf', tier: 2, name: 'Timeless Wisdom', gold: 3500, mana: 200, hours: 12, lib: 2, prereq: 'Arcane Mastery I',
    effect: { modifier_type: 'multiplier', target: 'research_cost', value: -0.30, scope: 'all' },
    desc: 'All research costs -30%'
  },
  {
    race: 'elf', tier: 3, name: 'Starweave Armor', gold: 5000, mana: 400, hours: 22, lib: 3, prereq: 'Arcane Mastery I',
    effect: { modifier_type: 'multiplier', target: 'troop_defense', value: 0.15, scope: 'race_specific' },
    desc: 'All Elf troops +15% defense'
  },

  // Dwarf Tech Tree
  {
    race: 'dwarf', tier: 1, name: 'Deep Mining', gold: 900, mana: 0, hours: 6, lib: 2, prereq: null,
    effect: { modifier_type: 'multiplier', target: 'industry_points', value: 0.25, scope: 'all' },
    desc: '+25% industry output'
  },
  {
    race: 'dwarf', tier: 1, name: 'Runic Inscription I', gold: 1000, mana: 100, hours: 8, lib: 2, prereq: null,
    effect: { modifier_type: 'flat', target: 'runic_warrior_bonus', value: 3, scope: 'all' },
    desc: 'Runic Warriors +3 ATK/DEF'
  },
  {
    race: 'dwarf', tier: 2, name: 'Runic Inscription II', gold: 2200, mana: 200, hours: 14, lib: 2, prereq: 'Runic Inscription I',
    effect: { modifier_type: 'multiplier', target: 'runic_warrior_damage_reduction', value: 0.2, scope: 'all' },
    desc: 'Runic Warriors suffer 20% fewer casualties'
  },
  {
    race: 'dwarf', tier: 3, name: 'Runic Inscription III', gold: 4500, mana: 400, hours: 22, lib: 3, prereq: 'Runic Inscription II',
    effect: { modifier_type: 'multiplier', target: 'runic_warrior_vs_magic', value: 0.20, scope: 'all' },
    desc: 'Runic Warriors +20% ATK against Undead and Elf provinces'
  },
  {
    race: 'dwarf', tier: 2, name: 'Fortress Doctrine', gold: 2000, mana: 0, hours: 12, lib: 2, prereq: null,
    effect: { modifier_type: 'flat', target: 'wall_level_bonus', value: 1, scope: 'all' },
    desc: 'Walls count as 1 level higher than built'
  },
  {
    race: 'dwarf', tier: 2, name: 'Steam Engine', gold: 2800, mana: 0, hours: 16, lib: 2, prereq: 'Deep Mining',
    effect: { modifier_type: 'multiplier', target: 'building_cost', value: -0.30, scope: 'all' },
    desc: '-30% building cost and construction time'
  },
  {
    race: 'dwarf', tier: 3, name: 'Masterwork Forge', gold: 5500, mana: 300, hours: 24, lib: 3, prereq: 'Runic Inscription II',
    effect: { modifier_type: 'multiplier', targets: ['troop_attack', 'troop_defense'], value: 0.1, scope: 'race_specific' },
    desc: 'All Dwarf troops +10% ATK and DEF'
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM tech_tree');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('tech_tree already seeded, skipping.');
      return;
    }

    // First pass: insert without prerequisites
    const nameToId = {};
    for (const t of techs) {
      const { rows } = await client.query(
        `INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [t.race, t.name, t.tier, t.gold, t.mana, t.hours, t.lib, JSON.stringify(t.effect), t.desc]
      );
      nameToId[t.name] = rows[0].id;
    }

    // Second pass: set prerequisites
    for (const t of techs) {
      if (!t.prereq) continue;
      const prereqId = nameToId[t.prereq];
      if (!prereqId) {
        console.warn(`Prereq not found for ${t.name}: ${t.prereq}`);
        continue;
      }
      await client.query(
        'UPDATE tech_tree SET prerequisite_tech_id = $1 WHERE name = $2',
        [prereqId, t.name]
      );
    }

    console.log(`Seeded ${techs.length} tech tree entries.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
