-- Migration 045: update race check constraints to include new races
-- Serpathi, Ironveil, Ashborn, Tidewarden

ALTER TABLE troop_types DROP CONSTRAINT IF EXISTS troop_types_race_check;
ALTER TABLE troop_types ADD CONSTRAINT troop_types_race_check
  CHECK (race IN ('human','orc','undead','elf','dwarf','serpathi','ironveil','ashborn','tidewarden'));

ALTER TABLE provinces DROP CONSTRAINT IF EXISTS provinces_race_check;
ALTER TABLE provinces ADD CONSTRAINT provinces_race_check
  CHECK (race IN ('human','orc','undead','elf','dwarf','serpathi','ironveil','ashborn','tidewarden'));
