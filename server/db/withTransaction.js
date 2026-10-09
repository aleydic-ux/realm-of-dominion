const pool = require('../config/db');

/**
 * Runs fn(client) inside a transaction. fn returns null to commit, or a
 * user-facing error message to roll back with; that message is returned.
 * Thrown errors roll back and propagate.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const failure = await fn(client);
    await client.query(failure ? 'ROLLBACK' : 'COMMIT');
    return failure || null;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = withTransaction;
