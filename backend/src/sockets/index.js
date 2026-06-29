// backend/src/sockets/index.js
'use strict';

const { Server }    = require('socket.io');
const jwt           = require('jsonwebtoken');
const User          = require('../models/User');
const Friendship    = require('../models/Friendship');
const logger        = require('../utils/logger');

let io;

// ── Presence registry: userId → Set<socketId> ──────────────────────────────
// A user is "online" while they have at least one connected socket.
const presence = new Map();

function addSocket(userId, socketId) {
  let set = presence.get(userId);
  if (!set) { set = new Set(); presence.set(userId, set); }
  const wasOffline = set.size === 0;
  set.add(socketId);
  return wasOffline;                 // true if this is the user's first socket
}

function removeSocket(userId, socketId) {
  const set = presence.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) { presence.delete(userId); return true; }   // now offline
  return false;
}

function isOnline(userId) {
  const set = presence.get(String(userId));
  return !!set && set.size > 0;
}

// Accepted-friend ids for a user (for presence fan-out + chat list).
async function acceptedFriendIds(uid) {
  const rows = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: uid }, { recipient: uid }],
  }).select('requester recipient').lean();
  return rows.map(r =>
    String(r.requester) === String(uid) ? String(r.recipient) : String(r.requester)
  );
}

/**
 * Initialize Socket.IO with JWT authentication middleware
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.FRONTEND_URL || 'http://localhost:8100',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token missing'));

      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user    = await User.findById(payload.sub).lean();
      if (!user) return next(new Error('User not found'));

      socket.user   = user;
      socket.userId = String(user._id);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const uid = socket.userId;
    logger.info(`[Socket] User connected: ${uid} (${socket.id})`);

    // Join personal room for targeted messages
    socket.join(`user:${uid}`);

    // ── Presence: announce online + send current online friends ──────────
    const cameOnline = addSocket(uid, socket.id);
    try {
      const friendIds = await acceptedFriendIds(uid);
      if (cameOnline) {
        friendIds.forEach(fid =>
          io.to(`user:${fid}`).emit('presence:update', { userId: uid, online: true })
        );
      }
      // Tell the connecting client which of their friends are currently online.
      socket.emit('presence:state', {
        online: friendIds.filter(fid => isOnline(fid)),
      });
    } catch (e) {
      logger.warn('[Socket] presence init error:', e.message);
    }

    // ── Notification read receipt ────────────────────────────────────────
    socket.on('notification:read', async ({ notificationId }) => {
      try {
        const Notification = require('../models/Notification');
        await Notification.findByIdAndUpdate(notificationId, {
          isRead: true,
          readAt: new Date(),
        });
      } catch (e) {
        logger.warn('[Socket] notification:read error:', e.message);
      }
    });

    socket.on('reminder:typing', ({ friendId }) => {
      io.to(`user:${friendId}`).emit('friend:typing', { userId: uid });
    });

    // ── Chat: send a message ─────────────────────────────────────────────
    socket.on('chat:send', async ({ toUserId, tempId, text }) => {
      try {
        const Message = require('../models/Message');
        const { conversationKey } = require('../models/Message');
        const notifService = require('../services/notification.service');

        const body = String(text ?? '').trim();
        if (!body || body.length > 4000 || !toUserId) return;

        // Authorisation — must be accepted friends.
        const friendship = await Friendship.findOne({
          status: 'accepted',
          $or: [
            { requester: uid, recipient: toUserId },
            { requester: toUserId, recipient: uid },
          ],
        }).lean();
        if (!friendship) return;

        const recipientOnline = isOnline(toUserId);

        const msg = await Message.create({
          conversationId: conversationKey(uid, toUserId),
          sender:    uid,
          recipient: toUserId,
          text:      body,
          status:    recipientOnline ? 'delivered' : 'sent',
          deliveredAt: recipientOnline ? new Date() : null,
        });

        const shaped = {
          _id:       msg._id,
          sender:    String(msg.sender),
          recipient: String(msg.recipient),
          text:      msg.text,
          status:    msg.status,
          deliveredAt: msg.deliveredAt,
          readAt:    msg.readAt,
          createdAt: msg.createdAt,
        };

        // Deliver to recipient + acknowledge to sender (swaps the optimistic bubble).
        io.to(`user:${toUserId}`).emit('chat:message', { message: shaped });
        socket.emit('chat:ack', { tempId, message: shaped });

        if (recipientOnline) {
          socket.emit('chat:delivered', { messageId: String(msg._id) });
        } else {
          // Push only when the recipient isn't actively connected.
          notifService.pushChatMessage({
            recipientId: toUserId,
            senderName:  socket.user?.name || 'A friend',
            text:        body,
            senderId:    uid,
          }).catch(e => logger.warn('[Socket] chat push error:', e.message));
        }
      } catch (e) {
        logger.warn('[Socket] chat:send error:', e.message);
      }
    });

    // ── Chat: typing indicator ───────────────────────────────────────────
    socket.on('chat:typing', ({ toUserId, isTyping }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit('chat:typing', { fromUserId: uid, isTyping: !!isTyping });
    });

    // ── Chat: read receipt ───────────────────────────────────────────────
    socket.on('chat:read', async ({ fromUserId }) => {
      try {
        if (!fromUserId) return;
        const Message = require('../models/Message');
        const { conversationKey } = require('../models/Message');
        const result = await Message.updateMany(
          {
            conversationId: conversationKey(uid, fromUserId),
            recipient: uid,
            status: { $ne: 'read' },
          },
          { status: 'read', readAt: new Date() }
        );
        if (result.modifiedCount > 0) {
          io.to(`user:${fromUserId}`).emit('chat:read', { byUserId: uid });
        }
      } catch (e) {
        logger.warn('[Socket] chat:read error:', e.message);
      }
    });

    // ── Disconnect: announce offline when the last socket closes ─────────
    socket.on('disconnect', async (reason) => {
      logger.info(`[Socket] User disconnected: ${uid} — reason: ${reason}`);
      const wentOffline = removeSocket(uid, socket.id);
      if (wentOffline) {
        try {
          const friendIds = await acceptedFriendIds(uid);
          friendIds.forEach(fid =>
            io.to(`user:${fid}`).emit('presence:update', { userId: uid, online: false })
          );
        } catch (e) {
          logger.warn('[Socket] presence disconnect error:', e.message);
        }
      }
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance (use in controllers)
 */
function getIO() {
  return io;
}

/**
 * Emit an event to a specific user room
 */
function emitToUser(userId, event, data) {
  if (!io) { logger.warn('[Socket] io not initialized'); return; }
  io.to(`user:${userId}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitToUser, isOnline };
