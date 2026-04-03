-- Migration 046: spy system
CREATE TABLE IF NOT EXISTS spy_reports (
  id SERIAL PRIMARY KEY,
  attacker_province_id INTEGER NOT NULL REFERENCES provinces(id),
  defender_province_id INTEGER NOT NULL REFERENCES provinces(id),
  action_type VARCHAR(30) NOT NULL,
  success BOOLEAN NOT NULL,
  detected BOOLEAN NOT NULL,
  result JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS spy_reports_attacker_idx ON spy_reports (attacker_province_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spy_reports_defender_idx ON spy_reports (defender_province_id, created_at DESC);
