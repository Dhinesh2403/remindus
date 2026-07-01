// backend/src/controllers/admin.controller.js
'use strict';

const User         = require('../models/User');
const Reminder     = require('../models/Reminder');
const Notification = require('../models/Notification');
const DeviceLog    = require('../models/DeviceLog');
const AppConfig    = require('../models/AppConfig');
const { asyncHandler } = require('../utils/helpers');

// ── GET /api/admin/stats ──────────────────────────────────────────────────
exports.getDashboardStats = asyncHandler(async (_req, res) => {
  const [totalUsers, premiumUsers, totalReminders, doneReminders, missedReminders] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      Reminder.countDocuments(),
      Reminder.countDocuments({ status: 'done' }),
      Reminder.countDocuments({ status: 'missed' }),
    ]);

  const completionRate = totalReminders > 0
    ? Math.round((doneReminders / totalReminders) * 100)
    : 0;

  res.json({
    success: true,
    data: {
      totalUsers,
      premiumUsers,
      freeUsers: totalUsers - premiumUsers,
      totalReminders,
      doneReminders,
      missedReminders,
      completionRate,
    },
  });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────
exports.getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, isPremium } = req.query;
  const filter = {};
  if (search)              filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
  if (isPremium !== undefined) filter.isPremium = isPremium === 'true';

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('-refreshTokens -password -otp -otpExpiry')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.json({ success: true, data: users, total, page: Number(page) });
});

// ── PATCH /api/admin/users/:id/premium ────────────────────────────────────
exports.togglePremium = asyncHandler(async (req, res) => {
  const { isPremium, expiryDays = 30 } = req.body;
  const expiry = isPremium
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    : null;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isPremium, premiumExpiry: expiry },
    { new: true }
  );
  res.json({ success: true, data: user });
});

// ── GET /api/admin/reminders ──────────────────────────────────────────────
exports.getAllReminders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type)   filter.type   = type;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Reminder.countDocuments(filter);
  const data  = await Reminder.find(filter)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.json({ success: true, data, total, page: Number(page) });
});

// ── POST /api/admin/device-logs ───────────────────────────────────────────
// Named endpoint + body filters (per CLAUDE.md). Body: { page, limit, level, userId, platform }
exports.getDeviceLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, level, userId, platform } = req.body || {};
  const filter = {};
  if (level)    filter.level    = level;
  if (userId)   filter.userId   = userId;
  if (platform) filter.platform = platform;

  const perPage = Math.min(Number(limit) || 50, 200);
  const skip    = (Number(page) - 1) * perPage;
  const total   = await DeviceLog.countDocuments(filter);
  const data    = await DeviceLog.find(filter)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage);

  res.json({ success: true, data, total, page: Number(page) });
});

// ── GET /api/admin/app-config ─────────────────────────────────────────────
exports.getAppConfig = asyncHandler(async (_req, res) => {
  const cfg = await AppConfig.getSingleton();
  res.json({ success: true, data: cfg });
});

// ── PUT /api/admin/app-config ─────────────────────────────────────────────
// Body: any subset of the editable AppConfig fields.
exports.updateAppConfig = asyncHandler(async (req, res) => {
  const editable = [
    'androidLatestVersion', 'androidLatestBuild', 'androidMinBuild', 'androidUpdateUrl',
    'iosLatestVersion', 'iosLatestBuild', 'iosMinBuild', 'iosUpdateUrl',
    'maintenanceMode', 'maintenanceMessage', 'forceUpdateMessage', 'normalUpdateMessage',
  ];
  const update = {};
  for (const key of editable) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }

  const cfg = await AppConfig.findOneAndUpdate(
    { key: 'singleton' },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: cfg });
});
