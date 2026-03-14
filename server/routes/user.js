const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const { sendEmailVerificationEmail } = require('../services/email');

const router = express.Router();

// PATCH /api/user/profile — change display name
router.patch('/profile', authenticate, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName || typeof displayName !== 'string') {
    return res.status(422).json({ error: 'Display name is required.' });
  }
  const trimmed = displayName.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return res.status(422).json({ error: 'Display name must be 3-20 characters.' });
  }
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
    return res.status(422).json({ error: 'Display name may only contain letters, numbers, and spaces.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT display_name_changed_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found.' });

    const lastChanged = rows[0].display_name_changed_at;
    if (lastChanged) {
      const daysSince = (Date.now() - new Date(lastChanged).getTime()) / 86400000;
      if (daysSince < 30) {
        return res.status(400).json({ error: 'You can only change your display name once every 30 days.' });
      }
    }

    await pool.query(
      'UPDATE users SET display_name = $1, display_name_changed_at = NOW(), updated_at = NOW() WHERE id = $2',
      [trimmed, req.user.id]
    );
    res.json({ message: 'Display name updated.' });
  } catch (err) {
    console.error('Change display name error:', err);
    res.status(500).json({ error: 'Failed to update display name.' });
  }
});

// POST /api/user/change-email
router.post('/change-email', authenticate, async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  try {
    // Check email not already in use
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [newEmail, req.user.id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'That email is already in use.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Remove any existing pending change for this user
    await pool.query('DELETE FROM pending_email_changes WHERE user_id = $1', [req.user.id]);
    await pool.query(
      'INSERT INTO pending_email_changes (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [req.user.id, newEmail, tokenHash, expiresAt]
    );

    sendEmailVerificationEmail(newEmail, rawToken).catch(err =>
      console.error('[change-email] Email send failed:', err.message)
    );

    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    console.error('Change email error:', err);
    res.status(500).json({ error: 'Failed to initiate email change.' });
  }
});

// GET /api/user/verify-email?token=TOKEN
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL || 'https://realmofdominion.com';

  if (!token) return res.redirect(`${CLIENT_URL}/settings?email_error=1`);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const { rows } = await pool.query(
      'SELECT id, user_id, new_email FROM pending_email_changes WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    if (!rows.length) {
      return res.redirect(`${CLIENT_URL}/settings?email_error=1`);
    }
    const { id: pendingId, user_id, new_email } = rows[0];

    await pool.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [new_email, user_id]);
    await pool.query('DELETE FROM pending_email_changes WHERE id = $1', [pendingId]);

    res.redirect(`${CLIENT_URL}/settings?email_verified=1`);
  } catch (err) {
    console.error('Verify email error:', err);
    res.redirect(`${CLIENT_URL}/settings?email_error=1`);
  }
});

// POST /api/user/change-password
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(401).json({ error: 'User not found.' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// POST /api/user/delete-account
router.post('/delete-account', authenticate, async (req, res) => {
  const { confirmation } = req.body;
  if (confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Invalid confirmation.' });
  }

  try {
    await pool.query('UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [req.user.id]);
    res.json({ message: 'Account scheduled for deletion.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// GET /api/user/me — fetch current user settings data
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT username, email, display_name, display_name_changed_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('User me error:', err);
    res.status(500).json({ error: 'Failed to load user data.' });
  }
});

module.exports = router;
