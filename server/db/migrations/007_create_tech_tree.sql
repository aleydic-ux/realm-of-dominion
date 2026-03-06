CREATE TABLE IF NOT EXISTS tech_tree (
  id SERIAL PRIMARY KEY,
  race VARCHAR(20) CHECK (race IN ('human','orc','undead','elf','dwarf') OR race IS NULL),
  name VARCHAR(100) NOT NULL,
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  gold_cost INTEGER NOT NULL,
  mana_cost INTEGER DEFAULT 0,
  research_hours NUMERIC(4,1) DEFAULT 4.0,
  requires_library_level INTEGER DEFAULT 2,
  prerequisite_tech_id INTEGER REFERENCES tech_tree(id),
  effect_json JSONB,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
