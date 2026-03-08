-- Active spell effects (buffs on caster, debuffs on target, scout results)
CREATE TABLE IF NOT EXISTS spell_effects (
  id SERIAL PRIMARY KEY,
  caster_province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  target_province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  spell_key VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL, -- 'buff' | 'debuff' | 'scout'
  effect_json JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spell_effects_target_idx ON spell_effects(target_province_id, expires_at);
CREATE INDEX IF NOT EXISTS spell_effects_caster_idx ON spell_effects(caster_province_id, expires_at);

-- Spell cooldowns per province per spell
CREATE TABLE IF NOT EXISTS spell_cooldowns (
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  spell_key VARCHAR(50) NOT NULL,
  cooldown_ends_at TIMESTAMP NOT NULL,
  PRIMARY KEY(province_id, spell_key)
);

-- Add Arcane Sanctum building to all existing provinces (level 0 = not built yet)
INSERT INTO province_buildings (province_id, building_type, level)
SELECT p.id, 'arcane_sanctum', 0
FROM provinces p
WHERE NOT EXISTS (
  SELECT 1 FROM province_buildings pb
  WHERE pb.province_id = p.id AND pb.building_type = 'arcane_sanctum'
);
