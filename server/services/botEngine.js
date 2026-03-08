const pool = require('../config/db');
const { RECIPES, COST_RESOURCE_MAP } = require('../constants/craftingRecipes');
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

  // Crafting branch
  await botCraftingTick(province);

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

// ─── Bot Crafting ─────────────────────────────────────────────────────────────

async function botCraftingTick(bot) {
  try {
    // Collect any completed crafts
    await botCollectCrafts(bot.id);

    // Load tower
    const { rows: [tower] } = await pool.query(
      `SELECT * FROM alchemist_towers WHERE province_id = $1`, [bot.id]
    );

    // Build tower if enough resources and no tower yet
    if (!tower) {
      await pool.query(`SELECT gold, production_points FROM provinces WHERE id = $1`, [bot.id])
        .then(async ({ rows: [p] }) => {
          if (p && p.gold >= 500 && p.production_points >= 200) {
            await pool.query(
              `INSERT INTO alchemist_towers (province_id, tier, crafting_slots) VALUES ($1, 1, 2)
               ON CONFLICT (province_id) DO NOTHING`,
              [bot.id]
            );
            await pool.query(
              `UPDATE provinces SET gold = gold - 500, production_points = production_points - 200, updated_at = NOW()
               WHERE id = $1`, [bot.id]
            );
          }
        }).catch(() => {});
      return;
    }

    // Check open slots
    const { rows: [qc] } = await pool.query(
      `SELECT COUNT(*) as count FROM crafting_queue WHERE province_id = $1 AND status = 'in_progress'`,
      [bot.id]
    );
    if (parseInt(qc.count) >= tower.crafting_slots) return;

    // Reload province for current resources
    const { rows: [province] } = await pool.query('SELECT * FROM provinces WHERE id = $1', [bot.id]);
    if (!province) return;

    // Bots only craft resource boosters (harvest_tonic, gold_infusion, industry_surge)
    const BOT_PREFERRED = ['harvest_tonic', 'gold_infusion', 'industry_surge'];
    const candidates = BOT_PREFERRED.filter(key => {
      const r = RECIPES[key];
      return r && r.tier_required <= tower.tier && canBotAfford(province, r.cost);
    });
    if (!candidates.length) return;

    const itemKey = candidates[Math.floor(Math.random() * candidates.length)];
    const recipe = RECIPES[itemKey];

    // Deduct cost and enqueue
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

    // List excess inventory (> 3 of same resource booster) on marketplace at 90% avg price
    await botListExcess(bot.id);
  } catch (err) {
    // Non-critical — crafting tables may not exist yet
  }
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
      `INSERT INTO crafted_items (province_id, item_key, quantity)
       VALUES ($1, $2, $3)
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

    // Get average recent price or default to 50g/unit
    const { rows: [avg] } = await pool.query(
      `SELECT ROUND(AVG(price_per_unit), 0) as avg_price FROM marketplace_listings
       WHERE item_key = $1 AND is_sold = true`, [item.item_key]
    );
    const price = Math.max(10, Math.floor((parseFloat(avg?.avg_price) || 50) * 0.9));
    const listQty = item.quantity - 2; // keep 2 in reserve
    if (listQty < 1) continue;

    // Check bot doesn't already have active listing for this item
    const { rows: existing } = await pool.query(
      `SELECT id FROM marketplace_listings
       WHERE seller_province_id = $1 AND item_key = $2 AND is_sold = false AND expires_at > NOW()`,
      [botId, item.item_key]
    );
    if (existing.length) continue;

    // Deduct from inventory and create listing
    await pool.query(
      `UPDATE crafted_items SET quantity = quantity - $1 WHERE province_id = $2 AND item_key = $3`,
      [listQty, botId, item.item_key]
    );
    const expiresAt = new Date(Date.now() + 72 * 3600000); // 3-day listings
    await pool.query(
      `INSERT INTO marketplace_listings (seller_province_id, item_key, quantity, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [botId, item.item_key, listQty, price, expiresAt]
    );
  }
}

module.exports = { tickBots, spawnBots };
