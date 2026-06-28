// backend/src/controllers/note.controller.js
'use strict';

const Note = require('../models/Note');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/notes ────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await Note.find({ userId: req.user._id })
    .sort({ pinned: -1, createdAt: -1 })
    .lean();
  res.json({ success: true, data });
});

// ── POST /api/notes ───────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { text, color, priority } = req.body;
  const note = await Note.create({
    userId: req.user._id,
    text,
    color: color || 'yellow',
    priority: priority === 'high' ? 'high' : 'normal',
  });
  res.status(201).json({ success: true, data: note });
});

// ── PUT /api/notes/:id ────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['text', 'color', 'priority', 'pinned'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!note) throw new AppError('Note not found', 404);
  res.json({ success: true, data: note });
});

// ── PATCH /api/notes/:id/pin ─────────────────────────────────────────────
exports.togglePin = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user._id });
  if (!note) throw new AppError('Note not found', 404);
  note.pinned = !note.pinned;
  await note.save();
  res.json({ success: true, data: note });
});

// ── DELETE /api/notes/:id ─────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!note) throw new AppError('Note not found', 404);
  res.json({ success: true, message: 'Note deleted' });
});
