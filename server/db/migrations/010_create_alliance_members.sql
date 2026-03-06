CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
  province_id INTEGER REFERENCES provinces(id) ON DELETE CASCADE,
  rank VARCHAR(20) DEFAULT 'member' CHECK (rank IN ('leader','officer','member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (alliance_id, province_id)
);
