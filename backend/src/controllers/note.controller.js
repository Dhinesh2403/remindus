// backend/src/controllers/note.controller.js
'use strict';

const Note = require('../models/Note');
const Friendship = require('../models/Friendship');
const { asyncHandler, AppError } = require('../utils/helpers');
const { emitToUser } = require('../sockets');

const POPULATE_FIELDS = 'name avatar gender';

// ── GET /api/notes ────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await Note.find({
    $or: [{ userId: req.user._id }, { collaborators: req.user._id }],
  })
    .sort({ pinned: -1, order: -1 })
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS)
    .lean();
  res.json({ success: true, data });
});

// ── POST /api/notes ───────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { text, color } = req.body;
  const note = await Note.create({
    userId: req.user._id,
    text,
    color: color || 'none',
  });
  const populated = await note.populate('userId', POPULATE_FIELDS);
  res.status(201).json({ success: true, data: populated });
});

// ── PUT /api/notes/:id ────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['text', 'color', 'pinned'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, $or: [{ userId: req.user._id }, { collaborators: req.user._id }] },
    { $set: update },
    { new: true, runValidators: true }
  )
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS);
  if (!note) throw new AppError('Note not found', 404);

  notifyNote(note, 'note:updated', { note });
  res.json({ success: true, data: note });
});

// ── PATCH /api/notes/:id/pin ─────────────────────────────────────────────
exports.togglePin = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    $or: [{ userId: req.user._id }, { collaborators: req.user._id }],
  })
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS);
  if (!note) throw new AppError('Note not found', 404);
  note.pinned = !note.pinned;
  await note.save();

  notifyNote(note, 'note:updated', { note });
  res.json({ success: true, data: note });
});

// ── DELETE /api/notes/:id ─────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!note) throw new AppError('Note not found', 404);

  notifyNote(note, 'note:deleted', { noteId: String(note._id) });
  res.json({ success: true, message: 'Note deleted' });
});

// ── POST /api/notes/:id/share ────────────────────────────────────────────
exports.share = asyncHandler(async (req, res) => {
  const { friendId } = req.body;
  const note = await Note.findOne({ _id: req.params.id, userId: req.user._id });
  if (!note) throw new AppError('Note not found', 404);

  const friendship = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: req.user._id, recipient: friendId },
      { requester: friendId, recipient: req.user._id },
    ],
  });
  if (!friendship) throw new AppError('You can only share notes with friends', 400);

  note.collaborators.addToSet(friendId);
  await note.save();
  const populated = await note.populate([
    { path: 'userId', select: POPULATE_FIELDS },
    { path: 'collaborators', select: POPULATE_FIELDS },
  ]);

  notifyNote(populated, 'note:shared', { note: populated });
  res.json({ success: true, data: populated });
});

// ── DELETE /api/notes/:id/share/:friendId ────────────────────────────────
exports.unshare = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, userId: req.user._id });
  if (!note) throw new AppError('Note not found', 404);

  const { friendId } = req.params;
  note.collaborators.pull(friendId);
  await note.save();
  const populated = await note.populate([
    { path: 'userId', select: POPULATE_FIELDS },
    { path: 'collaborators', select: POPULATE_FIELDS },
  ]);

  // The removed friend needs to hear about this too, even though they're no
  // longer in `collaborators` — notifyNote() below only fans out to current members.
  emitToUser(friendId, 'note:unshared', { noteId: String(note._id), friendId: String(friendId) });
  notifyNote(populated, 'note:unshared', { noteId: String(note._id), friendId: String(friendId) });
  res.json({ success: true, data: populated });
});

// ── PATCH /api/notes/:id/order ───────────────────────────────────────────
exports.reorder = asyncHandler(async (req, res) => {
  const { order } = req.body;
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, $or: [{ userId: req.user._id }, { collaborators: req.user._id }] },
    { $set: { order } },
    { new: true }
  )
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS);
  if (!note) throw new AppError('Note not found', 404);

  notifyNote(note, 'note:reordered', { noteId: String(note._id), order: note.order });
  res.json({ success: true, data: note });
});

// ── Fan out a note event to the owner + every collaborator ──────────────
function notifyNote(note, event, payload) {
  emitToUser(String(note.userId._id || note.userId), event, payload);
  for (const c of note.collaborators || []) {
    emitToUser(String(c._id || c), event, payload);
  }
}
