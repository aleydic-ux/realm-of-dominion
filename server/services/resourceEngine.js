const pool = require('../config/db');
const raceConfig = require('../config/raceConfig');
const { applyTechModifiers } = require('./techEngine');

// Base resource generation rates (per hour)
const BASE_GOLD_PER_LAND = 1.65;
const BASE_FOOD_PER_LAND = 0.88;
const BASE_MANA_PER_HOUR = 3.3;
const BASE_PRODUCTION_PER_LAND = 0.55;
const FOOD_PER_POPULATION_HOUR = 0.02;

/**
 * Get building level map for a province.
 */
async function getBuildingLevels(provinceId) {
  const { rows } = await pool.query(
    'SELECT building_type, level FROM province_buildings WHERE province_id = $1',
    [provinceId]
  );
  const map = {};
  for (const row of rows) map[row.building_type] = row.level;
  return map;
}

/**
 * Lazily updates resources based on time elapsed since last_resource_update.
 * Also handles lazy troop training completion, building completion, research completion.
 */
async function lazyResourceUpdate(provinceId, techEffects = [], io = null) {
  const nowTs = new Date();

  // Complete finished timers in parallel (independent updates, no transaction needed)
  const [trainingRes, buildingRes, researchRes] = await Promise.all([
    pool.query(
      `UPDATE province_troops
       SET count_home = count_home + count_training,
           count_training = 0,
           training_completes_at = NULL,
           updated_at = NOW()
       WHERE province_id = $1
         AND count_training > 0
         AND (training_completes_at IS NULL OR training_completes_at <= $2)`,
      [provinceId, nowTs]
    ),
    pool.query(
      `UPDATE province_buildings
       SET is_upgrading = false,
           upgrade_completes_at = NULL,
           updated_at = NOW()
       WHERE province_id = $1
         AND is_upgrading = true
         AND (upgrade_completes_at IS NULL OR upgrade_completes_at <= $2)`,
      [provinceId, nowTs]
    ),
    pool.query(
      `UPDATE province_research
       SET status = 'complete',
           updated_at = NOW()
       WHERE province_id = $1
         AND status = 'in_progress'
         AND (completes_at IS NULL OR completes_at <= $2)`,
      [provinceId, nowTs]
    ),
  ]);

  // Notify the province's socket room if any timer just completed
  if (io && (trainingRes.rowCount > 0 || buildingRes.rowCount > 0 || researchRes.rowCount > 0)) {
    io.to(`province_${provinceId}`).emit('province_update', { type: 'timer_complete' });
  }

  const client = await pool.connect();
  try {
    const { rows: [province] } = await client.query(
      'SELECT * FROM provinces WHERE id = $1', [provinceId]
    );
    if (!province) return;

    const now = Date.now();
    const lastUpdate = new Date(province.last_resource_update).getTime();
    const hoursElapsed = (now - lastUpdate) / 3600000;

    if (hoursElapsed <= 0) return;

    const buildings = await getBuildingLevels(provinceId);
    const race = province.race;
    const cfg = raceConfig[race];

    // Building bonuses (per level multipliers)
    const farmLevel = buildings['farm'] || 0;
    const treasuryLevel = buildings['treasury'] || 0;
    const mineLevel = buildings['mine_quarry'] || 0;
    const templeLevel = buildings['temple_altar'] || 0;
    const ancientGroveLevel = buildings['ancient_grove'] || 0; // Elf only
    const royalBankLevel = buildings['royal_bank'] || 0; // Human only
    const arcaneSanctumLevel = buildings['arcane_sanctum'] || 0;

    // --- Gold ---
    let goldRate = province.land * BASE_GOLD_PER_LAND;
    goldRate *= 1 + (treasuryLevel * 0.04); // +4% per level passive income
    if (royalBankLevel > 0) goldRate *= 1 + (royalBankLevel * 0.15); // Human royal bank
    goldRate *= cfg.goldIncomeMultiplier;
    goldRate = applyTechModifiers(goldRate, 'gold_income', techEffects);

    // --- Food ---
    let foodRate = province.land * BASE_FOOD_PER_LAND;
    foodRate *= 1 + (farmLevel * 0.05); // +5% per farm level
    if (ancientGroveLevel > 0) foodRate *= 1 + (ancientGroveLevel * 0.10); // Elf grove
    foodRate *= cfg.foodProductionMultiplier;
    foodRate = applyTechModifiers(foodRate, 'food_production', techEffects);

    // Food consumption: troops + population
    const { rows: troops } = await client.query(
      `SELECT SUM(pt.count_home * tt.food_upkeep) as total_upkeep
       FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1`,
      [provinceId]
    );
    const troopFoodConsumption = (parseFloat(troops[0].total_upkeep || 0)) * cfg.troopFoodUpkeepMultiplier;
    const populationFoodConsumption = province.population * FOOD_PER_POPULATION_HOUR;
    foodRate -= (troopFoodConsumption + populationFoodConsumption);

    // --- Mana ---
    let manaRate = BASE_MANA_PER_HOUR;
    manaRate *= 1 + (templeLevel * 0.10); // +10% per temple level
    if (ancientGroveLevel > 0) manaRate *= 1 + (ancientGroveLevel * 0.15); // Elf grove
    if (arcaneSanctumLevel > 0) manaRate *= 1 + (arcaneSanctumLevel * 0.05); // +5% per sanctum level
    manaRate *= cfg.manaRegenMultiplier;
    manaRate = applyTechModifiers(manaRate, 'mana_regen', techEffects);

    // --- Production Points ---
    let productionRate = province.land * BASE_PRODUCTION_PER_LAND;
    productionRate *= 1 + (mineLevel * 0.08); // +8% per mine level
    productionRate = applyTechModifiers(productionRate, 'production_points', techEffects);

    // --- Active spell effects (buffs/debuffs affecting this province's resources) ---
    try {
      const { rows: spellRows } = await client.query(
        `SELECT effect_json FROM spell_effects
         WHERE target_province_id = $1 AND expires_at > NOW()
           AND effect_json->>'modifier_type' IS NOT NULL`,
        [provinceId]
      );
      const spellModifiers = spellRows.map(r => r.effect_json).filter(Boolean);
      if (spellModifiers.length > 0) {
        manaRate = applyTechModifiers(manaRate, 'mana_regen', spellModifiers);
        foodRate = applyTechModifiers(foodRate, 'food_production', spellModifiers);
        goldRate = applyTechModifiers(goldRate, 'gold_income', spellModifiers);
      }
    } catch (_) { /* spell_effects table may not exist yet during migration */ }

    // Calculate totals
    const goldGained = Math.floor(goldRate * hoursElapsed);
    const foodGained = Math.floor(foodRate * hoursElapsed);
    const manaGained = Math.floor(manaRate * hoursElapsed);
    const productionGained = Math.floor(productionRate * hoursElapsed);

    // Apply resource changes (gold/mana/production never go below 0, food can go negative)
    await client.query(
      `UPDATE provinces SET
        gold = GREATEST(0, gold + $1),
        food = food + $2,
        mana = GREATEST(0, mana + $3),
        production_points = GREATEST(0, production_points + $4),
        last_resource_update = NOW(),
        updated_at = NOW()
       WHERE id = $5`,
      [goldGained, foodGained, manaGained, productionGained, provinceId]
    );


  } finally {
    client.release();
  }
}

// Per-building base costs — differentiates building types meaningfully
const BUILDING_BASE_COSTS = {
  farm:              { gold: 300,  production_points: 30 },
  barracks:          { gold: 600,  production_points: 60 },
  treasury:          { gold: 400,  production_points: 40 },
  marketplace_stall: { gold: 350,  production_points: 35 },
  watchtower:        { gold: 450,  production_points: 45 },
  walls:             { gold: 700,  production_points: 70 },
  library:           { gold: 500,  production_points: 50 },
  mine_quarry:       { gold: 400,  production_points: 40 },
  temple_altar:      { gold: 450,  production_points: 45 },
  war_hall:          { gold: 800,  production_points: 80 },
  royal_bank:        { gold: 600,  production_points: 60 },
  warchief_pit:      { gold: 700,  production_points: 70 },
  crypt:             { gold: 550,  production_points: 55 },
  ancient_grove:     { gold: 550,  production_points: 55 },
  runic_forge:       { gold: 650,  production_points: 65 },
  arcane_sanctum:    { gold: 900,  production_points: 90 },
};

/**
 * Calculate building cost for a given level.
 * base_cost is per-building-type; falls back to { gold: 500, production_points: 50 }
 * level_cost = base_cost * (1.8 ^ (target_level - 1))
 */
function calculateBuildingCost(targetLevel, race, buildingType) {
  const cfg = raceConfig[race];
  const base = BUILDING_BASE_COSTS[buildingType] || { gold: 500, production_points: 50 };
  const multiplier = Math.pow(1.8, targetLevel - 1);
  // L1=20s, L2=60s, L3=3min, L4=9min, L5=27min (×3 per level)
  const timeSeconds = Math.round(20 * Math.pow(3, targetLevel - 1));
  return {
    gold: Math.ceil(base.gold * multiplier * cfg.buildingCostMultiplier),
    production_points: Math.ceil(base.production_points * multiplier * cfg.buildingCostMultiplier),
    time_hours: timeSeconds / 3600,
  };
}

/**
 * Get land occupied by buildings.
 * Level 1 = 5 acres, each subsequent level = +3 acres.
 */
function getLandForBuildingLevel(level) {
  if (level <= 0) return 0;
  return 5 + (level - 1) * 3;
}

module.exports = { lazyResourceUpdate, calculateBuildingCost, getLandForBuildingLevel, getBuildingLevels };
