// backend/src/utils/reminder-text.js
'use strict';

/**
 * Human copy for reminder notifications.
 *
 * A reminder fires `reminderWindowMinutes` BEFORE its real due moment
 * (nextFireAt = date+time − window), so the absolute due timestamp is
 * nextFireAt + window. Phrasing stays relative ("due in 45 min") because the
 * server never knows the user's timezone — the only absolute part is the
 * clock time, echoed verbatim from the user-entered `time` string.
 */

function dueAtOf(reminder) {
  const fireAt = reminder.nextFireAt ? new Date(reminder.nextFireAt) : null;
  // Epoch-0 means unset; year 9999 is the "already claimed" sentinel.
  if (!fireAt || fireAt.getTime() <= 0 || fireAt.getUTCFullYear() >= 9999) return null;
  return new Date(fireAt.getTime() + (reminder.reminderWindowMinutes || 0) * 60000);
}

function clockTime(hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!match) return null;
  const h = Number(match[1]);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${match[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "due now" | "due in 45 min" | "due in 2 hr 5 min" | "due in 3 days at 9:00 AM" */
exports.duePhrase = (reminder, now = new Date()) => {
  const dueAt = dueAtOf(reminder);
  const diffMin = dueAt ? Math.round((dueAt.getTime() - now.getTime()) / 60000) : 0;
  if (diffMin <= 0) return 'due now';
  if (diffMin < 60) return `due in ${diffMin} min`;
  if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `due in ${h} hr ${m} min` : `due in ${h} hr`;
  }
  const days = Math.round(diffMin / 1440);
  const clock = clockTime(reminder.time);
  return `due in ${days} day${days === 1 ? '' : 's'}${clock ? ` at ${clock}` : ''}`;
};

exports.sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Absolute "when" for an assigned task, so the recipient sees the concrete
 * date + clock time rather than only a relative phrase — e.g. "Jul 6, 9:00 AM".
 *
 * The date is derived in UTC (matching how nextFireAt is computed in the
 * Reminder model) and the clock time is echoed verbatim from the user-entered
 * `time` string, so the server's own timezone never shifts it.
 */
exports.dueWhen = (reminder) => {
  const clock = clockTime(reminder.time);
  const d = reminder.date ? new Date(reminder.date) : null;
  if (!d || Number.isNaN(d.getTime())) return clock || '';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const datePart = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return clock ? `${datePart}, ${clock}` : datePart;
};

// Exported so callers (e.g. the fire push) can show just the clock time.
exports.clockTime = clockTime;
