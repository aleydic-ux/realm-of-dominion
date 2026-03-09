const { Pool, types } = require('pg');
require('dotenv').config();

// Parse TIMESTAMP WITHOUT TIME ZONE as UTC (OID 1114)
// By default node-postgres interprets it in local system timezone, causing comparison bugs
types.setTypeParser(1114, (val) => new Date(val + 'Z'));

// Clean up connection string:
// 1. Strip sslmode (handled via ssl option below, avoids pg deprecation warning)
// 2. Add connect_timeout=10 so TCP connections to Neon fail fast instead of hanging
//    when the serverless compute is cold (node-postgres has NO TCP-level timeout)
let connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*/i, '$1').replace(/[?&]$/, '')
  : undefined;
if (connectionString && !connectionString.includes('connect_timeout')) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'connect_timeout=10';
}

const pool = new Pool({
  connectionString,
  // Use SSL whenever a DATABASE_URL is provided (i.e. on Render).
  // Avoids relying on NODE_ENV which may not be set in the Render environment.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Pool sizing — default 10 is too low for multiplayer + cron jobs + socket auth
  max: 20,
  // Return connections that sit idle for 30s so Neon doesn't drop them silently
  idleTimeoutMillis: 30000,
  // Don't wait forever for a connection — fail fast after 10s so requests don't hang
  connectionTimeoutMillis: 10000,
});

// NOTE: pool.on('connect') was removed — the fire-and-forget client.query() call inside it
// caused "concurrent client.query()" deprecation warnings (pg@9.0 will error).
// Timestamp UTC handling is covered by types.setTypeParser above.

// Handle errors on idle clients (e.g. connection dropped while in pool)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
});

// Wrap pool.connect() so every checked-out client (used in BEGIN/COMMIT transactions)
// gets a silent error handler. Without this, a FATAL PostgreSQL error (code 57P01 —
// "terminating connection due to administrator command") emitted mid-query on a client
// that has no listener causes an unhandled 'error' event and crashes the process.
const _connect = pool.connect.bind(pool);
pool.connect = async function wrappedConnect() {
  const client = await _connect();
  client.on('error', (err) => {
    console.error('DB client error (connection terminated):', err.message);
  });
  return client;
};

module.exports = pool;
