const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'Realm of Dominion <noreply@realmofdominion.com>';
const BASE_URL = process.env.CLIENT_URL || 'https://realmofdominion.com';

async function sendPasswordResetEmail(toEmail, rawToken) {
  const link = `${BASE_URL}/reset-password?token=${rawToken}`;
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Reset Your Realm of Dominion Password',
    text: `You requested a password reset.\n\nClick the link below to reset your password (expires in 30 minutes):\n\n${link}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:Georgia,serif;background:#060e1c;color:#c8d8e8;padding:32px;max-width:480px;margin:auto;border:1px solid #1e3050;border-radius:8px;">
        <h2 style="color:#c8a048;font-size:1.4rem;margin-bottom:8px;">Realm of Dominion</h2>
        <p>You requested a password reset. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:10px 24px;background:#c8a048;color:#060e1c;font-weight:bold;text-decoration:none;border-radius:4px;">Reset Password</a>
        <p style="color:#8090a8;font-size:0.85rem;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
      </div>
    `,
  });
}

async function sendEmailVerificationEmail(toEmail, rawToken) {
  const link = `${BASE_URL}/api/user/verify-email?token=${rawToken}`;
  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Verify Your New Email — Realm of Dominion',
    text: `Click the link below to verify your new email address (expires in 24 hours):\n\n${link}`,
    html: `
      <div style="font-family:Georgia,serif;background:#060e1c;color:#c8d8e8;padding:32px;max-width:480px;margin:auto;border:1px solid #1e3050;border-radius:8px;">
        <h2 style="color:#c8a048;font-size:1.4rem;margin-bottom:8px;">Realm of Dominion</h2>
        <p>Click the button below to verify your new email address. This link expires in <strong>24 hours</strong>.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:10px 24px;background:#c8a048;color:#060e1c;font-weight:bold;text-decoration:none;border-radius:4px;">Verify Email</a>
        <p style="color:#8090a8;font-size:0.85rem;">If you didn't request this change, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendEmailVerificationEmail };
