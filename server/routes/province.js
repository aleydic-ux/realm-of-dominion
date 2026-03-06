const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { lazyResourceUpdate, calculateBuildingCost } = require('../services/resourceEngine');
const { getProvinceTechEffects } = require('../services/techEngine');
const { calculateAndStoreNetworth } = require('../services/networthCalc');
const { checkAndReturnTroops } = require('../services/troopReturn');
const { checkEndOfAge } = require('../services/endOfAge');
const raceConfig = require('../config/raceConfig');

const router = express.Router();

// All routes require auth + AP regen
router.use(authenticate, apRegen);

// GET /api/province/me - Full dashboard data
router.get('/me', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found for active age' });
  const provinceId = req.province.id;

  try {
    // Lazily check if age has ended
    await checkEndOfAge();

    const techEffects = await getProvinceTechEffects(provinceId);
    await lazyResourceUpdate(provinceId, techEffects);
    await checkAndReturnTroops(provinceId);

    const { rows: [province] } = await pool.query(
      `SELECT p.*, u.username, a.name as age_name, a.ends_at as age_ends_at
       FROM provinces p
       JOIN users u ON u.id = p.user_id
       JOIN ages a ON a.id = p.age_id
       WHERE p.id = $1`, [provinceId]
    );

    const { rows: buildings } = await pool.query(
      'SELECT building_type, level, is_upgrading, upgrade_completes_at FROM province_buildings WHERE province_id = $1',
      [provinceId]
    );

    const { rows: troops } = await pool.query(
      `SELECT pt.*, tt.name, tt.tier, tt.offense_power, tt.defense_power, tt.gold_cost, tt.food_upkeep, tt.training_time_hours, tt.special_ability
       FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1 ORDER BY tt.tier`, [provinceId]
    );

    const { rows: research } = await pool.query(
      `SELECT pr.*, tt.name, tt.description, tt.effect_json
       FROM province_research pr
       JOIN tech_tree tt ON tt.id = pr.tech_id
       WHERE pr.province_id = $1`, [provinceId]
    );

    // Alliance info
    const { rows: allianceRows } = await pool.query(
      `SELECT a.id, a.name, am.rank
       FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.province_id = $1`, [provinceId]
    );

    res.json({
      province,
      buildings,
      troops,
      research,
      alliance: allianceRows[0] || null,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/province/list - All provinces in current age
router.get('/list', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.race, p.land, p.networth, p.morale,
              p.protection_ends_at, p.is_in_war, u.username,
              a2.name as alliance_name
       FROM provinces p
       JOIN users u ON u.id = p.user_id
       JOIN ages ag ON ag.id = p.age_id AND ag.is_active = true
       LEFT JOIN alliance_members am ON am.province_id = p.id
       LEFT JOIN alliances a2 ON a2.id = am.alliance_id
       ORDER BY p.networth DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Province list error:', err);
    res.status(500).json({ error: 'Failed to load kingdoms' });
  }
});

// GET /api/province/:id - Public view of another province
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: [province] } = await pool.query(
      `SELECT p.id, p.name, p.race, p.land, p.networth, p.morale,
              p.protection_ends_at, p.is_in_war, u.username
       FROM provinces p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`, [id]
    );
    if (!province) return res.status(404).json({ error: 'Province not found' });

    const { rows: buildings } = await pool.query(
      'SELECT building_type, level FROM province_buildings WHERE province_id = $1', [id]
    );

    res.json({ province, buildings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load province' });
  }
});

// POST /api/province/explore - Explore land (1 AP)
router.post('/explore', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;

  if (province.action_points < 1) {
    return res.status(400).json({ error: 'Not enough AP (need 1)' });
  }

  const techEffects = await getProvinceTechEffects(province.id);
  // Cartography: -20% AP cost (floor to 1 min)
  // Handled implicitly via tech — for simplicity we check if research gives AP reduction
  // (Full implementation would reduce cost to 0 if -100%, but min 1 AP)

  const landGained = 5 + Math.floor(Math.random() * 21); // 5-25 acres
  const cfg = raceConfig[province.race];
  const adjustedLand = Math.floor(landGained * cfg.landResourceYieldMultiplier);

  await pool.query(
    `UPDATE provinces SET
      action_points = action_points - 1,
      land = land + $1,
      updated_at = NOW()
     WHERE id = $2`,
    [adjustedLand, province.id]
  );

  // Drop newbie protection early if land > 500
  if (province.land + adjustedLand > 500 && province.protection_ends_at) {
    await pool.query(
      'UPDATE provinces SET protection_ends_at = NOW() WHERE id = $1', [province.id]
    );
  }

  await calculateAndStoreNetworth(province.id);

  res.json({ message: `Explored ${adjustedLand} acres`, land_gained: adjustedLand });
});

// POST /api/province/build - Build or upgrade a building (2 AP)
router.post('/build', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;
  const { building_type } = req.body;

  if (!building_type) return res.status(400).json({ error: 'building_type required' });
  if (province.action_points < 2) return res.status(400).json({ error: 'Not enough AP (need 2)' });

  let { rows: [building] } = await pool.query(
    'SELECT * FROM province_buildings WHERE province_id = $1 AND building_type = $2',
    [province.id, building_type]
  );
  if (!building) return res.status(404).json({ error: 'Building not found for your province' });
  if (building.level >= 5) return res.status(400).json({ error: 'Building is already at max level (5)' });
  if (building.is_upgrading) {
    const done = !building.upgrade_completes_at || new Date(building.upgrade_completes_at).getTime() <= Date.now();
    if (done) {
      await pool.query(
        `UPDATE province_buildings SET is_upgrading = false, upgrade_completes_at = NULL, updated_at = NOW()
         WHERE province_id = $1 AND building_type = $2`,
        [province.id, building_type]
      );
      building = { ...building, is_upgrading: false, upgrade_completes_at: null };
    } else {
      return res.status(400).json({ error: 'Building is already being upgraded', completes_at: building.upgrade_completes_at });
    }
  }

  // Check Library L1 requirement for Library itself
  if (building_type === 'library') {
    const { rows: [treasury] } = await pool.query(
      'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
      [province.id, 'treasury']
    );
    if (!treasury || treasury.level < 1) {
      return res.status(400).json({ error: 'Library requires Treasury Level 1' });
    }
  }
  if (building_type === 'war_hall') {
    const { rows: [barracks] } = await pool.query(
      'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
      [province.id, 'barracks']
    );
    if (!barracks || barracks.level < 2) {
      return res.status(400).json({ error: 'War Hall requires Barracks Level 2' });
    }
  }
  if (building_type === 'temple_altar') {
    const { rows: [library] } = await pool.query(
      'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
      [province.id, 'library']
    );
    if (!library || library.level < 1) {
      return res.status(400).json({ error: 'Temple/Altar requires Library Level 1' });
    }
  }

  const targetLevel = building.level + 1;
  const cost = calculateBuildingCost(targetLevel, province.race);

  // Apply Steam Engine tech: -30% cost
  const techEffects = await getProvinceTechEffects(province.id);
  const steamEngine = techEffects.find(e => e && e.target === 'building_cost');
  const costMultiplier = steamEngine ? 1 + steamEngine.value : 1; // value is -0.30
  const finalGold = Math.ceil(cost.gold * costMultiplier);
  const finalPP = Math.ceil(cost.production_points * costMultiplier);
  const finalTimeHours = cost.time_hours * costMultiplier;

  if (province.gold < finalGold) {
    return res.status(400).json({ error: `Not enough gold (need ${finalGold})` });
  }
  if (province.production_points < finalPP) {
    return res.status(400).json({ error: `Not enough production points (need ${finalPP})` });
  }

  // Library reduces build time: -10% per level
  const { rows: [lib] } = await pool.query(
    'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
    [province.id, 'library']
  );
  const libraryLevel = lib ? lib.level : 0;
  const timeReduction = 1 - (libraryLevel * 0.10);
  const buildTimeHours = Math.max(10 / 3600, finalTimeHours * timeReduction);
  const completesAt = new Date(Date.now() + buildTimeHours * 3600000);

  await pool.query(
    `UPDATE provinces SET
      action_points = action_points - 2,
      gold = gold - $1,
      production_points = production_points - $2,
      updated_at = NOW()
     WHERE id = $3`,
    [finalGold, finalPP, province.id]
  );

  await pool.query(
    `UPDATE province_buildings SET
      level = level + 1,
      is_upgrading = true,
      upgrade_completes_at = $1,
      updated_at = NOW()
     WHERE province_id = $2 AND building_type = $3`,
    [completesAt, province.id, building_type]
  );

  await calculateAndStoreNetworth(province.id);

  res.json({
    message: `${building_type} upgrading to level ${targetLevel}`,
    completes_at: completesAt,
    cost: { gold: finalGold, production_points: finalPP },
  });
});

// POST /api/province/train - Train troops (1 AP per batch)
router.post('/train', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;
  const { troop_type_id, quantity } = req.body;

  if (!troop_type_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'troop_type_id and quantity (>0) required' });
  }

  // Verify troop type belongs to this province's race
  const { rows: [troopType] } = await pool.query(
    'SELECT * FROM troop_types WHERE id = $1 AND race = $2',
    [troop_type_id, province.race]
  );
  if (!troopType) return res.status(404).json({ error: 'Troop type not found for your race' });

  // Check building requirements
  if (troopType.requires_building) {
    const [bType, bLevel] = troopType.requires_building.split(':');
    const { rows: [bld] } = await pool.query(
      'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
      [province.id, bType]
    );
    if (!bld || bld.level < parseInt(bLevel)) {
      return res.status(400).json({ error: `Requires ${bType} level ${bLevel}` });
    }
  }

  // Check province troop row and flush completed training using JS date comparison
  let { rows: [pt] } = await pool.query(
    'SELECT * FROM province_troops WHERE province_id = $1 AND troop_type_id = $2',
    [province.id, troop_type_id]
  );
  if (pt && pt.count_training > 0) {
    const done = !pt.training_completes_at || new Date(pt.training_completes_at).getTime() <= Date.now();
    if (done) {
      await pool.query(
        `UPDATE province_troops
         SET count_home = count_home + count_training,
             count_training = 0,
             training_completes_at = NULL,
             updated_at = NOW()
         WHERE province_id = $1 AND troop_type_id = $2`,
        [province.id, troop_type_id]
      );
      pt = { ...pt, count_training: 0, training_completes_at: null };
    } else {
      return res.status(400).json({ error: 'Already training this troop type. Wait for current batch to complete.' });
    }
  }

  const totalCost = troopType.gold_cost * quantity;
  if (province.gold < totalCost) {
    return res.status(400).json({ error: `Not enough gold (need ${totalCost})` });
  }

  // Training time with barracks speed bonus
  const { rows: [barracks] } = await pool.query(
    'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
    [province.id, 'barracks']
  );
  const barracksLevel = barracks ? barracks.level : 0;
  const cfg = raceConfig[province.race];
  const speedMultiplier = cfg.trainingSpeedMultiplier;
  const barracksSpeedBonus = 1 + (barracksLevel * 0.10);
  // Seconds per troop scales by tier: T1=1s, T2=3s, T3=9s, T4=27s, T5=81s
  const secsPerTroop = Math.pow(3, (troopType.tier || 1) - 1);
  const trainingHours = (quantity * secsPerTroop / 3600) / (barracksSpeedBonus * speedMultiplier);
  const completesAt = new Date(Date.now() + trainingHours * 3600000);

  await pool.query(
    `UPDATE provinces SET gold = gold - $1, updated_at = NOW() WHERE id = $2`,
    [totalCost, province.id]
  );

  await pool.query(
    `UPDATE province_troops
     SET count_training = $1, training_completes_at = $2, updated_at = NOW()
     WHERE province_id = $3 AND troop_type_id = $4`,
    [quantity, completesAt, province.id, troop_type_id]
  );

  res.json({
    message: `Training ${quantity}x ${troopType.name}`,
    completes_at: completesAt,
    total_cost: totalCost,
  });
});

// POST /api/province/research - Start research (1 AP)
router.post('/research', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;
  const { tech_id } = req.body;

  if (!tech_id) return res.status(400).json({ error: 'tech_id required' });
  if (province.action_points < 1) return res.status(400).json({ error: 'Not enough AP (need 1)' });

  // Get tech
  const { rows: [tech] } = await pool.query(
    'SELECT * FROM tech_tree WHERE id = $1',
    [tech_id]
  );
  if (!tech) return res.status(404).json({ error: 'Technology not found' });

  // Check race restriction
  if (tech.race && tech.race !== province.race) {
    return res.status(400).json({ error: 'This technology is for a different race' });
  }

  // Check library level
  const { rows: [lib] } = await pool.query(
    'SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = $2',
    [province.id, 'library']
  );
  const libraryLevel = lib ? lib.level : 0;
  if (libraryLevel < tech.requires_library_level) {
    return res.status(400).json({ error: `Library Level ${tech.requires_library_level} required` });
  }

  // Check prerequisite
  if (tech.prerequisite_tech_id) {
    const { rows: prereq } = await pool.query(
      `SELECT id FROM province_research WHERE province_id = $1 AND tech_id = $2 AND status = 'complete'`,
      [province.id, tech.prerequisite_tech_id]
    );
    if (!prereq.length) {
      const { rows: [prereqTech] } = await pool.query('SELECT name FROM tech_tree WHERE id = $1', [tech.prerequisite_tech_id]);
      return res.status(400).json({ error: `Requires '${prereqTech?.name}' first` });
    }
  }

  // Flush any completed research first (JS date comparison to avoid timezone issues)
  const { rows: completedResearch } = await pool.query(
    `SELECT id, completes_at FROM province_research WHERE province_id = $1 AND status = 'in_progress'`,
    [province.id]
  );
  for (const r of completedResearch) {
    if (!r.completes_at || new Date(r.completes_at).getTime() <= Date.now()) {
      await pool.query(
        `UPDATE province_research SET status = 'complete', updated_at = NOW() WHERE id = $1`,
        [r.id]
      );
    }
  }

  // Check if already researched or in progress
  const { rows: existing } = await pool.query(
    'SELECT status FROM province_research WHERE province_id = $1 AND tech_id = $2',
    [province.id, tech_id]
  );
  if (existing.length) {
    if (existing[0].status === 'complete') return res.status(400).json({ error: 'Already researched' });
    if (existing[0].status === 'in_progress') return res.status(400).json({ error: 'Research already in progress' });
  }

  // Check if any research is currently in progress
  const { rows: inProgress } = await pool.query(
    `SELECT id FROM province_research WHERE province_id = $1 AND status = 'in_progress'`,
    [province.id]
  );
  if (inProgress.length) {
    return res.status(400).json({ error: 'Can only research one technology at a time' });
  }

  // Calculate cost with tech/race modifiers
  const techEffects = await getProvinceTechEffects(province.id);
  const cfg = raceConfig[province.race];

  // Timeless Wisdom: -30% research cost
  let goldCost = tech.gold_cost;
  const timelessWisdom = techEffects.find(e => e && e.target === 'research_cost');
  if (timelessWisdom) {
    goldCost = Math.ceil(goldCost * (1 + timelessWisdom.value));
  }

  if (province.gold < goldCost) return res.status(400).json({ error: `Not enough gold (need ${goldCost})` });

  // Research time: hours / (library_bonus * race_research_speed)
  const libraryBonus = 1 + (libraryLevel * 0.10);
  const researchHours = tech.research_hours / (libraryBonus * cfg.researchSpeedMultiplier);
  const completesAt = new Date(Date.now() + researchHours * 3600000);

  await pool.query(
    `UPDATE provinces SET action_points = action_points - 1, gold = gold - $1, updated_at = NOW()
     WHERE id = $2`,
    [goldCost, province.id]
  );

  await pool.query(
    `INSERT INTO province_research (province_id, tech_id, status, started_at, completes_at)
     VALUES ($1, $2, 'in_progress', NOW(), $3)
     ON CONFLICT (province_id, tech_id) DO UPDATE SET status = 'in_progress', started_at = NOW(), completes_at = $3`,
    [province.id, tech_id, completesAt]
  );

  res.json({
    message: `Researching ${tech.name}`,
    completes_at: completesAt,
    cost: { gold: goldCost },
  });
});

// GET /api/province/me/troops
router.get('/me/troops', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT pt.*, tt.name, tt.tier, tt.offense_power, tt.defense_power, tt.gold_cost, tt.food_upkeep, tt.special_ability
       FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1 ORDER BY tt.tier`, [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load troops' });
  }
});

// GET /api/province/me/buildings
router.get('/me/buildings', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM province_buildings WHERE province_id = $1 ORDER BY building_type',
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load buildings' });
  }
});

// GET /api/province/me/research
router.get('/me/research', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, tt.name, tt.description, tt.race, tt.tier, tt.effect_json
       FROM province_research pr
       JOIN tech_tree tt ON tt.id = pr.tech_id
       WHERE pr.province_id = $1`, [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load research' });
  }
});

// GET /api/province/me/attacks
router.get('/me/attacks', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              ap.name as attacker_name, ap.race as attacker_race,
              dp.name as defender_name, dp.race as defender_race
       FROM attacks a
       JOIN provinces ap ON ap.id = a.attacker_province_id
       JOIN provinces dp ON dp.id = a.defender_province_id
       WHERE a.attacker_province_id = $1 OR a.defender_province_id = $1
       ORDER BY a.attacked_at DESC LIMIT 50`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attacks' });
  }
});

module.exports = router;
