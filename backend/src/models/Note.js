// backend/src/models/Note.js
'use strict';

const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title:    { type: String, trim: true, maxlength: 120, default: '' },
    text:     { type: String, required: true, trim: true, maxlength: 2000 },
    pinned:   { type: Boolean, default: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Drives display order; drag-reorder sets this to the midpoint of its new neighbours.
    order:    { type: Number, default: () => Date.now() * 1000 },
    // Who last changed title/text/color, and when — drives the per-viewer "unread edit" badge.
    lastEditedAt: { type: Date, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // One entry per user who has opened this note; compared against lastEditedAt.
    viewedBy: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, pinned: -1, order: -1 });
noteSchema.index({ collaborators: 1 });

module.exports = mongoose.model('Note', noteSchema);
