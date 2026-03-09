/**
 * Crafting recipe definitions.
 * cost keys: gold, food, mana, industry (maps to industry_points in DB)
 * modifier_key: used in active_effects table and resource/combat calculations
 * duration_hours: null = single-battle effect (deleted after combat), number = timed
 */
const RECIPES = {
  // --- Combat Boosters ---
  minor_mana_potion: {
    name:             'Minor Mana Potion',
    tier_required:    1,
    craft_time_mins:  45,
    cost:             { mana: 65, gold: 35 },
    effect_type:      'combat_boost',
    modifier_key:     'attack_pct',
    modifier_value:   0.10,
    duration_hours:   null,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+10% attack power for 1 battle',
  },
  shield_draught: {
    name:             'Shield Draught',
    tier_required:    1,
    craft_time_mins:  45,
    cost:             { mana: 100, gold: 45 },
    effect_type:      'combat_boost',
    modifier_key:     'defense_pct',
    modifier_value:   0.20,
    duration_hours:   2,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+20% defense power for 2 hours',
  },
  war_elixir: {
    name:             'War Elixir',
    tier_required:    2,
    craft_time_mins:  90,
    cost:             { mana: 160, industry: 70 },
    effect_type:      'combat_boost',
    modifier_key:     'attack_pct',
    modifier_value:   0.25,
    duration_hours:   null,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+25% attack power for 1 battle',
  },
  berserker_brew: {
    name:             'Berserker Brew',
    tier_required:    3,
    craft_time_mins:  180,
    cost:             { mana: 275, industry: 140 },
    effect_type:      'combat_boost',
    modifier_key:     'attack_pct',
    modifier_value:   0.50,
    duration_hours:   null,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+50% attack power for 1 battle',
  },

  // --- Resource Boosters ---
  harvest_tonic: {
    name:             'Harvest Tonic',
    tier_required:    1,
    craft_time_mins:  45,
    cost:             { food: 80, industry: 55 },
    effect_type:      'resource_boost',
    modifier_key:     'food_production_pct',
    modifier_value:   0.25,
    duration_hours:   4,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+25% food production for 4 hours',
  },
  gold_infusion: {
    name:             'Gold Infusion',
    tier_required:    1,
    craft_time_mins:  45,
    cost:             { mana: 130, gold: 70 },
    effect_type:      'resource_boost',
    modifier_key:     'gold_income_pct',
    modifier_value:   0.20,
    duration_hours:   6,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+20% gold income for 6 hours',
  },
  industry_surge: {
    name:             'Industry Surge',
    tier_required:    2,
    craft_time_mins:  90,
    cost:             { gold: 110, mana: 80 },
    effect_type:      'resource_boost',
    modifier_key:     'industry_pct',
    modifier_value:   0.30,
    duration_hours:   4,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '+30% industry point generation for 4 hours',
  },

  // --- Debuff Items (sent to enemy provinces) ---
  plague_vial: {
    name:             'Plague Vial',
    tier_required:    2,
    craft_time_mins:  90,
    cost:             { food: 140, mana: 70 },
    effect_type:      'debuff',
    modifier_key:     'food_production_pct',
    modifier_value:   -0.30,
    duration_hours:   3,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '-30% enemy food production for 3 hours',
  },
  chaos_dust: {
    name:             'Chaos Dust',
    tier_required:    2,
    craft_time_mins:  90,
    cost:             { mana: 200, industry: 100 },
    effect_type:      'debuff',
    modifier_key:     'gold_income_pct',
    modifier_value:   -0.20,
    duration_hours:   4,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '-20% enemy gold income for 4 hours',
  },
  mana_drain: {
    name:             'Mana Drain',
    tier_required:    3,
    craft_time_mins:  180,
    cost:             { mana: 275, gold: 140 },
    effect_type:      'debuff',
    modifier_key:     'mana_regen_pct',
    modifier_value:   -0.40,
    duration_hours:   3,
    max_stacks:       2,
    cooldown_hours:   4,
    description:      '-40% enemy mana regeneration for 3 hours',
  },
};

// Tower tier unlock costs
const TOWER_COSTS = {
  build:   { gold: 800,  industry: 350  },
  upgrade2:{ gold: 2000, industry: 800,  mana: 500  },
  upgrade3:{ gold: 5000, industry: 1800, mana: 1200 },
};

// Tier → crafting slots
const TIER_SLOTS = { 1: 2, 2: 3, 3: 4 };

// Map recipe cost keys → province column names
const COST_RESOURCE_MAP = {
  gold:     'gold',
  food:     'food',
  mana:     'mana',
  industry: 'industry_points',
};

module.exports = { RECIPES, TOWER_COSTS, TIER_SLOTS, COST_RESOURCE_MAP };
