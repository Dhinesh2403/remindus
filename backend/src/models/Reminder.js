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
      enum: ['general','birthday','wedding','medicine','study','bill','work','custom'],
      default: 'general',
    },
    repeatType: {
      type: String,
      enum: ['none','daily','weekly','monthly','yearly'],
      default: 'none',
    },
    priority: {
      type: String,
      enum: ['low','medium','high','urgent'],
      default: 'medium',
    },
    reminderWindowMinutes: { type: Number, default: 30 },
    notificationTypes: [{
      type: String,
      enum: ['push','email','sms','whatsapp'],
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

reminderSchema.pre('save', function (next) {
  if (this.isModified('date') || this.isModified('time') || this.isModified('reminderWindowMinutes')) {
    const [h, m] = this.time.split(':').map(Number);
    const fireAt = new Date(this.date);
    fireAt.setHours(h, m, 0, 0);
    fireAt.setMinutes(fireAt.getMinutes() - this.reminderWindowMinutes);
    this.nextFireAt = fireAt;
  }
  next();
});

module.exports = mongoose.model('Reminder', reminderSchema);
