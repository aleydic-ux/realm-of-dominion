-- Per-target attack cap: count attacks by (attacker, defender) in the last 24h
CREATE INDEX IF NOT EXISTS idx_attacks_attacker_defender_time
  ON attacks(attacker_province_id, defender_province_id, attacked_at DESC);
