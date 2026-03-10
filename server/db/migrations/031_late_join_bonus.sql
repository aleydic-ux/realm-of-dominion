-- Late-join mechanism: track bonus application
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS joined_on_day INT NOT NULL DEFAULT 1;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS late_join_bonus_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS late_join_bonus_at TIMESTAMPTZ;
