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
    color:    { type: String, enum: ['yellow', 'pink', 'blue', 'green', 'purple'], default: 'yellow' },
    pinned:   { type: Boolean, default: false },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
