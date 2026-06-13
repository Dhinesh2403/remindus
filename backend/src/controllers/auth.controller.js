// backend/src/controllers/auth.controller.js
'use strict';

const jwt           = require('jsonwebtoken');
const { totp }      = require('otplib');
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

// ── POST /api/auth/register ────────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.findOne({ email })) {
    throw new AppError('Email already in use', 409);
  }

  const user = await User.create({ name, email, password });

  // Send welcome email (fire and forget)
  emailService.sendWelcome(user).catch((e) => logger.warn('Welcome email failed:', e.message));

  const tokens = issueTokens(user._id);
  user.refreshTokens = [tokens.refreshToken];
  await user.save();

  logger.info(`New user registered: ${email}`);
  res.status(201).json({ success: true, user, tokens });
});

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

  totp.options = { step: 300, digits: 6 }; // 5-minute OTP
  const secret = `${user._id}${process.env.JWT_ACCESS_SECRET}`;
  const otp    = totp.generate(secret);

  user.otp      = otp;
  user.otpExpiry= new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  await emailService.sendOtp(user, otp);
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

// ── GET /api/auth/me ───────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json(user);
});
