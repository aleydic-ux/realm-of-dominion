-- Hourly resource snapshots for history chart
CREATE TABLE IF NOT EXISTS resource_snapshots (
  id SERIAL PRIMARY KEY,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  gold NUMERIC DEFAULT 0,
  food NUMERIC DEFAULT 0,
  mana NUMERIC DEFAULT 0,
  land INTEGER DEFAULT 0,
  industry_points NUMERIC DEFAULT 0,
  population INTEGER DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_province_time
  ON resource_snapshots(province_id, recorded_at DESC);
