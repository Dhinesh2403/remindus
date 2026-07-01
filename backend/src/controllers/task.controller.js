// backend/src/controllers/task.controller.js
'use strict';

const Task = require('../models/Task');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/tasks ────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: tasks });
});

// ── GET /api/tasks/:id ────────────────────────────────────────────────────
exports.getOne = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!task) throw new AppError('Task not found', 404);
  res.json({ success: true, data: task });
});

// ── POST /api/tasks ───────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const {
    title, notes, category, priority, dueDate, startTime,
    estimatedMin, reminderType, repeat, subtasks, assignedTo,
  } = req.body;

  const sub = Array.isArray(subtasks)
    ? subtasks.map((s) => ({ title: String(s.title || '').trim(), done: !!s.done })).filter((s) => s.title)
    : [];

  const task = await Task.create({
    userId: req.user._id,
    title,
    notes:        notes || '',
    category:     category || 'Personal',
    priority:     priority || 'medium',
    dueDate:      dueDate || null,
    startTime:    startTime || null,
    estimatedMin: estimatedMin || null,
    reminderType: reminderType || 'notification',
    repeat:       repeat || 'Does not repeat',
    subtasks:     sub,
    assignedTo:   assignedTo || null,
  });
  res.status(201).json({ success: true, data: task });
});

// ── PUT /api/tasks/:id ────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = [
    'title', 'notes', 'category', 'priority', 'status',
    'dueDate', 'startTime', 'estimatedMin', 'reminderType', 'repeat',
  ];
  const update = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

  if (Array.isArray(req.body.subtasks)) {
    update.subtasks = req.body.subtasks
      .map((s) => ({ title: String(s.title || '').trim(), done: !!s.done }))
      .filter((s) => s.title);
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!task) throw new AppError('Task not found', 404);
  res.json({ success: true, data: task });
});

// ── PATCH /api/tasks/:id/toggle ───────────────────────────────────────────
exports.toggle = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) throw new AppError('Task not found', 404);
  task.status = task.status === 'done' ? 'active' : 'done';
  await task.save();
  res.json({ success: true, data: task });
});

// ── PATCH /api/tasks/:id/subtask ──────────────────────────────────────────
exports.toggleSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.body;
  const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) throw new AppError('Task not found', 404);
  const sub = task.subtasks.id(subtaskId);
  if (!sub) throw new AppError('Subtask not found', 404);
  sub.done = !sub.done;
  await task.save();
  res.json({ success: true, data: task });
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!task) throw new AppError('Task not found', 404);
  res.json({ success: true, message: 'Task deleted' });
});
