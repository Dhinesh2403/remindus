// backend/src/models/Notification.js
'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'reminder_due',
        'reminder_assigned',
        'reminder_response',
        'reminder_pre_alert',
        'reminder_status_update',
        'friend_reminder_due',
        'friend_request',
        'friend_accepted',
        'system',
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    data:    { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead:  { type: Boolean, default: false, index: true },
    readAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
