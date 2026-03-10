-- Protection Period enhancements: manual drop tracking
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS protection_dropped_at TIMESTAMPTZ;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS protection_manual_drop BOOLEAN NOT NULL DEFAULT FALSE;
