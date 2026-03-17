-- Migration 042: reduce troop food upkeep for all non-undead troops
-- T3: 2→1, T4: 3→2, T5: 4→2 (undead already at 0, unchanged)
UPDATE troop_types SET food_upkeep = 1 WHERE tier = 3 AND food_upkeep > 0;
UPDATE troop_types SET food_upkeep = 2 WHERE tier = 4 AND food_upkeep > 0;
UPDATE troop_types SET food_upkeep = 2 WHERE tier = 5 AND food_upkeep > 0;
