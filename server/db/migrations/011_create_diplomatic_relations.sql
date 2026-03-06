CREATE TABLE IF NOT EXISTS diplomatic_relations (
  id SERIAL PRIMARY KEY,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  target_province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ally','neutral','enemy','pact')),
  pact_expires_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(province_id, target_province_id)
);
