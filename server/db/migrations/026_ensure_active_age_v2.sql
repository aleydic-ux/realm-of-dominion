-- Ensure there is always an active age with a valid ends_at in the future
DO $$
DECLARE
  v_age_id INTEGER;
  v_active_id INTEGER;
BEGIN
  -- Check if there's already an active age with a future end date
  SELECT id INTO v_active_id
  FROM ages
  WHERE is_active = true AND ends_at > NOW()
  LIMIT 1;

  IF v_active_id IS NOT NULL THEN
    RETURN; -- all good, nothing to do
  END IF;

  -- Find the age that the most provinces belong to
  SELECT age_id INTO v_age_id
  FROM provinces
  WHERE age_id IS NOT NULL
  GROUP BY age_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Deactivate all ages first
  UPDATE ages SET is_active = false;

  IF v_age_id IS NOT NULL THEN
    -- Reactivate the age provinces belong to, 7 days from now
    UPDATE ages
    SET is_active = true,
        ends_at = NOW() + INTERVAL '7 days'
    WHERE id = v_age_id;
  ELSE
    -- No provinces at all — reactivate the newest age or create one
    UPDATE ages
    SET is_active = true,
        ends_at = NOW() + INTERVAL '7 days'
    WHERE id = (SELECT id FROM ages ORDER BY id DESC LIMIT 1);

    IF NOT FOUND THEN
      INSERT INTO ages (name, starts_at, ends_at, is_active)
      VALUES ('Age of Iron', NOW(), NOW() + INTERVAL '7 days', true);
    END IF;
  END IF;
END $$;
