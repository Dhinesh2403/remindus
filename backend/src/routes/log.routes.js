// backend/src/routes/log.routes.js
'use strict';

const router     = require('express').Router();
const rateLimit  = require('express-rate-limit');
const ctrl       = require('../controllers/log.controller');
const { authenticate } = require('../middlewares/auth');

// Guard against a misbehaving client flooding the log endpoint.
const logLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many log uploads.' },
});

router.post('/device', authenticate, logLimiter, ctrl.ingest);

module.exports = router;
