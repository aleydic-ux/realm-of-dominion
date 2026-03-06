CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
  sender_province_id INTEGER REFERENCES provinces(id),
  body TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_alliance_idx ON messages(alliance_id, sent_at DESC);
