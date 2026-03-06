const pool = require('../config/db');

/**
 * Loads all completed tech effects for a province.
 * Returns an array of effect_json objects.
 */
async function getProvinceTechEffects(provinceId) {
  const { rows } = await pool.query(
    `SELECT tt.effect_json FROM province_research pr
     JOIN tech_tree tt ON tt.id = pr.tech_id
     WHERE pr.province_id = $1 AND pr.status = 'complete'`,
    [provinceId]
  );
  return rows.map(r => r.effect_json).filter(Boolean);
}

/**
 * Applies all matching tech modifiers to a base value.
 * @param {number} baseValue
 * @param {string} target - e.g. 'troop_attack', 'food_production'
 * @param {Array} effects - array of effect_json objects
 * @returns {number} modified value
 */
function applyTechModifiers(baseValue, target, effects) {
  let result = baseValue;
  for (const effect of effects) {
    if (!effect || effect.target !== target) continue;
    if (effect.modifier_type === 'multiplier') {
      result = result * (1 + effect.value);
    } else if (effect.modifier_type === 'flat') {
      result = result + effect.value;
    }
  }
  return result;
}

/**
 * Check if a specific unlock tech is researched.
 */
function hasUnlock(target, effects) {
  return effects.some(e => e && e.modifier_type === 'unlock' && e.target === target);
}

module.exports = { getProvinceTechEffects, applyTechModifiers, hasUnlock };
