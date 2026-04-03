const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { getBuildingLevels } = require('../services/resourceEngine');

const router = express.Router();
router.use(authenticate, apRegen);

const SPY_ACTIONS = {
  recon: {
    name: 'Recon',
    ap_cost: 2,
    gold_cost: 500,
    description: 'Gather basic intel: troops, morale, land, and resources.',
    base_success: 0.65,
    base_detection: 0.20,
  },
  steal_gold: {
    name: 'Steal Gold',
    ap_cost: 3,
    gold_cost: 800,
    description: "Infiltrate the treasury. Steal 4–8% of the target's gold.",
    base_success: 0.55,
    base_detection: 0.30,
  },
  steal_food: {
    name: 'Raid Granary',
    ap_cost: 3,
    gold_cost: 600,
    description: "Raid the granaries. Steal 4–8% of the target's food stores.",
    base_success: 0.55,
    base_detection: 0.30,
  },
  assassinate: {
    name: 'Assassinate Troops',
    ap_cost: 4,
    gold_cost: 1200,
    description: "Eliminate a portion of the enemy's forces. Kill 3–7% of their weakest troop type.",
    base_success: 0.45,
    base_detection: 0.40,
  },
};

// Serpathi racial bonus: -20% AP cost on all spy actions (min 1)
function effectiveApCost(action, race) {
  if (race === 'serpathi') return Math.max(1, Math.floor(action.ap_cost * 0.8));
  return action.ap_cost;
}

// GET /api/spy/actions
router.get('/actions', (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const race = req.province.race;
  const actions = Object.entries(SPY_ACTIONS).map(([key, a]) => ({
    key,
    ...a,
    ap_cost: effectiveApCost(a, race),
  }));
  res.json(actions);
});

// GET /api/spy/reports
router.get('/reports', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT sr.*, ap.name AS attacker_name, ap.race AS attacker_race,
              dp.name AS defender_name, dp.race AS defender_race
       FROM spy_reports sr
       JOIN provinces ap ON ap.id = sr.attacker_province_id
       JOIN provinces dp ON dp.id = sr.defender_province_id
       WHERE sr.attacker_province_id = $1 OR sr.defender_province_id = $1
       ORDER BY sr.created_at DESC
       LIMIT 30`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Spy reports error:', err);
    res.status(500).json({ error: 'Failed to load spy reports' });
  }
});

// POST /api/spy/execute
router.post('/execute', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const attacker = req.province;
  const { target_id, action_type } = req.body;

  if (!target_id || !action_type) {
    return res.status(400).json({ error: 'target_id and action_type required' });
  }
  const action = SPY_ACTIONS[action_type];
  if (!action) return res.status(400).json({ error: 'Invalid action type' });
  if (parseInt(target_id) === attacker.id) {
    return res.status(400).json({ error: 'Cannot spy on yourself' });
  }

  const apCost = effectiveApCost(action, attacker.race);
  if (attacker.action_points < apCost) {
    return res.status(400).json({ error: `Not enough AP (need ${apCost})` });
  }
  if (attacker.gold < action.gold_cost) {
    return res.status(400).json({ error: `Not enough gold (need ${action.gold_cost})` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load defender
    const { rows: [defender] } = await client.query(
      `SELECT p.*, u.username FROM provinces p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [target_id]
    );
    if (!defender) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target province not found' });
    }

    if (defender.protection_ends_at && new Date(defender.protection_ends_at) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This province is under a new player shield' });
    }

    // Load active gem buffs for both sides
    const { rows: atkBuffRows } = await client.query(
      `SELECT enhancement_id FROM gem_buffs
       WHERE province_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [attacker.id]
    );
    const atkBuffs = new Set(atkBuffRows.map(r => r.enhancement_id));

    const { rows: defBuffRows } = await client.query(
      `SELECT enhancement_id FROM gem_buffs
       WHERE province_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [defender.id]
    );
    const defBuffs = new Set(defBuffRows.map(r => r.enhancement_id));

    // Defender watchtower boosts detection
    const defBuildings = await getBuildingLevels(defender.id);
    const watchtowerLevel = defBuildings['watchtower'] || 0;

    // Resolve success chance
    let successChance = action.base_success;
    if (defender.race === 'serpathi') successChance *= 0.75;           // scout_resistance
    if (atkBuffs.has('espionage_t3_shadowmaster')) successChance = Math.min(0.95, successChance * 3);

    // Resolve detection chance
    let detectionChance = action.base_detection;
    if (atkBuffs.has('espionage_t1_shadow_cloak')) detectionChance = Math.max(0, detectionChance - 0.30);
    if (defBuffs.has('espionage_t1_counterintelligence')) detectionChance = Math.min(1, detectionChance + 0.25);
    detectionChance = Math.min(1, detectionChance + watchtowerLevel * 0.05);

    // Ghost Network: guaranteed success, then consume
    const hasGhostNetwork = atkBuffs.has('espionage_t2_ghost_network');
    const success = hasGhostNetwork || Math.random() < successChance;

    if (hasGhostNetwork) {
      await client.query(
        `DELETE FROM gem_buffs WHERE id = (
           SELECT id FROM gem_buffs WHERE province_id = $1
           AND enhancement_id = 'espionage_t2_ghost_network'
           AND (expires_at IS NULL OR expires_at > NOW())
           LIMIT 1
         )`,
        [attacker.id]
      );
    }

    // Detection is lower on a successful op
    const detected = Math.random() < (success ? detectionChance * 0.5 : detectionChance);

    // Double Agent: defender learns attacker identity; consume it
    const hasDoubleAgent = defBuffs.has('espionage_t2_double_agent');
    if (detected && hasDoubleAgent) {
      await client.query(
        `DELETE FROM gem_buffs WHERE id = (
           SELECT id FROM gem_buffs WHERE province_id = $1
           AND enhancement_id = 'espionage_t2_double_agent'
           AND (expires_at IS NULL OR expires_at > NOW())
           LIMIT 1
         )`,
        [defender.id]
      );
    }

    // Deduct AP and gold from attacker
    await client.query(
      `UPDATE provinces SET action_points = action_points - $1, gold = gold - $2, updated_at = NOW() WHERE id = $3`,
      [apCost, action.gold_cost, attacker.id]
    );

    // Execute operation effects
    let result = {};

    if (success) {
      if (action_type === 'recon') {
        const { rows: defTroops } = await client.query(
          `SELECT tt.name, tt.tier, pt.count_home, pt.count_away
           FROM province_troops pt
           JOIN troop_types tt ON tt.id = pt.troop_type_id
           WHERE pt.province_id = $1 AND (pt.count_home > 0 OR pt.count_away > 0)`,
          [defender.id]
        );
        result = {
          land: defender.land,
          race: defender.race,
          morale: defender.morale,
          gold: Math.floor(defender.gold),
          food: Math.floor(defender.food),
          mana: Math.floor(defender.mana),
          troops: defTroops,
        };
      } else if (action_type === 'steal_gold') {
        const stealPct = 0.04 + Math.random() * 0.04;
        const stolen = Math.floor(defender.gold * stealPct);
        if (stolen > 0) {
          await client.query(
            `UPDATE provinces SET gold = GREATEST(0, gold - $1), updated_at = NOW() WHERE id = $2`,
            [stolen, defender.id]
          );
          await client.query(
            `UPDATE provinces SET gold = gold + $1, updated_at = NOW() WHERE id = $2`,
            [stolen, attacker.id]
          );
        }
        result = { stolen_gold: stolen };
      } else if (action_type === 'steal_food') {
        const stealPct = 0.04 + Math.random() * 0.04;
        const stolen = Math.floor(defender.food * stealPct);
        if (stolen > 0) {
          await client.query(
            `UPDATE provinces SET food = GREATEST(0, food - $1), updated_at = NOW() WHERE id = $2`,
            [stolen, defender.id]
          );
          await client.query(
            `UPDATE provinces SET food = food + $1, updated_at = NOW() WHERE id = $2`,
            [stolen, attacker.id]
          );
        }
        result = { stolen_food: stolen };
      } else if (action_type === 'assassinate') {
        const { rows: [weakest] } = await client.query(
          `SELECT pt.id, pt.count_home, tt.name, tt.tier
           FROM province_troops pt
           JOIN troop_types tt ON tt.id = pt.troop_type_id
           WHERE pt.province_id = $1 AND pt.count_home > 0
           ORDER BY tt.tier ASC LIMIT 1`,
          [defender.id]
        );
        if (weakest) {
          const killed = Math.max(1, Math.floor(weakest.count_home * (0.03 + Math.random() * 0.04)));
          await client.query(
            `UPDATE province_troops SET count_home = GREATEST(0, count_home - $1), updated_at = NOW() WHERE id = $2`,
            [killed, weakest.id]
          );
          result = { killed, troop_name: weakest.name, troop_tier: weakest.tier };
        } else {
          result = { killed: 0, note: 'No troops to assassinate' };
        }
      }
    }

    // Save report
    await client.query(
      `INSERT INTO spy_reports (attacker_province_id, defender_province_id, action_type, success, detected, result)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [attacker.id, defender.id, action_type, success, detected, JSON.stringify(result)]
    );

    // Notify defender if detected
    if (detected) {
      const identityRevealed = hasDoubleAgent;
      const who = identityRevealed ? `${attacker.name}` : 'An unknown agent';
      const outcome = success ? 'successfully' : 'but was repelled';
      await client.query(
        `INSERT INTO notifications (province_id, type, title, message, metadata)
         VALUES ($1, 'spy_detected', $2, $3, $4)`,
        [
          defender.id,
          identityRevealed ? 'Spy Intercepted!' : 'Spy Activity Detected',
          `${who} attempted a ${action.name} on your province ${outcome}.`,
          JSON.stringify({ attacker_name: identityRevealed ? attacker.name : null, action_type, success }),
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success, detected, action_type, action_name: action.name, result: success ? result : null, ap_used: apCost, gold_used: action.gold_cost });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Spy execute error:', err);
    res.status(500).json({ error: 'Spy operation failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
