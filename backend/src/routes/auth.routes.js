// backend/src/routes/auth.routes.js
'use strict';

const router  = require('express').Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const { validate }     = require('../middlewares/validate');

router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  ],
  validate,
  ctrl.register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  ctrl.login
);

router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  ctrl.refresh
);

router.post('/logout',  authenticate, ctrl.logout);
router.get('/me',       authenticate, ctrl.getMe);

router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  ctrl.forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  ctrl.resetPassword
);

router.post('/send-otp',   [body('email').isEmail()], validate, ctrl.sendOtp);
router.post('/verify-otp',
  [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 })],
  validate,
  ctrl.verifyOtp
);

module.exports = router;
