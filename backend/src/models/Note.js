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
    text:     { type: String, required: true, trim: true, maxlength: 2000 },
    color:    { type: String, enum: ['none', 'yellow', 'pink', 'blue', 'green', 'purple'], default: 'none' },
    pinned:   { type: Boolean, default: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Drives display order; drag-reorder sets this to the midpoint of its new neighbours.
    order:    { type: Number, default: () => Date.now() * 1000 },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, pinned: -1, order: -1 });
noteSchema.index({ collaborators: 1 });

module.exports = mongoose.model('Note', noteSchema);
