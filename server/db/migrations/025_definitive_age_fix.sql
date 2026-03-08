-- Definitive age fix: find the age provinces belong to and make it the only active age
DO $$
DECLARE
  v_age_id INTEGER;
BEGIN
  -- Find the age that the most provinces are linked to
  SELECT age_id INTO v_age_id
  FROM provinces
  WHERE age_id IS NOT NULL
  GROUP BY age_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Deactivate ALL ages first (clean slate)
  UPDATE ages SET is_active = false;

  IF v_age_id IS NOT NULL THEN
    -- Reactivate the age provinces belong to, 7 days from now
    UPDATE ages
    SET is_active = true,
        ends_at = NOW() + INTERVAL '7 days'
    WHERE id = v_age_id;
  ELSE
    -- No provinces — reactivate the oldest age or create one
    UPDATE ages
    SET is_active = true,
        ends_at = NOW() + INTERVAL '7 days'
    WHERE id = (SELECT id FROM ages ORDER BY id ASC LIMIT 1);

    IF NOT FOUND THEN
      INSERT INTO ages (name, starts_at, ends_at, is_active)
      VALUES ('Age of Iron', NOW(), NOW() + INTERVAL '7 days', true);
    END IF;
  END IF;
END $$;
