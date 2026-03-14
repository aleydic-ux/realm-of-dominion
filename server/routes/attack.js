const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { resolveAttack } = require('../services/combatEngine');
const { getProvinceTechEffects } = require('../services/techEngine');
const { calculateAndStoreNetworth } = require('../services/networthCalc');
const { checkAndReturnTroops } = require('../services/troopReturn');
const { getBuildingLevels } = require('../services/resourceEngine');
const { awardGems, checkLandMilestone } = require('../services/gemEngine');
const { checkAchievements, incrementStat } = require('../services/achievementEngine');

const router = express.Router();

router.use(authenticate, apRegen);

// POST /api/attack
router.post('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const attacker = req.province;
  const { target_id, attack_type, troops } = req.body;

  if (!target_id || !attack_type || !troops) {
    return res.status(400).json({ error: 'target_id, attack_type, and troops required' });
  }
  if (!['raid','conquest','raze','massacre'].includes(attack_type)) {
    return res.status(400).json({ error: 'Invalid attack type' });
  }
  if (attacker.action_points < 3) {
    return res.status(400).json({ error: 'Not enough AP (need 3)' });
  }
  if (attacker.id === parseInt(target_id)) {
    return res.status(400).json({ error: 'Cannot attack yourself' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load defender
    const { rows: [defender] } = await client.query(
      'SELECT * FROM provinces WHERE id = $1', [target_id]
    );
    if (!defender) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target province not found' });
    }

    // Newbie protection check
    if (defender.protection_ends_at && new Date(defender.protection_ends_at) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This province is under a new player shield', protection_ends_at: defender.protection_ends_at });
    }

    // Attack ratio check — defender must be within 30%–350% of attacker's land
    const minLand = Math.floor(attacker.land * 0.3);
    const maxLand = Math.floor(attacker.land * 3.5);
    if (defender.land < minLand || defender.land > maxLand) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Target is out of your attack range. You can only attack provinces with ${minLand}–${maxLand} acres (30%–350% of your ${attacker.land} acres).`,
      });
    }

    // Ally check - cannot attack allies
    const { rows: relation } = await client.query(
      `SELECT status FROM diplomatic_relations WHERE province_id = $1 AND target_province_id = $2`,
      [attacker.id, target_id]
    );
    if (relation.length && relation[0].status === 'ally') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cannot attack allied provinces' });
    }

    // Remove attacker's newbie shield if attacking (forced drop)
    if (attacker.protection_ends_at && new Date(attacker.protection_ends_at) > new Date()) {
      await client.query(
        `UPDATE provinces SET protection_ends_at = NOW(), protection_dropped_at = NOW(), updated_at = NOW()
         WHERE id = $1`, [attacker.id]
      );
    }

    // Load attacker troop types and validate deployment
    const { rows: attackerTroopTypes } = await client.query(
      'SELECT * FROM troop_types WHERE race = $1', [attacker.race]
    );
    const { rows: attackerTroops } = await client.query(
      'SELECT * FROM province_troops WHERE province_id = $1', [attacker.id]
    );

    // Validate troops
    const troopsDeployed = {};
    for (const [troopTypeIdStr, count] of Object.entries(troops)) {
      const troopTypeId = parseInt(troopTypeIdStr);
      const count_n = parseInt(count);
      if (count_n <= 0) continue;

      const pt = attackerTroops.find(t => t.troop_type_id === troopTypeId);
      if (!pt || pt.count_home < count_n) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough troops of type ${troopTypeId} at home` });
      }
      troopsDeployed[troopTypeId] = count_n;
    }

    if (!Object.keys(troopsDeployed).length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Must deploy at least one troop' });
    }

    // Load defender data
    const { rows: defenderTroops } = await client.query(
      'SELECT * FROM province_troops WHERE province_id = $1', [target_id]
    );
    const { rows: defenderTroopTypes } = await client.query(
      'SELECT * FROM troop_types WHERE race = $1', [defender.race]
    );
    const defenderBuildings = await getBuildingLevels(parseInt(target_id));

    // Load tech effects
    const attackerTechs = await getProvinceTechEffects(attacker.id);
    const defenderTechs = await getProvinceTechEffects(parseInt(target_id));

    // Load active spell buffs for combat (graceful fallback if table not yet migrated)
    let attackerSpellEffects = [], defenderSpellEffects = [];
    try {
      const [attackerSpellRes, defenderSpellRes] = await Promise.all([
        pool.query(
          `SELECT effect_json FROM spell_effects
           WHERE caster_province_id = $1 AND target_province_id = $1
             AND category = 'buff' AND expires_at > NOW()
             AND effect_json->>'modifier_type' IS NOT NULL`,
          [attacker.id]
        ),
        pool.query(
          `SELECT effect_json FROM spell_effects
           WHERE caster_province_id = $1 AND target_province_id = $1
             AND category = 'buff' AND expires_at > NOW()
             AND effect_json->>'modifier_type' IS NOT NULL`,
          [parseInt(target_id)]
        ),
      ]);
      attackerSpellEffects = attackerSpellRes.rows.map(r => r.effect_json).filter(Boolean);
      defenderSpellEffects = defenderSpellRes.rows.map(r => r.effect_json).filter(Boolean);
    } catch (_) { /* spell_effects table may not exist yet */ }

    // Load active crafting effects and format as spell-compatible modifiers
    // modifier_key 'attack_pct' → target 'troop_attack', 'defense_pct' → 'troop_defense'
    const CRAFT_COMBAT_MAP = { attack_pct: 'troop_attack', defense_pct: 'troop_defense' };
    let attackerCraftEffects = [], defenderCraftEffects = [];
    try {
      const [acRes, dcRes] = await Promise.all([
        pool.query(
          `SELECT modifier_key, SUM(modifier_value) as total FROM active_effects
           WHERE province_id = $1 AND modifier_key IN ('attack_pct','defense_pct')
             AND (expires_at IS NULL OR expires_at > NOW())
           GROUP BY modifier_key`,
          [attacker.id]
        ),
        pool.query(
          `SELECT modifier_key, SUM(modifier_value) as total FROM active_effects
           WHERE province_id = $1 AND modifier_key IN ('attack_pct','defense_pct')
             AND (expires_at IS NULL OR expires_at > NOW())
           GROUP BY modifier_key`,
          [parseInt(target_id)]
        ),
      ]);
      attackerCraftEffects = acRes.rows
        .filter(r => CRAFT_COMBAT_MAP[r.modifier_key])
        .map(r => ({ modifier_type: 'multiplier', target: CRAFT_COMBAT_MAP[r.modifier_key], value: parseFloat(r.total) }));
      defenderCraftEffects = dcRes.rows
        .filter(r => CRAFT_COMBAT_MAP[r.modifier_key])
        .map(r => ({ modifier_type: 'multiplier', target: CRAFT_COMBAT_MAP[r.modifier_key], value: parseFloat(r.total) }));
    } catch (_) { /* active_effects table may not exist yet */ }

    // Check enemy morale bonus
    const isEnemy = relation.length && relation[0].status === 'enemy';
    const attackerMoraleBonus = isEnemy ? 10 : 0;
    const attackerWithBonus = { ...attacker, morale: attacker.morale + attackerMoraleBonus };

    // Resolve combat
    const result = resolveAttack({
      attacker: attackerWithBonus,
      defender,
      attackType: attack_type,
      troopsDeployed,
      attackerTroopTypes,
      defenderTroops,
      defenderTroopTypes,
      buildings: defenderBuildings,
      attackerTechs,
      defenderTechs,
      attackerSpellEffects: [...attackerSpellEffects, ...attackerCraftEffects],
      defenderSpellEffects: [...defenderSpellEffects, ...defenderCraftEffects],
    });

    // Apply attacker losses (remove from home, add to deployed - losses)
    for (const [troopTypeIdStr, count] of Object.entries(troopsDeployed)) {
      const troopTypeId = parseInt(troopTypeIdStr);
      await client.query(
        `UPDATE province_troops
         SET count_home = count_home - $1,
             count_deployed = count_deployed + $1,
             updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [count, attacker.id, troopTypeId]
      );
    }

    // Remove dead troops from deployed
    for (const [troopTypeIdStr, lost] of Object.entries(result.attackerLosses)) {
      await client.query(
        `UPDATE province_troops
         SET count_deployed = GREATEST(0, count_deployed - $1),
             updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [lost, attacker.id, parseInt(troopTypeIdStr)]
      );
    }

    // Apply defender losses
    for (const [troopTypeIdStr, lost] of Object.entries(result.defenderLosses)) {
      await client.query(
        `UPDATE province_troops
         SET count_home = GREATEST(0, count_home - $1),
             updated_at = NOW()
         WHERE province_id = $2 AND troop_type_id = $3`,
        [lost, parseInt(target_id), parseInt(troopTypeIdStr)]
      );
    }

    // Apply outcome effects
    if (result.outcome === 'win') {
      // Land transfer
      if (result.landGained > 0) {
        await client.query(
          `UPDATE provinces SET land = land + $1, updated_at = NOW() WHERE id = $2`,
          [result.landGained, attacker.id]
        );
        await client.query(
          `UPDATE provinces SET land = GREATEST(10, land - $1), updated_at = NOW() WHERE id = $2`,
          [result.landGained, target_id]
        );
      }

      // Resource stealing
      if (result.resourcesStolen.gold > 0 || result.resourcesStolen.food > 0 || result.resourcesStolen.mana > 0) {
        const stolen = result.resourcesStolen;
        await client.query(
          `UPDATE provinces SET
            gold = gold + $1, food = food + $2, mana = mana + $3,
            updated_at = NOW()
           WHERE id = $4`,
          [stolen.gold || 0, stolen.food || 0, stolen.mana || 0, attacker.id]
        );
        await client.query(
          `UPDATE provinces SET
            gold = GREATEST(0, gold - $1),
            food = GREATEST(0, food - $2),
            mana = GREATEST(0, mana - $3),
            updated_at = NOW()
           WHERE id = $4`,
          [stolen.gold || 0, stolen.food || 0, stolen.mana || 0, target_id]
        );
      }

      // Apply special effects
      for (const effect of result.specialEffects) {
        if (effect.type === 'morale_drain') {
          await client.query(
            `UPDATE provinces SET morale = GREATEST(0, morale + $1), updated_at = NOW() WHERE id = $2`,
            [effect.value, target_id]
          );
        }
        if (effect.type === 'mana_drain') {
          const manaDrained = Math.floor(defender.mana * effect.value);
          await client.query(
            `UPDATE provinces SET mana = GREATEST(0, mana - $1), updated_at = NOW() WHERE id = $2`,
            [manaDrained, target_id]
          );
        }
        if (effect.type === 'raze_building' || effect.type === 'destroy_building') {
          // Reduce a random building level
          await client.query(
            `UPDATE province_buildings
             SET level = GREATEST(0, level - 1), updated_at = NOW()
             WHERE province_id = $1
               AND level > 0
             ORDER BY RANDOM() LIMIT 1`,
            [target_id]
          );
        }
        if (effect.type === 'massacre') {
          await client.query(
            `UPDATE provinces SET population = GREATEST(0, population - $1), updated_at = NOW() WHERE id = $2`,
            [effect.value, target_id]
          );
        }

        // Undead skeleton raise
        if (attacker.race === 'undead') {
          let raiseChance = 0.10; // base 10%
          const cryptLevel = defenderBuildings['crypt'] || 0;
          raiseChance += cryptLevel * 0.07;
          if (Math.random() < raiseChance) {
            const { rows: [skeleton] } = await client.query(
              `SELECT pt.troop_type_id FROM province_troops pt
               JOIN troop_types tt ON tt.id = pt.troop_type_id
               WHERE pt.province_id = $1 AND tt.name = 'Skeleton'`, [attacker.id]
            );
            if (skeleton) {
              const raisedCount = Math.floor(Math.random() * 10) + 1;
              await client.query(
                `UPDATE province_troops SET count_home = count_home + $1, updated_at = NOW()
                 WHERE province_id = $2 AND troop_type_id = $3`,
                [raisedCount, attacker.id, skeleton.troop_type_id]
              );
            }
          }
        }
      }
    }

    // AP deduction and attack record
    await client.query(
      `UPDATE provinces SET action_points = action_points - 3, updated_at = NOW() WHERE id = $1`,
      [attacker.id]
    );

    const { rows: [attackRecord] } = await client.query(
      `INSERT INTO attacks (attacker_province_id, defender_province_id, attack_type,
        attacker_power, defender_power, outcome, land_gained, resources_stolen,
        troops_deployed, attacker_losses, defender_losses, troops_return_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        attacker.id, target_id, attack_type,
        result.attackerPower, result.defenderPower, result.outcome,
        result.landGained, JSON.stringify(result.resourcesStolen),
        JSON.stringify(troopsDeployed), JSON.stringify(result.attackerLosses),
        JSON.stringify(result.defenderLosses), result.troopsReturnAt,
      ]
    );

    // Delete single-battle crafting effects (expires_at IS NULL) for attacker after combat
    try {
      await pool.query(
        `DELETE FROM active_effects WHERE province_id = $1 AND expires_at IS NULL`,
        [attacker.id]
      );
    } catch (_) { /* active_effects may not exist yet */ }

    await client.query('COMMIT');

    // ── Notifications ──
    try {
      const io = req.app.get('io');

      const lostTroopCount = Object.values(result.defenderLosses).reduce((s, v) => s + v, 0);
      const stolenSummary = Object.entries(result.resourcesStolen || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');

      let defTitle, defMsg;
      if (result.outcome === 'win') {
        defTitle = `${attacker.name} raided you!`;
        const parts = [];
        if (result.landGained > 0) parts.push(`seized ${result.landGained} acres`);
        if (stolenSummary) parts.push(`stole ${stolenSummary}`);
        if (lostTroopCount > 0) parts.push(`you lost ${lostTroopCount} troops`);
        defMsg = `${attacker.name} launched a ${attack_type} and was victorious. ${parts.join('. ')}.`;
      } else if (result.outcome === 'loss') {
        defTitle = `You repelled ${attacker.name}!`;
        defMsg = `${attacker.name} launched a ${attack_type} against you but was defeated.${lostTroopCount > 0 ? ` You lost ${lostTroopCount} troops in the defense.` : ''}`;
      } else {
        defTitle = `Draw with ${attacker.name}`;
        defMsg = `${attacker.name} launched a ${attack_type}. The battle ended in a stalemate.${lostTroopCount > 0 ? ` You lost ${lostTroopCount} troops.` : ''}`;
      }

      const defMeta = {
        attack_id: attackRecord.id, attacker_name: attacker.name, attacker_race: attacker.race,
        attack_type, outcome: result.outcome, land_lost: result.landGained || 0,
        resources_stolen: result.resourcesStolen, defender_losses: result.defenderLosses,
        attacker_power: result.attackerPower, defender_power: result.defenderPower,
      };

      // Save notification for defender
      await pool.query(
        `INSERT INTO notifications (province_id, type, title, message, metadata) VALUES ($1, 'raid_report', $2, $3, $4)`,
        [parseInt(target_id), defTitle, defMsg, JSON.stringify(defMeta)]
      );

      // Save notification for attacker
      const atkTitle = result.outcome === 'win' ? `Victory against ${defender.name}!`
        : result.outcome === 'loss' ? `Defeat against ${defender.name}` : `Draw with ${defender.name}`;
      const atkParts = [];
      if (result.landGained > 0) atkParts.push(`gained ${result.landGained} acres`);
      if (stolenSummary) atkParts.push(`stole ${stolenSummary}`);
      const atkLost = Object.values(result.attackerLosses).reduce((s, v) => s + v, 0);
      if (atkLost > 0) atkParts.push(`lost ${atkLost} troops`);

      await pool.query(
        `INSERT INTO notifications (province_id, type, title, message, metadata) VALUES ($1, 'raid_report', $2, $3, $4)`,
        [attacker.id, atkTitle, `Your ${attack_type} on ${defender.name}: ${result.outcome}. ${atkParts.join('. ')}.`,
         JSON.stringify({
           attack_id: attackRecord.id, defender_name: defender.name, defender_race: defender.race,
           attack_type, outcome: result.outcome, land_gained: result.landGained || 0,
           resources_stolen: result.resourcesStolen, attacker_losses: result.attackerLosses,
           attacker_power: result.attackerPower, defender_power: result.defenderPower,
         })]
      );

      // Real-time socket push to defender
      if (io) {
        io.to(`province_${target_id}`).emit('raid_alert', {
          title: defTitle, message: defMsg, attack_id: attackRecord.id,
          attacker_name: attacker.name, attacker_race: attacker.race, attack_type, outcome: result.outcome,
        });
        io.to(`province_${target_id}`).emit('province_update', { type: 'raid' });
      }
    } catch (e) { console.error('Notification error:', e.message); }

    // Post world feed event
    try {
      let eventMsg;
      if (result.outcome === 'win') {
        const details = [];
        if (result.landGained > 0) details.push(`${result.landGained} acres seized`);
        if (result.resourcesStolen.gold > 0) details.push(`${result.resourcesStolen.gold} gold stolen`);
        eventMsg = `[WAR] ${attacker.name} launched a ${attack_type} on ${defender.name} and was VICTORIOUS! ${details.length ? '(' + details.join(', ') + ')' : ''}`;
      } else {
        eventMsg = `[WAR] ${attacker.name} attacked ${defender.name} but was REPELLED by the defenders!`;
      }
      await pool.query(
        `INSERT INTO world_feed (type, author_name, province_id, message) VALUES ('event', 'World News', NULL, $1)`,
        [eventMsg]
      );
    } catch (e) { /* non-critical */ }

    // Recalculate networth for both
    await calculateAndStoreNetworth(attacker.id);
    await calculateAndStoreNetworth(parseInt(target_id));

    // Award gems for combat
    try {
      if (result.outcome === 'win') {
        await awardGems(attacker.id, 3, 'Won attack');
        // Check land milestones after conquest
        if (result.landGained > 0) {
          const { rows: [updated] } = await pool.query('SELECT land FROM provinces WHERE id = $1', [attacker.id]);
          if (updated) await checkLandMilestone(attacker.id, updated.land);
        }
      } else if (result.outcome === 'loss') {
        await awardGems(parseInt(target_id), 2, 'Defended attack');
      }
    } catch (_) { /* non-critical */ }

    // Award achievements + update stats (non-critical)
    try {
      const goldStolen = result.resourcesStolen?.gold || 0;
      if (result.outcome === 'win') {
        await incrementStat(attacker.id, 'attacks_won');
        if (result.landGained > 0) await incrementStat(attacker.id, 'land_conquered', result.landGained);
        if (goldStolen > 0) await incrementStat(attacker.id, 'gold_plundered', goldStolen);
        await checkAchievements(attacker.id, 'attack_won');
      } else {
        await incrementStat(attacker.id, 'attacks_lost');
        await incrementStat(parseInt(target_id), 'attacks_defended');
        await checkAchievements(parseInt(target_id), 'attack_defended');
      }
    } catch (_) { /* non-critical */ }

    res.json({
      message: `Attack ${result.outcome}`,
      attack_id: attackRecord.id,
      outcome: result.outcome,
      attacker_power: result.attackerPower,
      defender_power: result.defenderPower,
      attacker_losses: result.attackerLosses,
      defender_losses: result.defenderLosses,
      land_gained: result.landGained,
      resources_stolen: result.resourcesStolen,
      troops_return_at: result.troopsReturnAt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Attack error:', err);
    res.status(500).json({ error: 'Attack failed' });
  } finally {
    client.release();
  }
});

// GET /api/attack/report/:id
router.get('/report/:id', async (req, res) => {
  try {
    const { rows: [attack] } = await pool.query(
      `SELECT a.*,
              ap.name as attacker_name, ap.race as attacker_race,
              dp.name as defender_name, dp.race as defender_race
       FROM attacks a
       JOIN provinces ap ON ap.id = a.attacker_province_id
       JOIN provinces dp ON dp.id = a.defender_province_id
       WHERE a.id = $1`, [req.params.id]
    );
    if (!attack) return res.status(404).json({ error: 'Attack report not found' });

    // Only attacker or defender can view
    if (!req.province || (attack.attacker_province_id !== req.province.id && attack.defender_province_id !== req.province.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(attack);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load report' });
  }
});

// GET /api/attack/incoming
router.get('/incoming', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.attack_type, a.outcome, a.attacked_at, a.land_gained, a.resources_stolen,
              ap.name as attacker_name, ap.race as attacker_race
       FROM attacks a
       JOIN provinces ap ON ap.id = a.attacker_province_id
       WHERE a.defender_province_id = $1
       ORDER BY a.attacked_at DESC LIMIT 20`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load incoming attacks' });
  }
});

module.exports = router;
