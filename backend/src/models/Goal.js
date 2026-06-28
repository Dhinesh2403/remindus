// backend/src/models/Goal.js
'use strict';

const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    t:    { type: String, required: true, trim: true, maxlength: 160 },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title:  { type: String, required: true, trim: true, maxlength: 120 },
    cat:    { type: String, default: 'Personal', trim: true, maxlength: 40 },
    color:  { type: String, default: '#7B61D8' },
    target: { type: String, default: 'No target date', trim: true, maxlength: 60 },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
