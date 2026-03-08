const pool = require('../config/db');
const { lazyResourceUpdate, getBuildingLevels } = require('./resourceEngine');
const { resolveAttack } = require('./combatEngine');
const { calculateAndStoreNetworth } = require('./networthCalc');
const { getProvinceTechEffects } = require('./techEngine');

const UNIVERSAL_BUILDINGS = [
  'farm', 'barracks', 'treasury', 'marketplace_stall', 'watchtower',
  'walls', 'library', 'mine_quarry', 'temple_altar', 'war_hall', 'arcane_sanctum',
];
const RACE_BUILDINGS = {
  human: 'royal_bank', orc: 'warchief_pit', undead: 'crypt',
  elf: 'ancient_grove', dwarf: 'runic_forge',
};
const BOT_RACES = ['human', 'orc', 'undead', 'elf', 'dwarf'];
const BOT_NAMES = [
  'Ironhold', 'Grimveil', 'Thornshire', 'Embervast', 'Coldmere',
  'Duskfall', 'Ravenmark', 'Stonehaven', 'Ashwood', 'Bleakspire',
  'Crestmoor', 'Darkwater', 'Evenmire', 'Frostgate', 'Gilden Peak',
  'Hollow Crown', 'Ironsong', 'Jadehaven', 'Killmore Keep', 'Lionspire',
  'Mordenhall', 'Nightveil', 'Obsidhaven', 'Pyreholt', 'Quarrymere',
  'Rustmoor', 'Shadowfang', 'Thornwall', 'Umbragate', 'Vexhaven',
];

/**
 * Spawn bot provinces when a new season starts.
 * client must be an active pg client inside a BEGIN/COMMIT transaction.
 */
async function spawnBots(client, ageId, protectionEndsAt) {
  const botConfigs = [
    { difficulty: 'easy',   count: 4 },
    { difficulty: 'medium', count: 3 },
    { difficulty: 'hard',   count: 3 },
  ];

  const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let nameIdx = 0;

  for (const { difficulty, count } of botConfigs) {
    for (let i = 0; i < count; i++) {
      const name = shuffledNames[nameIdx++ % shuffledNames.length];
      const race = BOT_RACES[Math.floor(Math.random() * BOT_RACES.length)];

      const { rows: [newBot] } = await client.query(
        `INSERT INTO provinces (user_id, age_id, name, race, is_bot, bot_difficulty, protection_ends_at)
         VALUES (NULL, $1, $2, $3, true, $4, $5) RETURNING id`,
        [ageId, name, race, difficulty, protectionEndsAt]
      );

      // Init buildings
      const buildingTypes = [...UNIVERSAL_BUILDINGS, RACE_BUILDINGS[race]].filter(Boolean);
      for (const bt of buildingTypes) {
        await client.query(
          `INSERT INTO province_buildings (province_id, building_type) VALUES ($1, $2)`,
          [newBot.id, bt]
        );
      }

      // Init troops
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

/**
 * Main bot tick — runs for all bots in the active age.
 */
async function tickBots() {
  const { rows: bots } = await pool.query(
    `SELECT p.* FROM provinces p
     JOIN ages a ON a.id = p.age_id
     WHERE a.is_active = true AND p.is_bot = true`
  );

  if (!bots.length) return;
  console.log(`[bot] Ticking ${bots.length} bot provinces`);

  for (const bot of bots) {
    try {
      await tickSingleBot(bot);
    } catch (err) {
      console.error(`[bot] Error ticking ${bot.name}:`, err.message);
    }
  }
}

async function tickSingleBot(bot) {
  await lazyResourceUpdate(bot.id);

  // Reload fresh after resource update
  const { rows: [province] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [bot.id]);
  if (!province) return;

  const difficulty = province.bot_difficulty || 'easy';

  // Train troops with current gold
  await botTrainTroops(province, difficulty);

  // Attack if AP available — re-read after training (gold changed)
  const { rows: [refreshed] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [province.id]);
  if (refreshed && refreshed.action_points >= 3) {
    // Bots don't always attack — probability varies by difficulty
    const attackChance = difficulty === 'hard' ? 0.80 : difficulty === 'medium' ? 0.55 : 0.30;
    if (Math.random() < attackChance) {
      await botAttack(refreshed, difficulty);
    }
  }

  await calculateAndStoreNetworth(province.id);
}

async function botTrainTroops(province, difficulty) {
  const { rows: [barracksRow] } = await pool.query(
    `SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = 'barracks'`,
    [province.id]
  );
  if (!barracksRow || barracksRow.level === 0) return;

  const maxTier = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
  const { rows: troopTypes } = await pool.query(
    `SELECT * FROM troop_types WHERE race = $1 AND tier <= $2 ORDER BY tier ASC`,
    [province.race, maxTier]
  );
  if (!troopTypes.length) return;

  // Pick a random eligible troop type
  const target = troopTypes[Math.floor(Math.random() * troopTypes.length)];
  const budget = Math.floor(province.gold * 0.4); // spend up to 40% of gold
  const canAfford = Math.floor(budget / Math.max(1, target.gold_cost));
  if (canAfford < 3) return;

  const maxTrain = difficulty === 'hard' ? 50 : difficulty === 'medium' ? 25 : 12;
  const trainCount = Math.min(canAfford, maxTrain);
  const cost = trainCount * target.gold_cost;

  await pool.query(
    `UPDATE provinces SET gold = GREATEST(0, gold - $1), updated_at = NOW() WHERE id = $2`,
    [cost, province.id]
  );
  // Bots train instantly — no timer needed
  await pool.query(
    `UPDATE province_troops SET count_home = count_home + $1, updated_at = NOW()
     WHERE province_id = $2 AND troop_type_id = $3`,
    [trainCount, province.id, target.id]
  );
}

async function botAttack(bot, difficulty) {
  const minLand = Math.floor(bot.land * 0.5);
  const maxLand = Math.floor(bot.land * 2.0);

  // Pick candidate targets in land range, not under protection
  const { rows: targets } = await pool.query(
    `SELECT p.* FROM provinces p
     JOIN ages a ON a.id = p.age_id
     WHERE a.is_active = true
       AND p.id != $1
       AND p.land >= $2 AND p.land <= $3
       AND (p.protection_ends_at IS NULL OR p.protection_ends_at <= NOW())
     ORDER BY RANDOM() LIMIT 8`,
    [bot.id, minLand, maxLand]
  );
  if (!targets.length) return;

  // Prefer real players over bots
  const playerTargets = targets.filter(t => !t.is_bot);
  const target = playerTargets.length > 0
    ? playerTargets[Math.floor(Math.random() * playerTargets.length)]
    : targets[Math.floor(Math.random() * targets.length)];

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

  // Deploy 60–80% of offensive troops
  const deployRatio = 0.6 + Math.random() * 0.2;
  const troopsDeployed = {};
  for (const troop of offensiveTroops) {
    const deploy = Math.floor(troop.count_home * deployRatio);
    if (deploy > 0) troopsDeployed[troop.troop_type_id] = deploy;
  }
  if (!Object.keys(troopsDeployed).length) return;

  // Load combat data
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

  const attackType = (difficulty === 'hard' && Math.random() < 0.4) ? 'conquest' : 'raid';

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

  // Apply results in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bot attacker losses — removed directly (no deployment phase for bots)
    for (const [troopTypeIdStr, count] of Object.entries(troopsDeployed)) {
      const troopTypeId = parseInt(troopTypeIdStr);
      const lost = result.attackerLosses[troopTypeId] || 0;
      await client.query(
        `UPDATE province_troops SET count_home = GREATEST(0, count_home - $1), updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [lost, bot.id, troopTypeId]
      );
    }

    // Defender losses
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
      if (stolen.gold > 0 || stolen.food > 0) {
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

    // Deduct AP
    await client.query(
      `UPDATE provinces SET action_points = GREATEST(0, action_points - 3), updated_at = NOW() WHERE id = $1`,
      [bot.id]
    );

    // Record attack
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
    console.log(`[bot] ${bot.name} ${result.outcome} ${attackType} vs ${target.name} (land: ${result.landGained})`);

    // World feed for wins only
    if (result.outcome === 'win') {
      const details = [];
      if (result.landGained > 0) details.push(`${result.landGained} acres seized`);
      if ((stolen.gold || 0) > 0) details.push(`${stolen.gold} gold plundered`);
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

  await calculateAndStoreNetworth(target.id);
}

module.exports = { tickBots, spawnBots };
