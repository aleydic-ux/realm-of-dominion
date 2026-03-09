-- Performance indexes for hot query paths
-- These tables are queried by province_id on every page load (lazyResourceUpdate, apRegen, etc.)

-- province_buildings: fetched on every lazyResourceUpdate + getBuildingLevels call
CREATE INDEX IF NOT EXISTS idx_province_buildings_province ON province_buildings(province_id);

-- province_troops: fetched for food upkeep calc, attack page, bot attacks
CREATE INDEX IF NOT EXISTS idx_province_troops_province ON province_troops(province_id);

-- province_research: fetched for tech effects on every lazyResourceUpdate
CREATE INDEX IF NOT EXISTS idx_province_research_province ON province_research(province_id);

-- active_effects: fetched on every lazyResourceUpdate for crafting modifiers
CREATE INDEX IF NOT EXISTS idx_active_effects_province ON active_effects(province_id, expires_at);

-- crafting_queue: fetched on crafting status load and 5-min cron
CREATE INDEX IF NOT EXISTS idx_crafting_queue_province ON crafting_queue(province_id, status);

-- crafted_items: fetched on crafting status load and inventory
CREATE INDEX IF NOT EXISTS idx_crafted_items_province ON crafted_items(province_id);

-- provinces: fetched in apRegen on every authenticated request
CREATE INDEX IF NOT EXISTS idx_provinces_user_id ON provinces(user_id);
CREATE INDEX IF NOT EXISTS idx_provinces_age_bot ON provinces(age_id, is_bot);

-- alchemist_towers: fetched on every crafting status load
CREATE INDEX IF NOT EXISTS idx_alchemist_towers_province ON alchemist_towers(province_id);

-- attacks: fetched for reports and bot daily-attack cap check
CREATE INDEX IF NOT EXISTS idx_attacks_time ON attacks(attacked_at DESC);

-- marketplace: seller listings lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace_listings(seller_province_id, is_sold, expires_at);
