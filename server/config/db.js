const { Pool, types } = require('pg');
require('dotenv').config();

// Parse TIMESTAMP WITHOUT TIME ZONE as UTC (OID 1114)
// By default node-postgres interprets it in local system timezone, causing comparison bugs
types.setTypeParser(1114, (val) => new Date(val + 'Z'));

// Strip sslmode from connection string to suppress pg-connection-string v3 deprecation warning.
// SSL is handled explicitly via the ssl option below.
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*/i, '$1').replace(/[?&]$/, '')
  : undefined;

const pool = new Pool({
  connectionString,
  // Use SSL whenever a DATABASE_URL is provided (i.e. on Render).
  // Avoids relying on NODE_ENV which may not be set in the Render environment.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// NOTE: pool.on('connect') was removed — the fire-and-forget client.query() call inside it
// caused "concurrent client.query()" deprecation warnings (pg@9.0 will error).
// Timestamp UTC handling is covered by types.setTypeParser above.

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
