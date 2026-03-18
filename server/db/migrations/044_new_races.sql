-- Migration 044: new race state columns for Ashborn, Tidewarden, and general attack tracking
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS ashborn_attack_streak INT DEFAULT 0;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS attacked_this_season BOOLEAN DEFAULT FALSE;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS phantom_attack_used BOOLEAN DEFAULT FALSE;
