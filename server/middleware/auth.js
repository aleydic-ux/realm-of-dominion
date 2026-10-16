const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// The session JWT lives in an httpOnly cookie, out of reach of page scripts (an XSS can't steal it)
const SESSION_COOKIE = 'rod_session';
const DEFAULT_SESSION_MS = 7 * 24 * 3600 * 1000;

function signToken(user) {
  return jwt.sign(
    { userId: user.id, token_version: user.token_version || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

// Sets the session cookie to expire with the token itself
function setSessionCookie(res, token) {
  const exp = jwt.decode(token)?.exp;
  const maxAge = exp ? exp * 1000 - Date.now() : DEFAULT_SESSION_MS;
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Reads one cookie from a raw Cookie header
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch (_) { return null; }
    }
  }
  return null;
}

// Session cookie first; a Bearer header still works for scripts and tools
function tokenFromRequest(req) {
  const cookieToken = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7) : null;
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
  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

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

// CSRF defense in depth (SameSite=Lax already blocks cross-site cookie POSTs): a state-changing
// request that names a foreign Origin is refused. Requests without an Origin (tools) pass.
function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = new Set([`${req.protocol}://${req.get('host')}`]);
  for (const o of (process.env.CLIENT_URL || 'http://localhost:3000').split(',')) allowed.add(o.trim());
  if (allowed.has(origin)) return next();
  return res.status(403).json({ error: 'Cross-origin request refused' });
}

module.exports = authenticate;
module.exports.signToken = signToken;
module.exports.isSessionValid = isSessionValid;
module.exports.setSessionCookie = setSessionCookie;
module.exports.clearSessionCookie = clearSessionCookie;
module.exports.readCookie = readCookie;
module.exports.tokenFromRequest = tokenFromRequest;
module.exports.requireSameOrigin = requireSameOrigin;
module.exports.SESSION_COOKIE = SESSION_COOKIE;
