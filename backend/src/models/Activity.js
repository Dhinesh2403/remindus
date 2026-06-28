// backend/src/models/Activity.js
'use strict';

const mongoose = require('mongoose');

// A "Daily Plan" activity — a time-blocked entry for a specific calendar day.
const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title:  { type: String, required: true, trim: true, maxlength: 120 },
    // Day this activity belongs to, stored as YYYY-MM-DD (local day key).
    dayKey: { type: String, required: true, index: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startH: { type: Number, default: 10, min: 0, max: 23 },
    startM: { type: Number, default: 0,  min: 0, max: 59 },
    endH:   { type: Number, default: 11, min: 0, max: 23 },
    endM:   { type: Number, default: 0,  min: 0, max: 59 },
    color:  { type: String, default: '#3257EE' },
    type:   { type: String, default: 'General', trim: true, maxlength: 40 },
    note:   { type: String, default: '', trim: true, maxlength: 500 },
    cat:    { type: String, default: 'None', trim: true, maxlength: 40 },
    done:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, dayKey: 1 });

module.exports = mongoose.model('Activity', activitySchema);
