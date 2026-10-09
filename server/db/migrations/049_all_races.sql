-- Allow all 9 races (keep in sync with server/config/raceConfig.js).
-- 003/004/007 only allowed the original 5, so new-race troops, techs and provinces
-- were rejected. DROP IF EXISTS + NOT VALID keeps this safe on databases that were
-- patched by hand: existing rows aren't re-validated, new rows are checked.
ALTER TABLE provinces DROP CONSTRAINT IF EXISTS provinces_race_check;
ALTER TABLE provinces ADD CONSTRAINT provinces_race_check
  CHECK (race IN ('human','orc','undead','elf','dwarf','serpathi','ironveil','ashborn','tidewarden')) NOT VALID;

ALTER TABLE troop_types DROP CONSTRAINT IF EXISTS troop_types_race_check;
ALTER TABLE troop_types ADD CONSTRAINT troop_types_race_check
  CHECK (race IN ('human','orc','undead','elf','dwarf','serpathi','ironveil','ashborn','tidewarden')) NOT VALID;

ALTER TABLE tech_tree DROP CONSTRAINT IF EXISTS tech_tree_race_check;
ALTER TABLE tech_tree ADD CONSTRAINT tech_tree_race_check
  CHECK (race IN ('human','orc','undead','elf','dwarf','serpathi','ironveil','ashborn','tidewarden') OR race IS NULL) NOT VALID;

-- Registration omitted Arcane Sanctum, so players who joined after 018 have no row for
-- it and can't build it. Backfill (level 0 = not built yet), same as 018.
INSERT INTO province_buildings (province_id, building_type, level)
SELECT p.id, 'arcane_sanctum', 0
FROM provinces p
WHERE NOT EXISTS (
  SELECT 1 FROM province_buildings pb
  WHERE pb.province_id = p.id AND pb.building_type = 'arcane_sanctum'
);
