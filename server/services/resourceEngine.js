const pool = require('../config/db');
const raceConfig = require('../config/raceConfig');
const { applyTechModifiers, sumEffects, allianceBuffMultiplier } = require('./techEngine');

// Base resource generation rates (per hour)
const BASE_GOLD_PER_LAND = 1.65;
const BASE_FOOD_PER_LAND = 0.88;
const BASE_MANA_PER_HOUR = 3.3;      // flat base — all provinces
const BASE_MANA_PER_LAND = 0.04;     // land-scaled component — bigger provinces regen faster
const BASE_PRODUCTION_PER_LAND = 0.55;
const FOOD_PER_POPULATION_HOUR = 0.02;
// Troop wages (gold/hour per troop at home or deployed): 0.25% of its price, at least 0.02
const WAGE_RATE = 0.0025;
const MIN_WAGE = 0.02;

// Morale (per hour). Recovers toward MORALE_MAX; 40 -> 100 takes ~30h with no temple.
// Starvation (food below 0) drains instead of recovering. Morale is an integer column,
// so the fractional remainder carries over in morale_progress between ticks.
const MORALE_MAX = 100;
const MORALE_REGEN_PER_HOUR = 2;
const MORALE_REGEN_PER_TEMPLE_LEVEL = 1;
const MORALE_STARVATION_PER_HOUR = 5;

/**
 * Returns { morale, moraleProgress } after hoursElapsed.
 */
function computeMorale(morale, progress, hoursElapsed, starving, templeLevel, cap = MORALE_MAX) {
  let rate = 0;
  let floor = 0;
  if (starving) rate = -MORALE_STARVATION_PER_HOUR;
  else if (morale < cap) rate = MORALE_REGEN_PER_HOUR + templeLevel * MORALE_REGEN_PER_TEMPLE_LEVEL;
  else if (morale > cap) { rate = -MORALE_REGEN_PER_HOUR; floor = cap; } // drift down to a lowered cap
  if (rate === 0) return { morale, moraleProgress: 0 };

  const total = (progress || 0) + rate * hoursElapsed;
  const whole = Math.trunc(total);
  let next = morale + whole;
  let remainder = total - whole;
  if (rate > 0 && next >= cap) { next = Math.max(morale, cap); remainder = 0; }
  if (rate < 0 && next <= floor) { next = floor; remainder = 0; }
  return { morale: next, moraleProgress: remainder };
}

/**
 * Hourly rates for a province. Shared by the resource tick and GET /province/rates so the
 * numbers players see are the numbers they get.
 * @param {Object} p.province - province row (land, population, race)
 * @param {Object} p.buildings - { building_type: level }
 * @param {Array}  p.techEffects - completed research effects
 * @param {number} p.troopUpkeepRaw - SUM(count_home * food_upkeep) before race modifiers
 * @param {number} p.troopWages - gold/hour owed to troops (see loadTroopTotals)
 * @param {Array}  p.spellModifiers - active spell effect_json rows targeting this province
 * @param {Array}  p.activeEffects - active_effects rows (modifier_key, modifier_value, effect_type)
 */
function computeRates({ province, buildings, techEffects, troopUpkeepRaw, troopWages = 0, spellModifiers = [], activeEffects = [] }) {
  const cfg = raceConfig[province.race];
  const lvl = (b) => buildings[b] || 0;
  // Nature Bond doubles the Ancient Grove's output
  const groveMult = 1 + sumEffects('ancient_grove_output', techEffects);

  // --- Gold ---
  let goldRate = province.land * BASE_GOLD_PER_LAND;
  goldRate *= 1 + (lvl('treasury') * 0.04); // +4% per level passive income
  goldRate *= 1 + (lvl('royal_bank') * 0.15); // Human royal bank
  goldRate *= 1 + (lvl('tidal_basin') * 0.12); // Tidewarden tidal basin
  goldRate *= cfg.goldIncomeMultiplier;
  goldRate = applyTechModifiers(goldRate, 'gold_income', techEffects);

  // --- Food ---
  let foodRate = province.land * BASE_FOOD_PER_LAND;
  foodRate *= 1 + (lvl('farm') * 0.10); // +10% per farm level
  foodRate *= 1 + (lvl('ancient_grove') * 0.10 * groveMult); // Elf grove
  foodRate *= cfg.foodProductionMultiplier;
  foodRate = applyTechModifiers(foodRate, 'food_production', techEffects);

  // --- Mana ---
  let manaRate = BASE_MANA_PER_HOUR + (province.land * BASE_MANA_PER_LAND);
  manaRate *= 1 + (lvl('temple_altar') * 0.10); // +10% per temple level
  manaRate *= 1 + (lvl('ancient_grove') * 0.15 * groveMult); // Elf grove
  manaRate *= 1 + (lvl('arcane_sanctum') * 0.05); // +5% per sanctum level
  manaRate *= 1 + (lvl('shadowveil_den') * 0.07); // Serpathi shadowveil den
  manaRate *= cfg.manaRegenMultiplier;
  manaRate = applyTechModifiers(manaRate, 'mana_regen', techEffects);

  // --- Industry ---
  let industryRate = province.land * BASE_PRODUCTION_PER_LAND;
  industryRate *= 1 + (lvl('mine_quarry') * 0.08); // +8% per mine level
  industryRate *= 1 + (lvl('artificers_foundry') * 0.10); // Ironveil foundry
  industryRate = applyTechModifiers(industryRate, 'industry_points', techEffects);

  // --- Active spells (buffs/debuffs on this province) ---
  manaRate = applyTechModifiers(manaRate, 'mana_regen', spellModifiers);
  foodRate = applyTechModifiers(foodRate, 'food_production', spellModifiers);
  goldRate = applyTechModifiers(goldRate, 'gold_income', spellModifiers);

  // --- Potions, debuffs and alliance buffs (Diplomacy strengthens alliance buffs) ---
  const allianceMult = allianceBuffMultiplier(techEffects);
  for (const row of activeEffects) {
    const value = row.modifier_value * (row.effect_type === 'alliance_buff' ? allianceMult : 1);
    switch (row.modifier_key) {
      case 'food_production_pct': foodRate     *= (1 + value); break;
      case 'gold_income_pct':     goldRate     *= (1 + value); break;
      case 'mana_regen_pct':      manaRate     *= (1 + value); break;
      case 'industry_pct':        industryRate *= (1 + value); break;
    }
  }

  // --- Troop wages come out of gross gold income ---
  const goldIncome = goldRate;
  goldRate -= troopWages;

  // --- Food upkeep: troops + population (Population Boom cuts what the population eats) ---
  const foodProduction = foodRate;
  const troopUpkeep = troopUpkeepRaw * cfg.troopFoodUpkeepMultiplier;
  const popUpkeep = province.population * FOOD_PER_POPULATION_HOUR * Math.max(0, 1 + sumEffects('population_food', techEffects));
  foodRate -= troopUpkeep + popUpkeep;

  // Imperial Taxation: morale recovers only to its cap
  const caps = techEffects.filter(e => e && typeof e.morale_cap === 'number').map(e => e.morale_cap);
  const moraleCap = caps.length ? Math.min(MORALE_MAX, ...caps) : MORALE_MAX;

  return {
    goldRate, goldIncome, troopWages, foodRate, foodProduction, foodUpkeep: troopUpkeep + popUpkeep,
    manaRate, industryRate, moraleCap,
  };
}

// Raw troop food upkeep (troops at home) and gold wages (troops at home or deployed)
async function loadTroopTotals(provinceId, db = pool) {
  const { rows: [row] } = await db.query(
    `SELECT SUM(pt.count_home * tt.food_upkeep) AS total_upkeep,
            SUM((pt.count_home + pt.count_deployed) * GREATEST($2::float, tt.gold_cost * $3::float)) AS total_wages
     FROM province_troops pt
     JOIN troop_types tt ON tt.id = pt.troop_type_id
     WHERE pt.province_id = $1`,
    [provinceId, MIN_WAGE, WAGE_RATE]
  );
  return {
    troopUpkeepRaw: parseFloat(row?.total_upkeep || 0),
    troopWages: parseFloat(row?.total_wages || 0),
  };
}

// Active spell modifiers and active_effects rows for a province (tolerates missing tables)
async function loadRateEffects(provinceId, db = pool) {
  let spellModifiers = [], activeEffects = [];
  try {
    const { rows } = await db.query(
      `SELECT effect_json FROM spell_effects
       WHERE target_province_id = $1 AND expires_at > NOW()
         AND effect_json->>'modifier_type' IS NOT NULL`,
      [provinceId]
    );
    spellModifiers = rows.map(r => r.effect_json).filter(Boolean);
  } catch (_) { /* spell_effects table may not exist yet during migration */ }
  try {
    const { rows } = await db.query(
      `SELECT modifier_key, modifier_value, effect_type FROM active_effects
       WHERE province_id = $1 AND expires_at > NOW()`,
      [provinceId]
    );
    activeEffects = rows;
  } catch (_) { /* active_effects table may not exist yet during migration */ }
  return { spellModifiers, activeEffects };
}

// A building's level is raised when its upgrade starts; its bonus only counts once the upgrade
// finishes, so effects and requirements read this instead of the raw level
const EFFECTIVE_LEVEL_SQL = 'level - CASE WHEN is_upgrading AND upgrade_completes_at > NOW() THEN 1 ELSE 0 END';

// Max level 8 (Phase 2 B2); the War Hall stays at 5, its unlocks end there
const MAX_BUILDING_LEVEL = 8;
function maxBuildingLevel(buildingType) {
  return buildingType === 'war_hall' ? 5 : MAX_BUILDING_LEVEL;
}

// Cost growth per level: x1.8 up to level 5, x2.5 per level after, so levels 6-8 are season-long goals
function buildingCostMultiplier(targetLevel) {
  return Math.pow(1.8, Math.min(targetLevel, 5) - 1) * Math.pow(2.5, Math.max(0, targetLevel - 5));
}

/**
 * Get building level map for a province.
 */
async function getBuildingLevels(provinceId, db = pool) {
  const { rows } = await db.query(
    `SELECT building_type, ${EFFECTIVE_LEVEL_SQL} AS level FROM province_buildings WHERE province_id = $1`,
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
    await client.query('BEGIN');
    // Row lock serializes concurrent updates (cron tick vs dashboard load): the second
    // caller waits, then reads the fresh last_resource_update instead of re-granting the window
    const { rows: [province] } = await client.query(
      'SELECT * FROM provinces WHERE id = $1 FOR UPDATE', [provinceId]
    );
    if (!province) { await client.query('ROLLBACK'); return; }

    const now = Date.now();
    const lastUpdate = new Date(province.last_resource_update).getTime();
    const hoursElapsed = (now - lastUpdate) / 3600000;

    if (hoursElapsed <= 0) { await client.query('ROLLBACK'); return; }

    const buildings = await getBuildingLevels(provinceId, client);
    const { troopUpkeepRaw, troopWages } = await loadTroopTotals(provinceId, client);
    const { spellModifiers, activeEffects } = await loadRateEffects(provinceId, client);
    const { goldRate, foodRate, manaRate, industryRate: productionRate, moraleCap } = computeRates({
      province, buildings, techEffects, troopUpkeepRaw, troopWages, spellModifiers, activeEffects,
    });
    const templeLevel = buildings['temple_altar'] || 0;

    // Calculate totals
    const goldGained = Math.floor(goldRate * hoursElapsed);
    const foodGained = Math.floor(foodRate * hoursElapsed);
    const manaGained = Math.floor(manaRate * hoursElapsed);
    const productionGained = Math.floor(productionRate * hoursElapsed);

    // Starving, or unable to pay troop wages, drains morale
    const unpaidWages = troopWages > 0 && Number(province.gold) + goldGained < 0;
    const { morale, moraleProgress } = computeMorale(
      province.morale ?? MORALE_MAX, province.morale_progress, hoursElapsed,
      Number(province.food) + foodGained < 0 || unpaidWages, templeLevel, moraleCap
    );

    // Apply resource changes (gold/mana/production never go below 0, food can go negative).
    // Morale is written absolutely: the row is locked and was read in this transaction.
    await client.query(
      `UPDATE provinces SET
        gold = GREATEST(0, gold + $1),
        food = food + $2,
        mana = GREATEST(0, mana + $3),
        industry_points = GREATEST(0, industry_points + $4),
        morale = $5,
        morale_progress = $6,
        last_resource_update = NOW(),
        updated_at = NOW()
       WHERE id = $7`,
      [goldGained, foodGained, manaGained, productionGained, morale, moraleProgress, provinceId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Per-building base costs — differentiates building types meaningfully
const BUILDING_BASE_COSTS = {
  farm:              { gold: 300,  industry_points: 30 },
  barracks:          { gold: 600,  industry_points: 60 },
  treasury:          { gold: 400,  industry_points: 40 },
  marketplace_stall: { gold: 350,  industry_points: 35 },
  watchtower:        { gold: 450,  industry_points: 45 },
  walls:             { gold: 700,  industry_points: 70 },
  library:           { gold: 500,  industry_points: 50 },
  mine_quarry:       { gold: 400,  industry_points: 40 },
  temple_altar:      { gold: 450,  industry_points: 45 },
  war_hall:          { gold: 800,  industry_points: 80 },
  royal_bank:        { gold: 600,  industry_points: 60 },
  warchief_pit:      { gold: 700,  industry_points: 70 },
  crypt:             { gold: 550,  industry_points: 55 },
  ancient_grove:     { gold: 550,  industry_points: 55 },
  runic_forge:       { gold: 650,  industry_points: 65 },
  arcane_sanctum:    { gold: 900,  industry_points: 90 },
  shadowveil_den:    { gold: 600,  industry_points: 60 },
  artificers_foundry:{ gold: 700,  industry_points: 70 },
  ashfire_altar:     { gold: 650,  industry_points: 65 },
  tidal_basin:       { gold: 600,  industry_points: 60 },
};

/**
 * Calculate building cost for a given level.
 * base_cost is per-building-type; falls back to { gold: 500, industry_points: 50 }
 * level_cost = base_cost * (1.8 ^ (target_level - 1))
 */
function calculateBuildingCost(targetLevel, race, buildingType) {
  const cfg = raceConfig[race];
  const base = BUILDING_BASE_COSTS[buildingType] || { gold: 500, industry_points: 50 };
  const multiplier = buildingCostMultiplier(targetLevel);
  // L1=20s, L2=60s, L3=3min, L4=9min, L5=27min, L6=81min, L7=4h, L8=12h (×3 per level)
  const timeSeconds = Math.round(20 * Math.pow(3, targetLevel - 1));
  return {
    gold: Math.ceil(base.gold * multiplier * cfg.buildingCostMultiplier),
    industry_points: Math.ceil(base.industry_points * multiplier * cfg.buildingCostMultiplier),
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

module.exports = { lazyResourceUpdate, calculateBuildingCost, getLandForBuildingLevel, getBuildingLevels, computeRates, loadRateEffects, loadTroopTotals,
  EFFECTIVE_LEVEL_SQL, maxBuildingLevel, buildingCostMultiplier };
