const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signToken(user) {
  return jwt.sign(
    { userId: user.id, token_version: user.token_version || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Returns true if the user may still use a token carrying this payload.
// Tokens issued before token_version existed have no claim and count as version 0.
async function isSessionValid(payload) {
  const { rows } = await pool.query(
    'SELECT is_active, deleted_at, token_version FROM users WHERE id = $1',
    [payload.userId]
  );
  const user = rows[0];
  return !!user
    && user.is_active === true
    && user.deleted_at === null
    && user.token_version === (payload.token_version ?? 0);
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (!(await isSessionValid(payload))) {
      return res.status(401).json({ error: 'Session expired' });
    }
  } catch (err) {
    // DB failure is not an auth failure — don't 401 (the client logs out on 401)
    console.error('Auth lookup error:', err.message);
    return res.status(503).json({ error: 'Service unavailable, please retry' });
  }

  req.user = { id: payload.userId };
  next();
}

module.exports = authenticate;
module.exports.signToken = signToken;
module.exports.isSessionValid = isSessionValid;
