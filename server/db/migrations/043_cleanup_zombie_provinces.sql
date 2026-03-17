-- Migration 043: remove zombie provinces (old bot provinces carried over from previous age
-- without is_bot=true flag, resulting in user_id=NULL, is_bot=false, bot_personality=NULL)
-- These are safe to delete as they have no real activity.

DELETE FROM province_troops WHERE province_id IN (
  SELECT p.id FROM provinces p
  JOIN ages a ON a.id = p.age_id AND a.is_active = true
  WHERE p.user_id IS NULL AND p.is_bot = false AND p.bot_personality IS NULL
);

DELETE FROM province_buildings WHERE province_id IN (
  SELECT p.id FROM provinces p
  JOIN ages a ON a.id = p.age_id AND a.is_active = true
  WHERE p.user_id IS NULL AND p.is_bot = false AND p.bot_personality IS NULL
);

DELETE FROM provinces
WHERE user_id IS NULL AND is_bot = false AND bot_personality IS NULL
  AND age_id IN (SELECT id FROM ages WHERE is_active = true);
