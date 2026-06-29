// backend/src/controllers/habit.controller.js
'use strict';

const Habit = require('../models/Habit');
const { asyncHandler, AppError } = require('../utils/helpers');

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── GET /api/habits ───────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await Habit.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, data });
});

// ── POST /api/habits ──────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { name, goal, color } = req.body;
  const habit = await Habit.create({
    userId: req.user._id,
    name,
    goal: goal || 'Every day',
    color: color || '#E0732B',
  });
  res.status(201).json({ success: true, data: habit });
});

// ── PUT /api/habits/:id ───────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const { name, goal, color } = req.body;
  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { ...(name !== undefined && { name }), ...(goal !== undefined && { goal }), ...(color !== undefined && { color }) } },
    { new: true, runValidators: true }
  );
  if (!habit) throw new AppError('Habit not found', 404);
  res.json({ success: true, data: habit });
});

// ── PATCH /api/habits/:id/toggle ─────────────────────────────────────────
// Toggles today's completion box and recomputes the streak server-side.
exports.toggleToday = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
  if (!habit) throw new AppError('Habit not found', 404);

  const week = [...habit.week];
  const done = !week[6];
  week[6] = done;
  habit.week = week;
  habit.streak = done ? habit.streak + 1 : Math.max(0, habit.streak - 1);
  if (habit.streak > habit.best) habit.best = habit.streak;
  habit.lastToggledDay = todayKey();
  await habit.save();

  res.json({ success: true, data: habit });
});

// ── DELETE /api/habits/:id ────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!habit) throw new AppError('Habit not found', 404);
  res.json({ success: true, message: 'Habit deleted' });
});
