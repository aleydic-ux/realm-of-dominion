-- Additional bot tracking columns
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS bot_personality     VARCHAR(20);
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS bot_last_action_at  TIMESTAMP;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS bot_aggression_level FLOAT DEFAULT 0.5;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS bot_spawn_at        TIMESTAMP;

-- Map existing difficulty values to personalities for existing bots
UPDATE provinces
SET bot_personality = CASE bot_difficulty
    WHEN 'easy'   THEN 'passive'
    WHEN 'medium' THEN 'economic'
    WHEN 'hard'   THEN 'aggressive'
    ELSE 'economic'
  END,
  bot_spawn_at = created_at
WHERE is_bot = true AND bot_personality IS NULL;

-- Bot action log (P2)
CREATE TABLE IF NOT EXISTS bot_action_log (
  id          SERIAL PRIMARY KEY,
  bot_id      INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  action_type VARCHAR(50),
  target_id   INTEGER,
  result      VARCHAR(50),
  reason      TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
