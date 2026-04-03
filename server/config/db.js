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

const QUERY_TIMEOUT_MS = 15000;

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false,
  // Pool sizing — Neon free tier limits concurrent connections; keep moderate
  max: 10,
  // Kill idle connections after 20s so Neon doesn't silently drop them
  idleTimeoutMillis: 20000,
  // Don't wait forever for a connection from the pool — fail fast after 8s
  connectionTimeoutMillis: 8000,
});

// Log the DB host on startup so we can verify the right endpoint is being used
if (connectionString) {
  const hostMatch = connectionString.match(/@([^/:]+)/);
  console.log('[db] Connecting to:', hostMatch ? hostMatch[1] : 'unknown host');
}

// Handle errors on idle clients (e.g. connection dropped while in pool)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
});

// Wrap pool.query() to DESTROY stuck connections on timeout.
//
// The old Promise.race approach had a fatal flaw: when the timeout fired,
// the underlying pg query kept running and the connection was never released
// back to the pool. Over time ALL connections leaked this way and the pool
// became completely dead (total:10, idle:0, waiting:0).
//
// This version checks out a client explicitly so we can call
// client.release(true) on timeout — which destroys the connection and lets
// the pool create a fresh one.
const _poolQuery = pool.query.bind(pool);
const _connect = pool.connect.bind(pool);

pool.query = async function queryWithTimeout(text, params) {
  let client;
  try {
    client = await _connect();
  } catch (err) {
    throw new Error('DB pool exhausted: ' + err.message);
  }

  let timer;
  let timedOut = false;

  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      // DESTROY the stuck connection — don't return it to the pool
      try { client.release(true); } catch (_) {}
      reject(new Error(`Query timeout (${QUERY_TIMEOUT_MS / 1000}s) — connection destroyed`));
    }, QUERY_TIMEOUT_MS);

    client.query(text, params)
      .then((result) => {
        if (!timedOut) {
          clearTimeout(timer);
          client.release(); // return healthy connection to pool
          resolve(result);
        }
      })
      .catch((err) => {
        if (!timedOut) {
          clearTimeout(timer);
          client.release(true); // destroy errored connection
          reject(err);
        }
      });
  });
};

// Wrap pool.connect() so every checked-out client gets a silent error handler.
// Without this, a FATAL PostgreSQL error (code 57P01) on a client with no
// listener causes an unhandled 'error' event and crashes the process.
pool.connect = async function wrappedConnect() {
  const client = await _connect();
  client.on('error', (err) => {
    console.error('DB client error (connection terminated):', err.message);
  });
  return client;
};

module.exports = pool;
