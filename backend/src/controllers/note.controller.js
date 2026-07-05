// backend/src/controllers/note.controller.js
'use strict';

const Note = require('../models/Note');
const Friendship = require('../models/Friendship');
const { asyncHandler, AppError } = require('../utils/helpers');
const { emitToUser } = require('../sockets');
const notifService = require('../services/notification.service');

const POPULATE_FIELDS = 'name avatar gender';

// ── Normalize a lean/plain note for the requesting user ──────────────────
// .lean() skips Mongoose's array-default getters, so notes saved before the
// collaborators/order fields existed come back with them missing entirely —
// that crashes the frontend, which assumes collaborators is always an array.
// Also derives `hasUnreadEdit` (viewer-scoped) and strips the raw viewedBy/
// lastEditedBy tracking fields so the client only ever sees the flag.
function normalizeForViewer(n, viewerId) {
  const collaborators = n.collaborators || [];
  const order = n.order ?? 0;
  const viewerIdStr = String(viewerId);
  const isShared = collaborators.length > 0;
  const editedByOther = n.lastEditedBy && String(n.lastEditedBy._id || n.lastEditedBy) !== viewerIdStr;
  const viewedEntry = (n.viewedBy || []).find((v) => String(v.user) === viewerIdStr);
  const hasUnreadEdit = !!(
    isShared &&
    editedByOther &&
    n.lastEditedAt &&
    (!viewedEntry || new Date(viewedEntry.at) < new Date(n.lastEditedAt))
  );
  const { viewedBy, lastEditedBy, ...rest } = n;
  return { ...rest, title: n.title ?? '', collaborators, order, hasUnreadEdit };
}

// ── GET /api/notes ────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await Note.find({
    $or: [{ userId: req.user._id }, { collaborators: req.user._id }],
  })
    .sort({ pinned: -1, order: -1 })
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS)
    .lean();
  const normalized = data.map((n) => normalizeForViewer(n, req.user._id));
  res.json({ success: true, data: normalized });
});

// ── POST /api/notes ───────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { text, title, collaboratorIds } = req.body;
  const note = await Note.create({
    userId: req.user._id,
    title: title || '',
    text,
  });

  if (Array.isArray(collaboratorIds) && collaboratorIds.length) {
    const friendships = await Friendship.find({
      status: 'accepted',
      $or: collaboratorIds.flatMap((id) => [
        { requester: req.user._id, recipient: id },
        { requester: id, recipient: req.user._id },
      ]),
    });
    const friendIds = new Set(
      friendships.map((f) =>
        String(f.requester) === String(req.user._id) ? String(f.recipient) : String(f.requester)
      )
    );
    for (const id of collaboratorIds) if (friendIds.has(String(id))) note.collaborators.addToSet(id);
    if (note.isModified('collaborators')) await note.save();
    for (const id of friendIds) await notifyNoteShared(note, req.user, id);
  }

  const populated = await note.populate([
    { path: 'userId', select: POPULATE_FIELDS },
    { path: 'collaborators', select: POPULATE_FIELDS },
  ]);
  const rawNote = populated.toObject();

  emitNoteToMembers(rawNote, 'note:created');
  res.status(201).json({ success: true, data: normalizeForViewer(rawNote, req.user._id) });
});

// ── PUT /api/notes/:id ────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['title', 'text', 'pinned'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const editsContent = ['title', 'text'].some((k) => update[k] !== undefined);
  if (editsContent) {
    update.lastEditedAt = new Date();
    update.lastEditedBy = req.user._id;
  }
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, $or: [{ userId: req.user._id }, { collaborators: req.user._id }] },
    { $set: update },
    { new: true, runValidators: true }
  )
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS);
  if (!note) throw new AppError('Note not found', 404);

  const rawNote = note.toObject();
  emitNoteToMembers(rawNote, 'note:updated');
  res.json({ success: true, data: normalizeForViewer(rawNote, req.user._id) });
});

// ── PATCH /api/notes/:id/view ────────────────────────────────────────────
exports.markViewed = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, $or: [{ userId: req.user._id }, { collaborators: req.user._id }] },
    { $pull: { viewedBy: { user: req.user._id } } }
  );
  if (!note) throw new AppError('Note not found', 404);

  const updated = await Note.findByIdAndUpdate(
    req.params.id,
    { $push: { viewedBy: { user: req.user._id, at: new Date() } } },
    { new: true }
  )
    .populate('userId', POPULATE_FIELDS)
    .populate('collaborators', POPULATE_FIELDS);

  const normalized = normalizeForViewer(updated.toObject(), req.user._id);
  emitToUser(String(req.user._id), 'note:viewed', { noteId: String(updated._id) });
  res.json({ success: true, data: normalized });
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

  const rawNote = note.toObject();
  emitNoteToMembers(rawNote, 'note:updated');
  res.json({ success: true, data: normalizeForViewer(rawNote, req.user._id) });
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
  const rawNote = populated.toObject();

  emitNoteToMembers(rawNote, 'note:shared');
  await notifyNoteShared(note, req.user, friendId);
  res.json({ success: true, data: normalizeForViewer(rawNote, req.user._id) });
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
  res.json({ success: true, data: normalizeForViewer(populated.toObject(), req.user._id) });
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
  res.json({ success: true, data: normalizeForViewer(note.toObject(), req.user._id) });
});

// ── Push/DB notification to a collaborator a note was just shared with ──────
async function notifyNoteShared(note, sender, friendId) {
  await notifService.createAndPush({
    userId:  friendId,
    type:    'note_shared',
    title:   sender.name,
    message: `${sender.name} shared a note with you${note.title ? `: "${note.title}"` : ''}`,
    data:    { noteId: String(note._id), route: `/app/notes/${note._id}` },
    category:   'Note',
    subtext:    'Shared a note with you',
    senderName: sender.name,
    avatar:     sender.avatar,
  });
}

// ── Fan out a note event (no personalized `note` payload) to the owner + every collaborator ──
function notifyNote(note, event, payload) {
  if (note.userId) emitToUser(String(note.userId._id || note.userId), event, payload);
  for (const c of note.collaborators || []) {
    if (c) emitToUser(String(c._id || c), event, payload);
  }
}

// ── Fan out a note-carrying event, personalizing hasUnreadEdit per recipient ──
function emitNoteToMembers(rawNote, event, extra = {}) {
  const ownerId = String(rawNote.userId?._id || rawNote.userId);
  const collabIds = (rawNote.collaborators || []).map((c) => String(c?._id || c));
  for (const uid of [ownerId, ...collabIds]) {
    if (!uid) continue;
    emitToUser(uid, event, { note: normalizeForViewer(rawNote, uid), ...extra });
  }
}
