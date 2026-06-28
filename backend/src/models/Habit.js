// backend/src/models/Habit.js
'use strict';

const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name:  { type: String, required: true, trim: true, maxlength: 100 },
    goal:  { type: String, trim: true, maxlength: 120, default: 'Every day' },
    color: { type: String, default: '#E0732B' },
    streak: { type: Number, default: 0, min: 0 },
    best:   { type: Number, default: 0, min: 0 },
    // 7 booleans, Monday..Sunday — index 6 represents "today".
    week: {
      type: [Boolean],
      default: () => [false, false, false, false, false, false, false],
      validate: { validator: (v) => v.length === 7, message: 'week must have 7 entries' },
    },
    // Day (YYYY-MM-DD) the "today" box was last toggled — lets us roll the week forward.
    lastToggledDay: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Habit', habitSchema);
