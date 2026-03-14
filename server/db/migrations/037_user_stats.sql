-- Running province combat/activity statistics
CREATE TABLE IF NOT EXISTS user_stats (
  province_id INTEGER PRIMARY KEY REFERENCES provinces(id) ON DELETE CASCADE,
  attacks_won INTEGER DEFAULT 0,
  attacks_lost INTEGER DEFAULT 0,
  attacks_defended INTEGER DEFAULT 0,
  land_conquered INTEGER DEFAULT 0,
  gold_plundered INTEGER DEFAULT 0,
  troops_trained INTEGER DEFAULT 0,
  research_completed INTEGER DEFAULT 0,
  spells_cast INTEGER DEFAULT 0,
  buildings_upgraded INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
