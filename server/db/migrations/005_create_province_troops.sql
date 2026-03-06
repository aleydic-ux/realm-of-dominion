CREATE TABLE IF NOT EXISTS province_troops (
  id SERIAL PRIMARY KEY,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  troop_type_id INTEGER REFERENCES troop_types(id),
  count_home INTEGER DEFAULT 0,
  count_training INTEGER DEFAULT 0,
  count_deployed INTEGER DEFAULT 0,
  training_completes_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(province_id, troop_type_id)
);
