// backend/src/controllers/task.controller.js
'use strict';

const Task = require('../models/Task');
const notifService = require('../services/notification.service');
const { emitToUser } = require('../sockets');
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

  // Assigned to a friend → real-time event + push, mirroring reminders
  if (assignedTo) {
    emitToUser(String(assignedTo), 'task:received', {
      _id:      String(task._id),
      title:    task.title,
      dueDate:  task.dueDate,
      priority: task.priority,
      assignedBy: { _id: String(req.user._id), name: req.user.name, avatar: req.user.avatar },
    });
    await notifService.createAndPush({
      userId:  assignedTo,
      type:    'task_assigned',
      title:   task.title,
      message: `${req.user.name} assigned "${task.title}" to you`,
      data:    { taskId: String(task._id) },
      category:   'Task',
      subtext:    `From ${req.user.name}`,
      senderName: req.user.name,
      avatar:     req.user.avatar,
    });
  }

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
// Owner or assignee may toggle; the other party is notified on completion.
exports.toggle = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const task = await Task.findOne({
    _id: req.params.id,
    $or: [{ userId: uid }, { assignedTo: uid }],
  });
  if (!task) throw new AppError('Task not found', 404);
  task.status = task.status === 'done' ? 'active' : 'done';
  await task.save();

  if (task.assignedTo) {
    const otherParty = String(task.userId) === String(uid) ? task.assignedTo : task.userId;
    emitToUser(String(otherParty), 'task:sharedStatus', {
      _id:    String(task._id),
      status: task.status,
    });
    if (task.status === 'done') {
      await notifService.createAndPush({
        userId:  otherParty,
        type:    'task_status_update',
        title:   task.title,
        message: `${req.user.name} completed a shared task`,
        data:    { taskId: String(task._id), type: 'task_status_update' },
        category: 'Task',
        subtext:  `${req.user.name} completed it`,
      });
    }
  }

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
