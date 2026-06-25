// backend/src/routes/friend.routes.js
'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/friend.controller');
const { authenticate }  = require('../middlewares/auth');
const { validate }      = require('../middlewares/validate');

router.use(authenticate);

router.get('/',                                         ctrl.getFriends);
router.get('/lookup',                                   ctrl.lookupByRefId);
router.post('/request',
  [body('refId').trim().notEmpty().withMessage('Friend code is required')],
  validate,
  ctrl.sendRequest
);
router.patch('/:id/accept', ctrl.accept);
router.patch('/:id/reject', ctrl.reject);
router.delete('/:id',       ctrl.remove);

module.exports = router;
