// backend/src/controllers/activity.controller.js
'use strict';

const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/activities?date=YYYY-MM-DD ──────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.date) filter.dayKey = req.query.date;
  const data = await Activity.find(filter).sort({ startH: 1, startM: 1 }).lean();
  res.json({ success: true, data });
});

// ── POST /api/activities ──────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { title, dayKey, startH, startM, endH, endM, color, type, note, cat } = req.body;
  const activity = await Activity.create({
    userId: req.user._id,
    title,
    dayKey,
    startH, startM, endH, endM,
    color: color || '#3257EE',
    type: type || 'General',
    note: note || '',
    cat: cat || 'None',
  });
  res.status(201).json({ success: true, data: activity });
});

// ── PUT /api/activities/:id ───────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['title', 'startH', 'startM', 'endH', 'endM', 'color', 'type', 'note', 'cat', 'done'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const activity = await Activity.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!activity) throw new AppError('Activity not found', 404);
  res.json({ success: true, data: activity });
});

// ── PATCH /api/activities/:id/toggle ─────────────────────────────────────
exports.toggleDone = asyncHandler(async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id, userId: req.user._id });
  if (!activity) throw new AppError('Activity not found', 404);
  activity.done = !activity.done;
  await activity.save();
  res.json({ success: true, data: activity });
});

// ── DELETE /api/activities/:id ────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const activity = await Activity.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!activity) throw new AppError('Activity not found', 404);
  res.json({ success: true, message: 'Activity deleted' });
});
