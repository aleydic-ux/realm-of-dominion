const pool = require('../config/db');
const { RECIPES, COST_RESOURCE_MAP } = require('../constants/craftingRecipes');
const { lazyResourceUpdate, getBuildingLevels, calculateBuildingCost } = require('./resourceEngine');
const { resolveAttack } = require('./combatEngine');
const { calculateAndStoreNetworth } = require('./networthCalc');
const { getProvinceTechEffects } = require('./techEngine');
const raceConfig = require('../config/raceConfig');

// ─── Personality configs ─────────────────────────────────────────────────────
// attackRatio: minimum (bot troops / target troops) ratio required to attack
// buildPriority: 'food' | 'gold' | 'army' | 'mixed'
// trainRate: multiplier on how many troops to train per tick
const PERSONALITIES = {
  passive:    { attackRatio: Infinity, buildPriority: 'food',  trainRate: 0.25 },
  economic:   { attackRatio: 2.0,     buildPriority: 'gold',  trainRate: 0.40 },
  aggressive: { attackRatio: 1.5,     buildPriority: 'army',  trainRate: 0.70 },
  adaptive:   { attackRatio: 1.3,     buildPriority: 'mixed', trainRate: 0.50 },
};

const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall', 'arcane_sanctum',
];
const RACE_BUILDINGS = {
  human: 'royal_bank', orc: 'warchief_pit', undead: 'crypt',
  elf: 'ancient_grove', dwarf: 'runic_forge',
};
const BOT_RACES = ['human', 'orc', 'undead', 'elf', 'dwarf'];
const MIN_WORLD_POPULATION = 12; // spawn more bots if total kingdoms < this

const BOT_NAMES = [
  'Ironhold', 'Grimveil', 'Thornshire', 'Embervast', 'Coldmere',
  'Duskfall', 'Ravenmark', 'Stonehaven', 'Ashwood', 'Bleakspire',
  'Crestmoor', 'Darkwater', 'Evenmire', 'Frostgate', 'Gilden Peak',
  'Hollow Crown', 'Ironsong', 'Jadehaven', 'Killmore Keep', 'Lionspire',
  'Mordenhall', 'Nightveil', 'Obsidhaven', 'Pyreholt', 'Quarrymere',
  'Rustmoor', 'Shadowfang', 'Thornwall', 'Umbragate', 'Vexhaven',
];

// Personality distribution for auto-spawned bots
const PERSONALITY_DIST = [
  'passive','passive','passive','passive',
  'economic','economic','economic',
  'aggressive','aggressive',
  'adaptive',
];

function getRandomPersonality() {
  return PERSONALITY_DIST[Math.floor(Math.random() * PERSONALITY_DIST.length)];
}

// ─── Protection rules ────────────────────────────────────────────────────────

function isNewProvince(province) {
  const ageHours = (Date.now() - new Date(province.created_at || province.bot_spawn_at || 0).getTime()) / 3600000;
  return ageHours < 48;
}

function isInactiveProvince(province) {
  const lastActive = new Date(province.last_resource_update || province.updated_at || 0).getTime();
  const daysSinceActive = (Date.now() - lastActive) / (3600000 * 24);
  return daysSinceActive > 7;
}

async function attacksAgainstTargetToday(botId, targetId) {
  try {
    const { rows: [r] } = await pool.query(
      `SELECT COUNT(*) as count FROM attacks
       WHERE attacker_province_id = $1 AND defender_province_id = $2
         AND attacked_at > NOW() - INTERVAL '24 hours'`,
      [botId, targetId]
    );
    return parseInt(r.count);
  } catch { return 0; }
}

function isValidTarget(bot, target, personality) {
  if (personality === 'passive') return false;           // passive never attacks
  if (isNewProvince(target)) return false;               // 48h new-player protection
  if (isInactiveProvince(target)) return false;          // 7-day inactivity protection
  if (target.id === bot.id) return false;
  return true;
}

// ─── Action logging ──────────────────────────────────────────────────────────

async function logAction(botId, actionType, targetId, result, reason) {
  try {
    await pool.query(
      `INSERT INTO bot_action_log (bot_id, action_type, target_id, result, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [botId, actionType, targetId || null, result, reason]
    );
  } catch { /* non-critical */ }
}

async function updateLastAction(botId) {
  try {
    await pool.query(
      `UPDATE provinces SET bot_last_action_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [botId]
    );
  } catch { /* non-critical */ }
}

// ─── Spawn bots (for season rollover) ───────────────────────────────────────

async function spawnBots(client, ageId, protectionEndsAt) {
  const botConfigs = [
    { personality: 'passive',    count: 3 },
    { personality: 'economic',   count: 3 },
    { personality: 'aggressive', count: 3 },
    { personality: 'adaptive',   count: 1 },
  ];

  const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let nameIdx = 0;

  for (const { personality, count } of botConfigs) {
    for (let i = 0; i < count; i++) {
      const name = shuffledNames[nameIdx++ % shuffledNames.length];
      const race = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];
      const aggressionLevel = personality === 'aggressive' ? 0.7 + Math.random() * 0.3
        : personality === 'passive' ? 0.1 + Math.random() * 0.2
        : 0.3 + Math.random() * 0.4;

      const { rows: [newBot] } = await client.query(
        `INSERT INTO provinces
           (user_id, age_id, name, race, is_bot, bot_difficulty, bot_personality,
            bot_aggression_level, bot_spawn_at, protection_ends_at)
         VALUES (NULL, $1, $2, $3, true, $4, $4, $5, NOW(), $6) RETURNING id`,
        [ageId, name, race, personality, aggressionLevel, protectionEndsAt]
      );

      const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]].filter(Boolean);
      for (const bt of buildingTypes) {
        await client.query(
          `INSERT INTO province_buildings (province_id, building_type) VALUES ($1, $2)`,
          [newBot.id, bt]
        );
      }

      const { rows: troopTypes } = await client.query(
        `SELECT id FROM troop_types WHERE race = $1`, [race]
      );
      for (const tt of troopTypes) {
        await client.query(
          `INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1, $2)`,
          [newBot.id, tt.id]
        );
      }
    }
  }

  console.log(`[bot] Spawned 10 bot provinces for age ${ageId}`);
}

// ─── Spawn a single new bot (for auto-population) ───────────────────────────

async function spawnSingleBot(ageId, personality) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const race = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];

    const { rows: [newBot] } = await client.query(
      `INSERT INTO provinces
         (user_id, age_id, name, race, is_bot, bot_difficulty, bot_personality,
          bot_aggression_level, bot_spawn_at)
       VALUES (NULL, $1, $2, $3, true, $4, $4, $5, NOW()) RETURNING id`,
      [ageId, name, race, personality, 0.3 + Math.random() * 0.5]
    );

    const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]].filter(Boolean);
    for (const bt of buildingTypes) {
      await client.query(
        `INSERT INTO province_buildings (province_id, building_type) VALUES ($1, $2)`,
        [newBot.id, bt]
      );
    }

    const { rows: troopTypes } = await client.query(
      `SELECT id FROM troop_types WHERE race = $1`, [race]
    );
    for (const tt of troopTypes) {
      await client.query(
        `INSERT INTO province_troops (province_id, troop_type_id) VALUES ($1, $2)`,
        [newBot.id, tt.id]
      );
    }

    await client.query('COMMIT');
    console.log(`[bot] Auto-spawned ${personality} bot "${name}" (${race})`);
    return newBot.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Respawn a wiped bot ─────────────────────────────────────────────────────

async function respawnWipedBots() {
  try {
    // A bot is "wiped" if it has 0 land or no troops home AND hasn't acted in 24h
    const { rows: wiped } = await pool.query(
      `SELECT p.id, p.bot_personality, p.age_id FROM provinces p
       JOIN ages a ON a.id = p.age_id AND a.is_active = true
       WHERE p.is_bot = true AND p.land <= 10
         AND (p.bot_last_action_at IS NULL OR p.bot_last_action_at < NOW() - INTERVAL '24 hours')`
    );

    for (const bot of wiped) {
      await pool.query(
        `UPDATE provinces SET
           land = 100, gold = 5000, food = 2000, mana = 500,
           industry_points = 1000, population = 500, morale = 100,
           action_points = 20, bot_spawn_at = NOW(), bot_last_action_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [bot.id]
      );
      await pool.query(
        `UPDATE province_troops SET count_home = 0, count_training = 0, count_deployed = 0,
           training_completes_at = NULL, updated_at = NOW()
         WHERE province_id = $1`,
        [bot.id]
      );
      // Give starting T1 troops so respawned bots aren't helpless
      await pool.query(
        `UPDATE province_troops SET count_home = 40, updated_at = NOW()
         WHERE province_id = $1
           AND troop_type_id IN (
             SELECT tt.id FROM troop_types tt
             JOIN provinces p ON p.race = tt.race AND p.id = $1
             WHERE tt.tier = 1 LIMIT 1
           )`,
        [bot.id]
      );
      console.log(`[bot] Respawned wiped bot id=${bot.id}`);
    }
  } catch (err) {
    console.error('[bot] Respawn check failed:', err.message);
  }
}

// ─── Auto-population ─────────────────────────────────────────────────────────

async function autoPopulate() {
  try {
    const { rows: [age] } = await pool.query(`SELECT id FROM ages WHERE is_active = true LIMIT 1`);
    if (!age) return;

    const { rows: [counts] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_bot = false) as players,
         COUNT(*) FILTER (WHERE is_bot = true)  as bots
       FROM provinces p
       JOIN ages a ON a.id = p.age_id AND a.is_active = true`
    );

    const total = parseInt(counts.players) + parseInt(counts.bots);
    if (total < MIN_WORLD_POPULATION) {
      const needed = MIN_WORLD_POPULATION - total;
      for (let i = 0; i < needed; i++) {
        await spawnSingleBot(age.id, getRandomPersonality()).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[bot] Auto-populate failed:', err.message);
  }
}

// ─── Main bot tick ────────────────────────────────────────────────────────────

async function tickBots() {
  const { rows: bots } = await pool.query(
    `SELECT p.* FROM provinces p
     JOIN ages a ON a.id = p.age_id
     WHERE a.is_active = true AND p.is_bot = true`
  );

  if (!bots.length) return;
  console.log(`[bot] Ticking ${bots.length} bot provinces`);

  // Stagger each bot with random 0-15s jitter to avoid DB spikes
  for (const bot of bots) {
    const jitter = Math.random() * 15000;
    setTimeout(() => tickSingleBot(bot).catch(err =>
      console.error(`[bot] Error ticking ${bot.name}:`, err.message)
    ), jitter);
  }

  // Respawn wiped bots and auto-populate (run after jitter window)
  setTimeout(async () => {
    await respawnWipedBots();
    await autoPopulate();
  }, 20000);
}

async function tickSingleBot(bot) {
  await lazyResourceUpdate(bot.id);

  const { rows: [province] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [bot.id]);
  if (!province) return;

  const personality = province.bot_personality || 'economic';
  const config = PERSONALITIES[personality] || PERSONALITIES.economic;

  // ── Bot decision order ──
  // 1. Explore for land (spend AP to grow)
  // 2. Upgrade buildings (farms/barracks/treasury)
  // 3. Train troops
  // 4. Attack if army ratio sufficient
  // 5. Craft if tower owned
  // 6. Marketplace — list surplus resources + buy bargains

  // 1. Explore — spend AP to gain land
  await botExplore(province, config);

  // 2. Upgrade buildings
  const { rows: [afterExplore] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [province.id]);
  if (afterExplore) await botUpgradeBuildings(afterExplore, config);

  // 3. Train troops
  const { rows: [afterBuild] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [province.id]);
  if (afterBuild) await botTrainTroops(afterBuild, config);

  // 4. Attack
  const { rows: [refreshed] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [province.id]);
  if (refreshed && refreshed.action_points >= 3 && personality !== 'passive') {
    await botAttack(refreshed, personality, config);
  }

  // 5. Craft
  await botCraftingTick(province);

  // 6. Marketplace — list surplus resources + buy bargains
  const { rows: [afterCraft] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [province.id]);
  if (afterCraft) await botMarketplaceTick(afterCraft, personality);

  await updateLastAction(bot.id);
  await calculateAndStoreNetworth(province.id);
}

// ─── Explore land ────────────────────────────────────────────────────────────
// Bots spend AP to explore and gain land, just like players do.
// Aggressive bots explore less (save AP for attacks), passive/economic explore more.

async function botExplore(province, config) {
  // How many explores to do per tick based on personality
  const exploreCount = config.buildPriority === 'army' ? 2
    : config.buildPriority === 'food' ? 5
    : config.buildPriority === 'gold' ? 4
    : 3; // mixed

  const maxExplores = Math.min(exploreCount, province.action_points - 1); // keep 1 AP reserve
  if (maxExplores <= 0) return;

  const cfg = raceConfig[province.race];
  let totalLand = 0;

  for (let i = 0; i < maxExplores; i++) {
    const landGained = 5 + Math.floor(Math.random() * 21); // 5-25 acres
    const adjustedLand = Math.floor(landGained * cfg.landResourceYieldMultiplier);
    totalLand += adjustedLand;
  }

  await pool.query(
    `UPDATE provinces SET
      action_points = action_points - $1,
      land = land + $2,
      updated_at = NOW()
     WHERE id = $3`,
    [maxExplores, totalLand, province.id]
  );

  await logAction(province.id, 'explore', null, 'success', `explored ${totalLand} acres (${maxExplores} expeditions)`);
}

// ─── Upgrade buildings ──────────────────────────────────────────────────────
// Bots upgrade key buildings based on personality priority.

async function botUpgradeBuildings(province, config) {
  // Don't build if low on gold
  if (province.gold < 500) return;

  const { rows: buildings } = await pool.query(
    `SELECT * FROM province_buildings WHERE province_id = $1`,
    [province.id]
  );

  // Check if anything is already upgrading
  const upgrading = buildings.find(b => b.is_upgrading);
  if (upgrading) {
    // Check if it's done
    const done = !upgrading.upgrade_completes_at || new Date(upgrading.upgrade_completes_at).getTime() <= Date.now();
    if (done) {
      await pool.query(
        `UPDATE province_buildings SET is_upgrading = false, upgrade_completes_at = NULL, updated_at = NOW()
         WHERE province_id = $1 AND building_type = $2`,
        [province.id, upgrading.building_type]
      );
    } else {
      return; // wait for current upgrade
    }
  }

  // Priority order based on personality
  let priorities;
  if (config.buildPriority === 'army') {
    priorities = ['barracks', 'walls', 'war_hall', 'farm', 'treasury'];
  } else if (config.buildPriority === 'food') {
    priorities = ['farm', 'treasury', 'barracks', 'walls', 'library'];
  } else if (config.buildPriority === 'gold') {
    priorities = ['treasury', 'farm', 'marketplace_stall', 'barracks', 'library'];
  } else {
    priorities = ['farm', 'barracks', 'treasury', 'walls', 'library'];
  }

  for (const bt of priorities) {
    const building = buildings.find(b => b.building_type === bt);
    if (!building || building.level >= 5) continue;

    const targetLevel = building.level + 1;
    const cost = calculateBuildingCost(targetLevel, province.race, bt);
    if (province.gold < cost.gold || province.industry_points < cost.industry_points) continue;

    // Build it
    const buildTimeHours = cost.time_hours;
    const completesAt = new Date(Date.now() + buildTimeHours * 3600000);

    await pool.query(
      `UPDATE provinces SET gold = gold - $1, industry_points = industry_points - $2, updated_at = NOW()
       WHERE id = $3`,
      [cost.gold, cost.industry_points, province.id]
    );
    await pool.query(
      `UPDATE province_buildings SET level = level + 1, is_upgrading = true, upgrade_completes_at = $1, updated_at = NOW()
       WHERE province_id = $2 AND building_type = $3`,
      [completesAt, province.id, bt]
    );

    await logAction(province.id, 'build', null, 'success', `upgrading ${bt} to level ${targetLevel}`);
    break; // one upgrade per tick
  }
}

// ─── Train troops ─────────────────────────────────────────────────────────────

async function botTrainTroops(province, config) {
  const { rows: [barracksRow] } = await pool.query(
    `SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = 'barracks'`,
    [province.id]
  );
  if (!barracksRow || barracksRow.level === 0) return;

  const maxTier = config.buildPriority === 'army' ? 3 : config.buildPriority === 'mixed' ? 2 : 1;
  const { rows: troopTypes } = await pool.query(
    `SELECT * FROM troop_types WHERE race = $1 AND tier <= $2 ORDER BY tier ASC`,
    [province.race, maxTier]
  );
  if (!troopTypes.length) return;

  const target = troopTypes[Math.floor(Math.random() * troopTypes.length)];
  const budget = Math.floor(province.gold * 0.4 * config.trainRate);
  const canAfford = Math.floor(budget / Math.max(1, target.gold_cost));
  if (canAfford < 3) return;

  const maxTrain = config.buildPriority === 'army' ? 100 : config.buildPriority === 'mixed' ? 60 : 30;
  const trainCount = Math.min(canAfford, maxTrain);
  const cost = trainCount * target.gold_cost;

  await pool.query(
    `UPDATE provinces SET gold = GREATEST(0, gold - $1), updated_at = NOW() WHERE id = $2`,
    [cost, province.id]
  );
  await pool.query(
    `UPDATE province_troops SET count_home = count_home + $1, updated_at = NOW()
     WHERE province_id = $2 AND troop_type_id = $3`,
    [trainCount, province.id, target.id]
  );
  await logAction(province.id, 'train', null, 'success', `trained ${trainCount} ${target.name}`);
}

// ─── Attack ───────────────────────────────────────────────────────────────────

async function botAttack(bot, personality, config) {
  const minLand = Math.floor(bot.land * 0.5);
  const maxLand = Math.floor(bot.land * 2.0);

  const { rows: targets } = await pool.query(
    `SELECT p.* FROM provinces p
     JOIN ages a ON a.id = p.age_id
     WHERE a.is_active = true
       AND p.id != $1
       AND p.land >= $2 AND p.land <= $3
       AND (p.protection_ends_at IS NULL OR p.protection_ends_at <= NOW())
     ORDER BY RANDOM() LIMIT 10`,
    [bot.id, minLand, maxLand]
  );
  if (!targets.length) return;

  // Filter by protection rules
  const validTargets = targets.filter(t => isValidTarget(bot, t, personality));
  if (!validTargets.length) {
    await logAction(bot.id, 'attack', null, 'skipped', 'no valid targets after protection checks');
    return;
  }

  // Prefer real players over other bots
  const playerTargets = validTargets.filter(t => !t.is_bot);
  const candidates = playerTargets.length > 0 ? playerTargets : validTargets;

  // Get bot's offensive troops
  const { rows: botTroops } = await pool.query(
    `SELECT pt.*, tt.tier, tt.offense_power, tt.defense_power, tt.name
     FROM province_troops pt
     JOIN troop_types tt ON tt.id = pt.troop_type_id
     WHERE pt.province_id = $1 AND pt.count_home > 0`,
    [bot.id]
  );
  const offensiveTroops = botTroops.filter(t => t.offense_power > 0 && t.count_home > 0);
  if (!offensiveTroops.length) return;

  const botTotalTroops = offensiveTroops.reduce((s, t) => s + t.count_home, 0);

  // Find a target where our army ratio is sufficient
  let target = null;
  for (const candidate of candidates) {
    // Check daily attack cap (max 2 per target per day)
    const todayAttacks = await attacksAgainstTargetToday(bot.id, candidate.id);
    if (todayAttacks >= 2) continue;

    const { rows: targetTroops } = await pool.query(
      `SELECT pt.count_home FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1 AND tt.defense_power > 0`,
      [candidate.id]
    );
    const targetTotalTroops = targetTroops.reduce((s, t) => s + t.count_home, 1);
    const ratio = botTotalTroops / targetTotalTroops;

    if (ratio >= config.attackRatio) {
      target = candidate;
      break;
    }
  }

  if (!target) {
    await logAction(bot.id, 'attack', null, 'skipped', `army ratio below ${config.attackRatio}`);
    return;
  }

  const deployRatio = 0.6 + Math.random() * 0.2;
  const troopsDeployed = {};
  for (const troop of offensiveTroops) {
    const deploy = Math.floor(troop.count_home * deployRatio);
    if (deploy > 0) troopsDeployed[troop.troop_type_id] = deploy;
  }
  if (!Object.keys(troopsDeployed).length) return;

  const [
    { rows: attackerTroopTypes },
    { rows: defenderTroops },
    { rows: defenderTroopTypes },
    defenderBuildings,
    attackerTechs,
    defenderTechs,
  ] = await Promise.all([
    pool.query('SELECT * FROM troop_types WHERE race = $1', [bot.race]),
    pool.query('SELECT * FROM province_troops WHERE province_id = $1', [target.id]),
    pool.query('SELECT * FROM troop_types WHERE race = $1', [target.race]),
    getBuildingLevels(target.id),
    getProvinceTechEffects(bot.id),
    getProvinceTechEffects(target.id),
  ]);

  // Aggressive bots conquer, others raid
  const attackType = (personality === 'aggressive' && Math.random() < 0.4) ? 'conquest' : 'raid';

  const result = resolveAttack({
    attacker: bot,
    defender: target,
    attackType,
    troopsDeployed,
    attackerTroopTypes,
    defenderTroops,
    defenderTroopTypes,
    buildings: defenderBuildings,
    attackerTechs,
    defenderTechs,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Apply attacker losses
    for (const [troopTypeIdStr, count] of Object.entries(troopsDeployed)) {
      const troopTypeId = parseInt(troopTypeIdStr);
      const lost = result.attackerLosses[troopTypeId] || 0;
      await client.query(
        `UPDATE province_troops SET count_home = GREATEST(0, count_home - $1), updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [lost, bot.id, troopTypeId]
      );
    }

    // Apply defender losses
    for (const [troopTypeIdStr, lost] of Object.entries(result.defenderLosses)) {
      await client.query(
        `UPDATE province_troops SET count_home = GREATEST(0, count_home - $1), updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [lost, target.id, parseInt(troopTypeIdStr)]
      );
    }

    if (result.outcome === 'win') {
      if (result.landGained > 0) {
        await client.query(
          `UPDATE provinces SET land = land + $1, updated_at = NOW() WHERE id = $2`,
          [result.landGained, bot.id]
        );
        await client.query(
          `UPDATE provinces SET land = GREATEST(10, land - $1), updated_at = NOW() WHERE id = $2`,
          [result.landGained, target.id]
        );
      }
      const stolen = result.resourcesStolen;
      if ((stolen.gold || 0) > 0 || (stolen.food || 0) > 0) {
        await client.query(
          `UPDATE provinces SET gold = gold + $1, food = food + $2, updated_at = NOW() WHERE id = $3`,
          [stolen.gold || 0, stolen.food || 0, bot.id]
        );
        await client.query(
          `UPDATE provinces SET gold = GREATEST(0, gold - $1), food = GREATEST(0, food - $2), updated_at = NOW() WHERE id = $3`,
          [stolen.gold || 0, stolen.food || 0, target.id]
        );
      }
    }

    await client.query(
      `UPDATE provinces SET action_points = GREATEST(0, action_points - 3), updated_at = NOW() WHERE id = $1`,
      [bot.id]
    );

    await client.query(
      `INSERT INTO attacks (attacker_province_id, defender_province_id, attack_type,
        attacker_power, defender_power, outcome, land_gained, resources_stolen,
        troops_deployed, attacker_losses, defender_losses, troops_return_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        bot.id, target.id, attackType,
        result.attackerPower, result.defenderPower, result.outcome,
        result.landGained, JSON.stringify(result.resourcesStolen),
        JSON.stringify(troopsDeployed), JSON.stringify(result.attackerLosses),
        JSON.stringify(result.defenderLosses), new Date(Date.now() + 8 * 3600000),
      ]
    );

    await client.query('COMMIT');
    console.log(`[bot] ${bot.name} [${personality}] ${result.outcome} ${attackType} vs ${target.name}`);

    if (result.outcome === 'win') {
      const details = [];
      if (result.landGained > 0) details.push(`${result.landGained} acres seized`);
      if ((result.resourcesStolen.gold || 0) > 0) details.push(`${result.resourcesStolen.gold} gold plundered`);
      const detailStr = details.length ? ` (${details.join(', ')})` : '';
      await pool.query(
        `INSERT INTO world_feed (type, author_name, province_id, message) VALUES ('event','World News',NULL,$1)`,
        [`[WAR] ${bot.name} launched a ${attackType} on ${target.name} and was VICTORIOUS!${detailStr}`]
      ).catch(() => {});
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await logAction(bot.id, 'attack', target.id, result.outcome,
    `${attackType} vs ${target.name} | AP:${result.attackerPower} vs DP:${result.defenderPower}`);
  await calculateAndStoreNetworth(target.id);
}

// ─── Bot Crafting ─────────────────────────────────────────────────────────────

async function botCraftingTick(bot) {
  try {
    await botCollectCrafts(bot.id);

    const { rows: [tower] } = await pool.query(
      `SELECT * FROM alchemist_towers WHERE province_id = $1`, [bot.id]
    );

    if (!tower) {
      const { rows: [p] } = await pool.query(
        `SELECT gold, industry_points FROM provinces WHERE id = $1`, [bot.id]
      );
      if (p && p.gold >= 800 && p.industry_points >= 350) {
        await pool.query(
          `INSERT INTO alchemist_towers (province_id, tier, crafting_slots) VALUES ($1, 1, 2)
           ON CONFLICT (province_id) DO NOTHING`,
          [bot.id]
        );
        await pool.query(
          `UPDATE provinces SET gold = gold - 800, industry_points = industry_points - 350, updated_at = NOW()
           WHERE id = $1`,
          [bot.id]
        );
      }
      return;
    }

    const { rows: [qc] } = await pool.query(
      `SELECT COUNT(*) as count FROM crafting_queue WHERE province_id = $1 AND status = 'in_progress'`,
      [bot.id]
    );
    if (parseInt(qc.count) >= tower.crafting_slots) return;

    const { rows: [province] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [bot.id]);
    if (!province) return;

    const BOT_PREFERRED = ['harvest_tonic', 'gold_infusion', 'industry_surge'];
    const candidates = BOT_PREFERRED.filter(key => {
      const r = RECIPES[key];
      return r && r.tier_required <= tower.tier && canBotAfford(province, r.cost);
    });
    if (!candidates.length) return;

    const itemKey = candidates[Math.floor(Math.random() * candidates.length)];
    const recipe = RECIPES[itemKey];

    const setClauses = [];
    const vals = [];
    let idx = 1;
    for (const [k, amount] of Object.entries(recipe.cost)) {
      const col = COST_RESOURCE_MAP[k];
      setClauses.push(`${col} = GREATEST(0, ${col} - $${idx})`);
      vals.push(amount);
      idx++;
    }
    vals.push(bot.id);
    await pool.query(
      `UPDATE provinces SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, vals
    );

    const completesAt = new Date(Date.now() + recipe.craft_time_mins * 60000);
    await pool.query(
      `INSERT INTO crafting_queue (province_id, item_key, quantity, completes_at) VALUES ($1, $2, 1, $3)`,
      [bot.id, itemKey, completesAt]
    );

    await botListExcess(bot.id);
  } catch (_) { /* non-critical */ }
}

function canBotAfford(province, cost) {
  for (const [k, amount] of Object.entries(cost)) {
    const col = COST_RESOURCE_MAP[k];
    if ((province[col] || 0) < amount) return false;
  }
  return true;
}

async function botCollectCrafts(botId) {
  const { rows: completed } = await pool.query(
    `SELECT * FROM crafting_queue
     WHERE province_id = $1 AND status = 'in_progress' AND completes_at <= NOW()`,
    [botId]
  );
  for (const job of completed) {
    await pool.query(
      `INSERT INTO crafted_items (province_id, item_key, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (province_id, item_key) DO UPDATE SET quantity = crafted_items.quantity + $3`,
      [botId, job.item_key, job.quantity]
    );
    await pool.query(`UPDATE crafting_queue SET status = 'completed' WHERE id = $1`, [job.id]);
  }
}

async function botListExcess(botId) {
  const { rows: items } = await pool.query(
    `SELECT item_key, quantity FROM crafted_items WHERE province_id = $1 AND quantity > 3`,
    [botId]
  );
  for (const item of items) {
    const recipe = RECIPES[item.item_key];
    if (!recipe || recipe.effect_type !== 'resource_boost') continue;

    const { rows: existing } = await pool.query(
      `SELECT id FROM marketplace_listings
       WHERE seller_province_id = $1 AND item_key = $2 AND is_sold = false AND expires_at > NOW()`,
      [botId, item.item_key]
    );
    if (existing.length) continue;

    const { rows: [avg] } = await pool.query(
      `SELECT ROUND(AVG(price_per_unit), 0) as avg_price FROM marketplace_listings
       WHERE item_key = $1 AND is_sold = true`,
      [item.item_key]
    );
    const price = Math.max(10, Math.floor((parseFloat(avg?.avg_price) || 50) * 0.9));
    const listQty = item.quantity - 2;
    if (listQty < 1) continue;

    await pool.query(
      `UPDATE crafted_items SET quantity = quantity - $1 WHERE province_id = $2 AND item_key = $3`,
      [listQty, botId, item.item_key]
    );
    const expiresAt = new Date(Date.now() + 72 * 3600000);
    await pool.query(
      `INSERT INTO marketplace_listings (seller_province_id, item_key, quantity, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [botId, item.item_key, listQty, price, expiresAt]
    );
  }
}

// ─── Bot Marketplace ─────────────────────────────────────────────────────────
// Bots list surplus resources for sale and buy bargains from the marketplace.
// Undead bots skip selling (lore restriction). All bots can buy.

// Surplus thresholds — bot lists excess above these levels
const SURPLUS_THRESHOLDS = {
  gold:             { passive: 15000, economic: 10000, aggressive: 8000, adaptive: 10000 },
  food:             { passive: 8000,  economic: 6000,  aggressive: 5000, adaptive: 6000  },
  mana:             { passive: 3000,  economic: 3000,  aggressive: 2000, adaptive: 2500  },
  industry_points:  { passive: 5000,  economic: 4000,  aggressive: 3000, adaptive: 4000  },
};

// Base prices bots use when no market history exists
const BASE_PRICES = { gold: 1, food: 2, mana: 4, industry_points: 3 };

// What each personality wants to buy
const BUY_PRIORITIES = {
  passive:    ['food', 'mana'],
  economic:   ['food', 'industry_points'],
  aggressive: ['food', 'gold'],
  adaptive:   ['food', 'mana', 'industry_points'],
};

async function botMarketplaceTick(bot, personality) {
  try {
    // Selling: list surplus resources (skip undead — lore restriction)
    if (bot.race !== 'undead') {
      await botListResources(bot, personality);
    }

    // Buying: look for bargains
    await botBuyListings(bot, personality);
  } catch (err) {
    // Non-critical — don't let marketplace errors block other bot actions
  }
}

async function botListResources(bot, personality) {
  // Check listing slot availability
  const { rows: [stall] } = await pool.query(
    `SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = 'marketplace_stall'`,
    [bot.id]
  );
  const maxSlots = Math.max(1, stall ? stall.level : 1);
  const { rows: [{ count: activeCount }] } = await pool.query(
    `SELECT COUNT(*) as count FROM marketplace_listings
     WHERE seller_province_id = $1 AND is_sold = false AND expires_at > NOW()`,
    [bot.id]
  );
  const slotsAvailable = maxSlots - parseInt(activeCount);
  if (slotsAvailable <= 0) return;

  const resources = ['gold', 'food', 'mana', 'industry_points'];
  let listed = 0;

  for (const res of resources) {
    if (listed >= slotsAvailable) break;

    const threshold = SURPLUS_THRESHOLDS[res]?.[personality] || 10000;
    const surplus = bot[res] - threshold;
    if (surplus <= 0) continue;

    // List 30-60% of surplus
    const listPct = 0.3 + Math.random() * 0.3;
    const listQty = Math.floor(surplus * listPct);
    if (listQty < 50) continue; // not worth listing tiny amounts

    // Don't list gold for gold — that's pointless
    if (res === 'gold') continue;

    // Check if we already have an active listing for this resource
    const { rows: existing } = await pool.query(
      `SELECT id FROM marketplace_listings
       WHERE seller_province_id = $1 AND resource_type = $2 AND is_sold = false AND expires_at > NOW()`,
      [bot.id, res]
    );
    if (existing.length) continue;

    // Price: use recent avg or base price, with ±15% variation
    const { rows: [avgRow] } = await pool.query(
      `SELECT ROUND(AVG(price_per_unit), 2) as avg_price FROM marketplace_listings
       WHERE resource_type = $1 AND is_sold = true AND sold_at > NOW() - INTERVAL '48 hours'`,
      [res]
    );
    const avgPrice = parseFloat(avgRow?.avg_price) || BASE_PRICES[res] || 2;
    const variation = 0.85 + Math.random() * 0.30; // 85%-115% of avg
    const price = Math.max(1, Math.round(avgPrice * variation));

    // Deduct resources and create listing
    await pool.query(
      `UPDATE provinces SET ${res} = ${res} - $1, updated_at = NOW() WHERE id = $2`,
      [listQty, bot.id]
    );
    const expiresAt = new Date(Date.now() + 48 * 3600000); // 48h listing
    await pool.query(
      `INSERT INTO marketplace_listings (seller_province_id, resource_type, quantity, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [bot.id, res, listQty, price, expiresAt]
    );

    listed++;
    await logAction(bot.id, 'market_list', null, 'success', `listed ${listQty} ${res} at ${price}g each`);
  }
}

async function botBuyListings(bot, personality) {
  // Need gold to buy and at least some budget
  const budget = Math.floor(bot.gold * 0.15); // spend up to 15% of gold
  if (budget < 100) return;

  const wantedResources = BUY_PRIORITIES[personality] || ['food'];

  // Find cheap listings (not our own, not expired)
  const { rows: listings } = await pool.query(
    `SELECT ml.id, ml.resource_type, ml.item_key, ml.quantity, ml.price_per_unit,
            ml.seller_province_id
     FROM marketplace_listings ml
     WHERE ml.is_sold = false AND ml.expires_at > NOW()
       AND ml.seller_province_id != $1
     ORDER BY ml.price_per_unit ASC
     LIMIT 20`,
    [bot.id]
  );

  if (!listings.length) return;

  let spent = 0;
  for (const listing of listings) {
    if (spent >= budget) break;

    // Check if this is something we want
    const isWantedResource = listing.resource_type && wantedResources.includes(listing.resource_type);
    const isWantedItem = listing.item_key && RECIPES[listing.item_key];

    if (!isWantedResource && !isWantedItem) continue;

    // For resources: only buy if price is reasonable (≤ 150% of base)
    if (listing.resource_type) {
      const basePrice = BASE_PRICES[listing.resource_type] || 2;
      if (listing.price_per_unit > basePrice * 1.5) continue;
    }

    // For items: only buy combat/resource boosters at reasonable prices
    if (listing.item_key) {
      if (listing.price_per_unit > 80) continue; // don't overpay for items
      // Aggressive bots buy combat items, others buy resource boosters
      const recipe = RECIPES[listing.item_key];
      if (!recipe) continue;
      if (personality === 'aggressive' && recipe.effect_type !== 'combat_boost') continue;
      if (personality !== 'aggressive' && recipe.effect_type !== 'resource_boost') continue;
    }

    const totalCost = Math.ceil(listing.quantity * listing.price_per_unit);
    const tax = Math.ceil(totalCost * 0.05);
    const totalWithTax = totalCost + tax;

    if (totalWithTax > budget - spent) continue;

    // Refresh bot gold to make sure we can afford it
    const { rows: [current] } = await pool.query('SELECT gold FROM provinces WHERE id = $1', [bot.id]);
    if (!current || current.gold < totalWithTax) break;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Re-check listing is still available
      const { rows: [fresh] } = await client.query(
        `SELECT * FROM marketplace_listings WHERE id = $1 AND is_sold = false FOR UPDATE`,
        [listing.id]
      );
      if (!fresh) { await client.query('ROLLBACK'); continue; }

      // Deduct buyer gold
      await client.query(
        `UPDATE provinces SET gold = gold - $1, updated_at = NOW() WHERE id = $2`,
        [totalWithTax, bot.id]
      );

      // Give buyer the goods
      if (fresh.item_key) {
        await client.query(
          `INSERT INTO crafted_items (province_id, item_key, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (province_id, item_key) DO UPDATE SET quantity = crafted_items.quantity + $3`,
          [bot.id, fresh.item_key, fresh.quantity]
        );
      } else {
        await client.query(
          `UPDATE provinces SET ${fresh.resource_type} = ${fresh.resource_type} + $1, updated_at = NOW() WHERE id = $2`,
          [fresh.quantity, bot.id]
        );
      }

      // Give seller gold (96% after 4% fee, + race bonus)
      const { rows: [seller] } = await client.query('SELECT race FROM provinces WHERE id = $1', [fresh.seller_province_id]);
      const sellerCfg = raceConfig[seller?.race || 'human'];
      const sellerReceives = Math.floor(totalCost * 0.96 * (1 + sellerCfg.marketplaceSaleBonus));
      await client.query(
        `UPDATE provinces SET gold = gold + $1, updated_at = NOW() WHERE id = $2`,
        [sellerReceives, fresh.seller_province_id]
      );

      // Mark sold
      await client.query(
        `UPDATE marketplace_listings SET is_sold = true, buyer_province_id = $1, sold_at = NOW() WHERE id = $2`,
        [bot.id, listing.id]
      );

      await client.query('COMMIT');
      spent += totalWithTax;

      const what = fresh.item_key
        ? `${fresh.quantity}x ${RECIPES[fresh.item_key]?.name || fresh.item_key}`
        : `${fresh.quantity} ${fresh.resource_type}`;
      await logAction(bot.id, 'market_buy', fresh.seller_province_id, 'success', `bought ${what} for ${totalWithTax}g`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
    } finally {
      client.release();
    }
  }
}

module.exports = { tickBots, spawnBots, spawnSingleBot, respawnWipedBots, autoPopulate };
