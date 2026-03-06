CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  age_id INTEGER REFERENCES ages(id),
  name VARCHAR(100) NOT NULL,
  race VARCHAR(20) NOT NULL CHECK (race IN ('human','orc','undead','elf','dwarf')),
  land INTEGER DEFAULT 100,
  gold BIGINT DEFAULT 5000,
  food BIGINT DEFAULT 2000,
  mana BIGINT DEFAULT 500,
  production_points BIGINT DEFAULT 1000,
  population INTEGER DEFAULT 500,
  morale INTEGER DEFAULT 100,
  action_points INTEGER DEFAULT 20,
  ap_last_regen TIMESTAMP DEFAULT NOW(),
  last_resource_update TIMESTAMP DEFAULT NOW(),
  protection_ends_at TIMESTAMP,
  networth BIGINT DEFAULT 0,
  is_in_war BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS provinces_user_age_idx ON provinces(user_id, age_id);
