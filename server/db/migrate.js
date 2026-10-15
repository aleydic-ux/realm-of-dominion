// CLI: node server/db/migrate.js (npm run db:migrate, and npm start before the server)
const pool = require('../config/db');
const { runMigrations } = require('./runMigrations');

runMigrations(pool)
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
