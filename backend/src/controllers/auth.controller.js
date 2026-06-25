// backend/src/controllers/auth.controller.js
'use strict';

const jwt           = require('jsonwebtoken');
const { totp }      = require('otplib');
const { OAuth2Client } = require('google-auth-library');
const User          = require('../models/User');
const emailService  = require('../services/email.service');
const logger        = require('../utils/logger');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── Token factories ────────────────────────────────────────────────────────
function signAccess(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function signRefresh(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function issueTokens(userId) {
  return {
    accessToken:  signAccess(userId),
    refreshToken: signRefresh(userId),
  };
}

// Short-lived token that authorises the final "set password" step of signup,
// proving the holder just verified the email OTP.
function signSetupToken(userId) {
  return jwt.sign({ sub: userId, purpose: 'signup_setup' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

// Generate, persist and email a fresh 6-digit OTP (valid 5 minutes).
async function issueOtp(user) {
  totp.options = { step: 300, digits: 6 };
  const secret = `${user._id}${process.env.JWT_ACCESS_SECRET}`;
  const otp    = totp.generate(secret);

  user.otp       = otp;
  user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  await emailService.sendOtp(user, otp);
}

// ── Google OAuth client (lazy — only when GOOGLE_CLIENT_ID is configured) ────
let googleClient;
function getGoogleClient() {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  if (!googleClient) googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleClient;
}

// Save a freshly issued refresh token, keeping the last 5 (multi-device).
function rememberRefreshToken(user, refreshToken) {
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastActiveAt  = new Date();
}

// ── POST /api/auth/login ───────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !user.password) throw new AppError('Invalid credentials', 401);

  const match = await user.comparePassword(password);
  if (!match) throw new AppError('Invalid credentials', 401);

  const tokens = issueTokens(user._id);

  // Keep last 5 refresh tokens (multi-device support)
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), tokens.refreshToken];
  user.lastActiveAt  = new Date();
  await user.save();

  logger.info(`User logged in: ${email} [${process.env.NODE_ENV}]`);
  res.json({ success: true, user, tokens });
});

// ── POST /api/auth/refresh ─────────────────────────────────────────────────
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.refreshTokens?.includes(refreshToken)) {
    throw new AppError('Refresh token revoked', 401);
  }

  // Rotate refresh token
  const tokens = issueTokens(user._id);
  user.refreshTokens = [
    ...user.refreshTokens.filter((t) => t !== refreshToken).slice(-4),
    tokens.refreshToken,
  ];
  await user.save();

  res.json({ success: true, ...tokens });
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken && req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: refreshToken },
    });
  }
  res.json({ success: true, message: 'Logged out' });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond 200 to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  }

  const resetToken = jwt.sign({ sub: user._id }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  user.passwordResetToken  = resetToken;
  user.passwordResetExpiry = new Date(Date.now() + 3600 * 1000);
  await user.save();

  await emailService.sendPasswordReset(user, resetToken);
  res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const user = await User.findOne({
    _id: payload.sub,
    passwordResetToken: token,
    passwordResetExpiry: { $gt: new Date() },
  }).select('+refreshTokens');

  if (!user) throw new AppError('Invalid or expired reset token', 400);

  user.password            = password;
  user.passwordResetToken  = undefined;
  user.passwordResetExpiry = undefined;
  user.refreshTokens       = [];   // invalidate all sessions
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. Please log in.' });
});

// ── POST /api/auth/send-otp ───────────────────────────────────────────────
exports.sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new AppError('User not found', 404);

  await issueOtp(user);
  res.json({ success: true, message: 'OTP sent to your email' });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+otp +otpExpiry');
  if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
    throw new AppError('Invalid or expired OTP', 400);
  }

  user.isEmailVerified = true;
  user.otp             = undefined;
  user.otpExpiry       = undefined;
  await user.save();

  res.json({ success: true, verified: true });
});

// ── POST /api/auth/google ──────────────────────────────────────────────────
// Verifies a Google ID token, then logs in an existing user or creates a new
// passwordless account (Google users sign in via Google only).
exports.googleAuth = asyncHandler(async (req, res) => {
  const { idToken, accessToken } = req.body;

  const client = getGoogleClient();
  if (!client) throw new AppError('Google sign-in is not configured on the server', 503);

  // Resolve the Google profile from either credential type:
  //   • idToken     — native apps (Capacitor plugin).
  //   • accessToken — web, via Google Identity Services. The web flow returns
  //     an access token because the legacy ID-token iframe needs third-party
  //     cookies, which modern browsers block.
  let payload;
  if (idToken) {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Invalid Google token', 401);
    }
  } else if (accessToken) {
    // Validate the access token AND confirm it was minted for *our* client —
    // otherwise a token issued to another app could be replayed here.
    let info;
    try {
      info = await client.getTokenInfo(accessToken);
    } catch {
      throw new AppError('Invalid Google token', 401);
    }
    if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new AppError('Google token audience mismatch', 401);
    }
    // Name + avatar are cosmetic; fetch best-effort and tolerate failure.
    let profile = {};
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) profile = await r.json();
    } catch { /* fall back to email-derived name */ }
    payload = {
      email:   info.email || profile.email,
      name:    profile.name,
      picture: profile.picture,
    };
  } else {
    throw new AppError('Missing Google credential', 400);
  }

  const email = (payload.email || '').toLowerCase();
  if (!email) throw new AppError('Google account has no email', 400);

  let user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user) {
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      avatar: payload.picture || null,
      isEmailVerified: true,
    });
    emailService.sendWelcome(user).catch((e) => logger.warn('Welcome email failed:', e.message));
  } else if (!user.avatar && payload.picture) {
    user.avatar = payload.picture;
  }

  // First-time Google users have no password yet — the app routes them to a
  // one-time "set a password" screen so they can later sign in with email too.
  // Returning Google users already have one and skip straight into the app.
  const needsPassword = !user.password;

  const tokens = issueTokens(user._id);
  rememberRefreshToken(user, tokens.refreshToken);
  await user.save();

  logger.info(`Google sign-in: ${email}${needsPassword ? ' (new — needs password)' : ''}`);
  res.json({ success: true, user, tokens, needsPassword });
});

// ── POST /api/auth/set-password ────────────────────────────────────────────
// One-time password setup for accounts created via Google (which start
// passwordless). Authenticated — the active Google session authorises it.
// Afterwards the user can sign in with either Google or email + password.
exports.setPassword = asyncHandler(async (req, res) => {
  const { password, name } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found', 404);
  if (user.password) throw new AppError('Password is already set', 400);

  user.password = password;                         // hashed by the pre-save hook
  if (name && name.trim()) user.name = name.trim();
  await user.save();

  logger.info(`Password set for Google account: ${user.email}`);
  res.json({ success: true, user });
});

// ── POST /api/auth/signup/start ────────────────────────────────────────────
// Step 1 of email signup: capture name + email and email a verification OTP.
exports.signupStart = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  let user = await User.findOne({ email }).select('+password');
  if (user && user.password) {
    throw new AppError('Email already registered. Please log in.', 409);
  }

  if (!user) {
    user = await User.create({ name, email });   // pending account, no password yet
  } else {
    user.name = name;                            // passwordless/pending — refresh name
  }

  await issueOtp(user);
  logger.info(`Signup OTP sent: ${email}`);
  res.json({ success: true, message: 'Verification code sent to your email' });
});

// ── POST /api/auth/signup/resend ───────────────────────────────────────────
exports.signupResend = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || user.password) throw new AppError('No pending signup for this email', 400);

  await issueOtp(user);
  res.json({ success: true, message: 'A new code has been sent' });
});

// ── POST /api/auth/signup/verify ───────────────────────────────────────────
// Step 2: confirm the OTP and hand back a short-lived setup token.
exports.signupVerify = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select('+otp +otpExpiry');
  if (!user || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
    throw new AppError('Invalid or expired code', 400);
  }

  user.isEmailVerified = true;
  user.otp             = undefined;
  user.otpExpiry       = undefined;
  await user.save();

  res.json({ success: true, verified: true, setupToken: signSetupToken(user._id) });
});

// ── POST /api/auth/signup/set-password ─────────────────────────────────────
// Step 3: set the password using the setup token, then log the user in.
exports.signupSetPassword = asyncHandler(async (req, res) => {
  const { setupToken, password } = req.body;

  let payload;
  try {
    payload = jwt.verify(setupToken, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError('Setup session expired. Please verify your email again.', 400);
  }
  if (payload.purpose !== 'signup_setup') throw new AppError('Invalid setup token', 400);

  const user = await User.findById(payload.sub).select('+password +refreshTokens');
  if (!user) throw new AppError('Account not found', 404);
  if (!user.isEmailVerified) throw new AppError('Email not verified', 400);

  user.password = password;   // hashed by the model pre-save hook
  const tokens = issueTokens(user._id);
  rememberRefreshToken(user, tokens.refreshToken);
  await user.save();

  emailService.sendWelcome(user).catch((e) => logger.warn('Welcome email failed:', e.message));

  logger.info(`Signup completed: ${user.email}`);
  res.status(201).json({ success: true, user, tokens });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  // Backfill a refId for legacy accounts created before this field existed.
  if (user && !user.refId) await user.save();
  res.json(user);
});
