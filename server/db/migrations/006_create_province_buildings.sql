CREATE TABLE IF NOT EXISTS province_buildings (
  id SERIAL PRIMARY KEY,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  building_type VARCHAR(50) NOT NULL,
  level INTEGER DEFAULT 0,
  is_upgrading BOOLEAN DEFAULT false,
  upgrade_completes_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(province_id, building_type)
);
