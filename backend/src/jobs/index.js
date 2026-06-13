// backend/src/jobs/index.js
'use strict';

const cron          = require('node-cron');
const Reminder      = require('../models/Reminder');
const User          = require('../models/User');
const notifService  = require('../services/notification.service');
const logger        = require('../utils/logger');

/**
 * Start all cron jobs.
 * Called once from app.js after DB is connected.
 */
function startJobs() {
  // ── Fire due reminders (every minute) ─────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dueReminders = await Reminder.find({
        status:     { $in: ['pending', 'snoozed'] },
        nextFireAt: { $lte: now },
      })
        .populate('userId', 'name email phone notifPrefs pushSubscription fcmToken')
        .populate('assignedTo', 'name fcmToken pushSubscription');

      for (const reminder of dueReminders) {
        await fireReminder(reminder);
      }

      if (dueReminders.length > 0) {
        logger.info(`[Cron] Fired ${dueReminders.length} reminder(s)`);
      }
    } catch (err) {
      logger.error('[Cron] reminder-fire error:', err.message);
    }
  });

  // ── Pre-alert: notify assigned friend 2 minutes before fire time ───────
  cron.schedule('* * * * *', async () => {
    try {
      const now   = new Date();
      const soon  = new Date(now.getTime() + 2 * 60 * 1000); // exactly 2 min from now
      const delta = 60 * 1000; // ±30s window to avoid missing a tick

      const upcoming = await Reminder.find({
        assignedTo:   { $ne: null },
        status:       'pending',
        preAlertSent: false,
        nextFireAt:   { $gte: new Date(soon.getTime() - delta), $lt: new Date(soon.getTime() + delta) },
      }).populate('userId', 'name').populate('assignedTo', 'name fcmToken pushSubscription');

      for (const reminder of upcoming) {
        const assignedTo = reminder.assignedTo;
        if (!assignedTo) continue;

        await notifService.createAndPush({
          userId:  assignedTo._id,
          type:    'reminder_pre_alert',
          title:   '⏰ Reminder in 2 minutes',
          message: `"${reminder.title}" set by ${reminder.userId?.name} is due soon`,
          data:    { reminderId: String(reminder._id), type: 'friend_request' },
        });

        reminder.preAlertSent = true;
        await reminder.save();
      }

      if (upcoming.length > 0) {
        logger.info(`[Cron] Sent ${upcoming.length} pre-alert(s)`);
      }
    } catch (err) {
      logger.error('[Cron] pre-alert error:', err.message);
    }
  });

  // ── Mark overdue reminders as missed (every 5 minutes) ────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = await Reminder.updateMany(
        {
          status:     'pending',
          nextFireAt: { $lt: fiveMinutesAgo },
        },
        { $set: { status: 'missed' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[Cron] Marked ${result.modifiedCount} reminder(s) as missed`);
      }
    } catch (err) {
      logger.error('[Cron] missed-mark error:', err.message);
    }
  });

  // ── Update next fire date for recurring reminders (daily at midnight) ──
  cron.schedule('0 0 * * *', async () => {
    try {
      const recurring = await Reminder.find({
        status:      'done',
        repeatType:  { $ne: 'none' },
      });

      for (const r of recurring) {
        const next = computeNextDate(r.date, r.repeatType);
        await Reminder.findByIdAndUpdate(r._id, {
          date:   next,
          status: 'pending',
          snoozeCount: 0,
        });
      }
      logger.info(`[Cron] Reset ${recurring.length} recurring reminder(s)`);
    } catch (err) {
      logger.error('[Cron] recurrence error:', err.message);
    }
  });

  // ── Streak maintenance (daily at 1 AM) ────────────────────────────────
  cron.schedule('0 1 * * *', async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Users who haven't been active for more than 1 day — reset streak
      await User.updateMany(
        { lastActiveAt: { $lt: yesterday }, streak: { $gt: 0 } },
        { $set: { streak: 0 } }
      );
    } catch (err) {
      logger.error('[Cron] streak reset error:', err.message);
    }
  });

  logger.info('✅ Cron jobs started');
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function fireReminder(reminder) {
  const user = reminder.userId;
  if (!user) return;

  const notifTypes = reminder.notificationTypes?.length
    ? reminder.notificationTypes
    : ['push'];

  // Notify the reminder owner
  await notifService.send({ user, reminder, channels: notifTypes });
  await notifService.createAndPush({
    userId:  user._id,
    type:    'reminder_due',
    title:   `⏰ ${reminder.title}`,
    message: reminder.description || 'Your reminder is due now!',
    data:    { reminderId: String(reminder._id), type: 'reminder_due' },
  });

  // If assigned to a friend, fire notification to them too with action options
  if (reminder.assignedTo?._id) {
    await notifService.createAndPush({
      userId:  reminder.assignedTo._id,
      type:    'friend_reminder_due',
      title:   `⏰ ${reminder.title}`,
      message: `Reminder from ${user.name} is due now! Tap to take action.`,
      data:    {
        reminderId:  String(reminder._id),
        type:        'friend_request',   // routes push tap to friends tab
        senderName:  user.name,
      },
    });

    // Update sharedStatus to 'received' if still at 'sent'
    if (reminder.sharedStatus === 'sent' || !reminder.sharedStatus) {
      await reminder.constructor.findByIdAndUpdate(reminder._id, { sharedStatus: 'received' });
    }
  }
}

function computeNextDate(currentDate, repeatType) {
  const d = new Date(currentDate);
  switch (repeatType) {
    case 'daily':   d.setDate(d.getDate() + 1);    break;
    case 'weekly':  d.setDate(d.getDate() + 7);    break;
    case 'monthly': d.setMonth(d.getMonth() + 1);  break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

module.exports = { startJobs };
