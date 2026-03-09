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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// NOTE: pool.on('connect') was removed — the fire-and-forget client.query() call inside it
// caused "concurrent client.query()" deprecation warnings (pg@9.0 will error).
// Timestamp UTC handling is covered by types.setTypeParser above.

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
