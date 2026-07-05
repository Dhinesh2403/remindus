// backend/src/models/Reminder.js
'use strict';

const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title:       { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    date: { type: Date, required: true },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    type: {
      type: String,
      enum: ['general','birthday','wedding','medicine','study','bill','work','custom',
             'personal','health','finance','family','travel','shopping'],
      default: 'general',
    },
    repeatType: {
      type: String,
      enum: ['none','daily','weekly','weekdays','monthly','yearly'],
      default: 'none',
    },
    priority: {
      type: String,
      enum: ['low','medium','high','urgent'],
      default: 'medium',
    },
    // 0 = fire at the exact due time (the app's default). A positive value fires
    // that many minutes *before* the due moment; duePhrase reconstructs the real
    // due instant as nextFireAt + reminderWindowMinutes, so the two must always
    // agree — every create/update path keeps them in sync (see reminder.controller).
    reminderWindowMinutes: { type: Number, default: 0 },
    durationMinutes:       { type: Number, default: null },
    notificationTypes: [{
      type: String,
      enum: ['push','email','sms','whatsapp','alarm'],
    }],
    status: {
      type: String,
      enum: ['pending','done','snoozed','missed'],
      default: 'pending',
      index: true,
    },
    snoozeCount:  { type: Number, default: 0 },
    snoozeUntil:  { type: Date,   default: null },
    completedAt:  { type: Date,   default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sharedStatus: {
      type: String,
      enum: ['sent', 'received', 'acknowledged', 'processing', 'skipped', 'completed'],
      default: null,
    },
    preAlertSent: { type: Boolean, default: false },
    nextFireAt: { type: Date, index: true },
  },
  { timestamps: true }
);

reminderSchema.index({ userId: 1, status: 1, date: 1 });
reminderSchema.index({ nextFireAt: 1, status: 1 });

/**
 * Fallback fire instant from date + wall-clock time when the client didn't send
 * a timezone-aware `nextFireAt`. Uses UTC so the server's own timezone never
 * shifts it, then subtracts the reminder window. Exported so the update path can
 * recompute consistently (findOneAndUpdate bypasses this hook).
 */
function computeNextFireAt(date, time, windowMinutes = 0) {
  const [h, m] = String(time).split(':').map(Number);
  const d = new Date(date);
  const fireAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0));
  fireAt.setUTCMinutes(fireAt.getUTCMinutes() - (windowMinutes || 0));
  return fireAt;
}

reminderSchema.pre('save', function (next) {
  // If frontend provided nextFireAt (timezone-aware), trust it on new docs
  if (this.isNew && this.nextFireAt) {
    return next();
  }
  if (this.isModified('date') || this.isModified('time') || this.isModified('reminderWindowMinutes')) {
    this.nextFireAt = computeNextFireAt(this.date, this.time, this.reminderWindowMinutes);
  }
  next();
});

const Reminder = mongoose.model('Reminder', reminderSchema);
Reminder.computeNextFireAt = computeNextFireAt;
module.exports = Reminder;
