-- Phase 2 B1: troops train in queued batches, each with its own timer
-- (one batch per troop type at a time before; see server/services/trainingQueue.js).
CREATE TABLE IF NOT EXISTS training_queue (
  id            SERIAL PRIMARY KEY,
  province_id   INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  troop_type_id INTEGER NOT NULL REFERENCES troop_types(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  completes_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_queue_province_completes ON training_queue (province_id, completes_at);

-- Carry over batches already in training under the old one-per-type scheme
INSERT INTO training_queue (province_id, troop_type_id, quantity, completes_at)
SELECT province_id, troop_type_id, count_training, COALESCE(training_completes_at, NOW())
FROM province_troops
WHERE count_training > 0;
