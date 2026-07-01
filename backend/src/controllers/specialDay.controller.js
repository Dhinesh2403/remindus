// backend/src/controllers/specialDay.controller.js
'use strict';

const SpecialDay = require('../models/SpecialDay');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/special-days ────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.type) filter.type = req.query.type;

  const docs = await SpecialDay.find(filter).sort({ month: 1, day: 1 }).lean({ virtuals: true });
  res.json({ success: true, data: docs });
});

// ── POST /api/special-days ───────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { name, type, month, day, year, note, color } = req.body;
  const doc = await SpecialDay.create({
    userId: req.user._id,
    name,
    type,
    month: Number(month),
    day:   Number(day),
    year:  year ? Number(year) : null,
    note:  note || '',
    color: color || '#E0699B',
  });
  res.status(201).json({ success: true, data: doc.toJSON() });
});

// ── PUT /api/special-days/:id ────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'type', 'month', 'day', 'year', 'note', 'color'];
  const update  = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

  const doc = await SpecialDay.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!doc) throw new AppError('Special day not found', 404);
  res.json({ success: true, data: doc.toJSON() });
});

// ── DELETE /api/special-days/:id ─────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const doc = await SpecialDay.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Special day not found', 404);
  res.json({ success: true, message: 'Special day deleted' });
});
