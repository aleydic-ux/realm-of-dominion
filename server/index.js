require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const provinceRoutes = require('./routes/province');
const attackRoutes = require('./routes/attack');
const marketplaceRoutes = require('./routes/marketplace');
const allianceRoutes = require('./routes/alliance');
const diplomacyRoutes = require('./routes/diplomacy');
const leaderboardRoutes = require('./routes/leaderboard');
const techTreeRoutes = require('./routes/techTree');
const feedRoutes = require('./routes/feed');
const spellRoutes = require('./routes/spells');
const craftingRoutes = require('./routes/crafting');
const { collectCompletedCrafts } = require('./routes/crafting');
const botAdminRoutes = require('./routes/bots');
const initSocket = require('./socket/chat');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
app.set('io', io);
initSocket(io);

// Trust Render's reverse proxy so express-rate-limit reads real client IPs
app.set('trust proxy', 1);

// Middleware
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/province', provinceRoutes);
app.use('/api/attack', attackRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/diplomacy', diplomacyRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/tech-tree', techTreeRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/spells', spellRoutes);
app.use('/api/crafting', craftingRoutes);
app.use('/api/bots', botAdminRoutes);

// Diagnostic endpoint (temporary) — shows DB state for debugging
app.get('/api/debug/state', async (req, res) => {
  try {
    const [ages, provinces, migrations] = await Promise.all([
      pool.query('SELECT id, name, is_active, ends_at FROM ages ORDER BY id'),
      pool.query('SELECT id, user_id, age_id, name, race FROM provinces ORDER BY id'),
      pool.query("SELECT filename FROM migrations WHERE filename LIKE '%age%' OR filename LIKE '%027%' ORDER BY filename"),
    ]);
    res.json({
      ages: ages.rows,
      provinces: provinces.rows,
      age_migrations: migrations.rows.map(r => r.filename),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated debug — simulates the exact apRegen query for the logged-in user
const authenticate = require('./middleware/auth');
app.get('/api/debug/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const provinceQuery = await pool.query(
      `SELECT p.* FROM provinces p
       JOIN ages a ON a.id = p.age_id
       WHERE p.user_id = $1 AND a.is_active = true`,
      [userId]
    );
    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'provinces' ORDER BY ordinal_position`
    );
    const buildings = provinceQuery.rows[0] ? await pool.query(
      'SELECT building_type, level FROM province_buildings WHERE province_id = $1',
      [provinceQuery.rows[0].id]
    ) : { rows: [] };
    res.json({
      jwt_user_id: userId,
      province: provinceQuery.rows[0] || null,
      province_columns: columns.rows.map(r => r.column_name),
      buildings: buildings.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check — Render pings this to know the server is ready
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

// Serve React frontend
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Clear ALL stuck timers on startup (handles timezone-corrupted data)
const pool = require('./config/db');
async function clearStuckTimers() {
  try {
    await pool.query(`UPDATE province_troops SET count_home = count_home + count_training, count_training = 0, training_completes_at = NULL, updated_at = NOW() WHERE count_training > 0`);
    await pool.query(`UPDATE province_buildings SET is_upgrading = false, upgrade_completes_at = NULL, updated_at = NOW() WHERE is_upgrading = true`);
    await pool.query(`UPDATE province_research SET status = 'complete', updated_at = NOW() WHERE status = 'in_progress'`);
    console.log('Cleared all stuck timers.');
  } catch (err) {
    console.error('Failed to clear stuck timers:', err.message);
  }
}

// Season rollover — check every hour if current age has expired
const { checkAndEndSeason } = require('./services/seasonEngine');
const { tickBots } = require('./services/botEngine');
cron.schedule('0 * * * *', async () => {
  try {
    await checkAndEndSeason(io);
  } catch (err) {
    console.error('[cron] Season check failed:', err.message);
  }
});

// Crafting cron — collect completed jobs + expire active_effects every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    // Expire timed effects
    await pool.query(`DELETE FROM active_effects WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);

    // Collect completed crafting jobs for all provinces
    const { rows } = await pool.query(
      `SELECT DISTINCT province_id FROM crafting_queue WHERE status = 'in_progress' AND completes_at <= NOW()`
    );
    await Promise.all(rows.map(({ province_id }) => collectCompletedCrafts(province_id).catch(() => {})));
  } catch (err) {
    console.error('[cron] Crafting tick failed:', err.message);
  }
});

// Bot tick — runs every 2 hours
cron.schedule('0 */2 * * *', async () => {
  try {
    await tickBots();
  } catch (err) {
    console.error('[cron] Bot tick failed:', err.message);
  }
});

// Resource production cron tick — runs every 10 minutes
const { lazyResourceUpdate } = require('./services/resourceEngine');
const CRON_BATCH_SIZE = 20;
cron.schedule('*/10 * * * *', async () => {
  try {
    const { rows } = await pool.query('SELECT id FROM provinces');
    for (let i = 0; i < rows.length; i += CRON_BATCH_SIZE) {
      const batch = rows.slice(i, i + CRON_BATCH_SIZE);
      await Promise.all(batch.map(({ id }) => lazyResourceUpdate(id).catch(() => {})));
    }
    console.log(`[cron] Resource tick complete for ${rows.length} provinces`);
  } catch (err) {
    console.error('[cron] Resource tick failed:', err.message);
  }
});

// Run pending migrations on startup (ensures they always run regardless of start command)
const fs = require('fs');
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      const { rows } = await client.query('SELECT id FROM migrations WHERE filename = $1', [file]);
      if (rows.length > 0) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] Applying ${file}...`);
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      console.log(`[migrate]   Done.`);
    }
    console.log('[migrate] All migrations up to date.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
  } finally {
    client.release();
  }
}

// Prevent silent crashes from unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const PORT = process.env.PORT || 5000;

// Start server only AFTER migrations + cleanup finish.
// This prevents Render from routing traffic to an unready server.
(async () => {
  try {
    await runMigrations();
    await clearStuckTimers();
  } catch (err) {
    console.error('Startup tasks failed — exiting:', err.message);
    process.exit(1);
  }
  server.listen(PORT, () => {
    console.log(`Realm of Dominion server running on port ${PORT}`);
  });
})();

module.exports = { app, server };
