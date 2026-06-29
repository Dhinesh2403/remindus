// backend/src/routes/auth.routes.js
'use strict';

const router  = require('express').Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const { validate }     = require('../middlewares/validate');

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  ctrl.login
);

// ── Google sign-in ─────────────────────────────────────────────────────────
// Accept either an ID token (native apps) or an access token (web / Google
// Identity Services) — require at least one.
router.post('/google',
  [
    body().custom((_value, { req }) => {
      if (!req.body.idToken && !req.body.accessToken) {
        throw new Error('Google credential required');
      }
      return true;
    }),
  ],
  validate,
  ctrl.googleAuth
);

// One-time password setup for Google (passwordless) accounts — authenticated.
router.post('/set-password',
  authenticate,
  [body('password').isLength({ min: 8 }).withMessage('Password min 8 chars')],
  validate,
  ctrl.setPassword
);

// ── Email signup (OTP-first): start → verify → set-password ────────────────
router.post('/signup/start',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
  ],
  validate,
  ctrl.signupStart
);

router.post('/signup/resend',
  [body('email').isEmail().normalizeEmail()],
  validate,
  ctrl.signupResend
);

router.post('/signup/verify',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code'),
  ],
  validate,
  ctrl.signupVerify
);

router.post('/signup/set-password',
  [
    body('setupToken').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  ],
  validate,
  ctrl.signupSetPassword
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
