-- Gem System: balance column, transaction ledger, unlock tree, active buffs
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS gems INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS gem_transactions (
  id            SERIAL PRIMARY KEY,
  province_id   INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  amount        INT NOT NULL,
  reason        VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gem_transactions_province ON gem_transactions(province_id);

CREATE TABLE IF NOT EXISTS gem_unlocks (
  id              SERIAL PRIMARY KEY,
  province_id     INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  enhancement_id  VARCHAR(50) NOT NULL,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(province_id, enhancement_id)
);

CREATE TABLE IF NOT EXISTS gem_buffs (
  id              SERIAL PRIMARY KEY,
  province_id     INT NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  enhancement_id  VARCHAR(50) NOT NULL,
  expires_at      TIMESTAMPTZ,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gem_buffs_province ON gem_buffs(province_id);
