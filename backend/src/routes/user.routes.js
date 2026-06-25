// backend/src/routes/user.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth');
const { validate }     = require('../middlewares/validate');

router.use(authenticate);

router.get('/me',               ctrl.getProfile);
router.put('/me',               ctrl.updateProfile);
router.patch('/me/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password min 8 chars'),
  ],
  validate,
  ctrl.changePassword
);
router.put('/me/notif-prefs',   ctrl.updateNotifPrefs);
router.post('/me/avatar',       ctrl.uploadAvatar);
router.patch('/me/fcm-token',   ctrl.updateFcmToken);
router.delete('/me',            ctrl.deleteAccount);

module.exports = router;
