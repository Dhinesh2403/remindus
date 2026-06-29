// backend/src/routes/chat.routes.js
'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/conversations',        ctrl.getConversations);
router.get('/unread-count',         ctrl.getUnreadCount);
router.get('/:friendId/messages',   ctrl.getMessages);
router.post('/:friendId/messages',  ctrl.sendMessage);
router.patch('/:friendId/read',     ctrl.markRead);

module.exports = router;
