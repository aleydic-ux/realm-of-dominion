-- Chat moderation: soft-delete messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Chat moderation: mute members from chat
ALTER TABLE alliance_members ADD COLUMN IF NOT EXISTS chat_muted_until TIMESTAMP;

-- In-game mail
CREATE TABLE IF NOT EXISTS mail (
  id SERIAL PRIMARY KEY,
  sender_province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  recipient_province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL DEFAULT 'No subject',
  body TEXT NOT NULL,
  read_at TIMESTAMP,
  deleted_by_sender BOOLEAN DEFAULT FALSE,
  deleted_by_recipient BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_recipient ON mail(recipient_province_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_sender ON mail(sender_province_id, created_at DESC);
