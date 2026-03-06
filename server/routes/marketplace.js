const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const apRegen = require('../middleware/apRegen');
const raceConfig = require('../config/raceConfig');
const { calculateAndStoreNetworth } = require('../services/networthCalc');

const router = express.Router();

router.use(authenticate, apRegen);

// GET /api/marketplace - List all active listings
router.get('/', async (req, res) => {
  try {
    // Lazy expiry: mark expired listings
    await pool.query(
      `UPDATE marketplace_listings
       SET is_sold = true
       WHERE is_sold = false AND expires_at <= NOW()`
    );

    const { rows } = await pool.query(
      `SELECT ml.id, ml.resource_type, ml.quantity, ml.price_per_unit, ml.expires_at,
              ml.created_at, p.name as seller_name, p.race as seller_race, p.id as seller_id
       FROM marketplace_listings ml
       JOIN provinces p ON p.id = ml.seller_province_id
       WHERE ml.is_sold = false AND ml.expires_at > NOW()
       ORDER BY ml.resource_type, ml.price_per_unit ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load marketplace' });
  }
});

// GET /api/marketplace/stats - Average prices from last 50 sales
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT resource_type,
              ROUND(AVG(price_per_unit), 2) as avg_price,
              SUM(quantity) as total_volume,
              COUNT(*) as transaction_count
       FROM marketplace_listings
       WHERE is_sold = true
       GROUP BY resource_type`
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

// POST /api/marketplace/list - Create new listing (1 AP)
router.post('/list', async (req, res) => {
  if (!req.province) return res.status(404).json({ error: 'No province found' });
  const province = req.province;

  // Undead restriction
  if (raceConfig[province.race].marketplaceBlocked) {
    return res.status(403).json({ error: 'Undead provinces cannot post marketplace listings (lore restriction)' });
  }

  const { resource_type, quantity, price_per_unit } = req.body;

  if (!resource_type || !quantity || !price_per_unit) {
    return res.status(400).json({ error: 'resource_type, quantity, and price_per_unit required' });
  }
  if (!['gold','food','mana','production_points'].includes(resource_type)) {
    return res.status(400).json({ error: 'Invalid resource_type' });
  }
  if (quantity <= 0 || price_per_unit <= 0) {
    return res.status(400).json({ error: 'quantity and price_per_unit must be positive' });
  }
  if (province.action_points < 1) {
    return res.status(400).json({ error: 'Not enough AP (need 1)' });
  }

  // Check available stall slots
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

  // Check resource availability
  if (province[resource_type] < quantity) {
    return res.status(400).json({ error: `Not enough ${resource_type}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deduct resource and AP
    await client.query(
      `UPDATE provinces SET action_points = action_points - 1,
        ${resource_type} = ${resource_type} - $1, updated_at = NOW()
       WHERE id = $2`,
      [quantity, province.id]
    );

    const expiresAt = new Date(Date.now() + 24 * 3600000); // 24 hours
    const { rows: [listing] } = await client.query(
      `INSERT INTO marketplace_listings (seller_province_id, resource_type, quantity, price_per_unit, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [province.id, resource_type, quantity, price_per_unit, expiresAt]
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

// POST /api/marketplace/buy/:id - Purchase listing (1 AP)
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

    if (!listing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.is_sold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Listing already sold' });
    }
    if (new Date(listing.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Listing has expired' });
    }
    if (listing.seller_province_id === buyer.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }

    const totalCost = Math.ceil(listing.quantity * listing.price_per_unit);
    const taxAmount = Math.ceil(totalCost * 0.05); // 5% tax
    const totalWithTax = totalCost + taxAmount;

    if (buyer.gold < totalWithTax) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough gold (need ${totalWithTax} including 5% tax)` });
    }

    // Seller receives gold (Human +20% sale proceeds)
    const sellerCfg = raceConfig[listing.seller_race];
    const sellerReceives = Math.floor(totalCost * (1 + sellerCfg.marketplaceSaleBonus));

    // Deduct buyer gold
    await client.query(
      `UPDATE provinces SET action_points = action_points - 1, gold = gold - $1, updated_at = NOW() WHERE id = $2`,
      [totalWithTax, buyer.id]
    );

    // Give buyer the resource
    await client.query(
      `UPDATE provinces SET ${listing.resource_type} = ${listing.resource_type} + $1, updated_at = NOW() WHERE id = $2`,
      [listing.quantity, buyer.id]
    );

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

    res.json({
      message: `Purchased ${listing.quantity} ${listing.resource_type}`,
      total_paid: totalWithTax,
      tax: taxAmount,
    });
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

    if (!listing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.seller_province_id !== req.province.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not your listing' });
    }
    if (listing.is_sold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Listing already sold' });
    }

    // Return resources to seller
    await client.query(
      `UPDATE provinces SET ${listing.resource_type} = ${listing.resource_type} + $1, updated_at = NOW() WHERE id = $2`,
      [listing.quantity, req.province.id]
    );

    // Mark as sold (cancelled)
    await client.query(
      `UPDATE marketplace_listings SET is_sold = true WHERE id = $1`, [listing.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Listing cancelled, resources returned' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to cancel listing' });
  } finally {
    client.release();
  }
});

module.exports = router;
