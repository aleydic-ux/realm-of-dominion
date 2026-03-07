const pool = require('../config/db');
const jwt = require('jsonwebtoken');

function initSocket(io) {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(
        `SELECT p.id as province_id, p.name as province_name, p.race
         FROM provinces p
         JOIN ages a ON a.id = p.age_id AND a.is_active = true
         WHERE p.user_id = $1`,
        [payload.userId]
      );
      if (!rows.length) return next(new Error('No active province'));
      socket.provinceId = rows[0].province_id;
      socket.provinceName = rows[0].province_name;
      socket.race = rows[0].race;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: province ${socket.provinceId}`);
    // Auto-join personal province room for timer push notifications
    socket.join(`province_${socket.provinceId}`);

    // Join alliance room
    socket.on('join_alliance', async (allianceId) => {
      // Verify membership
      const { rows } = await pool.query(
        `SELECT 1 FROM alliance_members WHERE alliance_id = $1 AND province_id = $2`,
        [allianceId, socket.provinceId]
      );
      if (rows.length) {
        socket.join(`alliance_${allianceId}`);
        socket.emit('joined_alliance', { alliance_id: allianceId });
      } else {
        socket.emit('error', { message: 'Not a member of this alliance' });
      }
    });

    socket.on('leave_alliance', (allianceId) => {
      socket.leave(`alliance_${allianceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: province ${socket.provinceId}`);
    });
  });
}

module.exports = initSocket;
