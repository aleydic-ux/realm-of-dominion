CREATE TABLE IF NOT EXISTS troop_types (
  id SERIAL PRIMARY KEY,
  race VARCHAR(20) NOT NULL CHECK (race IN ('human','orc','undead','elf','dwarf')),
  name VARCHAR(50) NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  offense_power INTEGER DEFAULT 0,
  defense_power INTEGER DEFAULT 0,
  gold_cost INTEGER NOT NULL,
  food_upkeep INTEGER DEFAULT 1,
  training_time_hours NUMERIC(4,1) DEFAULT 1.0,
  special_ability TEXT,
  requires_building VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
