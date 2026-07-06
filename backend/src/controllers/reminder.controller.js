// backend/src/controllers/reminder.controller.js
'use strict';

const Reminder      = require('../models/Reminder');
const Notification = require('../models/Notification');
const User          = require('../models/User');
const notifService  = require('../services/notification.service');
const { asyncHandler, AppError } = require('../utils/helpers');
const { dueWhen } = require('../utils/reminder-text');
const { verifyActionToken } = require('../utils/notif-action');
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
    .populate('userId',     'name avatar gender')
    .populate('assignedTo', 'name avatar gender email');
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
      title:   reminder.title,
      message: `${req.user.name} assigned you "${reminder.title}" · due ${dueWhen(reminder)}`,
      data:    { reminderId: reminder._id },
      category:   'Task',
      subtext:    `From ${req.user.name} · due ${dueWhen(reminder)}`,
      // Assignee-side "Acknowledge" tray button (ack_assigned → sharedStatus=acknowledged).
      actions:    [{ id: 'ack_assigned', label: 'Acknowledge' }],
      senderName: req.user.name,
      avatar:     req.user.avatar,
    });
  }

  res.status(201).json({ success: true, data: reminder });
});

// ── PUT /api/reminders/:id ────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const current = await Reminder.findOne({ _id: req.params.id, userId: req.user._id });
  if (!current) throw new AppError('Reminder not found', 404);

  const $set = { ...req.body };

  // findOneAndUpdate bypasses the pre('save') hook, so an edited date/time/window
  // would otherwise keep a stale nextFireAt (wrong countdown + clock in the push).
  // Recompute it here unless the client sent a timezone-aware nextFireAt itself.
  const touchesFire = ['date', 'time', 'reminderWindowMinutes'].some((k) => req.body[k] !== undefined);
  if (touchesFire && req.body.nextFireAt === undefined) {
    $set.nextFireAt = Reminder.computeNextFireAt(
      req.body.date ?? current.date,
      req.body.time ?? current.time,
      req.body.reminderWindowMinutes ?? current.reminderWindowMinutes,
    );
  }

  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set },
    { new: true, runValidators: true }
  );
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
  const reminder = await doMarkDone(req.params.id, req.user._id, req.user.name);
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, data: reminder });
});

/**
 * Core "mark reminder done" used by both the REST route and the notification
 * tray-action endpoint. Returns the updated reminder, or null if not found /
 * not owned by `userId`. `actorName` is only needed for the assigner notice.
 */
async function doMarkDone(reminderId, userId, actorName = null) {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId, userId },
    { status: 'done', completedAt: new Date() },
    { new: true }
  );
  if (!reminder) return null;

  await updateStreak(userId);

  if (reminder.assignedBy) {
    const name = actorName || (await User.findById(userId).select('name').lean())?.name || 'A friend';
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_response',
      title:   reminder.title,
      message: `${name} marked "${reminder.title}" as done`,
      data:    { reminderId: reminder._id },
      category: 'Reminder',
      subtext:  `${name} marked it done`,
    });
  }

  getIO()?.to(`user:${userId}`).emit('reminder:response', reminder);
  return reminder;
}

// ── PATCH /api/reminders/:id/snooze ──────────────────────────────────────
exports.snooze = asyncHandler(async (req, res) => {
  const { minutes = 30 } = req.body;
  const reminder = await doSnooze(req.params.id, req.user._id, minutes, req.user.name);
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, data: reminder });
});

/**
 * Core "snooze reminder" shared by the REST route and the tray-action endpoint.
 * Returns the updated reminder, or null if not found / not owned by `userId`.
 */
async function doSnooze(reminderId, userId, minutes, actorName = null) {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId, userId },
    {
      status: 'snoozed',
      snoozeUntil,
      nextFireAt: snoozeUntil,
      // nextFireAt is now the exact re-fire instant, so the window must be 0 or
      // duePhrase would add it back and report "due in <window> min" wrongly.
      reminderWindowMinutes: 0,
      $inc: { snoozeCount: 1 },
    },
    { new: true }
  );
  if (!reminder) return null;

  // If snooze count > 3, escalate notification to assigner
  if (reminder.assignedBy && reminder.snoozeCount > 3) {
    const name = actorName || (await User.findById(userId).select('name').lean())?.name || 'A friend';
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_response',
      title:   reminder.title,
      message: `${name} has snoozed "${reminder.title}" ${reminder.snoozeCount} times`,
      data:    { reminderId: reminder._id },
      category: 'Reminder',
      subtext:  `Snoozed ${reminder.snoozeCount} times`,
    });
  }

  return reminder;
}

// ── POST /api/reminders/notif-action (public — token-authorised) ─────────
// Called by the Android notification-tray buttons. The signed token names the
// reminder, the user it was issued to, and the exact action, so no login
// session is needed. See utils/notif-action.js.
exports.notifAction = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new AppError('Missing action token', 400);

  let payload;
  try {
    payload = verifyActionToken(token);
  } catch {
    throw new AppError('Invalid or expired action token', 401);
  }

  const { reminderId, uid, act } = payload;
  let reminder;
  switch (act) {
    // Owner acting on their OWN reminder_due notification (userId-scoped).
    case 'ack':              reminder = await doMarkDone(reminderId, uid);              break;
    case 'snooze5':          reminder = await doSnooze(reminderId, uid, 5);             break;
    // Assignee acting on a task a friend gave them (assignedTo-scoped). "Acknowledge"
    // sets sharedStatus, it does NOT mark the owner's reminder done.
    case 'ack_assigned':     reminder = await doSharedStatus(reminderId, uid, 'acknowledged'); break;
    case 'snooze5_assigned': reminder = await doSnoozeAssigned(reminderId, uid, 5);     break;
    default:                 throw new AppError('Unknown action', 400);
  }
  if (!reminder) throw new AppError('Reminder not found', 404);

  res.json({ success: true, act, status: reminder.status, sharedStatus: reminder.sharedStatus });
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
    title:   reminder.title,
    message: `${req.user.name} assigned you "${reminder.title}" · due ${dueWhen(reminder)}`,
    data:    { reminderId: reminder._id },
    category:   'Task',
    subtext:    `From ${req.user.name} · due ${dueWhen(reminder)}`,
    actions:    [{ id: 'ack_assigned', label: 'Acknowledge' }],
    senderName: req.user.name,
    avatar:     req.user.avatar,
  });

  res.json({ success: true, data: reminder });
});

// ── PATCH /api/reminders/:id/shared-status ───────────────────────────────
exports.updateSharedStatus = asyncHandler(async (req, res) => {
  const reminder = await doSharedStatus(req.params.id, req.user._id, req.body.status, req.user.name);
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, data: reminder });
});

/**
 * Core "assignee updates the shared status" shared by the REST route and the
 * notification tray-action endpoint. Scoped by `assignedTo: uid` (the recipient),
 * NOT the owner. Returns the updated reminder, or null if not found / not the
 * assignee. `actorName` is resolved lazily when the tray endpoint doesn't have it.
 */
async function doSharedStatus(reminderId, uid, status, actorName = null) {
  const reminder = await Reminder.findOne({ _id: reminderId, assignedTo: uid });
  if (!reminder) return null;

  reminder.sharedStatus = status;
  if (status === 'completed') {
    reminder.completedAt = new Date();
    reminder.status = 'done';   // sync system status so detail page reflects completion
  }
  await reminder.save();

  if (reminder.assignedBy) {
    const name = actorName || (await User.findById(uid).select('name').lean())?.name || 'A friend';
    // Real-time socket update so the sender's "Sent to Friends" badge refreshes instantly
    emitToUser(String(reminder.assignedBy), 'reminder:sharedStatus', {
      _id:          String(reminder._id),
      sharedStatus: reminder.sharedStatus,
      status:       reminder.status,
    });

    const statusText = {
      received:     'received your reminder',
      acknowledged: 'acknowledged your reminder',
      processing:   'started working on your reminder',
      completed:    'completed your reminder',
      skipped:      'skipped your reminder',
    };
    const text = statusText[status] || 'updated your reminder status';
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_status_update',
      title:   reminder.title,
      message: `${name} ${text}`,
      data:    { reminderId: String(reminder._id), sharedStatus: status, type: 'reminder_status_update' },
      category: 'Reminder',
      subtext:  `${name} ${text}`,
    });
  }

  return reminder;
}

// ── PATCH /api/reminders/:id/snooze-assigned ─────────────────────────────
exports.snoozeAssigned = asyncHandler(async (req, res) => {
  const reminder = await doSnoozeAssigned(req.params.id, req.user._id, req.body.minutes ?? 10, req.user.name);
  if (!reminder) throw new AppError('Reminder not found', 404);
  res.json({ success: true, data: reminder });
});

/**
 * Core "assignee snoozes the task" shared by the REST route and the tray-action
 * endpoint. Scoped by `assignedTo: uid`. Reschedules to the exact re-fire instant
 * (window 0 so duePhrase doesn't add it back), and clears preAlertSent so the
 * cron fires the pre-alert + due push again. Returns the reminder, or null.
 */
async function doSnoozeAssigned(reminderId, uid, minutes, actorName = null) {
  const reminder = await Reminder.findOne({ _id: reminderId, assignedTo: uid });
  if (!reminder) return null;

  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
  reminder.status      = 'snoozed';
  reminder.snoozeUntil = snoozeUntil;
  reminder.nextFireAt  = snoozeUntil;
  reminder.reminderWindowMinutes = 0; // nextFireAt is the exact re-fire instant
  reminder.preAlertSent = false;       // allow pre-alert to fire again
  reminder.snoozeCount = (reminder.snoozeCount || 0) + 1;
  await reminder.save();

  // Notify sender of snooze
  if (reminder.assignedBy) {
    const name = actorName || (await User.findById(uid).select('name').lean())?.name || 'A friend';
    await notifService.createAndPush({
      userId:  reminder.assignedBy,
      type:    'reminder_status_update',
      title:   reminder.title,
      message: `${name} snoozed "${reminder.title}" by ${minutes} min`,
      data:    { reminderId: String(reminder._id), type: 'reminder_status_update' },
      category: 'Reminder',
      subtext:  `${name} snoozed it ${minutes} min`,
    });
  }

  return reminder;
}

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
