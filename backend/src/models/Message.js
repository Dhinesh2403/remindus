// backend/src/models/Message.js
'use strict';

const mongoose = require('mongoose');

/**
 * Build the canonical conversation key for a pair of users.
 * Sorting the ids makes the key identical regardless of who sends first.
 */
function conversationKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Fast history lookups + "latest message" per conversation.
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
module.exports.conversationKey = conversationKey;
