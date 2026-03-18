const raceConfig = require('../config/raceConfig');
const { applyTechModifiers } = require('./techEngine');

const BASE_RETURN_HOURS = 8;

/**
 * Resolves a combat encounter.
 * @param {Object} attacker - province + troops + research
 * @param {Object} defender - province + troops + buildings
 * @param {string} attackType - 'raid' | 'conquest' | 'raze' | 'massacre'
 * @param {Object} troopsDeployed - { troop_type_id: count }
 * @param {Array} attackerTechs - attacker's tech effects
 * @param {Array} defenderTechs - defender's tech effects
 */
function resolveAttack({ attacker, defender, attackType, troopsDeployed, attackerTroopTypes, defenderTroops, defenderTroopTypes, buildings, attackerTechs, defenderTechs, attackerSpellEffects = [], defenderSpellEffects = [] }) {
  const attackerCfg = raceConfig[attacker.race];
  const defenderCfg = raceConfig[defender.race];

  // 1. Calculate raw attacker power
  let attackerPower = 0;
  const deployedDetails = {};

  for (const [troopTypeIdStr, count] of Object.entries(troopsDeployed)) {
    const troopTypeId = parseInt(troopTypeIdStr);
    const troopType = attackerTroopTypes.find(t => t.id === troopTypeId);
    if (!troopType || count <= 0) continue;

    // Defense-only troops cannot attack
    if (troopType.tier === 5 && troopType.offense_power === 0) continue;
    if (troopType.name === 'Royal Guard' || troopType.name === 'Treant' || troopType.name === 'Leviathan Guard') continue;

    let offense = troopType.offense_power;

    // Warchief bonus: +5% to all units in same army
    const warchiefCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Warchief')] || 0;
    if (warchiefCount > 0) offense *= 1.05;

    deployedDetails[troopTypeId] = { troopType, count };
    attackerPower += offense * count;
  }

  // Apply race attack bonus
  attackerPower *= attackerCfg.troopAttackMultiplier;

  // Ashborn fury: +3% per consecutive attack streak (max 5 stacks = +15%)
  if (attackerCfg.specialRules.includes('ashborn_fury') && attacker.ashborn_attack_streak > 0) {
    attackerPower *= 1 + (Math.min(5, attacker.ashborn_attack_streak) * 0.03);
  }

  // Apply morale modifier
  const attackerMorale = attacker.morale / 100;
  attackerPower *= (0.5 + attackerMorale * 0.5); // morale 0 = 50% power, morale 100 = 100%, morale 150 = 125%

  // Apply tech modifiers
  attackerPower = applyTechModifiers(attackerPower, 'troop_attack', attackerTechs);
  // Apply active spell buffs (e.g. War Cry)
  attackerPower = applyTechModifiers(attackerPower, 'troop_attack', attackerSpellEffects);

  // Check enemy status (morale +10 when attacking enemy)
  // (handled in route before calling this)

  // 2. Calculate raw defender power
  let defenderPower = 0;
  for (const troop of defenderTroops) {
    if (troop.count_home <= 0) continue;
    const troopType = defenderTroopTypes.find(t => t.id === troop.troop_type_id);
    if (!troopType) continue;

    let defense = troopType.defense_power;

    // Orc Berserker dies when defending (special rule)
    if (troopType.name === 'Berserker' && !hasResearch(defenderTechs, 'berserker_survives_defense')) {
      defense = 0;
    }

    defenderPower += defense * troop.count_home;
  }

  // Apply wall bonus
  const wallLevel = buildings['walls'] || 0;
  const fortressBonus = hasResearch(defenderTechs, 'wall_level_bonus') ? 1 : 0;
  const effectiveWallLevel = wallLevel + fortressBonus;
  const wallBonus = 1 + (effectiveWallLevel * 0.15);

  // Tunnel Rat bypasses walls
  const tunnelRatCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Tunnel Rat')] || 0;
  const totalDeployed = Object.values(troopsDeployed).reduce((a, b) => a + b, 0);
  const wallBypassRatio = totalDeployed > 0 ? Math.min(1, tunnelRatCount / totalDeployed) : 0;
  let effectiveWallBonus = wallBonus * (1 - wallBypassRatio) + 1 * wallBypassRatio;

  // Serpent Hydra: ignores 20% of wall bonus
  const serpentHydraCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Serpent Hydra')] || 0;
  if (serpentHydraCount > 0) {
    effectiveWallBonus = 1 + (effectiveWallBonus - 1) * 0.80;
  }

  defenderPower *= effectiveWallBonus;

  // Apply defender morale
  const defenderMorale = defender.morale / 100;
  defenderPower *= (0.5 + defenderMorale * 0.5);

  // Apply watchtower defense bonus
  const watchtowerLevel = buildings['watchtower'] || 0;
  defenderPower *= 1 + (watchtowerLevel * 0.05);

  // Apply war hall attack bonus for attacker
  const warHallLevel = buildings['war_hall'] || 0; // This is defender's war hall (defensive use)
  // Attacker's war hall used for unlocking troops, not direct combat (handled by training unlock)

  // Apply tech modifiers
  defenderPower = applyTechModifiers(defenderPower, 'troop_defense', defenderTechs);
  // Apply active spell buffs (e.g. Mana Shield)
  defenderPower = applyTechModifiers(defenderPower, 'troop_defense', defenderSpellEffects);
  attackerPower = applyTechModifiers(attackerPower, 'wall_effectiveness', defenderTechs); // inverse

  // 3. Determine outcome
  let outcome;
  if (attackerPower > defenderPower) {
    outcome = 'win';
  } else if (attackerPower < defenderPower * 0.75) {
    outcome = 'loss';
  } else {
    outcome = 'draw';
  }

  // 4. Calculate casualties
  const casualtyRanges = {
    attacker: { win: [0.05, 0.15], draw: [0.15, 0.25], loss: [0.25, 0.40] },
    defender: { win: [0.15, 0.30], draw: [0.10, 0.20], loss: [0.05, 0.15] },
  };

  const [aMin, aMax] = casualtyRanges.attacker[outcome];
  const [dMin, dMax] = casualtyRanges.defender[outcome];
  let attackerCasualtyRate = aMin + Math.random() * (aMax - aMin);
  let defenderCasualtyRate = dMin + Math.random() * (dMax - dMin);

  // Tidewarden retreat penalty: attackers suffer +10% casualties
  if (defenderCfg.specialRules.includes('retreat_penalty_for_attackers')) {
    attackerCasualtyRate *= 1.10;
  }

  // Ashborn battle hardened: -15% defender casualties if province was attacked this season
  if (defenderCfg.specialRules.includes('battle_hardened') && defender.attacked_this_season) {
    defenderCasualtyRate *= 0.85;
  }

  // Apply Iron Hide tech: -15% attacker casualties on loss
  const finalAttackerCasualtyRate = outcome === 'loss'
    ? applyTechModifiers(attackerCasualtyRate, 'attacker_casualties', attackerTechs)
    : attackerCasualtyRate;

  // Apply Blade Dancer: evade 15% of counterattack
  const bladeDancerCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Blade Dancer')] || 0;
  const bladeDancerRatio = totalDeployed > 0 ? bladeDancerCount / totalDeployed : 0;
  let attackerCasualtyRateAdjusted = finalAttackerCasualtyRate * (1 - bladeDancerRatio * 0.15);

  // Thornblade (Serpathi T3): evade 15% of counterattack casualties
  const thornbladeCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Thornblade')] || 0;
  const thornbladeRatio = totalDeployed > 0 ? thornbladeCount / totalDeployed : 0;
  attackerCasualtyRateAdjusted *= (1 - thornbladeRatio * 0.15);

  // Calculate attacker losses
  const attackerLosses = {};
  for (const [troopTypeId, { troopType, count }] of Object.entries(deployedDetails)) {
    const lost = Math.floor(count * attackerCasualtyRateAdjusted);
    if (lost > 0) attackerLosses[troopTypeId] = lost;
  }

  // Calculate defender losses
  const defenderLosses = {};
  for (const troop of defenderTroops) {
    if (troop.count_home <= 0) continue;
    const troopType = defenderTroopTypes.find(t => t.id === troop.troop_type_id);
    if (!troopType || troopType.defense_power === 0) continue;
    const lost = Math.floor(troop.count_home * defenderCasualtyRate);
    if (lost > 0) defenderLosses[troop.troop_type_id] = lost;
  }

  // 5. Special ability effects
  const specialEffects = [];

  // Siege Breaker: destroys one enemy building level on win
  const siegeBreakerCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Siege Breaker')] || 0;
  if (outcome === 'win' && siegeBreakerCount > 0) {
    specialEffects.push({ type: 'destroy_building', race: 'orc' });
  }

  // Ironclad: destroys enemy wall effectiveness by 20% on win
  const ironcladCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Ironclad')] || 0;
  if (outcome === 'win' && ironcladCount > 0) {
    specialEffects.push({ type: 'wall_debuff', value: 0.20 });
  }

  // Death Knight: drains enemy morale -5 on successful attack
  const deathKnightCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Death Knight')] || 0;
  if (outcome === 'win' && deathKnightCount > 0) {
    specialEffects.push({ type: 'morale_drain', value: -5 });
  }

  // Lich: destroys 10% of enemy mana
  const lichCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Lich')] || 0;
  if (lichCount > 0) {
    specialEffects.push({ type: 'mana_drain', value: 0.10 });
  }

  // Cobra Assassin (Serpathi T4): drains enemy morale -3
  const cobraAssassinCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Cobra Assassin')] || 0;
  if (cobraAssassinCount > 0) {
    specialEffects.push({ type: 'morale_drain', value: -3 });
  }

  // Flame Warden (Ashborn T3): drains enemy morale -3 on win
  const flameWardenCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Flame Warden')] || 0;
  if (outcome === 'win' && flameWardenCount > 0) {
    specialEffects.push({ type: 'morale_drain', value: -3 });
  }

  // Infernal Drake (Ashborn T5): burns 15% of enemy food on win
  const infernalDrakeCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Infernal Drake')] || 0;
  if (outcome === 'win' && infernalDrakeCount > 0) {
    specialEffects.push({ type: 'food_burn', value: 0.15 });
  }

  // War Colossus (Ironveil T5): destroys 15% watchtower effectiveness on win
  const warColossusCount = troopsDeployed[getIdByName(attackerTroopTypes, 'War Colossus')] || 0;
  if (outcome === 'win' && warColossusCount > 0) {
    specialEffects.push({ type: 'watchtower_debuff', value: 0.15 });
  }

  // Archmage: reduces enemy DEF by 15% (already handled in power calc conceptually)
  // Wyvern Rider: immune to non-ranged defenders (simplification: +10% effective power)

  // 6. Calculate attack-type specific gains
  let landGained = 0;
  let resourcesStolen = {};

  // Army strength multiplier: scales rewards by troop count and average tier
  // More troops + higher tier = bigger rewards (1.0x to 2.5x)
  let totalTroopCount = 0;
  let weightedTierSum = 0;
  for (const [troopTypeIdStr, count] of Object.entries(troopsDeployed)) {
    const troopType = attackerTroopTypes.find(t => t.id === parseInt(troopTypeIdStr));
    if (!troopType || count <= 0) continue;
    totalTroopCount += count;
    weightedTierSum += troopType.tier * count;
  }
  const avgTier = totalTroopCount > 0 ? weightedTierSum / totalTroopCount : 1;
  // Tier scaling: T1=1.0x, T2=1.15x, T3=1.35x, T4=1.6x, T5=2.0x
  const tierMultiplier = 1 + (avgTier - 1) * 0.25;
  // Troop count scaling: more troops = more loot, soft caps at 2x around 500+ troops
  const countMultiplier = 1 + Math.min(1, Math.log10(Math.max(1, totalTroopCount)) / 2.7);
  // Combined army strength multiplier (1.0x to ~2.5x)
  const armyStrengthMult = Math.min(2.5, tierMultiplier * countMultiplier);

  if (outcome === 'win') {
    if (attackType === 'conquest') {
      // Land gained: 10-30% of attacker's army power ratio, scaled by army strength
      const ratio = attackerPower / Math.max(1, defenderPower);
      const baseLandPct = Math.min(0.30, Math.max(0.10, ratio * 0.10));
      const landPct = Math.min(0.50, baseLandPct * armyStrengthMult);
      landGained = Math.floor(defender.land * landPct);
    }

    if (attackType === 'raid') {
      // Steal resources: 5-15% base, scaled by army strength
      const baseStealPct = 0.05 + Math.random() * 0.10;
      const scaledStealPct = baseStealPct * armyStrengthMult;
      // Human Knight bonus
      const knightCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Knight')] || 0;
      const knightBonus = knightCount > 0 ? 0.10 : 0;
      let finalStealPct = scaledStealPct + knightBonus;
      // Ashborn: +25% raid loot
      if (attackerCfg.specialRules.includes('ashborn_fury')) finalStealPct *= 1.25;
      // Apply Pillage Mastery tech
      const effectiveStealPct = applyTechModifiers(finalStealPct, 'raid_resources', attackerTechs);

      // Deep Raider (Tidewarden T3): +10% gold from raids
      const deepRaiderCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Deep Raider')] || 0;
      const deepRaiderGoldBonus = deepRaiderCount > 0 ? 1.10 : 1.00;

      resourcesStolen = {
        gold: Math.floor(defender.gold * effectiveStealPct * deepRaiderGoldBonus),
        food: Math.floor(defender.food * effectiveStealPct * 0.5),
        mana: Math.floor(defender.mana * effectiveStealPct * 0.3),
      };
    }

    if (attackType === 'raze') {
      // Destroy buildings - handled by special effects
      specialEffects.push({ type: 'raze_building' });
    }

    if (attackType === 'massacre') {
      // Reduce population, scaled by army strength
      specialEffects.push({ type: 'massacre', value: Math.floor(defender.population * 0.10 * armyStrengthMult) });
    }
  }

  // Human marketplace bonus on raid
  if (attackType === 'raid' && attacker.race === 'human' && outcome === 'win') {
    const bonus = raceConfig.human.marketplaceSaleBonus;
    resourcesStolen.gold = Math.floor((resourcesStolen.gold || 0) * (1 + bonus));
  }

  // 7. Calculate return time
  let returnHours = BASE_RETURN_HOURS * attackerCfg.armyReturnSpeedMultiplier;
  // Current Dancer (Tidewarden T2): 2x army return speed
  const currentDancerCount = troopsDeployed[getIdByName(attackerTroopTypes, 'Current Dancer')] || 0;
  if (currentDancerCount > 0) returnHours *= 0.5;
  const troopsReturnAt = new Date(Date.now() + returnHours * 3600000);

  return {
    outcome,
    attackerPower: Math.floor(attackerPower),
    defenderPower: Math.floor(defenderPower),
    attackerLosses,
    defenderLosses,
    landGained,
    resourcesStolen,
    specialEffects,
    troopsReturnAt,
  };
}

function getIdByName(troopTypes, name) {
  const t = troopTypes.find(t => t.name === name);
  return t ? t.id : -1;
}

function hasResearch(techs, target) {
  return techs.some(e => e && e.modifier_type === 'unlock' && e.target === target);
}

module.exports = { resolveAttack };
