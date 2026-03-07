-- BALANCE-03: Scale food upkeep by tier (non-undead troops only)
-- T1=1 (unchanged), T2=2, T3=4, T4=6, T5=8
UPDATE troop_types SET food_upkeep = 1 WHERE tier = 1 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 2 WHERE tier = 2 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 4 WHERE tier = 3 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 6 WHERE tier = 4 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 8 WHERE tier = 5 AND race != 'undead';

-- BALANCE-04: Buff Elf T5 Archmage ATK from 11 to 22
UPDATE troop_types SET offense_power = 22 WHERE name = 'Archmage' AND race = 'elf';

-- BALANCE-06: Raise "Timeless Wisdom" cost to 3500 gold and add Arcane Mastery I as prerequisite
UPDATE tech_tree
SET gold_cost = 3500,
    prerequisite_tech_id = (SELECT id FROM tech_tree WHERE name = 'Arcane Mastery I' LIMIT 1)
WHERE name = 'Timeless Wisdom';
