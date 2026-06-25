// backend/src/controllers/chat.controller.js
'use strict';

const mongoose   = require('mongoose');
const Message    = require('../models/Message');
const { conversationKey } = require('../models/Message');
const Friendship = require('../models/Friendship');
const User       = require('../models/User');
const { emitToUser } = require('../sockets');
const { asyncHandler, AppError } = require('../utils/helpers');

// ── Authorisation: the two users must be accepted friends ──────────────────
async function assertFriends(uid, friendId) {
  if (String(uid) === String(friendId)) throw new AppError('Invalid conversation', 400);
  const friendship = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: uid, recipient: friendId },
      { requester: friendId, recipient: uid },
    ],
  }).lean();
  if (!friendship) throw new AppError('You can only chat with friends', 403);
}

// Strip a message doc down to the shape the client expects.
function shape(m) {
  return {
    _id:       m._id,
    sender:    String(m.sender),
    recipient: String(m.recipient),
    text:      m.text,
    status:    m.status,
    deliveredAt: m.deliveredAt,
    readAt:    m.readAt,
    createdAt: m.createdAt,
  };
}

// ── GET /api/chat/conversations ───────────────────────────────────────────
// One row per accepted friend with the last message + unread count.
exports.getConversations = asyncHandler(async (req, res) => {
  const uid = req.user._id;

  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: uid }, { recipient: uid }],
  }).populate('requester recipient', 'name avatar email').lean();

  const conversations = await Promise.all(
    friendships.map(async (f) => {
      const friend = String(f.requester._id) === String(uid) ? f.recipient : f.requester;
      const convoId = conversationKey(uid, friend._id);

      const [last, unread] = await Promise.all([
        Message.findOne({ conversationId: convoId }).sort({ createdAt: -1 }).lean(),
        Message.countDocuments({
          conversationId: convoId,
          recipient: uid,
          status: { $ne: 'read' },
        }),
      ]);

      return {
        friendId:    String(friend._id),
        name:        friend.name,
        avatar:      friend.avatar || null,
        lastMessage: last ? shape(last) : null,
        unreadCount: unread,
      };
    })
  );

  // Most-recently-active conversations first.
  conversations.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });

  res.json({ success: true, conversations });
});

// ── GET /api/chat/:friendId/messages?before=&limit=30 ─────────────────────
exports.getMessages = asyncHandler(async (req, res) => {
  const uid      = req.user._id;
  const friendId = req.params.friendId;
  if (!mongoose.isValidObjectId(friendId)) throw new AppError('Invalid friend', 400);

  await assertFriends(uid, friendId);

  const limit  = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const convoId = conversationKey(uid, friendId);

  const query = { conversationId: convoId };
  if (req.query.before) {
    const beforeDate = new Date(req.query.before);
    if (!isNaN(beforeDate)) query.createdAt = { $lt: beforeDate };
  }

  // Newest-first slice, then return ascending for natural rendering.
  const docs = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  const messages = docs.reverse().map(shape);

  res.json({ success: true, messages, hasMore: docs.length === limit });
});

// ── POST /api/chat/:friendId/messages ─────────────────────────────────────
// REST fallback for sending (socket is the primary path). Persists + emits.
exports.sendMessage = asyncHandler(async (req, res) => {
  const uid      = req.user._id;
  const friendId = req.params.friendId;
  if (!mongoose.isValidObjectId(friendId)) throw new AppError('Invalid friend', 400);

  const text = String(req.body.text ?? '').trim();
  if (!text) throw new AppError('Message cannot be empty', 400);
  if (text.length > 4000) throw new AppError('Message is too long', 400);

  await assertFriends(uid, friendId);

  const msg = await Message.create({
    conversationId: conversationKey(uid, friendId),
    sender:    uid,
    recipient: friendId,
    text,
  });

  emitToUser(String(friendId), 'chat:message', { message: shape(msg) });

  res.status(201).json({ success: true, message: shape(msg) });
});

// ── PATCH /api/chat/:friendId/read ────────────────────────────────────────
// Mark all friend→me messages as read and notify the friend.
exports.markRead = asyncHandler(async (req, res) => {
  const uid      = req.user._id;
  const friendId = req.params.friendId;
  if (!mongoose.isValidObjectId(friendId)) throw new AppError('Invalid friend', 400);

  await assertFriends(uid, friendId);

  const result = await Message.updateMany(
    {
      conversationId: conversationKey(uid, friendId),
      recipient: uid,
      status: { $ne: 'read' },
    },
    { status: 'read', readAt: new Date() }
  );

  if (result.modifiedCount > 0) {
    emitToUser(String(friendId), 'chat:read', { byUserId: String(uid) });
  }

  res.json({ success: true, updated: result.modifiedCount });
});

// ── GET /api/chat/unread-count ────────────────────────────────────────────
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({
    recipient: req.user._id,
    status: { $ne: 'read' },
  });
  res.json({ success: true, count });
});
