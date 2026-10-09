-- Session invalidation: JWTs carry token_version; bumping it revokes all existing tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
