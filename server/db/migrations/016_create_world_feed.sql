CREATE TABLE IF NOT EXISTS world_feed (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'chat',
  author_name VARCHAR(100) NOT NULL,
  province_id INTEGER REFERENCES provinces(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_feed_created ON world_feed(created_at DESC);
