-- BALANCE: Halve troop food upkeep to allow massive armies
-- Old: T1=1, T2=2, T3=4, T4=6, T5=8
-- New: T1=1, T2=1, T3=2, T4=3, T5=4
UPDATE troop_types SET food_upkeep = 1 WHERE tier = 1 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 1 WHERE tier = 2 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 2 WHERE tier = 3 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 3 WHERE tier = 4 AND race != 'undead';
UPDATE troop_types SET food_upkeep = 4 WHERE tier = 5 AND race != 'undead';
