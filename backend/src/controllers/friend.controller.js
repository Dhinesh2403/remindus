// backend/src/controllers/friend.controller.js
'use strict';

const User       = require('../models/User');
const Reminder    = require('../models/Reminder');
const Task       = require('../models/Task');
const Friendship = require('../models/Friendship');
const notifService = require('../services/notification.service');
const { isOnline } = require('../sockets');
const { asyncHandler, AppError } = require('../utils/helpers');

// All shared items between two users, regardless of who assigned whom.
const betweenPair = (a, b) => ({
  $or: [
    { userId: a, assignedTo: b },
    { userId: b, assignedTo: a },
  ],
});

// ── GET /api/friends ──────────────────────────────────────────────────────
exports.getFriends = asyncHandler(async (req, res) => {
  const uid = req.user._id;

  // Accepted friendships
  const accepted = await Friendship.find({
    $or: [{ requester: uid, status: 'accepted' }, { recipient: uid, status: 'accepted' }],
  }).populate('requester recipient', 'name email avatar gender refId lastSeenAt');

  // Pending requests sent TO this user
  const pending = await Friendship.find({ recipient: uid, status: 'pending' })
    .populate('requester', 'name email avatar gender');


  const friends = await Promise.all(
    accepted.map(async (f) => {
      const friend = String(f.requester._id) === String(uid) ? f.recipient : f.requester;
      const friendId = friend._id;

      // Counts span both directions (assigned by me OR by them) and both kinds.
      const [remShared, remPending, remDone, taskShared, taskPending, taskDone] = await Promise.all([
        Reminder.countDocuments(betweenPair(uid, friendId)),
        Reminder.countDocuments({ ...betweenPair(uid, friendId), status: 'pending' }),
        Reminder.countDocuments({ ...betweenPair(uid, friendId), status: 'done' }),
        Task.countDocuments(betweenPair(uid, friendId)),
        Task.countDocuments({ ...betweenPair(uid, friendId), status: 'active' }),
        Task.countDocuments({ ...betweenPair(uid, friendId), status: 'done' }),
      ]);

      return {
        _id:          friendId,
        friendshipId: f._id,
        name:         friend.name,
        email:        friend.email,
        avatar:       friend.avatar,
        gender:       friend.gender || null,
        refId:        friend.refId || null,
        lastSeenAt:   friend.lastSeenAt || null,
        username:     friend.email.split('@')[0],
        isOnline:     isOnline(friendId),
        completedCount: remDone + taskDone,
        sharedCount:    remShared + taskShared,
        pendingCount:   remPending + taskPending,
      };
    })
  );

  res.json({
    success: true,
    friends,
    pending: pending.map(p => ({
      _id:    p._id,
      name:   p.requester.name,
      email:  p.requester.email,
      avatar: p.requester.avatar || null,
      gender: p.requester.gender || null,
    })),
  });
});

// ── POST /api/friends/shared-activity ─────────────────────────────────────
// Everything shared between the current user and one friend: tasks and
// reminders assigned in either direction. Body: { friendId }
exports.getSharedActivity = asyncHandler(async (req, res) => {
  const uid        = req.user._id;
  const { friendId } = req.body;
  if (!friendId) throw new AppError('friendId is required', 400);

  // Only accepted friends may see each other's shared items.
  const friendship = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: uid, recipient: friendId },
      { requester: friendId, recipient: uid },
    ],
  }).lean();
  if (!friendship) throw new AppError('Not friends with this user', 403);

  const [reminders, tasks] = await Promise.all([
    Reminder.find(betweenPair(uid, friendId))
      .select('title date time status sharedStatus priority assignedTo assignedBy userId createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Task.find(betweenPair(uid, friendId))
      .select('title status dueDate startTime priority category userId assignedTo createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  res.json({ success: true, reminders, tasks });
});

// ── Normalise a typed/shared friend code to its canonical stored form ──────
function normaliseRefId(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── GET /api/friends/lookup?refId=XXXX ────────────────────────────────────
// Preview the owner of a friend code so the UI can show who they're adding
// (name + photo) before sending the request.
exports.lookupByRefId = asyncHandler(async (req, res) => {
  const refId = normaliseRefId(req.query.refId);
  if (refId.length < 6) throw new AppError('Enter a valid friend code', 400);

  const uid = String(req.user._id);
  const target = await User.findOne({ refId }).select('name avatar refId');
  if (!target) throw new AppError('No one found with that code', 404);
  if (String(target._id) === uid) throw new AppError('That\'s your own code', 400);

  // Surface any existing relationship so the UI can adapt the button.
  const existing = await Friendship.findOne({
    $or: [
      { requester: uid, recipient: target._id },
      { requester: target._id, recipient: uid },
    ],
  }).select('status requester');

  let relationship = 'none';
  if (existing) {
    if (existing.status === 'accepted') relationship = 'friends';
    else if (existing.status === 'pending') {
      relationship = String(existing.requester) === uid ? 'request_sent' : 'request_received';
    }
  }

  res.json({
    success: true,
    user: { _id: target._id, name: target.name, avatar: target.avatar || null },
    relationship,
  });
});

// ── GET /api/friends/search?q=name ───────────────────────────────────────
exports.searchUsers = asyncHandler(async (req, res) => {
  const raw = String(req.query.q ?? '').trim();
  if (raw.length < 2) return res.json({ success: true, users: [] });

  const uid = String(req.user._id);

  // Escape special regex characters so user input is always treated as plain text
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(escaped, 'i');

  // Build exclusion set: self + anyone already pending/accepted
  const friendships = await Friendship.find({
    $or: [{ requester: uid }, { recipient: uid }],
    status: { $in: ['pending', 'accepted'] },
  }).select('requester recipient').lean();

  const exclude = new Set([uid]);
  friendships.forEach(f => {
    exclude.add(String(f.requester) === uid ? String(f.recipient) : String(f.requester));
  });

  const users = await User.find({
    $or: [{ name: regex }, { email: regex }],
  }).select('name email avatar').limit(20).lean();

  res.json({
    success: true,
    users: users.filter(u => !exclude.has(String(u._id))),
  });
});

// ── POST /api/friends/request ─────────────────────────────────────────────
exports.sendRequest = asyncHandler(async (req, res) => {
  const refId = normaliseRefId(req.body.refId);
  const uid = req.user._id;

  if (refId.length < 6) throw new AppError('Enter a valid friend code', 400);

  const target = await User.findOne({ refId });

  if (!target) throw new AppError('No one found with that code', 404);
  if (String(target._id) === String(uid)) throw new AppError('That\'s your own code', 400);

  const existing = await Friendship.findOne({
    $or: [
      { requester: uid, recipient: target._id },
      { requester: target._id, recipient: uid },
    ],
  });
  if (existing) throw new AppError('Friend request already exists', 409);

  const friendship = await Friendship.create({ requester: uid, recipient: target._id });

  await notifService.createAndPush({
    userId:  target._id,
    type:    'friend_request',
    title:   req.user.name,
    message: `${req.user.name} wants to be your accountability buddy`,
    data:    { friendshipId: friendship._id },
    category:   'Friend request',
    subtext:    'Wants to be your buddy',
    senderName: req.user.name,
    avatar:     req.user.avatar,
  });

  res.status(201).json({ success: true, message: 'Friend request sent', data: friendship });
});

// ── PATCH /api/friends/:id/accept ────────────────────────────────────────
exports.accept = asyncHandler(async (req, res) => {
  const f = await Friendship.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id, status: 'pending' },
    { status: 'accepted' },
    { new: true }
  ).populate('requester', 'name');

  if (!f) throw new AppError('Friend request not found', 404);

  await notifService.createAndPush({
    userId:  f.requester._id,
    type:    'friend_accepted',
    title:   req.user.name,
    message: `${req.user.name} is now your accountability buddy`,
    data:    { friendshipId: f._id },
    category:   'Friend request',
    subtext:    'Accepted your request',
    senderName: req.user.name,
    avatar:     req.user.avatar,
  });

  res.json({ success: true, data: f });
});

// ── PATCH /api/friends/:id/reject ────────────────────────────────────────
exports.reject = asyncHandler(async (req, res) => {
  const f = await Friendship.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (!f) throw new AppError('Friend request not found', 404);
  res.json({ success: true, message: 'Request declined' });
});

// ── DELETE /api/friends/:id ───────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const f = await Friendship.findOneAndDelete({
    _id: req.params.id,
    $or: [{ requester: uid }, { recipient: uid }],
  });
  if (!f) throw new AppError('Friendship not found', 404);
  res.json({ success: true, message: 'Friend removed' });
});
