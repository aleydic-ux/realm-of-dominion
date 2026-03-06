const { Pool, types } = require('pg');
require('dotenv').config();

// Parse TIMESTAMP WITHOUT TIME ZONE as UTC (OID 1114)
// By default node-postgres interprets it in local system timezone, causing comparison bugs
types.setTypeParser(1114, (val) => new Date(val + 'Z'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Force every connection to use UTC so TIMESTAMP comparisons are consistent
pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'");
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
