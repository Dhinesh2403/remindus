// backend/src/services/email.service.js
'use strict';

const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const logger     = require('../utils/logger');

// Sender address — verified on the remindus.online domain in Resend.
const FROM_ADDRESS = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'no-reply@remindus.online';
const FROM         = `Remindus 🔔 <${FROM_ADDRESS}>`;

// ── Transport ──────────────────────────────────────────────────────────────
// Prefer Resend (production, real delivery) when an API key is configured;
// otherwise fall back to SMTP/Mailtrap so local dev still works unchanged.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const transporter = resend ? null : nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'sandbox.smtp.mailtrap.io',
  port:   Number(process.env.SMTP_PORT) || 2525,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

if (resend) {
  logger.info(`Email transport: Resend (from ${FROM_ADDRESS})`);
} else {
  logger.warn('Email transport: SMTP fallback — set RESEND_API_KEY for real delivery.');
}

/**
 * Send one email through whichever transport is active.
 * @param {{ to: string, subject: string, html: string }} msg
 */
async function deliver({ to, subject, html }) {
  if (resend) {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message || 'Resend delivery failed');
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

exports.deliver = deliver;

// ── Welcome email ─────────────────────────────────────────────────────────
exports.sendWelcome = async (user) => {
  await deliver({
    to:      user.email,
    subject: '🎉 Welcome to Remindus!',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <div style="background:#7C3AED;padding:28px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:24px">🔔 Remindus</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB">
          <h2 style="color:#1F2937">Welcome, ${user.name}! 👋</h2>
          <p style="color:#4B5563">You're all set to start managing your reminders and holding each other accountable.</p>
          <div style="background:#F8F7FF;border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0;color:#6B7280;font-size:14px">✅ Create unlimited reminders<br>👥 Add accountability buddies<br>📅 Never miss an important date</p>
          </div>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:8100'}/app/home"
             style="display:block;background:#7C3AED;color:white;text-decoration:none;padding:14px;text-align:center;border-radius:12px;font-weight:700;margin-top:20px">
            Open Remindus →
          </a>
        </div>
      </div>`,
  });
  logger.info(`Welcome email sent to ${user.email}`);
};

// ── OTP email ─────────────────────────────────────────────────────────────
exports.sendOtp = async (user, otp) => {
  await deliver({
    to:      user.email,
    subject: 'Your Remindus verification code',
    html: `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F5F3FF;padding:40px 16px">
        <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(76,29,149,0.18)">
          <div style="background:linear-gradient(135deg,#7C3AED 0%,#4C1D95 100%);padding:36px 32px;text-align:center">
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#C4B5FD;font-weight:600;margin-bottom:10px">Remindus</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700">Verify your email</h1>
          </div>
          <div style="padding:36px 32px">
            <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center">
              Use the verification code below to confirm your email address and continue setting up your account.
            </p>
            <div style="background:#F5F3FF;border:1px solid #E9D5FF;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px">
              <span style="font-size:40px;font-weight:800;color:#6D28D9;letter-spacing:12px;padding-left:12px;font-family:'Courier New',monospace">${otp}</span>
            </div>
            <div style="text-align:center;margin:0 0 24px">
              <span style="display:inline-block;background:#EDE9FE;color:#6D28D9;font-size:12px;font-weight:600;padding:6px 14px;border-radius:999px">⏱ Expires in 5 minutes</span>
            </div>

            <div style="background:#FAF9FF;border:1px solid #F0EBFF;border-radius:16px;padding:20px 22px;margin:0 0 8px">
              <p style="color:#6D28D9;font-size:13px;font-weight:700;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px">What's waiting for you ✨</p>
              <p style="color:#4B5563;font-size:14px;line-height:1.5;margin:0 0 10px">🔔 <b>Never miss a thing</b> — smart reminders that reach you on every device, right on time.</p>
              <p style="color:#4B5563;font-size:14px;line-height:1.5;margin:0">👥 <b>Stay accountable</b> — add buddies who keep you on track and cheer you on.</p>
            </div>

            <p style="color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;margin:16px 0 0">
              Didn't request this? You can safely ignore this email.<br>Never share this code with anyone.
            </p>
          </div>
          <div style="background:#FAFAFA;border-top:1px solid #F0F0F0;padding:20px 32px;text-align:center">
            <p style="color:#9CA3AF;font-size:11px;margin:0 0 4px">This is an automated message — please do not reply.</p>
            <p style="color:#9CA3AF;font-size:11px;margin:0">© Remindus · Stay on top of what matters</p>
          </div>
        </div>
      </div>`,
  });
};

// ── Password reset email ──────────────────────────────────────────────────
exports.sendPasswordReset = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8100'}/auth/reset-password?token=${token}`;
  await deliver({
    to:      user.email,
    subject: '🔑 Reset your Remindus password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <div style="background:#7C3AED;padding:24px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:20px">🔑 Password Reset</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB">
          <p style="color:#4B5563">Hi ${user.name},</p>
          <p style="color:#4B5563">We received a request to reset your password. Click the button below — this link expires in 1 hour.</p>
          <a href="${resetUrl}"
             style="display:block;background:#7C3AED;color:white;text-decoration:none;padding:14px;text-align:center;border-radius:12px;font-weight:700;margin:20px 0">
            Reset Password →
          </a>
          <p style="color:#9CA3AF;font-size:12px">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>`,
  });
};

// ── Reminder notification email ───────────────────────────────────────────
exports.sendReminderEmail = async (user, reminder) => {
  await deliver({
    to:      user.email,
    subject: `⏰ Reminder: ${reminder.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <div style="background:#7C3AED;padding:24px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:white;margin:0;font-size:20px">⏰ Reminder Due</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB">
          <h2 style="color:#7C3AED;margin:0 0 8px">${reminder.title}</h2>
          ${reminder.description ? `<p style="color:#6B7280">${reminder.description}</p>` : ''}
          <p style="color:#9CA3AF;font-size:13px">📅 ${reminder.time}</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:8100'}/app/reminders/${reminder._id}"
             style="display:block;background:#7C3AED;color:white;text-decoration:none;padding:14px;text-align:center;border-radius:12px;font-weight:700;margin-top:20px">
            Open Reminder →
          </a>
        </div>
      </div>`,
  });
};
