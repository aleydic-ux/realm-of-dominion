-- Tech audit: most research effects were never read by the game, or did the wrong thing.
-- The code now implements every tech; this brings existing tech rows (effect + description)
-- in line with server/db/seeds/tech_tree.js. Fresh databases get these values from the seed.

UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "explore_yield", "value": 0.2, "scope": "all"}'::jsonb, description = '+20% land from exploring', updated_at = NOW() WHERE name = 'Cartography';
UPDATE tech_tree SET description = '+15% attack power on Conquest and Raze attacks', updated_at = NOW() WHERE name = 'Siege Doctrine';
UPDATE tech_tree SET description = '+20% wall effectiveness', updated_at = NOW() WHERE name = 'Fortification';
UPDATE tech_tree SET description = '+30% wall effectiveness (stacks with Fortification)', updated_at = NOW() WHERE name = 'Grand Fortification';
UPDATE tech_tree SET description = '+20% watchtower effectiveness (defense and spy detection)', updated_at = NOW() WHERE name = 'Scouting Network';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "population_food", "value": -0.25, "scope": "all"}'::jsonb, description = 'Your population eats 25% less food', updated_at = NOW() WHERE name = 'Population Boom';
UPDATE tech_tree SET description = '+10% strength for alliance buffs', updated_at = NOW() WHERE name = 'Diplomacy I';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "enemy_attack", "value": 0.15, "scope": "all"}'::jsonb, description = '+15% attack power against provinces you have marked as enemies', updated_at = NOW() WHERE name = 'Diplomacy II';
UPDATE tech_tree SET description = '+25% strength for alliance buffs (stacks with Diplomacy I)', updated_at = NOW() WHERE name = 'Diplomacy III';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "troop_attack", "value": 0.2, "scope": "troop_name:Knight", "attack_morale_bonus": 10}'::jsonb, description = 'Knights +20% ATK, +10 army morale when attacking', updated_at = NOW() WHERE name = 'Chivalric Code';
UPDATE tech_tree SET description = 'Unlocks spell: Clarity (+5% attack, defense, gold, food and mana for 4h)', updated_at = NOW() WHERE name = 'Arcane Study';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "gold_income", "value": 0.25, "scope": "all", "morale_cap": 90}'::jsonb, description = '+25% gold income, but morale recovers only to 90%', updated_at = NOW() WHERE name = 'Imperial Taxation';
UPDATE tech_tree SET description = 'Berserkers defend at half their attack power instead of not at all', updated_at = NOW() WHERE name = 'Blood Frenzy';
UPDATE tech_tree SET description = '+20% mana regen', updated_at = NOW() WHERE name = 'Shamanic Ritual';
UPDATE tech_tree SET effect_json = '{"modifier_type": "flat", "target": "warchief_bonus", "value": 0.05, "scope": "all"}'::jsonb, description = 'Warchief army bonus doubles (+10% instead of +5%)', updated_at = NOW() WHERE name = 'Warchief Dominance';
UPDATE tech_tree SET description = '+10% chance to raise Skeletons after a win', updated_at = NOW() WHERE name = 'Dark Necromancy I';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "skeleton_raise_count", "value": 0.5, "scope": "all"}'::jsonb, description = 'Raise 50% more troops', updated_at = NOW() WHERE name = 'Dark Necromancy II';
UPDATE tech_tree SET effect_json = '{"modifier_type": "flat", "target": "skeleton_raise_chance", "value": 0.15, "scope": "all", "raise_unit": "Ghoul"}'::jsonb, description = '+15% raise chance, and raises Ghouls (T2) instead of Skeletons', updated_at = NOW() WHERE name = 'Dark Necromancy III';
UPDATE tech_tree SET description = 'Winning attacks burn 10% of enemy food', updated_at = NOW() WHERE name = 'Plague Carrier';
UPDATE tech_tree SET description = 'Winning attacks with Banshees cut enemy gold income 5% for 12 hours', updated_at = NOW() WHERE name = 'Soul Drain';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "lich_casualties", "value": -0.5, "scope": "all"}'::jsonb, description = 'Liches suffer half casualties', updated_at = NOW() WHERE name = 'Phylactery';
UPDATE tech_tree SET effect_json = '{"modifier_type": "flat", "target": "skeleton_bonus", "value": 1, "scope": "all"}'::jsonb, description = 'Skeletons +1 ATK and +1 DEF', updated_at = NOW() WHERE name = 'Endless Legion';
UPDATE tech_tree SET description = 'Unlocks spell: Weaken (-10% enemy attack for 4h)', updated_at = NOW() WHERE name = 'Arcane Mastery I';
UPDATE tech_tree SET description = 'Unlocks spell: Drain (steal 5% of enemy gold and mana)', updated_at = NOW() WHERE name = 'Arcane Mastery II';
UPDATE tech_tree SET description = 'Unlocks spell: Shatter (knock an enemy building down a level)', updated_at = NOW() WHERE name = 'Arcane Mastery III';
UPDATE tech_tree SET description = 'Successful spy recon also reveals the target''s research', updated_at = NOW() WHERE name = 'Farsight';
UPDATE tech_tree SET description = '+25% industry output', updated_at = NOW() WHERE name = 'Deep Mining';
UPDATE tech_tree SET description = 'Runic Warriors +3 ATK/DEF', updated_at = NOW() WHERE name = 'Runic Inscription I';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "target": "runic_warrior_damage_reduction", "value": 0.2, "scope": "all"}'::jsonb, description = 'Runic Warriors suffer 20% fewer casualties', updated_at = NOW() WHERE name = 'Runic Inscription II';
UPDATE tech_tree SET description = 'Runic Warriors +20% ATK against Undead and Elf provinces', updated_at = NOW() WHERE name = 'Runic Inscription III';
UPDATE tech_tree SET effect_json = '{"modifier_type": "multiplier", "targets": ["troop_attack", "troop_defense"], "value": 0.1, "scope": "race_specific"}'::jsonb, description = 'All Dwarf troops +10% ATK and DEF', updated_at = NOW() WHERE name = 'Masterwork Forge';
