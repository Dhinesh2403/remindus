// backend/src/controllers/user.controller.js
'use strict';

const User     = require('../models/User');
const Reminder = require('../models/Reminder');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/users/me ─────────────────────────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
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
exports.updateNotifPrefs = asyncHandler(async (req, res) => {
  const { push, email, sms, whatsapp } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { notifPrefs: { push, email, sms, whatsapp } },
    { new: true }
  );
  res.json({ success: true, notifPrefs: user.notifPrefs });
});

// ── GET /api/users/me/insights ────────────────────────────────────────────
exports.getInsights = asyncHandler(async (req, res) => {
  const uid   = req.user._id;
  const user  = await User.findById(uid);

  // Weekly data — last 7 days completed reminders per day
  const weeklyData = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const d     = new Date();
      d.setDate(d.getDate() - (6 - i));
      const start = new Date(d); start.setHours(0,0,0,0);
      const end   = new Date(d); end.setHours(23,59,59,999);
      const count = await Reminder.countDocuments({
        userId: uid, status: 'done',
        completedAt: { $gte: start, $lte: end },
      });
      return {
        label: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d.getDay() === 0 ? 6 : d.getDay() - 1],
        value: count,
      };
    })
  );

  // Category breakdown
  const catAgg = await Reminder.aggregate([
    { $match: { userId: uid, status: 'done' } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const totalDone = catAgg.reduce((s, c) => s + c.count, 0);
  const CAT_META = {
    birthday: { label:'Birthday', emoji:'🎂', color:'#EC4899' },
    wedding:  { label:'Wedding',  emoji:'💍', color:'#8B5CF6' },
    medicine: { label:'Medicine', emoji:'💊', color:'#EF4444' },
    bill:     { label:'Bill',     emoji:'💰', color:'#3B82F6' },
    study:    { label:'Study',    emoji:'📚', color:'#10B981' },
    work:     { label:'Work',     emoji:'💼', color:'#F59E0B' },
    general:  { label:'General',  emoji:'📌', color:'#6B7280' },
    custom:   { label:'Custom',   emoji:'✨', color:'#7C3AED' },
  };
  const categoryBreakdown = catAgg.map(c => ({
    type:       c._id,
    ...(CAT_META[c._id] ?? CAT_META.general),
    count:      c.count,
    percentage: totalDone > 0 ? Math.round((c.count / totalDone) * 100) : 0,
  }));

  // Accountability rate (% of assigned reminders responded to)
  const [assignedTotal, assignedDone] = await Promise.all([
    Reminder.countDocuments({ assignedTo: uid }),
    Reminder.countDocuments({ assignedTo: uid, status: 'done' }),
  ]);
  const accountabilityRate = assignedTotal > 0
    ? Math.round((assignedDone / assignedTotal) * 100)
    : 100;

  res.json({
    success: true,
    streak:             user.streak,
    bestStreak:         user.bestStreak,
    completedTotal:     user.completedCount,
    accountabilityRate,
    weeklyData,
    categoryBreakdown,
  });
});

// ── GET /api/users/me/insights/achievements ───────────────────────────────
exports.getAchievements = asyncHandler(async (req, res) => {
  const uid  = req.user._id;
  const user = await User.findById(uid);

  const achievements = [
    {
      id:       '7-day-streak',
      name:     '7-Day Streak',
      emoji:    '🔥',
      earned:   user.bestStreak >= 7,
      earnedAt: user.bestStreak >= 7 ? user.updatedAt : null,
      progress: Math.min(Math.round((user.streak / 7) * 100), 100),
    },
    {
      id:       'early-bird',
      name:     'Early Bird',
      emoji:    '🌅',
      earned:   user.completedCount >= 5,
      earnedAt: user.completedCount >= 5 ? user.updatedAt : null,
      progress: Math.min(Math.round((user.completedCount / 5) * 100), 100),
    },
    {
      id:       'team-player',
      name:     'Team Player',
      emoji:    '🤝',
      earned:   false,  // needs friend reminders count ≥ 3
      progress: 0,
    },
    {
      id:       'century-club',
      name:     'Century Club',
      emoji:    '💯',
      earned:   user.completedCount >= 100,
      earnedAt: user.completedCount >= 100 ? user.updatedAt : null,
      progress: Math.min(Math.round((user.completedCount / 100) * 100), 100),
    },
    {
      id:       'perfect-week',
      name:     'Perfect Week',
      emoji:    '⭐',
      earned:   false,
      progress: Math.min(Math.round((user.streak / 7) * 100), 100),
    },
  ];

  res.json({ success: true, data: achievements });
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


// ── PATCH /api/users/me/fcm-token ────────────────────────────────────────
exports.updateFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  await User.findByIdAndUpdate(req.user._id, { fcmToken: token || null });
  res.json({ success: true, message: 'FCM token updated' });
});
