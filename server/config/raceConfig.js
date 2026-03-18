/**
 * Single source of truth for all race modifiers.
 * All multipliers: 1.0 = no change, 1.2 = +20%, 0.8 = -20%
 */
const raceConfig = {
  human: {
    goldIncomeMultiplier: 1.20,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 0.90,
    marketplaceSaleBonus: 0.20,       // +20% added to proceeds
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,  // lower = faster
    landResourceYieldMultiplier: 1.00,
    specialRules: [],
  },
  orc: {
    goldIncomeMultiplier: 0.85,
    foodProductionMultiplier: 0.80,
    troopAttackMultiplier: 1.25,
    trainingSpeedMultiplier: 1.15,    // +15% speed = less time
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,
    landResourceYieldMultiplier: 1.00,
    specialRules: ['berserker_dies_defending'],
  },
  undead: {
    goldIncomeMultiplier: 0.75,
    foodProductionMultiplier: 1.00,   // population still consumes food, troops do not
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: true,         // Cannot post sell listings
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 0.00,  // All undead troops have 0 food upkeep
    armyReturnSpeedMultiplier: 0.50,  // Ghouls 2x speed (half the time)
    landResourceYieldMultiplier: 1.00,
    specialRules: ['skeleton_raise', 'no_troop_food_upkeep'],
  },
  elf: {
    goldIncomeMultiplier: 1.00,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 0.85,    // -15% = 15% slower
    researchSpeedMultiplier: 1.20,    // +20% faster research
    manaRegenMultiplier: 1.30,
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,
    landResourceYieldMultiplier: 1.15,
    specialRules: [],
  },
  dwarf: {
    goldIncomeMultiplier: 1.00,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 0.75,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.25,       // -25% siege damage taken
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.20,  // -20% slow = 20% longer
    landResourceYieldMultiplier: 1.00,
    specialRules: ['tunnel_rat_bypasses_walls', 'runic_warrior_forge_bonus'],
  },

  // ─── New Races ─────────────────────────────────────────────────────────────

  serpathi: {
    goldIncomeMultiplier: 1.00,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.10,        // +10% mana for spy operations
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 0.85,  // 15% faster army return
    landResourceYieldMultiplier: 1.00,
    specialRules: ['scout_resistance', 'defensive_troop_recovery'],
  },

  ironveil: {
    goldIncomeMultiplier: 1.00,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.15,      // +15% offensive attack power
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 0.90,     // -10% build cost
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,
    landResourceYieldMultiplier: 1.00,
    specialRules: ['crafting_bonus_charge'],
  },

  ashborn: {
    goldIncomeMultiplier: 1.00,
    foodProductionMultiplier: 1.00,
    troopAttackMultiplier: 1.00,      // base neutral — fury stacks applied in combat
    trainingSpeedMultiplier: 1.10,    // +10% training speed
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.00,
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.00,
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,
    landResourceYieldMultiplier: 1.00,
    specialRules: ['ashborn_fury', 'scorched_earth', 'battle_hardened'],
  },

  tidewarden: {
    goldIncomeMultiplier: 1.20,       // +20% gold production
    foodProductionMultiplier: 1.20,   // +20% food production
    troopAttackMultiplier: 1.00,
    trainingSpeedMultiplier: 1.00,
    researchSpeedMultiplier: 1.00,
    manaRegenMultiplier: 1.10,
    buildingCostMultiplier: 1.00,
    marketplaceSaleBonus: 0.10,       // +10% marketplace proceeds
    marketplaceBlocked: false,
    siegeDamageReduction: 0.00,
    troopFoodUpkeepMultiplier: 1.00,
    armyReturnSpeedMultiplier: 1.00,
    landResourceYieldMultiplier: 1.00,
    specialRules: ['phantom_attack', 'retreat_penalty_for_attackers'],
  },
};

module.exports = raceConfig;
