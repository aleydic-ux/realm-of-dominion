-- Province motto and active title on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS province_motto VARCHAR(80),
  ADD COLUMN IF NOT EXISTS active_title VARCHAR(60);
