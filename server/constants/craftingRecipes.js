/**
 * Crafting recipe definitions.
 * cost keys: gold, food, mana, industry (maps to production_points in DB)
 * modifier_key: used in active_effects table and resource/combat calculations
 * duration_hours: null = single-battle effect (deleted after combat), number = timed
 */
const RECIPES = {
  // --- Combat Boosters ---
  minor_mana_potion: {
    name:             'Minor Mana Potion',
    tier_required:    1,
    craft_time_mins:  30,
    cost:             { mana: 50, gold: 25 },
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
    craft_time_mins:  30,
    cost:             { mana: 80, gold: 30 },
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
    craft_time_mins:  60,
    cost:             { mana: 120, industry: 50 },
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
    craft_time_mins:  120,
    cost:             { mana: 200, industry: 100 },
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
    craft_time_mins:  30,
    cost:             { food: 60, industry: 40 },
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
    craft_time_mins:  30,
    cost:             { mana: 100, gold: 50 },
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
    craft_time_mins:  60,
    cost:             { gold: 80, mana: 60 },
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
    craft_time_mins:  60,
    cost:             { food: 100, mana: 50 },
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
    craft_time_mins:  60,
    cost:             { mana: 150, industry: 75 },
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
    craft_time_mins:  120,
    cost:             { mana: 200, gold: 100 },
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
  build:   { gold: 500,  production_points: 200 },
  upgrade2:{ gold: 1200, production_points: 500, mana: 300 },
  upgrade3:{ gold: 3000, production_points: 1000, mana: 800 },
};

// Tier → crafting slots
const TIER_SLOTS = { 1: 2, 2: 3, 3: 4 };

// Map recipe cost keys → province column names
const COST_RESOURCE_MAP = {
  gold:     'gold',
  food:     'food',
  mana:     'mana',
  industry: 'production_points',
};

module.exports = { RECIPES, TOWER_COSTS, TIER_SLOTS, COST_RESOURCE_MAP };
