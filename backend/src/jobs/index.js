// backend/src/jobs/index.js
'use strict';

const cron          = require('node-cron');
const Reminder      = require('../models/Reminder');
const User          = require('../models/User');
const notifService  = require('../services/notification.service');
const logger        = require('../utils/logger');
const { duePhrase, sentenceCase } = require('../utils/reminder-text');

/**
 * Start all cron jobs.
 * Called once from app.js after DB is connected.
 */
function startJobs() {
  // ── Fire due reminders (every minute) ─────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const now     = new Date();
      const maxDate = new Date('9999-12-31T23:59:59.000Z');
      let   fired   = 0;

      // Atomic claim-and-fire loop: each iteration grabs one unclaimed due
      // reminder (sets nextFireAt → 9999 so no other tick re-fires it), then
      // sends the notification.  Loop exits when nothing is left to fire.
      while (true) {
        const reminder = await Reminder.findOneAndUpdate(
          {
            status:     { $in: ['pending', 'snoozed'] },
            nextFireAt: { $gt: new Date(0), $lte: now },
          },
          { $set: { nextFireAt: maxDate } },
          { new: false },            // return the original doc so we know who to notify
        )
          .populate('userId',     'name avatar email phone notifPrefs pushSubscription fcmToken')
          .populate('assignedTo', 'name fcmToken pushSubscription');

        if (!reminder) break;       // no more due reminders this tick

        try {
          await fireReminder(reminder);
          fired++;
        } catch (fireErr) {
          logger.error(`[Cron] fireReminder failed for ${reminder._id}:`, fireErr.message);
        }
      }

      if (fired > 0) {
        logger.info(`[Cron] Fired ${fired} reminder(s)`);
      }
    } catch (err) {
      logger.error('[Cron] reminder-fire error:', err.message);
    }
  });

  // ── Pre-alert: notify assigned friend 5 minutes before fire time ───────
  // Only assigned reminders (tasks) get this heads-up — a plain reminder the
  // user set for themselves fires once, at its time, with no pre-alert.
  cron.schedule('* * * * *', async () => {
    try {
      const now   = new Date();
      const soon  = new Date(now.getTime() + 5 * 60 * 1000); // exactly 5 min from now
      const delta = 60 * 1000; // ±30s window to avoid missing a tick
      let   sent  = 0;

      // Atomic claim loop (same pattern as the fire loop above): flipping
      // preAlertSent inside findOneAndUpdate guarantees each reminder is
      // claimed exactly once, even when a tick overruns into the next one or
      // two server instances overlap during a deploy — the old find-then-save
      // version could send the same pre-alert twice.
      while (true) {
        const reminder = await Reminder.findOneAndUpdate(
          {
            assignedTo:   { $ne: null },
            status:       'pending',
            preAlertSent: false,
            nextFireAt:   { $gte: new Date(soon.getTime() - delta), $lt: new Date(soon.getTime() + delta) },
          },
          { $set: { preAlertSent: true } },
          { new: false },
        ).populate('userId', 'name').populate('assignedTo', 'name fcmToken pushSubscription');

        if (!reminder) break;
        if (!reminder.assignedTo) continue;   // assignee deleted — already claimed, skip

        const preFrom = reminder.userId?.name || 'A friend';
        await notifService.createAndPush({
          userId:  reminder.assignedTo._id,
          type:    'reminder_pre_alert',
          title:   reminder.title,
          message: `Heads-up — ${preFrom}'s task is due in 5 minutes.`,
          data:    { reminderId: String(reminder._id), type: 'reminder_pre_alert' },
          category: 'Task',
          subtext:  `From ${preFrom} · due in 5 min`,
        });
        sent++;
      }

      if (sent > 0) {
        logger.info(`[Cron] Sent ${sent} pre-alert(s)`);
      }
    } catch (err) {
      logger.error('[Cron] pre-alert error:', err.message);
    }
  });

  // ── Mark overdue reminders as missed (every 5 minutes) ────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const safeMax = new Date('2100-01-01'); // reminders with nextFireAt beyond this were already fired
      const result = await Reminder.updateMany(
        {
          status:     'pending',
          nextFireAt: { $gt: new Date(0), $lt: fiveMinutesAgo, $lte: safeMax },
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

  // Alarm-type reminders ring via a local notification scheduled on the
  // device — skip the FCM push so the owner isn't notified twice, but still
  // record it in the in-app notification center.
  const alarmOnly = notifTypes.includes('alarm') && !notifTypes.includes('push');

  // Notify the reminder owner. "Due in 30 min" (the reminder window) vs the
  // pre-alert's "⏳ In 2 min:" prefix is what tells the two apart on the phone.
  const due      = duePhrase(reminder);
  const dueLabel = sentenceCase(due); // "Due now" | "Due in 30 min"
  await notifService.send({ user, reminder, channels: notifTypes });
  await notifService.createAndPush({
    userId:  user._id,
    type:    'reminder_due',
    title:   reminder.title,
    message: reminder.description ? `${dueLabel} · ${reminder.description}` : dueLabel,
    data:    { reminderId: String(reminder._id), type: 'reminder_due' },
    category: 'Reminder',
    subtext:  dueLabel,
    actions:  [
      { id: 'ack',     label: 'Mark done' },
      { id: 'snooze5', label: 'Snooze 5 min' },
    ],
    push:    !alarmOnly,
  });

  // If assigned to a friend, fire notification to them too (tap-through)
  if (reminder.assignedTo?._id) {
    await notifService.createAndPush({
      userId:  reminder.assignedTo._id,
      type:    'friend_reminder_due',
      title:   reminder.title,
      // No "due now" — the arrival of the push IS the "it's time" signal. Lead
      // with who it's from + the task name; the Snooze button carries the rest.
      message: `From ${user.name} — tap Snooze to push it 5 min.`,
      data:    {
        reminderId:  String(reminder._id),
        type:        'friend_reminder_due',
        senderName:  user.name,
      },
      category:   'Task',
      subtext:    `From ${user.name}`,
      // Assignee-side snooze: reschedules the task +5 min and re-pushes then.
      actions:    [{ id: 'snooze5_assigned', label: 'Snooze 5 min' }],
      senderName: user.name,
      avatar:     user.avatar,
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
    case 'weekdays':
      d.setDate(d.getDate() + 1);
      while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setDate(d.getDate() + 1);
      break;
    case 'monthly': d.setMonth(d.getMonth() + 1);  break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

module.exports = { startJobs };
