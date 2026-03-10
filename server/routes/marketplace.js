const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const raceConfig = require('../config/raceConfig');
const { calculateAndStoreNetworth } = require('../services/networthCalc');
const { RECIPES } = require('../constants/craftingRecipes');

const router = express.Router();
router.use(authenticate, apRegen);

/** Return expired item listings to seller inventory. */
async function returnExpiredItems(client) {
  const { rows: expired } = await client.query(
    `SELECT id, seller_province_id, item_key, quantity
     FROM marketplace_listings
     WHERE is_sold = false AND expires_at <= NOW() AND item_key IS NOT NULL`
  );
  for (const listing of expired) {
    await client.query(
      `INSERT INTO crafted_items (province_id, item_key, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (province_id, item_key) DO UPDATE SET quantity = crafted_items.quantity + $3`,
      [listing.seller_province_id, listing.item_key, listing.quantity]
    );
  }
  if (expired.length) {
    await client.query(
      `UPDATE marketplace_listings SET is_sold = true
       WHERE is_sold = false AND expires_at <= NOW() AND item_key IS NOT NULL`
    );
  }
  // Expire resource listings (no return needed — already deducted at listing time)
  await client.query(
    `UPDATE marketplace_listings SET is_sold = true
     WHERE is_sold = false AND expires_at <= NOW() AND item_key IS NULL`
  );
}

// GET /api/marketplace - List all active listings
router.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await returnExpiredItems(client);
    await client.query('COMMIT');

    const { rows } = await pool.query(
      `SELECT ml.id, ml.resource_type, ml.item_key, ml.quantity, ml.price_per_unit,
              ml.expires_at, ml.created_at,
              p.name as seller_name, p.race as seller_race, p.id as seller_id
       FROM marketplace_listings ml
       JOIN provinces p ON p.id = ml.seller_province_id
       WHERE ml.is_sold = false AND ml.expires_at > NOW()
       ORDER BY ml.item_key NULLS LAST, ml.resource_type, ml.price_per_unit ASC`
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Failed to load marketplace' });
  } finally {
    client.release();
  }
});

// GET /api/marketplace/stats
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(item_key, resource_type) as type,
              ROUND(AVG(price_per_unit), 2) as avg_price,
              SUM(quantity) as total_volume,
              COUNT(*) as transaction_count
       FROM marketplace_listings
       WHERE is_sold = true
       GROUP BY COALESCE(item_key, resource_type)`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load market stats' });
  }
});

// GET /api/marketplace/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows: [listing] } = await pool.query(
      `SELECT ml.*, p.name as seller_name, p.race as seller_race
       FROM marketplace_listings ml
       JOIN provinces p ON p.id = ml.seller_province_id
       WHERE ml.id = $1`, [req.params.id]
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load listing' });
  }
});

// POST /api/marketplace/list - Create new listing (resource or crafted item)
router.post('/list', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;

  if (raceConfig[province.race].marketplaceBlocked) {
    return res.status(403).json({ error: 'Undead provinces cannot post marketplace listings (lore restriction)' });
  }

  // Block marketplace selling during protection
  if (province.protection_ends_at && new Date(province.protection_ends_at) > new Date()) {
    return res.status(403).json({ error: 'Cannot sell on the marketplace while under new player protection' });
  }

  const { resource_type, item_key, quantity, price_per_unit, duration_hours = 24 } = req.body;

  const isItemListing = !!item_key;
  const isResourceListing = !!resource_type && !item_key;

  if (!isItemListing && !isResourceListing) {
    return res.status(400).json({ error: 'Provide either item_key or resource_type' });
  }
  if (!quantity || !price_per_unit) {
    return res.status(400).json({ error: 'quantity and price_per_unit required' });
  }
  if (quantity <= 0 || price_per_unit <= 0) {
    return res.status(400).json({ error: 'quantity and price_per_unit must be positive' });
  }
  if (isResourceListing && !['gold','food','mana','industry_points'].includes(resource_type)) {
    return res.status(400).json({ error: 'Invalid resource_type' });
  }
  if (isItemListing && !RECIPES[item_key]) {
    return res.status(400).json({ error: 'Unknown item_key' });
  }
  if (province.action_points < 1) {
    return res.status(400).json({ error: 'Not enough AP (need 1)' });
  }

  // Validate duration
  const validDurations = [24, 72, 168]; // 1d, 3d, 7d
  const listDuration = validDurations.includes(parseInt(duration_hours)) ? parseInt(duration_hours) : 24;

  // Stall slot check
  const { rows: [stall] } = await pool.query(
    `SELECT level FROM province_buildings WHERE province_id = $1 AND building_type = 'marketplace_stall'`,
    [province.id]
  );
  const maxSlots = Math.max(1, stall ? stall.level : 1);
  const { rows: activeListings } = await pool.query(
    `SELECT COUNT(*) as count FROM marketplace_listings
     WHERE seller_province_id = $1 AND is_sold = false AND expires_at > NOW()`,
    [province.id]
  );
  if (parseInt(activeListings[0].count) >= maxSlots) {
    return res.status(400).json({ error: `Max listing slots reached (${maxSlots}). Upgrade Marketplace Stall for more.` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (isResourceListing) {
      if (province[resource_type] < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough ${resource_type}` });
      }
      await client.query(
        `UPDATE provinces SET action_points = action_points - 1,
          ${resource_type} = ${resource_type} - $1, updated_at = NOW()
         WHERE id = $2`,
        [quantity, province.id]
      );
    } else {
      // Item listing: deduct from crafted_items
      const { rows: [inv] } = await client.query(
        `SELECT quantity FROM crafted_items WHERE province_id = $1 AND item_key = $2 FOR UPDATE`,
        [province.id, item_key]
      );
      if (!inv || inv.quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough ${RECIPES[item_key].name} in inventory` });
      }
      await client.query(
        `UPDATE crafted_items SET quantity = quantity - $1 WHERE province_id = $2 AND item_key = $3`,
        [quantity, province.id, item_key]
      );
      await client.query(
        `UPDATE provinces SET action_points = action_points - 1, updated_at = NOW() WHERE id = $1`,
        [province.id]
      );
    }

    const expiresAt = new Date(Date.now() + listDuration * 3600000);
    const { rows: [listing] } = await client.query(
      `INSERT INTO marketplace_listings
         (seller_province_id, resource_type, item_key, quantity, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [province.id, resource_type || null, item_key || null, quantity, price_per_unit, expiresAt]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Listing created', listing_id: listing.id, expires_at: expiresAt });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  } finally {
    client.release();
  }
});

// POST /api/marketplace/buy/:id
router.post('/buy/:id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const buyer = req.province;

  if (buyer.action_points < 1) return res.status(400).json({ error: 'Not enough AP (need 1)' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [listing] } = await client.query(
      `SELECT ml.*, p.race as seller_race
       FROM marketplace_listings ml
       JOIN provinces p ON p.id = ml.seller_province_id
       WHERE ml.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (!listing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }); }
    if (listing.is_sold) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Listing already sold' }); }
    if (new Date(listing.expires_at) <= new Date()) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Listing has expired' }); }
    if (listing.seller_province_id === buyer.id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot buy your own listing' }); }

    const totalCost = Math.ceil(listing.quantity * listing.price_per_unit);
    const taxAmount = Math.ceil(totalCost * 0.05); // 5% buyer tax
    const totalWithTax = totalCost + taxAmount;

    if (buyer.gold < totalWithTax) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough gold (need ${totalWithTax} including 5% tax)` });
    }

    // Seller receives gold minus 4% fee (handoff spec) — combined: buyer pays +5%, seller gets -4%
    const sellerCfg = raceConfig[listing.seller_race];
    const sellerReceives = Math.floor(totalCost * 0.96 * (1 + sellerCfg.marketplaceSaleBonus));

    // Deduct buyer gold + AP
    await client.query(
      `UPDATE provinces SET action_points = action_points - 1, gold = gold - $1, updated_at = NOW() WHERE id = $2`,
      [totalWithTax, buyer.id]
    );

    // Give buyer the goods
    if (listing.item_key) {
      // Crafted item listing
      await client.query(
        `INSERT INTO crafted_items (province_id, item_key, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (province_id, item_key) DO UPDATE SET quantity = crafted_items.quantity + $3`,
        [buyer.id, listing.item_key, listing.quantity]
      );
    } else {
      // Resource listing
      await client.query(
        `UPDATE provinces SET ${listing.resource_type} = ${listing.resource_type} + $1, updated_at = NOW() WHERE id = $2`,
        [listing.quantity, buyer.id]
      );
    }

    // Give seller gold
    await client.query(
      `UPDATE provinces SET gold = gold + $1, updated_at = NOW() WHERE id = $2`,
      [sellerReceives, listing.seller_province_id]
    );

    // Mark sold
    await client.query(
      `UPDATE marketplace_listings SET is_sold = true, buyer_province_id = $1, sold_at = NOW() WHERE id = $2`,
      [buyer.id, listing.id]
    );

    await client.query('COMMIT');
    await calculateAndStoreNetworth(buyer.id);
    await calculateAndStoreNetworth(listing.seller_province_id);

    const what = listing.item_key
      ? `${listing.quantity}x ${RECIPES[listing.item_key]?.name || listing.item_key}`
      : `${listing.quantity} ${listing.resource_type}`;
    res.json({ message: `Purchased ${what}`, total_paid: totalWithTax, tax: taxAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Buy listing error:', err);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

// DELETE /api/marketplace/:id - Cancel own listing
router.delete('/:id', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [listing] } = await client.query(
      `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`, [req.params.id]
    );
    if (!listing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found' }); }
    if (listing.seller_province_id !== req.province.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your listing' }); }
    if (listing.is_sold) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Listing already sold' }); }

    // Return goods to seller
    if (listing.item_key) {
      await client.query(
        `INSERT INTO crafted_items (province_id, item_key, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (province_id, item_key) DO UPDATE SET quantity = crafted_items.quantity + $3`,
        [req.province.id, listing.item_key, listing.quantity]
      );
    } else {
      await client.query(
        `UPDATE provinces SET ${listing.resource_type} = ${listing.resource_type} + $1, updated_at = NOW() WHERE id = $2`,
        [listing.quantity, req.province.id]
      );
    }

    await client.query(
      `UPDATE marketplace_listings SET is_sold = true WHERE id = $1`, [listing.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Listing cancelled, goods returned' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to cancel listing' });
  } finally {
    client.release();
  }
});

module.exports = router;
