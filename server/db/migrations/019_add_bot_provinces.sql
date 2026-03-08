-- Add bot flag and difficulty to provinces
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS bot_difficulty VARCHAR(10) DEFAULT NULL;
