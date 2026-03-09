const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const { RECIPES, TOWER_COSTS, TIER_SLOTS, COST_RESOURCE_MAP } = require('../constants/craftingRecipes');

const router = express.Router();
router.use(authenticate, apRegen);

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Deduct recipe cost from a province inside an existing client transaction. */
async function deductRecipeCost(client, provinceId, cost) {
  const setClauses = [];
  const values = [];
  let idx = 1;
  for (const [key, amount] of Object.entries(cost)) {
    const col = COST_RESOURCE_MAP[key];
    setClauses.push(`${col} = GREATEST(0, ${col} - $${idx})`);
    values.push(amount);
    idx++;
  }
  values.push(provinceId);
  await client.query(
    `UPDATE provinces SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    values
  );
}

/** Check a province has enough resources for a cost object. Returns missing resource name or null. */
function checkAffordable(province, cost) {
  for (const [key, amount] of Object.entries(cost)) {
    const col = COST_RESOURCE_MAP[key];
    if ((province[col] || 0) < amount) return key;
  }
  return null;
}

/** Upsert crafted_items quantity for a province. */
async function addToInventory(client, provinceId, itemKey, qty = 1) {
  await client.query(
    `INSERT INTO crafted_items (province_id, item_key, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (province_id, item_key) DO UPDATE
       SET quantity = crafted_items.quantity + $3`,
    [provinceId, itemKey, qty]
  );
}

// ─── Tower ─────────────────────────────────────────────────────────────────

// GET /api/crafting/tower/status
router.get('/tower/status', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });

  try {
    const provinceId = req.province.id;

    const [towerRes, queueRes, inventoryRes, cooldownsRes, effectsRes] = await Promise.all([
      pool.query(`SELECT * FROM alchemist_towers WHERE province_id = $1`, [provinceId]),
      pool.query(
        `SELECT * FROM crafting_queue WHERE province_id = $1 AND status = 'in_progress' ORDER BY completes_at ASC`,
        [provinceId]
      ),
      pool.query(
        `SELECT item_key, quantity FROM crafted_items WHERE province_id = $1 AND quantity > 0`,
        [provinceId]
      ),
      pool.query(
        `SELECT item_key, last_used_at + INTERVAL '4 hours' AS cooldown_ends_at
         FROM crafting_cooldowns WHERE province_id = $1`,
        [provinceId]
      ),
      pool.query(
        `SELECT * FROM active_effects WHERE province_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [provinceId]
      ),
    ]);

    const tower = towerRes.rows[0] || null;

    // Cooldowns as { item_key: cooldown_ends_at }
    const cooldowns = {};
    for (const row of cooldownsRes.rows) cooldowns[row.item_key] = row.cooldown_ends_at;

    // All recipes as object keyed by item_key (frontend shows locked state for higher tiers)
    const recipes = {};
    for (const [key, r] of Object.entries(RECIPES)) recipes[key] = r;

    res.json({
      tower,
      queue: queueRes.rows,
      inventory: inventoryRes.rows,
      cooldowns,
      active_effects: effectsRes.rows,
      recipes,
      build_cost: TOWER_COSTS.build,
      upgrade_cost: tower && tower.tier < 3 ? TOWER_COSTS[`upgrade${tower.tier + 1}`] : null,
    });
  } catch (err) {
    console.error('Tower status error:', err);
    res.status(500).json({ error: 'Failed to load tower status' });
  }
});

// POST /api/crafting/tower/build
router.post('/tower/build', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;

  const missing = checkAffordable(province, TOWER_COSTS.build);
  if (missing) return res.status(400).json({ error: `Not enough ${missing} to build Alchemist Tower` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check already built
    const { rows: existing } = await client.query(
      `SELECT id FROM alchemist_towers WHERE province_id = $1`, [province.id]
    );
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Alchemist Tower already built' });
    }

    await deductRecipeCost(client, province.id, TOWER_COSTS.build);
    const { rows: [tower] } = await client.query(
      `INSERT INTO alchemist_towers (province_id, tier, crafting_slots) VALUES ($1, 1, 2) RETURNING *`,
      [province.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Alchemist Tower built!', tower });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Tower build error:', err);
    res.status(500).json({ error: 'Failed to build tower' });
  } finally {
    client.release();
  }
});

// POST /api/crafting/tower/upgrade
router.post('/tower/upgrade', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [tower] } = await client.query(
      `SELECT * FROM alchemist_towers WHERE province_id = $1 FOR UPDATE`, [province.id]
    );
    if (!tower) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No Alchemist Tower to upgrade' });
    }
    if (tower.tier >= 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tower already at max tier' });
    }

    const upgradeCost = TOWER_COSTS[`upgrade${tower.tier + 1}`];
    const missing = checkAffordable(province, upgradeCost);
    if (missing) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough ${missing} to upgrade` });
    }

    await deductRecipeCost(client, province.id, upgradeCost);
    const newTier = tower.tier + 1;
    const { rows: [updated] } = await client.query(
      `UPDATE alchemist_towers SET tier = $1, crafting_slots = $2, upgraded_at = NOW()
       WHERE province_id = $3 RETURNING *`,
      [newTier, TIER_SLOTS[newTier], province.id]
    );

    await client.query('COMMIT');
    res.json({ message: `Tower upgraded to Tier ${newTier}`, tower: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Tower upgrade error:', err);
    res.status(500).json({ error: 'Failed to upgrade tower' });
  } finally {
    client.release();
  }
});

// ─── Crafting Queue ─────────────────────────────────────────────────────────

// POST /api/crafting/start
router.post('/start', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;
  const { item_key, quantity = 1 } = req.body;

  const recipe = RECIPES[item_key];
  if (!recipe) return res.status(400).json({ error: 'Unknown item' });
  if (quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tower check
    const { rows: [tower] } = await client.query(
      `SELECT * FROM alchemist_towers WHERE province_id = $1 FOR UPDATE`, [province.id]
    );
    if (!tower) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You need an Alchemist Tower to craft' });
    }
    if (recipe.tier_required > tower.tier) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Requires Tier ${recipe.tier_required} tower (you have Tier ${tower.tier})` });
    }

    // Slot check
    const { rows: [qc] } = await client.query(
      `SELECT COUNT(*) as count FROM crafting_queue WHERE province_id = $1 AND status = 'in_progress'`,
      [province.id]
    );
    if (parseInt(qc.count) >= tower.crafting_slots) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `All crafting slots are full (${tower.crafting_slots} slots)` });
    }

    // Resource check (cost × quantity)
    const scaledCost = {};
    for (const [k, v] of Object.entries(recipe.cost)) scaledCost[k] = v * quantity;
    const missing = checkAffordable(province, scaledCost);
    if (missing) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough ${missing}` });
    }

    await deductRecipeCost(client, province.id, scaledCost);
    const completesAt = new Date(Date.now() + recipe.craft_time_mins * 60000);
    const { rows: [job] } = await client.query(
      `INSERT INTO crafting_queue (province_id, item_key, quantity, completes_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [province.id, item_key, quantity, completesAt]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: `Crafting ${recipe.name} x${quantity}`, job });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Craft start error:', err);
    res.status(500).json({ error: 'Failed to start crafting' });
  } finally {
    client.release();
  }
});

// GET /api/crafting/queue
router.get('/queue', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM crafting_queue WHERE province_id = $1 ORDER BY completes_at ASC`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load queue' });
  }
});

// POST /api/crafting/collect
router.post('/collect', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const provinceId = req.province.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: completed } = await client.query(
      `SELECT * FROM crafting_queue
       WHERE province_id = $1 AND status = 'in_progress' AND completes_at <= NOW()
       FOR UPDATE`,
      [provinceId]
    );

    if (!completed.length) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Nothing ready to collect', collected: [] });
    }

    const collected = [];
    for (const job of completed) {
      await addToInventory(client, provinceId, job.item_key, job.quantity);
      await client.query(
        `UPDATE crafting_queue SET status = 'completed' WHERE id = $1`, [job.id]
      );
      collected.push({ item_key: job.item_key, quantity: job.quantity, name: RECIPES[job.item_key]?.name });
    }

    await client.query('COMMIT');
    res.json({ message: `Collected ${collected.length} job(s)`, collected });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Collect error:', err);
    res.status(500).json({ error: 'Failed to collect items' });
  } finally {
    client.release();
  }
});

// ─── Inventory ──────────────────────────────────────────────────────────────

// GET /api/crafting/inventory
router.get('/inventory', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT ci.item_key, ci.quantity FROM crafted_items ci
       WHERE ci.province_id = $1 AND ci.quantity > 0`,
      [req.province.id]
    );
    // Enrich with recipe data
    const enriched = rows.map(r => ({
      ...r,
      ...(RECIPES[r.item_key] || {}),
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load inventory' });
  }
});

// ─── Items: Use & Send ───────────────────────────────────────────────────────

// GET /api/crafting/items/cooldowns
router.get('/items/cooldowns', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  try {
    const { rows } = await pool.query(
      `SELECT item_key, last_used_at,
              last_used_at + INTERVAL '4 hours' as cooldown_ends_at
       FROM crafting_cooldowns WHERE province_id = $1`,
      [req.province.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cooldowns' });
  }
});

// POST /api/crafting/items/use  (self-buff)
router.post('/items/use', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const provinceId = req.province.id;
  const { item_key } = req.body;

  const recipe = RECIPES[item_key];
  if (!recipe) return res.status(400).json({ error: 'Unknown item' });
  if (recipe.effect_type === 'debuff') return res.status(400).json({ error: 'Debuff items must be sent to enemies' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check inventory
    const { rows: [inv] } = await client.query(
      `SELECT quantity FROM crafted_items WHERE province_id = $1 AND item_key = $2 FOR UPDATE`,
      [provinceId, item_key]
    );
    if (!inv || inv.quantity < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You do not have this item' });
    }

    // Check cooldown
    const { rows: [cd] } = await client.query(
      `SELECT last_used_at FROM crafting_cooldowns WHERE province_id = $1 AND item_key = $2`,
      [provinceId, item_key]
    );
    if (cd) {
      const cooldownEnds = new Date(cd.last_used_at).getTime() + recipe.cooldown_hours * 3600000;
      if (Date.now() < cooldownEnds) {
        await client.query('ROLLBACK');
        const remaining = Math.ceil((cooldownEnds - Date.now()) / 60000);
        return res.status(400).json({ error: `On cooldown — ${remaining} minute(s) remaining` });
      }
    }

    // Stacking checks
    // Rule 1: only one modifier_key type active at a time from a different item
    const { rows: conflicting } = await client.query(
      `SELECT id FROM active_effects
       WHERE province_id = $1 AND modifier_key = $2 AND item_key != $3
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [provinceId, recipe.modifier_key, item_key]
    );
    if (conflicting.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `A different item affecting ${recipe.modifier_key} is already active` });
    }

    // Rule 2: max 2 stacks of same item
    const { rows: existing } = await client.query(
      `SELECT COUNT(*) as count FROM active_effects
       WHERE province_id = $1 AND item_key = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
      [provinceId, item_key]
    );
    if (parseInt(existing[0].count) >= recipe.max_stacks) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Max stacks (${recipe.max_stacks}) already active` });
    }

    // Deduct item from inventory
    await client.query(
      `UPDATE crafted_items SET quantity = quantity - 1 WHERE province_id = $1 AND item_key = $2`,
      [provinceId, item_key]
    );

    // Insert active effect
    const expiresAt = recipe.duration_hours
      ? new Date(Date.now() + recipe.duration_hours * 3600000)
      : null; // null = single-battle, removed after combat

    await client.query(
      `INSERT INTO active_effects
         (province_id, source_province_id, item_key, effect_type, modifier_key, modifier_value, stacks, expires_at)
       VALUES ($1, $1, $2, $3, $4, $5, 1, $6)`,
      [provinceId, item_key, recipe.effect_type, recipe.modifier_key, recipe.modifier_value, expiresAt]
    );

    // Upsert cooldown
    await client.query(
      `INSERT INTO crafting_cooldowns (province_id, item_key, last_used_at) VALUES ($1, $2, NOW())
       ON CONFLICT (province_id, item_key) DO UPDATE SET last_used_at = NOW()`,
      [provinceId, item_key]
    );

    await client.query('COMMIT');
    res.json({
      message: `${recipe.name} activated`,
      effect: { modifier_key: recipe.modifier_key, modifier_value: recipe.modifier_value, expires_at: expiresAt },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Item use error:', err);
    res.status(500).json({ error: 'Failed to use item' });
  } finally {
    client.release();
  }
});

// POST /api/crafting/items/send  (debuff on enemy)
router.post('/items/send', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const senderProvince = req.province;
  const { item_key, target_province_id: target_id } = req.body;

  const recipe = RECIPES[item_key];
  if (!recipe) return res.status(400).json({ error: 'Unknown item' });
  if (recipe.effect_type !== 'debuff') return res.status(400).json({ error: 'Only debuff items can be sent to enemies' });
  if (!target_id) return res.status(400).json({ error: 'target_province_id required' });
  if (parseInt(target_id) === senderProvince.id) return res.status(400).json({ error: 'Cannot send debuff to yourself' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load target
    const { rows: [target] } = await client.query(
      `SELECT id, name, is_bot, created_at, protection_ends_at FROM provinces WHERE id = $1`, [target_id]
    );
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target province not found' });
    }

    // New player shield blocks debuff items
    if (target.protection_ends_at && new Date(target.protection_ends_at) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'This province is protected by a new player shield',
        protection_ends_at: target.protection_ends_at,
      });
    }

    // Check inventory
    const { rows: [inv] } = await client.query(
      `SELECT quantity FROM crafted_items WHERE province_id = $1 AND item_key = $2 FOR UPDATE`,
      [senderProvince.id, item_key]
    );
    if (!inv || inv.quantity < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You do not have this item' });
    }

    // Check sender cooldown
    const { rows: [cd] } = await client.query(
      `SELECT last_used_at FROM crafting_cooldowns WHERE province_id = $1 AND item_key = $2`,
      [senderProvince.id, item_key]
    );
    if (cd) {
      const cooldownEnds = new Date(cd.last_used_at).getTime() + recipe.cooldown_hours * 3600000;
      if (Date.now() < cooldownEnds) {
        await client.query('ROLLBACK');
        const remaining = Math.ceil((cooldownEnds - Date.now()) / 60000);
        return res.status(400).json({ error: `On cooldown — ${remaining} minute(s) remaining` });
      }
    }

    // Check stacks on target
    const { rows: existing } = await client.query(
      `SELECT COUNT(*) as count FROM active_effects
       WHERE province_id = $1 AND item_key = $2 AND source_province_id = $3
         AND expires_at > NOW()`,
      [target_id, item_key, senderProvince.id]
    );
    if (parseInt(existing[0].count) >= recipe.max_stacks) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Max stacks already applied to this target` });
    }

    // Deduct item
    await client.query(
      `UPDATE crafted_items SET quantity = quantity - 1 WHERE province_id = $1 AND item_key = $2`,
      [senderProvince.id, item_key]
    );

    const expiresAt = new Date(Date.now() + recipe.duration_hours * 3600000);
    await client.query(
      `INSERT INTO active_effects
         (province_id, source_province_id, item_key, effect_type, modifier_key, modifier_value, stacks, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
      [target_id, senderProvince.id, item_key, recipe.effect_type, recipe.modifier_key, recipe.modifier_value, expiresAt]
    );

    // Cooldown on sender
    await client.query(
      `INSERT INTO crafting_cooldowns (province_id, item_key, last_used_at) VALUES ($1, $2, NOW())
       ON CONFLICT (province_id, item_key) DO UPDATE SET last_used_at = NOW()`,
      [senderProvince.id, item_key]
    );

    await client.query('COMMIT');
    res.json({
      message: `${recipe.name} sent to ${target.name}`,
      expires_at: expiresAt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Item send error:', err);
    res.status(500).json({ error: 'Failed to send item' });
  } finally {
    client.release();
  }
});

// ─── Shared collect helper (also called from cron) ─────────────────────────

async function collectCompletedCrafts(provinceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: completed } = await client.query(
      `SELECT * FROM crafting_queue
       WHERE province_id = $1 AND status = 'in_progress' AND completes_at <= NOW()`,
      [provinceId]
    );
    for (const job of completed) {
      await addToInventory(client, provinceId, job.item_key, job.quantity);
      await client.query(`UPDATE crafting_queue SET status = 'completed' WHERE id = $1`, [job.id]);
    }
    await client.query('COMMIT');
    return completed.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;
module.exports.collectCompletedCrafts = collectCompletedCrafts;
