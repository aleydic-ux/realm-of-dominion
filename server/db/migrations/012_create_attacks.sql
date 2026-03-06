CREATE TABLE IF NOT EXISTS attacks (
  id SERIAL PRIMARY KEY,
  attacker_province_id INTEGER REFERENCES provinces(id),
  defender_province_id INTEGER REFERENCES provinces(id),
  attack_type VARCHAR(20) NOT NULL CHECK (attack_type IN ('raid','conquest','raze','massacre')),
  attacker_power INTEGER,
  defender_power INTEGER,
  outcome VARCHAR(10) CHECK (outcome IN ('win','loss','draw')),
  land_gained INTEGER DEFAULT 0,
  resources_stolen JSONB DEFAULT '{}',
  troops_deployed JSONB DEFAULT '{}',
  attacker_losses JSONB DEFAULT '{}',
  defender_losses JSONB DEFAULT '{}',
  troops_return_at TIMESTAMP,
  troops_returned BOOLEAN DEFAULT false,
  attacked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attacks_attacker_idx ON attacks(attacker_province_id);
CREATE INDEX IF NOT EXISTS attacks_defender_idx ON attacks(defender_province_id);
CREATE INDEX IF NOT EXISTS attacks_return_idx ON attacks(attacker_province_id, troops_returned, troops_return_at);
