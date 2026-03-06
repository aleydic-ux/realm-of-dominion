CREATE TABLE IF NOT EXISTS hall_of_fame (
  id SERIAL PRIMARY KEY,
  age_id INTEGER REFERENCES ages(id),
  province_id INTEGER REFERENCES provinces(id),
  username VARCHAR(50),
  province_name VARCHAR(100),
  race VARCHAR(20),
  final_networth BIGINT,
  final_land INTEGER,
  successful_attacks INTEGER DEFAULT 0,
  category VARCHAR(20) DEFAULT 'overall' CHECK (category IN ('overall','military','economic','alliance')),
  rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
