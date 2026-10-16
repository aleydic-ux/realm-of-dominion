const pool = require('../config/db');

/**
 * Loads all completed tech effects for a province.
 * Returns an array of effect_json objects.
 */
async function getProvinceTechEffects(provinceId, db = pool) {
  const { rows } = await db.query(
    `SELECT tt.effect_json FROM province_research pr
     JOIN tech_tree tt ON tt.id = pr.tech_id
     WHERE pr.province_id = $1 AND pr.status = 'complete'`,
    [provinceId]
  );
  return rows.map(r => r.effect_json).filter(Boolean);
}

// An effect hits a target through `target` or a `targets` list (e.g. attack and defense)
function hitsTarget(effect, target) {
  return effect.target === target || (Array.isArray(effect.targets) && effect.targets.includes(target));
}

// Effects scoped to one troop type ('troop_name:Knight') apply per troop, not to a whole total
function troopScope(effect) {
  return typeof effect.scope === 'string' && effect.scope.startsWith('troop_name:')
    ? effect.scope.slice('troop_name:'.length)
    : null;
}

/**
 * Applies all matching tech modifiers to a base value.
 * Troop-scoped effects are skipped here; troopModifier() applies them per troop.
 * @param {number} baseValue
 * @param {string} target - e.g. 'troop_attack', 'food_production'
 * @param {Array} effects - array of effect_json objects
 * @returns {number} modified value
 */
function applyTechModifiers(baseValue, target, effects) {
  let result = baseValue;
  for (const effect of effects) {
    if (!effect || !hitsTarget(effect, target) || troopScope(effect)) continue;
    if (effect.modifier_type === 'multiplier') {
      result = result * (1 + effect.value);
    } else if (effect.modifier_type === 'flat') {
      result = result + effect.value;
    }
  }
  return result;
}

/** Multiplier from effects scoped to one troop type, e.g. Chivalric Code on Knights. */
function troopModifier(troopName, target, effects) {
  let mult = 1;
  for (const effect of effects) {
    if (effect && effect.modifier_type === 'multiplier' && hitsTarget(effect, target) && troopScope(effect) === troopName) {
      mult *= 1 + effect.value;
    }
  }
  return mult;
}

/** Sum of the values of every effect on a target (for flat bonuses and additive percentages). */
function sumEffects(target, effects) {
  let total = 0;
  for (const effect of effects) {
    if (effect && hitsTarget(effect, target) && typeof effect.value === 'number') total += effect.value;
  }
  return total;
}

/**
 * Check if a specific unlock tech is researched.
 */
function hasUnlock(target, effects) {
  return effects.some(e => e && e.modifier_type === 'unlock' && e.target === target);
}

/** Diplomacy I/III: alliance buffs are this much stronger for the province (1 = no bonus). */
function allianceBuffMultiplier(effects) {
  return 1 + sumEffects('alliance_bonus', effects);
}

module.exports = {
  getProvinceTechEffects, applyTechModifiers, troopModifier, sumEffects, hasUnlock, allianceBuffMultiplier,
};
