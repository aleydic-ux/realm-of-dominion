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
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Pool sizing — Neon free tier limits concurrent connections; keep moderate
  max: 10,
  // Kill idle connections after 20s so Neon doesn't silently drop them
  idleTimeoutMillis: 20000,
  // Don't wait forever for a connection from the pool — fail fast after 8s
  connectionTimeoutMillis: 8000,
});

// Handle errors on idle clients (e.g. connection dropped while in pool)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
});

// Wrap pool.query() with a hard 20s timeout.
// Neon can silently kill connections that are still in the pool.
// When we try to query on a dead connection, the query hangs forever because
// the TCP stack hasn't detected the dead socket yet. This wrapper ensures
// we NEVER block indefinitely — queries either complete or fail within 20s.
const _poolQuery = pool.query.bind(pool);
pool.query = function queryWithTimeout(...args) {
  return Promise.race([
    _poolQuery(...args),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout (20s) — database unreachable')), 20000)
    ),
  ]);
};

// Wrap pool.connect() so every checked-out client gets a silent error handler.
// Without this, a FATAL PostgreSQL error (code 57P01) on a client with no
// listener causes an unhandled 'error' event and crashes the process.
const _connect = pool.connect.bind(pool);
pool.connect = async function wrappedConnect() {
  const client = await _connect();
  client.on('error', (err) => {
    console.error('DB client error (connection terminated):', err.message);
  });
  return client;
};

module.exports = pool;
