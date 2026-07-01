// backend/src/models/Task.js
'use strict';

const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done:  { type: Boolean, default: false },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional — task can be shared with a friend
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    notes:       { type: String, default: '', trim: true, maxlength: 2000 },
    category:    { type: String, default: 'Personal', trim: true, maxlength: 50 },
    priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status:      { type: String, enum: ['active', 'done'], default: 'active' },
    dueDate:     { type: Date, default: null },
    startTime:   { type: String, default: null },
    estimatedMin:{ type: Number, default: null },
    reminderType:{ type: String, enum: ['notification', 'alarm', 'none'], default: 'notification' },
    repeat:      { type: String, default: 'Does not repeat' },
    subtasks:    { type: [subtaskSchema], default: [] },
  },
  { timestamps: true }
);

// Index for common queries
taskSchema.index({ userId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
