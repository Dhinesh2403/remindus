// backend/src/controllers/reminder.controller.js
'use strict';

const Reminder      = require('../models/Reminder');
const Notification = require('../models/Notification');
const User          = require('../models/User');
const notifService  = require('../services/notification.service');
const { asyncHandler, AppError } = require('../utils/helpers');
const { getIO, emitToUser } = require('../sockets');

// ── GET /api/reminders ────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const { status, type, priority, date, page = 1, limit = 20 } = req.query;

  const filter = { userId: req.user._id };
  if (status)   filter.status   = status;
  if (type)     filter.type     = type;
  if (priority) filter.priority = priority;

  if (date === 'today') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    filter.date = { $gte: start, $lte: end };
  } else if (date === 'week') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(start); end.setDate(start.getDate() + 7);
    filter.date = { $gte: start, $lt: end };
  } else if (date === 'month') {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    filter.date = { $gte: start, $lte: end };
  } else if (date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    filter.date = { $gte: d, $lt: next };
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Reminder.countDocuments(filter);
  const data  = await Reminder.find(filter)
    .sort({ date: 1, time: 1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('assignedTo', 'name avatar')
    .lean();

  res.json({
    success: true,
    data,
    total,
    page:  Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

// ── GET /api/reminders/stats/summary ─────────────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
  const uid   = req.user._id;
  const now   = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);

  const [today, upcoming, missed] = await Promise.all([
    Reminder.countDocuments({ userId: uid, status: 'pending', date: { $gte: todayStart, $lte: todayEnd } }),
    Reminder.countDocuments({ userId: uid, status: 'pending', date: { $gt: todayEnd } }),
    Reminder.countDocuments({ userId: uid, status: 'missed' }),
  ]);

  res.json({ success: true, today, upcoming, missed });
});

// ── GET /api/reminders/:id ────────────────────────────────────────────────
exports.getById = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  // Allow both the creator (userId) and the recipient (assignedTo) to view
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    $or: [{ userId: uid }, { assignedTo: uid }],
  })
    .populate('userId',     'name avatar')
    .populate('assignedTo', 'name avatar email');
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json(reminder);
});

// ── POST /api/reminders ───────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { assignedTo, ...body } = req.body;

  const reminder = await Reminder.create({
    ...body,
    userId:       req.user._id,
    assignedTo:   assignedTo || null,
    assignedBy:   assignedTo ? req.user._id : null,
    sharedStatus: assignedTo ? 'sent' : null,
  });

  // If assigned to a friend, emit socket + push notification
  if (assignedTo) {
    // Real-time: add reminder to friend's "From Friends" list immediately
    emitToUser(String(assignedTo), 'reminder:received', {
      _id:          String(reminder._id),
      title:        reminder.title,
      description:  reminder.description,
      date:         reminder.date,
      time:         reminder.time,
      type:         reminder.type,
      priority:     reminder.priority,
      status:       reminder.status,
      sharedStatus: reminder.sharedStatus,
      userId: {
        _id:    String(req.user._id),
        name:   req.user.name,
        avatar: req.user.avatar,
      },
    });
    await notifService.createAndPush({
      userId:  assignedTo,
      type:    'reminder_assigned',
      title:   '📌 New reminder assigned',
      message: `${req.user.name} assigned "${reminder.title}" to you`,
      data:    { reminderId: reminder._id },
    });
  }

  res.status(201).json({ success: true, data: reminder });
});

// ── PUT /api/reminders/:id ────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, data: reminder });
});

// ── DELETE /api/reminders/:id ─────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, message: 'Reminder deleted' });
});

// ── PATCH /api/reminders/:id/done ────────────────────────────────────────
exports.markDone = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { status: 'done', completedAt: new Date() },
    { new: true }
  );
  if (!reminder) throw new AppError('Reminder not found', 404);

  // Update user streak
  await updateStreak(req.user._id);

  // Notify assigner if this was assigned
  if (reminder.assignedBy) {
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_response',
      title:   '✅ Reminder completed!',
      message: `${req.user.name} marked "${reminder.title}" as done`,
      data:    { reminderId: reminder._id },
    });
  }

  // Real-time update to the reminder owner
  getIO()?.to(`user:${req.user._id}`).emit('reminder:response', reminder);

  res.json({ success: true, data: reminder });
});

// ── PATCH /api/reminders/:id/snooze ──────────────────────────────────────
exports.snooze = asyncHandler(async (req, res) => {
  const { minutes = 30 } = req.body;
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    {
      status: 'snoozed',
      snoozeUntil,
      nextFireAt: snoozeUntil,
      $inc: { snoozeCount: 1 },
    },
    { new: true }
  );
  if (!reminder) throw new AppError('Reminder not found', 404);

  // If snooze count > 3, escalate notification to assigner
  if (reminder.assignedBy && reminder.snoozeCount > 3) {
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_response',
      title:   '⚠️ Reminder keeps being snoozed',
      message: `${req.user.name} has snoozed "${reminder.title}" ${reminder.snoozeCount} times`,
      data:    { reminderId: reminder._id },
    });
  }

  res.json({ success: true, data: reminder });
});

// ── PATCH /api/reminders/:id/assign ──────────────────────────────────────
exports.assign = asyncHandler(async (req, res) => {
  const { friendId } = req.body;

  const friend = await User.findById(friendId);
  if (!friend) throw new AppError('Friend not found', 404);

  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { assignedTo: friendId, assignedBy: req.user._id },
    { new: true }
  );
  if (!reminder) throw new AppError('Reminder not found', 404);

  await notifService.createAndPush({
    userId:  friendId,
    type:    'reminder_assigned',
    title:   '📌 Reminder assigned to you',
    message: `${req.user.name} assigned "${reminder.title}" to you`,
    data:    { reminderId: reminder._id },
  });

  res.json({ success: true, data: reminder });
});

// ── PATCH /api/reminders/:id/shared-status ───────────────────────────────
exports.updateSharedStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const uid = req.user._id;

  const reminder = await Reminder.findOne({ _id: req.params.id, assignedTo: uid });
  if (!reminder) throw new AppError('Reminder not found', 404);

  reminder.sharedStatus = status;
  if (status === 'completed') {
    reminder.completedAt = new Date();
    reminder.status = 'done';   // sync system status so detail page reflects completion
  }
  await reminder.save();

  if (reminder.assignedBy) {
    // Real-time socket update so the sender's "Sent to Friends" badge refreshes instantly
    emitToUser(String(reminder.assignedBy), 'reminder:sharedStatus', {
      _id:          String(reminder._id),
      sharedStatus: reminder.sharedStatus,
      status:       reminder.status,
    });

    const notifMap = {
      received:     { emoji: '📬', text: 'received your reminder' },
      acknowledged: { emoji: '👀', text: 'acknowledged your reminder' },
      processing:   { emoji: '🔄', text: 'started working on your reminder' },
      completed:    { emoji: '✅', text: 'completed your reminder' },
      skipped:      { emoji: '⏭️', text: 'skipped your reminder' },
    };
    const n = notifMap[status] || { emoji: '🔔', text: 'updated your reminder status' };
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_status_update',
      title:   `${n.emoji} ${req.user.name} ${n.text}`,
      message: `"${reminder.title}"`,
      data:    { reminderId: String(reminder._id), sharedStatus: status, type: 'reminder_status_update' },
    });
  }

  res.json({ success: true, data: reminder });
});

// ── PATCH /api/reminders/:id/snooze-assigned ─────────────────────────────
exports.snoozeAssigned = asyncHandler(async (req, res) => {
  const { minutes = 10 } = req.body;
  const uid = req.user._id;

  const reminder = await Reminder.findOne({ _id: req.params.id, assignedTo: uid });
  if (!reminder) throw new AppError('Reminder not found', 404);

  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
  reminder.status      = 'snoozed';
  reminder.snoozeUntil = snoozeUntil;
  reminder.nextFireAt  = snoozeUntil;
  reminder.preAlertSent = false; // allow pre-alert to fire again
  reminder.$inc        = undefined;
  reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
  await reminder.save();

  // Notify sender of snooze
  if (reminder.assignedBy) {
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_status_update',
      title:   `⏰ Reminder snoozed`,
      message: `${req.user.name} snoozed "${reminder.title}" by ${minutes} min`,
      data:    { reminderId: String(reminder._id), type: 'reminder_status_update' },
    });
  }

  res.json({ success: true, data: reminder });
});

// ── GET /api/reminders/received ──────────────────────────────────────────
// Returns all reminders assigned TO the current user by any friend
exports.getReceived = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const reminders = await Reminder.find({ assignedTo: uid })
    .populate('userId', 'name avatar')
    .sort({ date: 1, time: 1 })
    .limit(100)
    .lean();
  res.json({ success: true, data: reminders });
});

// ── GET /api/reminders/shared/:friendId ──────────────────────────────────
exports.getSharedWithFriend = asyncHandler(async (req, res) => {
  const uid      = req.user._id;
  const friendId = req.params.friendId;

  const reminders = await Reminder.find({
    $or: [
      { userId: uid, assignedTo: friendId },
      { assignedTo: uid, assignedBy: friendId },
    ],
  })
    .select('title date time sharedStatus assignedTo assignedBy userId status')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({ success: true, data: reminders });
});

// ── Helpers ───────────────────────────────────────────────────────────────
async function updateStreak(userId) {
  const user = await User.findById(userId);
  const now  = new Date();
  const last = user.lastActiveAt;

  if (last) {
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      user.streak++;
      if (user.streak > user.bestStreak) user.bestStreak = user.streak;
    } else if (diffDays > 1) {
      user.streak = 1;
    }
  } else {
    user.streak = 1;
  }

  user.completedCount++;
  user.lastActiveAt = now;
  await user.save();
}
