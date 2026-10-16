-- Phase 2 B4: racial tech trees for the four new races (7 techs each, same tier shape as the
-- original five). Only runs on a database whose tech tree is already seeded: on a fresh
-- database the seed (server/db/seeds/tech_tree.js) inserts these with everything else, and
-- it skips seeding if any techs exist, so inserting them here first would block the seed.

INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Venom Glands', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.2, "scope": "troop_name:Venom Striker"}'::jsonb, 'Venom Strikers +20% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Venom Glands');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Shadow Craft', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "spy_success", "value": 0.1, "scope": "all"}'::jsonb, '+10% spy operation success'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Shadow Craft');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Serpent Scales', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.2, "scope": "troop_name:Thornblade"}'::jsonb, 'Thornblades +20% DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Serpent Scales');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Silent Approach', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "spy_detection", "value": -0.2, "scope": "all"}'::jsonb, 'Spy operations are 20% less likely to be detected'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Silent Approach');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Coiled Reserves', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.1, "scope": "all"}'::jsonb, '+10% all troop defense'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Coiled Reserves');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Hydra Brood', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.2, "scope": "troop_name:Serpent Hydra"}'::jsonb, 'Serpent Hydras +20% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Hydra Brood');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'serpathi', 'Toxin Mastery', 3, 5000, 300, 22, 3, '{"modifier_type": "flat", "target": "enemy_morale", "value": -5, "scope": "all"}'::jsonb, 'Winning attacks drain 5 extra enemy morale'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Toxin Mastery');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Steam Boilers', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "industry_points", "value": 0.2, "scope": "all"}'::jsonb, '+20% industry output'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Steam Boilers');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Reinforced Plating', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.2, "scope": "troop_name:Clockwork Knight"}'::jsonb, 'Clockwork Knights +20% DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Reinforced Plating');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Siege Engineering', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.25, "scope": "troop_name:Siege Automaton"}'::jsonb, 'Siege Automatons +25% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Siege Engineering');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Assembly Lines', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "building_cost", "value": -0.2, "scope": "all"}'::jsonb, '-20% building cost and construction time'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Assembly Lines');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Gear Discipline', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.1, "scope": "all"}'::jsonb, '+10% all troop attack'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Gear Discipline');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Colossus Forge', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "targets": ["troop_attack", "troop_defense"], "value": 0.2, "scope": "troop_name:War Colossus"}'::jsonb, 'War Colossus +20% ATK and DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Colossus Forge');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ironveil', 'Bastion Protocol', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.15, "scope": "all"}'::jsonb, '+15% all troop defense'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Bastion Protocol');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Kindling', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "raid_resources", "value": 0.15, "scope": "all"}'::jsonb, '+15% resources stolen on raids'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Kindling');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Ember Training', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.2, "scope": "troop_name:Ember Raider"}'::jsonb, 'Ember Raiders +20% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Ember Training');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Wildfire', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "enemy_food", "value": -0.05, "scope": "all"}'::jsonb, 'Winning attacks burn 5% of enemy food'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Wildfire');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Fire Walk', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.25, "scope": "troop_name:Flame Warden"}'::jsonb, 'Flame Wardens +25% DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Fire Walk');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Smoldering Rage', 2, 2500, 150, 13, 2, '{"modifier_type": "flat", "target": "fury_per_stack", "value": 0.01, "scope": "all"}'::jsonb, 'Fury stacks give +1% more each'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Smoldering Rage');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Cinder Legion', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.25, "scope": "troop_name:Cinderborn"}'::jsonb, 'Cinderborn +25% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Cinder Legion');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'ashborn', 'Inferno', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "targets": ["troop_attack", "troop_defense"], "value": 0.2, "scope": "troop_name:Infernal Drake"}'::jsonb, 'Infernal Drakes +20% ATK and DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Inferno');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Undertow', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.25, "scope": "troop_name:Tide Watcher"}'::jsonb, 'Tide Watchers +25% DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Undertow');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Pearl Divers', 1, 1000, 50, 6, 2, '{"modifier_type": "multiplier", "target": "food_production", "value": 0.15, "scope": "all"}'::jsonb, '+15% food production'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Pearl Divers');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Riptide', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "targets": ["troop_attack", "troop_defense"], "value": 0.2, "scope": "troop_name:Current Dancer"}'::jsonb, 'Current Dancers +20% ATK and DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Riptide');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Harbor Walls', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "wall_effectiveness", "value": 0.2, "scope": "all"}'::jsonb, '+20% wall effectiveness'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Harbor Walls');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Merchant Fleet', 2, 2500, 150, 13, 2, '{"modifier_type": "multiplier", "target": "marketplace_sale", "value": 0.15, "scope": "all"}'::jsonb, '+15% marketplace sale earnings'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Merchant Fleet');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Leviathan Bulwark', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "target": "troop_defense", "value": 0.2, "scope": "troop_name:Leviathan Guard"}'::jsonb, 'Leviathan Guard +20% DEF'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Leviathan Bulwark');
INSERT INTO tech_tree (race, name, tier, gold_cost, mana_cost, research_hours, requires_library_level, effect_json, description)
SELECT 'tidewarden', 'Kraken''s Call', 3, 5000, 300, 22, 3, '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.2, "scope": "troop_name:Kraken Lord"}'::jsonb, 'Kraken Lords +20% ATK'
WHERE EXISTS (SELECT 1 FROM tech_tree WHERE race IS NULL)
  AND NOT EXISTS (SELECT 1 FROM tech_tree WHERE name = 'Kraken''s Call');

UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Venom Glands' LIMIT 1) WHERE name = 'Serpent Scales' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Shadow Craft' LIMIT 1) WHERE name = 'Silent Approach' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Serpent Scales' LIMIT 1) WHERE name = 'Hydra Brood' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Silent Approach' LIMIT 1) WHERE name = 'Toxin Mastery' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Steam Boilers' LIMIT 1) WHERE name = 'Siege Engineering' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Steam Boilers' LIMIT 1) WHERE name = 'Assembly Lines' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Reinforced Plating' LIMIT 1) WHERE name = 'Gear Discipline' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Siege Engineering' LIMIT 1) WHERE name = 'Colossus Forge' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Gear Discipline' LIMIT 1) WHERE name = 'Bastion Protocol' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Kindling' LIMIT 1) WHERE name = 'Wildfire' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Ember Training' LIMIT 1) WHERE name = 'Fire Walk' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Fire Walk' LIMIT 1) WHERE name = 'Cinder Legion' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Wildfire' LIMIT 1) WHERE name = 'Inferno' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Undertow' LIMIT 1) WHERE name = 'Riptide' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Undertow' LIMIT 1) WHERE name = 'Harbor Walls' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Pearl Divers' LIMIT 1) WHERE name = 'Merchant Fleet' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Harbor Walls' LIMIT 1) WHERE name = 'Leviathan Bulwark' AND prerequisite_tech_id IS NULL;
UPDATE tech_tree SET prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Riptide' LIMIT 1) WHERE name = 'Kraken''s Call' AND prerequisite_tech_id IS NULL;
