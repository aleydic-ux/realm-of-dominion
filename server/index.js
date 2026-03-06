require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// Middleware
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

// Resource production cron tick — runs every 10 minutes
const { lazyResourceUpdate } = require('./services/resourceEngine');
cron.schedule('*/10 * * * *', async () => {
  try {
    const { rows } = await pool.query('SELECT id FROM provinces');
    for (const { id } of rows) {
      await lazyResourceUpdate(id).catch(() => {});
    }
    console.log(`[cron] Resource tick complete for ${rows.length} provinces`);
  } catch (err) {
    console.error('[cron] Resource tick failed:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Realm of Dominion server running on port ${PORT}`);
  await clearStuckTimers();
});

module.exports = { app, server };
