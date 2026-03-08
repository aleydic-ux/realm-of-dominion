-- Deactivate any wrongly-created empty ages
UPDATE ages SET is_active = false
WHERE id NOT IN (SELECT DISTINCT age_id FROM provinces WHERE age_id IS NOT NULL)
  AND is_active = true;

-- Reactivate the age that provinces actually belong to (extend 90 days)
UPDATE ages
SET is_active = true,
    ends_at = NOW() + INTERVAL '90 days'
WHERE id = (
  SELECT age_id FROM provinces
  WHERE age_id IS NOT NULL
  GROUP BY age_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
AND is_active = false;

-- Final fallback: if STILL no active age, reactivate whatever exists
UPDATE ages
SET is_active = true,
    ends_at = NOW() + INTERVAL '90 days'
WHERE id = (SELECT id FROM ages ORDER BY id ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM ages WHERE is_active = true);
