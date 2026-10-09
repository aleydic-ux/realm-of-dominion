-- Enforce exactly one active age.
--
-- Rollovers could run twice (the in-process guard was set after an await, and separate
-- instances had no guard at all), leaving two active ages; `LIMIT 1` then picked one at
-- random and players' provinces "disappeared" (see 023–027). The rollover now takes an
-- advisory lock; this repairs existing data and adds a DB-level guarantee.
DO $$
DECLARE
  v_active INTEGER;
  v_keep INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_active FROM ages WHERE is_active = true;

  IF v_active > 1 THEN
    -- Keep the active age most real players are in (newest on ties)
    SELECT a.id INTO v_keep
    FROM ages a
    LEFT JOIN provinces p ON p.age_id = a.id AND p.user_id IS NOT NULL
    WHERE a.is_active = true
    GROUP BY a.id
    ORDER BY COUNT(p.id) DESC, a.id DESC
    LIMIT 1;

    -- Bring over each player's newest province from the other active ages, unless they
    -- already have one in the kept age (provinces are unique per user and age)
    UPDATE provinces SET age_id = v_keep, updated_at = NOW()
    WHERE id IN (
      SELECT DISTINCT ON (p.user_id) p.id
      FROM provinces p
      JOIN ages a ON a.id = p.age_id AND a.is_active = true AND a.id <> v_keep
      WHERE p.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM provinces k WHERE k.age_id = v_keep AND k.user_id = p.user_id)
      ORDER BY p.user_id, p.created_at DESC
    );

    UPDATE ages SET is_active = false, updated_at = NOW()
    WHERE is_active = true AND id <> v_keep;

  ELSIF v_active = 0 THEN
    -- No active age: reactivate the one most players are in (as 025/026 did), or create one
    SELECT age_id INTO v_keep
    FROM provinces
    WHERE age_id IS NOT NULL AND user_id IS NOT NULL
    GROUP BY age_id
    ORDER BY COUNT(*) DESC, age_id DESC
    LIMIT 1;

    IF v_keep IS NOT NULL THEN
      UPDATE ages SET is_active = true, ends_at = GREATEST(ends_at, NOW() + INTERVAL '7 days'), updated_at = NOW()
      WHERE id = v_keep;
    ELSE
      INSERT INTO ages (name, starts_at, ends_at, is_active)
      VALUES ('Age of Iron', NOW(), NOW() + INTERVAL '7 days', true);
    END IF;
  END IF;
END $$;

-- At most one row can have is_active = true
CREATE UNIQUE INDEX IF NOT EXISTS ages_single_active ON ages (is_active) WHERE is_active;
