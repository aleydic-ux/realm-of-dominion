-- Convert every TIMESTAMP (without time zone) column to TIMESTAMPTZ.
--
-- TIMESTAMP stores a wall-clock time with no zone, so correctness depended on Node and
-- the DB session both running in UTC: JS Dates were written in Node's local time (the
-- offset is dropped), NOW() in the session's zone, and config/db.js read values back
-- as UTC. Off UTC, timers completed early or never, troops returned immediately, and
-- the resource tick stopped granting. TIMESTAMPTZ stores an absolute instant, so
-- neither zone matters.
--
-- Existing values were written with both sides on UTC (Render + Neon defaults), so
-- they are interpreted as UTC. Each table is rewritten once with all its columns.
-- New columns should use TIMESTAMPTZ.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name,
           string_agg(format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
                             c.column_name, c.column_name), ', ') AS alters
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.data_type = 'timestamp without time zone'
    GROUP BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE %I %s', t.table_name, t.alters);
  END LOOP;
END $$;
