-- Rename production_points column to industry_points across provinces table
ALTER TABLE provinces RENAME COLUMN production_points TO industry_points;

-- Update tech_tree_nodes JSONB: rename modifier target 'production_points' -> 'industry_points'
UPDATE tech_tree_nodes
SET effect = jsonb_set(effect, '{target}', '"industry_points"')
WHERE effect->>'target' = 'production_points';
