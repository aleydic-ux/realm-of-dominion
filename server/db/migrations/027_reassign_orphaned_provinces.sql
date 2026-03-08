-- Reassign provinces that belong to inactive ages to the active age
-- This handles the case where an age was deactivated but provinces were never migrated
DO $$
DECLARE
  v_active_age_id INTEGER;
BEGIN
  -- Find the active age
  SELECT id INTO v_active_age_id
  FROM ages
  WHERE is_active = true
  LIMIT 1;

  IF v_active_age_id IS NULL THEN
    RETURN; -- no active age, nothing to do
  END IF;

  -- Move all provinces from inactive ages to the active age
  UPDATE provinces
  SET age_id = v_active_age_id, updated_at = NOW()
  WHERE age_id != v_active_age_id
    AND age_id IN (SELECT id FROM ages WHERE is_active = false);
END $$;
