-- Reactivate the most recently deactivated age and extend it 90 days
-- (handles the case where the age ended and left no active age)
UPDATE ages
SET is_active = true,
    ends_at = NOW() + INTERVAL '90 days'
WHERE id = (SELECT id FROM ages ORDER BY id DESC LIMIT 1)
  AND is_active = false;

-- Fallback: if still no active age, create a fresh one
INSERT INTO ages (name, starts_at, ends_at, is_active)
SELECT 'Age of Iron', NOW(), NOW() + INTERVAL '90 days', true
WHERE NOT EXISTS (SELECT 1 FROM ages WHERE is_active = true);
