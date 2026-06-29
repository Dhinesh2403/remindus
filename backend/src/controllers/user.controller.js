// backend/src/controllers/user.controller.js
'use strict';

const User     = require('../models/User');
const Reminder = require('../models/Reminder');
const Friendship = require('../models/Friendship');
const { cloudinary, cloudinaryReady, cloudinaryFolder } = require('../config/cloudinary');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/users/me ─────────────────────────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  // Backfill a refId for legacy accounts created before this field existed.
  if (user && !user.refId) await user.save();
  res.json(user);
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'avatar'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json(user);
});

// ── PATCH /api/users/me/password ──────────────────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  const match = await user.comparePassword(currentPassword);
  if (!match) throw new AppError('Current password is incorrect', 401);

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

// ── PUT /api/users/me/notif-prefs ─────────────────────────────────────────
// Merges whatever is provided so a partial update never wipes other keys.
// Accepts either delivery channels (notifPrefs / legacy flat push,email,…) and
// per-category switches (notifTypes).
exports.updateNotifPrefs = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  // Delivery channels — support both nested `notifPrefs` and legacy flat body.
  const channels = req.body.notifPrefs ?? (() => {
    const { push, email, sms, whatsapp } = req.body;
    const flat = { push, email, sms, whatsapp };
    return Object.values(flat).some(v => v !== undefined) ? flat : null;
  })();
  if (channels) {
    for (const k of ['push', 'email', 'sms', 'whatsapp']) {
      if (channels[k] !== undefined) user.notifPrefs[k] = !!channels[k];
    }
  }

  // Per-category switches.
  if (req.body.notifTypes) {
    for (const k of ['reminders', 'chat', 'friendRequests', 'other']) {
      if (req.body.notifTypes[k] !== undefined) user.notifTypes[k] = !!req.body.notifTypes[k];
    }
  }

  await user.save();
  res.json({ success: true, notifPrefs: user.notifPrefs, notifTypes: user.notifTypes });
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────
exports.deleteAccount = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  await Promise.all([
    User.findByIdAndDelete(uid),
    Reminder.deleteMany({ userId: uid }),
    Friendship.deleteMany({
      $or: [{ requester: uid }, { recipient: uid }]
    }),
  ]);
  res.json({ success: true, message: 'Account deleted' });
});


// ── POST /api/users/me/avatar ─────────────────────────────────────────────
// Accepts a base64 data URI in `image`, uploads it to Cloudinary, and stores
// the resulting secure URL on the user. Returns the updated user.
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!cloudinaryReady) {
    throw new AppError('Image uploads are not configured on the server', 503);
  }

  const { image } = req.body;
  if (!image || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
    throw new AppError('A valid base64 image is required', 400);
  }

  const result = await cloudinary.uploader.upload(image, {
    folder:          `${cloudinaryFolder}/avatars`,
    public_id:       `user_${req.user._id}`,
    overwrite:       true,
    invalidate:      true,
    transformation:  [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: result.secure_url },
    { new: true }
  );

  res.json({ success: true, avatar: result.secure_url, user });
});

// ── PATCH /api/users/me/fcm-token ────────────────────────────────────────
exports.updateFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  await User.findByIdAndUpdate(req.user._id, { fcmToken: token || null });
  res.json({ success: true, message: 'FCM token updated' });
});
