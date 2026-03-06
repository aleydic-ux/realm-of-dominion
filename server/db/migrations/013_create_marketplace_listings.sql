CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  seller_province_id INTEGER REFERENCES provinces(id),
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('gold','food','mana','production_points')),
  quantity BIGINT NOT NULL,
  price_per_unit NUMERIC(10,2) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_sold BOOLEAN DEFAULT false,
  buyer_province_id INTEGER REFERENCES provinces(id),
  sold_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketplace_active_idx ON marketplace_listings(is_sold, expires_at);
