CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,           -- 'raid_incoming', 'raid_report', 'trade', 'system'
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',         -- attack_id, attacker_name, etc.
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_province ON notifications (province_id, is_read, created_at DESC);

-- Auto-purge old notifications (keep last 50 per province)
CREATE OR REPLACE FUNCTION prune_notifications() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM notifications
  WHERE id IN (
    SELECT id FROM notifications
    WHERE province_id = NEW.province_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_notifications ON notifications;
CREATE TRIGGER trg_prune_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION prune_notifications();
