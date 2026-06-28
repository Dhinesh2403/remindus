// backend/src/controllers/goal.controller.js
'use strict';

const Goal = require('../models/Goal');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/goals ────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await Goal.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, data });
});

// ── POST /api/goals ───────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { title, cat, color, target, milestones } = req.body;
  const ms = Array.isArray(milestones)
    ? milestones.map((m) => ({ t: String(m.t || '').trim(), done: !!m.done })).filter((m) => m.t)
    : [];
  const goal = await Goal.create({
    userId: req.user._id,
    title,
    cat: cat || 'Personal',
    color: color || '#7B61D8',
    target: target || 'No target date',
    milestones: ms.length ? ms : [{ t: 'Get started', done: false }],
  });
  res.status(201).json({ success: true, data: goal });
});

// ── PUT /api/goals/:id ────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const { title, cat, color, target, milestones } = req.body;
  const update = {};
  if (title !== undefined) update.title = title;
  if (cat !== undefined) update.cat = cat;
  if (color !== undefined) update.color = color;
  if (target !== undefined) update.target = target;
  if (Array.isArray(milestones)) {
    update.milestones = milestones
      .map((m) => ({ t: String(m.t || '').trim(), done: !!m.done }))
      .filter((m) => m.t);
  }
  const goal = await Goal.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!goal) throw new AppError('Goal not found', 404);
  res.json({ success: true, data: goal });
});

// ── PATCH /api/goals/:id/milestone ───────────────────────────────────────
// Toggles a single milestone's done flag by its index.
exports.toggleMilestone = asyncHandler(async (req, res) => {
  const { index } = req.body;
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw new AppError('Goal not found', 404);
  if (index < 0 || index >= goal.milestones.length) throw new AppError('Invalid milestone index', 400);

  goal.milestones[index].done = !goal.milestones[index].done;
  await goal.save();
  res.json({ success: true, data: goal });
});

// ── DELETE /api/goals/:id ─────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw new AppError('Goal not found', 404);
  res.json({ success: true, message: 'Goal deleted' });
});
