// backend/src/controllers/friend.controller.js
'use strict';

const User       = require('../models/User');
const Reminder    = require('../models/Reminder');
const Friendship = require('../models/Friendship');
const notifService = require('../services/notification.service');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── GET /api/friends ──────────────────────────────────────────────────────
exports.getFriends = asyncHandler(async (req, res) => {
  const uid = req.user._id;

  // Accepted friendships
  const accepted = await Friendship.find({
    $or: [{ requester: uid, status: 'accepted' }, { recipient: uid, status: 'accepted' }],
  }).populate('requester recipient', 'name email avatar');

  // Pending requests sent TO this user
  const pending = await Friendship.find({ recipient: uid, status: 'pending' })
    .populate('requester', 'name email avatar');


  const friends = await Promise.all(
    accepted.map(async (f) => {
      const friend = String(f.requester._id) === String(uid) ? f.recipient : f.requester;
      const friendId = friend._id;

      const [sharedCount, pendingCount, doneCount, totalCount] = await Promise.all([
        Reminder.countDocuments({ userId: uid, assignedTo: friendId }),
        Reminder.countDocuments({ userId: uid, assignedTo: friendId, status: 'pending' }),
        Reminder.countDocuments({ assignedTo: friendId, assignedBy: uid, status: 'done' }),
        Reminder.countDocuments({ assignedTo: friendId, assignedBy: uid }),
      ]);

      return {
        _id:          friendId,
        friendshipId: f._id,
        name:         friend.name,
        email:        friend.email,
        avatar:       friend.avatar,
        username:     friend.email.split('@')[0],
        isOnline:     false,   // enhanced via Socket.IO room check
        completedCount: doneCount,
        sharedCount,
        pendingCount,
      };
    })
  );

  res.json({
    success: true,
    friends,
    pending: pending.map(p => ({
      _id:  p._id,
      name: p.requester.name,
      email:p.requester.email,
    })),
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
  const { query } = req.body;  // email or @username
  const uid = req.user._id;

  const emailOrUsername = query.startsWith('@') ? query.slice(1) : query;
  const target = await User.findOne({
    $or: [
      { email: emailOrUsername },
      { email: { $regex: `^${emailOrUsername}@`, $options: 'i' } },
    ],
  });

  if (!target) throw new AppError('User not found', 404);
  if (String(target._id) === String(uid)) throw new AppError('Cannot add yourself', 400);

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
    title:   '👋 New friend request',
    message: `${req.user.name} wants to be your accountability buddy`,
    data:    { friendshipId: friendship._id },
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
    title:   '🎉 Friend request accepted!',
    message: `${req.user.name} is now your accountability buddy`,
    data:    { friendshipId: f._id },
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
