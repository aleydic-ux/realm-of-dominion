const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { SPELLS, SPELL_MAP } = require('../constants/spells');
const { getBuildingLevels } = require('../services/resourceEngine');

const router = express.Router();
router.use(authenticate, apRegen);

// GET /api/spells — spell definitions + player cooldowns + active effects
router.get('/', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const provinceId = req.province.id;

  try {
    const [cooldownsRes, effectsRes] = await Promise.all([
      pool.query(
        `SELECT spell_key, cooldown_ends_at FROM spell_cooldowns
         WHERE province_id = $1 AND cooldown_ends_at > NOW()`,
        [provinceId]
      ),
      pool.query(
        `SELECT * FROM spell_effects WHERE expires_at > NOW() AND (
           (caster_province_id = $1 AND target_province_id = $1 AND category = 'buff') OR
           (target_province_id = $1 AND category = 'debuff')
         ) ORDER BY created_at DESC`,
        [provinceId]
      ),
    ]);

    const cooldowns = {};
    for (const row of cooldownsRes.rows) cooldowns[row.spell_key] = row.cooldown_ends_at;

    res.json({ spells: SPELLS, cooldowns, active_effects: effectsRes.rows });
  } catch (err) {
    console.error('Spells GET error:', err);
    res.status(500).json({ error: 'Failed to load spells' });
  }
});

// POST /api/spells/cast
router.post('/cast', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const caster = req.province;
  const { spell_key, target_province_id } = req.body;

  const spell = SPELL_MAP[spell_key];
  if (!spell) return res.status(400).json({ error: 'Unknown spell' });

  if (caster.mana < spell.mana_cost) {
    return res.status(400).json({ error: `Not enough mana (need ${spell.mana_cost}, have ${Math.floor(caster.mana)})` });
  }
  if (spell.ap_cost > 0 && caster.action_points < spell.ap_cost) {
    return res.status(400).json({ error: `Not enough AP (need ${spell.ap_cost})` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check Arcane Sanctum level
    const buildings = await getBuildingLevels(caster.id);
    const sanctumLevel = buildings['arcane_sanctum'] || 0;
    if (sanctumLevel < spell.requires_arcane_sanctum) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Requires Arcane Sanctum level ${spell.requires_arcane_sanctum} (yours: ${sanctumLevel})`,
      });
    }

    // Check cooldown
    const { rows: [cooldown] } = await client.query(
      `SELECT cooldown_ends_at FROM spell_cooldowns
       WHERE province_id = $1 AND spell_key = $2 AND cooldown_ends_at > NOW()`,
      [caster.id, spell_key]
    );
    if (cooldown) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This spell is on cooldown', cooldown_ends_at: cooldown.cooldown_ends_at });
    }

    // Validate target for targeted spells
    let target = null;
    if (spell.targeted) {
      if (!target_province_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'target_province_id required for this spell' });
      }
      const { rows: [tgt] } = await client.query(
        'SELECT * FROM provinces WHERE id = $1', [target_province_id]
      );
      if (!tgt) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Target province not found' });
      }
      if (tgt.id === caster.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot target yourself' });
      }
      // New player shield — blocks hostile spells (attack/debuff) during protection window
      if ((spell.category === 'attack' || spell.category === 'debuff') &&
          tgt.protection_ends_at && new Date(tgt.protection_ends_at) > new Date()) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'This province is protected by a new player shield',
          protection_ends_at: tgt.protection_ends_at,
        });
      }
      target = tgt;
    }

    // Deduct mana and AP
    await client.query(
      `UPDATE provinces SET
         mana = GREATEST(0, mana - $1),
         action_points = action_points - $2,
         updated_at = NOW()
       WHERE id = $3`,
      [spell.mana_cost, spell.ap_cost, caster.id]
    );

    // Set cooldown
    const cooldownEndsAt = new Date(Date.now() + spell.cooldown_hours * 3600000);
    await client.query(
      `INSERT INTO spell_cooldowns (province_id, spell_key, cooldown_ends_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (province_id, spell_key) DO UPDATE SET cooldown_ends_at = $3`,
      [caster.id, spell_key, cooldownEndsAt]
    );

    // Apply the spell effect
    let result = {};
    const now = new Date();

    if (spell.category === 'scout') {
      result = await applyScoutSpell(client, caster, target, spell);
    } else if (spell.category === 'buff') {
      const expiresAt = new Date(now.getTime() + spell.duration_hours * 3600000);
      await client.query(
        `INSERT INTO spell_effects (caster_province_id, target_province_id, spell_key, category, effect_json, expires_at)
         VALUES ($1, $1, $2, 'buff', $3, $4)`,
        [caster.id, spell_key, JSON.stringify(spell.effect), expiresAt]
      );
      result = { message: `${spell.name} is now active for ${spell.duration_hours} hours.` };
    } else if (spell.category === 'attack') {
      result = await applyAttackSpell(client, caster, target, spell);
    }

    await client.query('COMMIT');

    res.json({ success: true, spell: spell.name, cooldown_ends_at: cooldownEndsAt, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Spell cast error:', err);
    res.status(500).json({ error: 'Failed to cast spell' });
  } finally {
    client.release();
  }
});

async function applyScoutSpell(client, caster, target, spell) {
  const { effect } = spell;

  if (effect.type === 'reveal_basic') {
    // Instant result — check for their alliance too
    const { rows: [am] } = await client.query(
      `SELECT a.name FROM alliance_members am JOIN alliances a ON a.id = am.alliance_id WHERE am.province_id = $1`,
      [target.id]
    );
    return {
      message: `Clairvoyance revealed ${target.name}.`,
      scouted: {
        id: target.id,
        name: target.name,
        race: target.race,
        land: target.land,
        networth: target.networth,
        alliance_name: am?.name || null,
      },
    };
  }

  if (effect.type === 'reveal_military') {
    const { rows: troops } = await client.query(
      `SELECT tt.name, tt.tier, pt.count_home, pt.count_deployed
       FROM province_troops pt
       JOIN troop_types tt ON tt.id = pt.troop_type_id
       WHERE pt.province_id = $1 ORDER BY tt.tier`,
      [target.id]
    );
    const scoutData = {
      id: target.id, name: target.name, race: target.race,
      morale: target.morale, gold: target.gold, food: target.food, mana: target.mana,
      troops: troops.filter(t => t.count_home > 0 || t.count_deployed > 0),
    };
    const expiresAt = new Date(Date.now() + spell.duration_hours * 3600000);
    await client.query(
      `INSERT INTO spell_effects (caster_province_id, target_province_id, spell_key, category, effect_json, expires_at)
       VALUES ($1, $2, $3, 'scout', $4, $5)`,
      [caster.id, target.id, spell.key, JSON.stringify({ type: 'scout_result', data: scoutData }), expiresAt]
    );
    return { message: `Spy Network revealed ${target.name}'s military.`, scouted: scoutData };
  }

  if (effect.type === 'reveal_full') {
    const [troopsRes, buildingsRes, researchRes] = await Promise.all([
      client.query(
        `SELECT tt.name, tt.tier, pt.count_home, pt.count_deployed
         FROM province_troops pt JOIN troop_types tt ON tt.id = pt.troop_type_id
         WHERE pt.province_id = $1 ORDER BY tt.tier`, [target.id]
      ),
      client.query(
        `SELECT building_type, level FROM province_buildings WHERE province_id = $1`, [target.id]
      ),
      client.query(
        `SELECT tt.name FROM province_research pr
         JOIN tech_tree tt ON tt.id = pr.tech_id
         WHERE pr.province_id = $1 AND pr.status = 'complete'`, [target.id]
      ),
    ]);
    const scoutData = {
      id: target.id, name: target.name, race: target.race,
      land: target.land, networth: target.networth, morale: target.morale,
      gold: target.gold, food: target.food, mana: target.mana,
      industry_points: target.industry_points, population: target.population,
      troops: troopsRes.rows.filter(t => t.count_home > 0 || t.count_deployed > 0),
      buildings: buildingsRes.rows.filter(b => b.level > 0),
      research: researchRes.rows,
    };
    const expiresAt = new Date(Date.now() + spell.duration_hours * 3600000);
    await client.query(
      `INSERT INTO spell_effects (caster_province_id, target_province_id, spell_key, category, effect_json, expires_at)
       VALUES ($1, $2, $3, 'scout', $4, $5)`,
      [caster.id, target.id, spell.key, JSON.stringify({ type: 'scout_result', data: scoutData }), expiresAt]
    );
    return { message: `True Sight revealed everything about ${target.name}.`, scouted: scoutData };
  }

  return {};
}

async function applyAttackSpell(client, caster, target, spell) {
  const { effect } = spell;

  if (effect.type === 'drain_mana') {
    const manaDrained = Math.floor(target.mana * effect.value);
    await client.query(
      `UPDATE provinces SET mana = GREATEST(0, mana - $1), updated_at = NOW() WHERE id = $2`,
      [manaDrained, target.id]
    );
    await client.query(
      `UPDATE provinces SET mana = mana + $1, updated_at = NOW() WHERE id = $2`,
      [manaDrained, caster.id]
    );
    return { message: `Drained ${manaDrained} mana from ${target.name}.`, mana_drained: manaDrained };
  }

  if (effect.type === 'storm_damage') {
    const lossPct = effect.troop_loss_pct_min +
      Math.random() * (effect.troop_loss_pct_max - effect.troop_loss_pct_min);
    const goldStolen = Math.floor(target.gold * effect.gold_steal_pct);

    await client.query(
      `UPDATE province_troops
       SET count_home = GREATEST(0, FLOOR(count_home * (1 - $1::float))), updated_at = NOW()
       WHERE province_id = $2`,
      [lossPct, target.id]
    );
    await client.query(
      `UPDATE provinces SET gold = GREATEST(0, gold - $1), updated_at = NOW() WHERE id = $2`,
      [goldStolen, target.id]
    );
    await client.query(
      `UPDATE provinces SET gold = gold + $1, updated_at = NOW() WHERE id = $2`,
      [goldStolen, caster.id]
    );
    return {
      message: `Arcane Storm devastated ${target.name}! ~${Math.floor(lossPct * 100)}% of their troops were destroyed and ${goldStolen} gold was seized.`,
      troop_loss_pct: lossPct,
      gold_stolen: goldStolen,
    };
  }

  if (effect.modifier_type === 'multiplier') {
    // Lasting debuff (e.g. famine_curse)
    const expiresAt = new Date(Date.now() + spell.duration_hours * 3600000);
    await client.query(
      `INSERT INTO spell_effects (caster_province_id, target_province_id, spell_key, category, effect_json, expires_at)
       VALUES ($1, $2, $3, 'debuff', $4, $5)`,
      [caster.id, target.id, spell.key, JSON.stringify(spell.effect), expiresAt]
    );
    return { message: `${spell.name} afflicted ${target.name} for ${spell.duration_hours} hours.` };
  }

  return {};
}

module.exports = router;
