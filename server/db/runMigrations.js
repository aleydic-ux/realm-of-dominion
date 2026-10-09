const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
// Advisory lock key shared by every migration runner (npm start's migrate.js, the boot-time
// run, overlapping deploys). Transaction-scoped so it also works through a PgBouncer
// transaction pooler, where session-level advisory locks aren't reliable.
const MIGRATION_LOCK_KEY = 4207002;

// Runs fn inside a transaction that holds the migration lock
async function lockedTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * Applies pending .sql migrations in filename order. Each migration and its record
 * commit together, so a failure leaves neither behind; a concurrent runner waits on the
 * lock and then skips what was applied. Throws on the first failure.
 */
async function runMigrations(pool, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await lockedTransaction(client, () => client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `));

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const applied = [];
    for (const file of files) {
      const didApply = await lockedTransaction(client, async () => {
        // Re-check under the lock: another runner may have just applied it
        const { rows } = await client.query('SELECT 1 FROM migrations WHERE filename = $1', [file]);
        if (rows.length) return false;
        log(`Applying ${file}...`);
        try {
          await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        } catch (err) {
          err.message = `${file}: ${err.message}`;
          throw err;
        }
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        return true;
      });
      if (didApply) applied.push(file);
    }

    log(applied.length ? `Applied ${applied.length} migration(s).` : 'All migrations up to date.');
    return applied;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
