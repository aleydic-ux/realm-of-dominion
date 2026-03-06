CREATE TABLE IF NOT EXISTS province_research (
  id SERIAL PRIMARY KEY,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  tech_id INTEGER REFERENCES tech_tree(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete')),
  started_at TIMESTAMP,
  completes_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(province_id, tech_id)
);
