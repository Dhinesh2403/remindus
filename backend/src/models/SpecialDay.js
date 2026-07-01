// backend/src/models/SpecialDay.js
'use strict';

const mongoose = require('mongoose');

const specialDaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name:  { type: String, required: true, trim: true, maxlength: 120 },
    type:  { type: String, enum: ['birthday', 'anniversary', 'event'], required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day:   { type: Number, required: true, min: 1, max: 31 },
    year:  { type: Number, default: null },
    note:  { type: String, default: '', trim: true, maxlength: 500 },
    color: { type: String, default: '#E0699B' },
  },
  { timestamps: true }
);

// Computed daysUntil virtual (does not persist)
specialDaySchema.virtual('daysUntil').get(function () {
  const now = new Date();
  const y   = now.getFullYear();
  let next  = new Date(y, this.month - 1, this.day);
  if (next < now) next = new Date(y + 1, this.month - 1, this.day);
  return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
});

specialDaySchema.set('toJSON', { virtuals: true });
specialDaySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SpecialDay', specialDaySchema);
