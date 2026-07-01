// backend/src/routes/app.routes.js
'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/app.controller');

// Public — must work before/independent of login and even when the DB session
// for a user is gone. Used by the client on boot to decide update/maintenance.
router.post('/version-check', ctrl.versionCheck);
router.get('/config',         ctrl.getConfig);

module.exports = router;
