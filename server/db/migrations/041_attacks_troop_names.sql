-- Store a troop name snapshot in each attack record so reports don't break
-- if troop_types IDs change or rows are missing.
ALTER TABLE attacks ADD COLUMN IF NOT EXISTS troop_name_map JSONB DEFAULT '{}';

-- Back-fill existing records: build { troop_type_id: name } from current troop_types table.
-- This will fix historical records for any IDs that still exist.
UPDATE attacks a
SET troop_name_map = (
  SELECT jsonb_object_agg(tt.id::text, tt.name)
  FROM troop_types tt
)
WHERE troop_name_map = '{}'::jsonb OR troop_name_map IS NULL;
