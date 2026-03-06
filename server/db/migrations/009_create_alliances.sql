CREATE TABLE IF NOT EXISTS alliances (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  leader_province_id INTEGER REFERENCES provinces(id),
  bank_gold BIGINT DEFAULT 0,
  age_id INTEGER REFERENCES ages(id),
  max_members INTEGER DEFAULT 12,
  is_at_war BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
