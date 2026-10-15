-- Fractional morale carried between resource ticks (morale itself stays an integer)
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS morale_progress REAL NOT NULL DEFAULT 0;
