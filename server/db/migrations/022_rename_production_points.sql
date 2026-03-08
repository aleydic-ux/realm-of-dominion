-- Safely rename production_points -> industry_points (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provinces' AND column_name = 'production_points'
  ) THEN
    ALTER TABLE provinces RENAME COLUMN production_points TO industry_points;
  END IF;
END $$;

-- Update tech_tree JSONB: rename modifier target 'production_points' -> 'industry_points'
UPDATE tech_tree
SET effect_json = jsonb_set(effect_json, '{target}', '"industry_points"')
WHERE effect_json->>'target' = 'production_points';
