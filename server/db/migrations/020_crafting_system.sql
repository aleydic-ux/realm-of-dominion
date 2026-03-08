-- Alchemist Tower (one per province)
CREATE TABLE IF NOT EXISTS alchemist_towers (
  id             SERIAL PRIMARY KEY,
  province_id    INTEGER REFERENCES provinces(id) ON DELETE CASCADE UNIQUE,
  tier           INTEGER NOT NULL DEFAULT 1,
  crafting_slots INTEGER NOT NULL DEFAULT 2,
  built_at       TIMESTAMP DEFAULT NOW(),
  upgraded_at    TIMESTAMP
);

-- Crafted item inventory (per province)
CREATE TABLE IF NOT EXISTS crafted_items (
  id          SERIAL PRIMARY KEY,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  item_key    VARCHAR(60) NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(province_id, item_key)
);

-- Active crafting jobs with timers
CREATE TABLE IF NOT EXISTS crafting_queue (
  id           SERIAL PRIMARY KEY,
  province_id  INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  item_key     VARCHAR(60) NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  started_at   TIMESTAMP DEFAULT NOW(),
  completes_at TIMESTAMP NOT NULL,
  status       VARCHAR(20) DEFAULT 'in_progress'
);

-- Active buffs/debuffs on provinces
CREATE TABLE IF NOT EXISTS active_effects (
  id                 SERIAL PRIMARY KEY,
  province_id        INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  source_province_id INTEGER REFERENCES provinces(id) ON DELETE SET NULL,
  item_key           VARCHAR(60) NOT NULL,
  effect_type        VARCHAR(30) NOT NULL,
  modifier_key       VARCHAR(60) NOT NULL,
  modifier_value     FLOAT NOT NULL,
  stacks             INTEGER NOT NULL DEFAULT 1,
  expires_at         TIMESTAMP
);

-- Per-item, per-province 4-hour cooldown tracking
CREATE TABLE IF NOT EXISTS crafting_cooldowns (
  province_id  INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  item_key     VARCHAR(60) NOT NULL,
  last_used_at TIMESTAMP NOT NULL,
  PRIMARY KEY (province_id, item_key)
);

-- Extend marketplace to support crafted item listings (NULL = resource listing)
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS item_key VARCHAR(60);
