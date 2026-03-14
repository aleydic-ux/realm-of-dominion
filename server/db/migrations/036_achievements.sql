-- Player achievement unlocks
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  achievement_key VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (province_id, achievement_key)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_province ON user_achievements(province_id);
