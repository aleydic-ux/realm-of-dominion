/**
 * Gem Enhancement Definitions
 * 4 trees (military, economy, magic, espionage) x 3 tiers each
 * Tier 2 requires tier 1 in same tree; tier 3 requires tier 2
 */
const ENHANCEMENTS = {
  // ── Military Tree ──
  military_t1_whetstone: {
    tree: 'military', tier: 1,
    name: 'Whetstone',
    unlock_cost: 15, use_cost: 5,
    duration_hours: null, // one-shot: next attack only
    effect: { type: 'offense_multiplier', value: 1.10, trigger: 'next_attack' },
    requires: null,
  },
  military_t1_shield_wall: {
    tree: 'military', tier: 1,
    name: 'Shield Wall',
    unlock_cost: 15, use_cost: 5,
    duration_hours: 6,
    effect: { type: 'defense_multiplier', value: 1.10 },
    requires: null,
  },
  military_t2_veteran_training: {
    tree: 'military', tier: 2,
    name: 'Veteran Training',
    unlock_cost: 40, use_cost: 12,
    duration_hours: 24,
    effect: { type: 'training_time_reduction', value: 0.20 },
    requires: 'military_t1_whetstone',
  },
  military_t2_iron_discipline: {
    tree: 'military', tier: 2,
    name: 'Iron Discipline',
    unlock_cost: 40, use_cost: 12,
    duration_hours: null,
    effect: { type: 'casualty_reduction', value: 0.15, trigger: 'next_attack' },
    requires: 'military_t1_shield_wall',
  },
  military_t3_war_banner: {
    tree: 'military', tier: 3,
    name: 'War Banner',
    unlock_cost: 80, use_cost: 25,
    duration_hours: 12,
    effect: { type: 'combat_multiplier', value: 1.20 }, // +20% ATK and DEF
    requires: 'military_t2_veteran_training',
  },

  // ── Economy Tree ──
  economy_t1_merchant_favor: {
    tree: 'economy', tier: 1,
    name: 'Merchant Favor',
    unlock_cost: 15, use_cost: 4,
    duration_hours: 12,
    effect: { type: 'gold_income_multiplier', value: 1.15 },
    requires: null,
  },
  economy_t1_harvest_blessing: {
    tree: 'economy', tier: 1,
    name: 'Harvest Blessing',
    unlock_cost: 15, use_cost: 4,
    duration_hours: 12,
    effect: { type: 'food_production_multiplier', value: 1.20 },
    requires: null,
  },
  economy_t2_master_builders: {
    tree: 'economy', tier: 2,
    name: 'Master Builders',
    unlock_cost: 40, use_cost: 10,
    duration_hours: 24,
    effect: { type: 'build_time_reduction', value: 0.25 },
    requires: 'economy_t1_merchant_favor',
  },
  economy_t2_tax_reform: {
    tree: 'economy', tier: 2,
    name: 'Tax Reform',
    unlock_cost: 40, use_cost: 10,
    duration_hours: 24,
    effect: { type: 'all_production_multiplier', value: 1.10 },
    requires: 'economy_t1_harvest_blessing',
  },
  economy_t3_golden_age: {
    tree: 'economy', tier: 3,
    name: 'Golden Age',
    unlock_cost: 80, use_cost: 30,
    duration_hours: 24,
    effect: { type: 'all_income_multiplier', value: 1.25 },
    requires: 'economy_t2_master_builders',
    once_per_season: true,
  },

  // ── Magic Tree ──
  magic_t1_mana_surge: {
    tree: 'magic', tier: 1,
    name: 'Mana Surge',
    unlock_cost: 15, use_cost: 5,
    duration_hours: 6,
    effect: { type: 'mana_regen_multiplier', value: 2.0 },
    requires: null,
  },
  magic_t1_ward_glyph: {
    tree: 'magic', tier: 1,
    name: 'Ward Glyph',
    unlock_cost: 15, use_cost: 5,
    duration_hours: null,
    effect: { type: 'negate_incoming_spell', trigger: 'next_spell' },
    requires: null,
  },
  magic_t2_arcane_focus: {
    tree: 'magic', tier: 2,
    name: 'Arcane Focus',
    unlock_cost: 40, use_cost: 12,
    duration_hours: 24,
    effect: { type: 'spell_power_multiplier', value: 1.25 },
    requires: 'magic_t1_mana_surge',
  },
  magic_t2_counterspell: {
    tree: 'magic', tier: 2,
    name: 'Counterspell Reserve',
    unlock_cost: 40, use_cost: 12,
    duration_hours: 24,
    effect: { type: 'auto_counter_spell', chance: 0.50 },
    requires: 'magic_t1_ward_glyph',
  },
  magic_t3_ley_line: {
    tree: 'magic', tier: 3,
    name: 'Ley Line Mastery',
    unlock_cost: 80, use_cost: 25,
    duration_hours: 24,
    effect: { type: 'mana_cost_reduction', value: 0.50 },
    requires: 'magic_t2_arcane_focus',
  },

  // ── Espionage Tree ──
  espionage_t1_shadow_cloak: {
    tree: 'espionage', tier: 1,
    name: 'Shadow Cloak',
    unlock_cost: 15, use_cost: 4,
    duration_hours: 12,
    effect: { type: 'spy_detection_reduction', value: 0.30 },
    requires: null,
  },
  espionage_t1_counterintelligence: {
    tree: 'espionage', tier: 1,
    name: 'Counterintelligence',
    unlock_cost: 15, use_cost: 4,
    duration_hours: 12,
    effect: { type: 'spy_detection_boost', value: 0.25 },
    requires: null,
  },
  espionage_t2_ghost_network: {
    tree: 'espionage', tier: 2,
    name: 'Ghost Network',
    unlock_cost: 40, use_cost: 10,
    duration_hours: null,
    effect: { type: 'guaranteed_spy_success', trigger: 'next_spy' },
    requires: 'espionage_t1_shadow_cloak',
  },
  espionage_t2_double_agent: {
    tree: 'espionage', tier: 2,
    name: 'Double Agent',
    unlock_cost: 40, use_cost: 10,
    duration_hours: null,
    effect: { type: 'intercept_spy_intel', trigger: 'next_incoming_spy' },
    requires: 'espionage_t1_counterintelligence',
  },
  espionage_t3_shadowmaster: {
    tree: 'espionage', tier: 3,
    name: 'Shadowmaster',
    unlock_cost: 80, use_cost: 25,
    duration_hours: 24,
    effect: { type: 'spy_effectiveness_multiplier', value: 3.0 },
    requires: 'espionage_t2_ghost_network',
  },
};

// Build lookup maps
const ENHANCEMENT_LIST = Object.entries(ENHANCEMENTS).map(([id, e]) => ({ id, ...e }));
const TREES = ['military', 'economy', 'magic', 'espionage'];

module.exports = { ENHANCEMENTS, ENHANCEMENT_LIST, TREES };
