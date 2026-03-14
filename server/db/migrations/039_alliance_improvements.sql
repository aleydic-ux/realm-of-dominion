-- Alliance war scoring
ALTER TABLE alliances ADD COLUMN IF NOT EXISTS war_wins INTEGER DEFAULT 0;
ALTER TABLE alliances ADD COLUMN IF NOT EXISTS war_losses INTEGER DEFAULT 0;

-- Alliance-to-alliance diplomacy (NAP / war tracking)
CREATE TABLE IF NOT EXISTS alliance_diplomacy (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  target_alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('war', 'nap', 'peace')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(alliance_id, target_alliance_id)
);
CREATE INDEX IF NOT EXISTS idx_alliance_diplomacy ON alliance_diplomacy(alliance_id);
CREATE INDEX IF NOT EXISTS idx_alliance_diplomacy_target ON alliance_diplomacy(target_alliance_id);

-- Purchasable alliance-wide buffs (purchase log + expiry)
CREATE TABLE IF NOT EXISTS alliance_buffs (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  buff_key VARCHAR(50) NOT NULL,
  buff_name VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_buffs_active ON alliance_buffs(alliance_id, expires_at);
